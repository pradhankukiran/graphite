"""Neo4j client with async and sync operations for graph access."""

import asyncio
import json
import logging
import threading

from django.conf import settings
from neo4j import AsyncDriver, AsyncGraphDatabase, Driver, GraphDatabase

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Neo4j driver singleton with async and sync operations."""

    _instance = None
    _async_driver: AsyncDriver | None = None
    _sync_driver: Driver | None = None
    _async_lock = asyncio.Lock()
    _sync_lock = threading.Lock()

    @staticmethod
    def _driver_kwargs() -> dict:
        return {
            "auth": (settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            "max_connection_pool_size": 50,
            "connection_acquisition_timeout": 30,
        }

    @classmethod
    async def get_driver(cls) -> AsyncDriver:
        """Get or create the async Neo4j driver."""
        if cls._async_driver is None:
            async with cls._async_lock:
                if cls._async_driver is None:
                    cls._async_driver = AsyncGraphDatabase.driver(
                        settings.NEO4J_URI,
                        **cls._driver_kwargs(),
                    )
        return cls._async_driver

    @classmethod
    def get_sync_driver(cls) -> Driver:
        """Get or create the sync Neo4j driver."""
        if cls._sync_driver is None:
            with cls._sync_lock:
                if cls._sync_driver is None:
                    cls._sync_driver = GraphDatabase.driver(
                        settings.NEO4J_URI,
                        **cls._driver_kwargs(),
                    )
        return cls._sync_driver

    @staticmethod
    def _session_kwargs() -> dict:
        database = getattr(settings, "NEO4J_DATABASE", "")
        return {"database": database} if database else {}

    @classmethod
    async def close(cls) -> None:
        """Close the Neo4j driver and release resources."""
        if cls._async_driver:
            await cls._async_driver.close()
            cls._async_driver = None
        if cls._sync_driver:
            cls._sync_driver.close()
            cls._sync_driver = None

    @classmethod
    async def health_check(cls) -> dict:
        """Check Neo4j connectivity and return status."""
        try:
            driver = await cls.get_driver()
            async with driver.session(**cls._session_kwargs()) as session:
                result = await session.run("RETURN 1 AS ok")
                await result.single()
                return {"status": "healthy", "connected": True}
        except Exception as e:
            logger.warning("Neo4j health check failed: %s", e)
            return {"status": "unhealthy", "connected": False, "error": str(e)}

    @classmethod
    async def execute_read(cls, query: str, parameters: dict | None = None) -> list[dict]:
        """Execute a read query and return all records as dicts."""
        driver = await cls.get_driver()
        async with driver.session(**cls._session_kwargs()) as session:
            result = await session.run(query, parameters or {})
            return [record.data() async for record in result]

    @classmethod
    async def execute_write(cls, query: str, parameters: dict | None = None) -> list[dict]:
        """Execute a write query and return all records as dicts."""
        driver = await cls.get_driver()
        async with driver.session(**cls._session_kwargs()) as session:
            result = await session.run(query, parameters or {})
            return [record.data() async for record in result]

    @classmethod
    def execute_read_sync(cls, query: str, parameters: dict | None = None) -> list[dict]:
        """Execute a read query via the sync driver and return all records."""
        driver = cls.get_sync_driver()
        with driver.session(**cls._session_kwargs()) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    @classmethod
    def execute_write_sync(cls, query: str, parameters: dict | None = None) -> list[dict]:
        """Execute a write query via the sync driver and return all records."""
        driver = cls.get_sync_driver()
        with driver.session(**cls._session_kwargs()) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    # -----------------------------------------------------------------------
    # Helper: node/relationship counts
    # -----------------------------------------------------------------------

    @classmethod
    async def get_node_count(cls, label: str) -> int:
        """Return the count of nodes with the given label."""
        query = f"MATCH (n:`{label}`) RETURN count(n) AS cnt"
        rows = await cls.execute_read(query)
        return rows[0]["cnt"] if rows else 0

    @classmethod
    async def get_relationship_count(cls, rel_type: str) -> int:
        """Return the count of relationships with the given type."""
        query = f"MATCH ()-[r:`{rel_type}`]->() RETURN count(r) AS cnt"
        rows = await cls.execute_read(query)
        return rows[0]["cnt"] if rows else 0

    @classmethod
    async def get_graph_stats(cls) -> dict:
        """
        Return aggregate statistics for the graph.

        Returns a dict with:
            node_counts   – dict mapping label -> count
            rel_counts    – dict mapping type  -> count
            total_nodes   – int
            total_rels    – int
        """
        node_label_query = """
        CALL db.labels() YIELD label
        CALL {
            WITH label
            MATCH (n)
            WHERE label IN labels(n)
            RETURN count(n) AS cnt
        }
        RETURN label, cnt
        """
        rel_type_query = """
        CALL db.relationshipTypes() YIELD relationshipType AS type
        CALL {
            WITH type
            MATCH ()-[r]->()
            WHERE type(r) = type
            RETURN count(r) AS cnt
        }
        RETURN type, cnt
        """
        try:
            node_rows = await cls.execute_read(node_label_query)
            rel_rows = await cls.execute_read(rel_type_query)
        except Exception:
            # Fallback for older Neo4j versions
            node_rows = []
            for label in ("Chunk", "Entity"):
                cnt = await cls.get_node_count(label)
                node_rows.append({"label": label, "cnt": cnt})
            rel_rows = []
            for rt in ("MENTIONS", "RELATES_TO", "NEXT_CHUNK"):
                cnt = await cls.get_relationship_count(rt)
                rel_rows.append({"type": rt, "cnt": cnt})

        node_counts = {r["label"]: r["cnt"] for r in node_rows}
        rel_counts = {r["type"]: r["cnt"] for r in rel_rows}

        return {
            "node_counts": node_counts,
            "rel_counts": rel_counts,
            "total_nodes": sum(node_counts.values()),
            "total_rels": sum(rel_counts.values()),
        }

    @classmethod
    def get_graph_stats_sync(cls) -> dict:
        """Sync version of ``get_graph_stats`` for Celery and sync views."""
        node_label_query = """
        CALL db.labels() YIELD label
        CALL {
            WITH label
            MATCH (n)
            WHERE label IN labels(n)
            RETURN count(n) AS cnt
        }
        RETURN label, cnt
        """
        rel_type_query = """
        CALL db.relationshipTypes() YIELD relationshipType AS type
        CALL {
            WITH type
            MATCH ()-[r]->()
            WHERE type(r) = type
            RETURN count(r) AS cnt
        }
        RETURN type, cnt
        """
        try:
            node_rows = cls.execute_read_sync(node_label_query)
            rel_rows = cls.execute_read_sync(rel_type_query)
        except Exception:
            node_rows = []
            for label in ("Chunk", "Entity"):
                query = f"MATCH (n:`{label}`) RETURN count(n) AS cnt"
                rows = cls.execute_read_sync(query)
                node_rows.append({"label": label, "cnt": rows[0]["cnt"] if rows else 0})
            rel_rows = []
            for rel_type in ("MENTIONS", "RELATES_TO", "NEXT_CHUNK"):
                query = f"MATCH ()-[r:`{rel_type}`]->() RETURN count(r) AS cnt"
                rows = cls.execute_read_sync(query)
                rel_rows.append({"type": rel_type, "cnt": rows[0]["cnt"] if rows else 0})

        node_counts = {r["label"]: r["cnt"] for r in node_rows}
        rel_counts = {r["type"]: r["cnt"] for r in rel_rows}

        return {
            "node_counts": node_counts,
            "rel_counts": rel_counts,
            "total_nodes": sum(node_counts.values()),
            "total_rels": sum(rel_counts.values()),
        }

    # -----------------------------------------------------------------------
    # Document-level operations
    # -----------------------------------------------------------------------

    @classmethod
    async def clear_document_data(cls, document_id: str) -> None:
        """Delete all chunks and orphaned entities for a document."""
        # Delete chunks (and their relationships) belonging to the document
        delete_chunks_query = """
        MATCH (c:Chunk {document_id: $document_id})
        DETACH DELETE c
        """
        await cls.execute_write(delete_chunks_query, {"document_id": document_id})

        # Delete entities that were only sourced from this document
        delete_orphan_entities_query = """
        MATCH (e:Entity)
        WHERE $document_id IN e.source_document_ids
        WITH e,
             [sid IN e.source_document_ids WHERE sid <> $document_id] AS remaining
        SET e.source_document_ids = remaining
        WITH e
        WHERE size(e.source_document_ids) = 0
            AND NOT EXISTS { (e)<-[:MENTIONS]-(:Chunk) }
        DETACH DELETE e
        """
        await cls.execute_write(delete_orphan_entities_query, {"document_id": document_id})

    @classmethod
    def clear_document_data_sync(cls, document_id: str) -> None:
        """Sync version of ``clear_document_data`` for sync callers."""
        delete_chunks_query = """
        MATCH (c:Chunk {document_id: $document_id})
        DETACH DELETE c
        """
        cls.execute_write_sync(delete_chunks_query, {"document_id": document_id})

        delete_orphan_entities_query = """
        MATCH (e:Entity)
        WHERE $document_id IN e.source_document_ids
        WITH e,
             [sid IN e.source_document_ids WHERE sid <> $document_id] AS remaining
        SET e.source_document_ids = remaining
        WITH e
        WHERE size(e.source_document_ids) = 0
            AND NOT EXISTS { (e)<-[:MENTIONS]-(:Chunk) }
        DETACH DELETE e
        """
        cls.execute_write_sync(delete_orphan_entities_query, {"document_id": document_id})

    # -----------------------------------------------------------------------
    # Chunk operations
    # -----------------------------------------------------------------------

    @classmethod
    async def store_chunk(cls, chunk_data: dict) -> list[dict]:
        """
        Create or merge a Chunk node.

        Expected keys in chunk_data:
            id, document_id, text, index, embedding, page_number, section
        """
        query = """
        MERGE (c:Chunk {id: $id})
        SET c.document_id = $document_id,
            c.text         = $text,
            c.index        = $index,
            c.embedding    = $embedding,
            c.page_number  = $page_number,
            c.section      = $section
        RETURN c {.id, .document_id, .index} AS chunk
        """
        return await cls.execute_write(query, {
            "id": chunk_data["id"],
            "document_id": chunk_data["document_id"],
            "text": chunk_data["text"],
            "index": chunk_data.get("index", 0),
            "embedding": chunk_data.get("embedding"),
            "page_number": chunk_data.get("page_number"),
            "section": chunk_data.get("section"),
        })

    @classmethod
    def store_chunk_sync(cls, chunk_data: dict) -> list[dict]:
        """Sync version of ``store_chunk`` for Celery workers."""
        query = """
        MERGE (c:Chunk {id: $id})
        SET c.document_id = $document_id,
            c.text         = $text,
            c.index        = $index,
            c.embedding    = $embedding,
            c.page_number  = $page_number,
            c.section      = $section
        RETURN c {.id, .document_id, .index} AS chunk
        """
        return cls.execute_write_sync(query, {
            "id": chunk_data["id"],
            "document_id": chunk_data["document_id"],
            "text": chunk_data["text"],
            "index": chunk_data.get("index", 0),
            "embedding": chunk_data.get("embedding"),
            "page_number": chunk_data.get("page_number"),
            "section": chunk_data.get("section"),
        })

    # -----------------------------------------------------------------------
    # Entity operations
    # -----------------------------------------------------------------------

    @classmethod
    async def store_entity(cls, entity_data: dict) -> list[dict]:
        """
        Create or merge an Entity node.

        Expected keys in entity_data:
            id, name, type, description, source_document_ids, properties
        """
        query = """
        MERGE (e:Entity {id: $id})
        SET e.name                = $name,
            e.type                = $type,
            e.description         = $description,
            e.source_document_ids = $source_document_ids,
            e.properties          = $properties
        RETURN e {.id, .name, .type} AS entity
        """
        properties = entity_data.get("properties", "{}")
        if not isinstance(properties, str):
            properties = json.dumps(properties)

        return await cls.execute_write(query, {
            "id": entity_data["id"],
            "name": entity_data["name"],
            "type": entity_data.get("type", "Unknown"),
            "description": entity_data.get("description", ""),
            "source_document_ids": entity_data.get("source_document_ids", []),
            "properties": properties,
        })

    @classmethod
    def store_entity_sync(cls, entity_data: dict) -> list[dict]:
        """Sync version of ``store_entity`` for Celery workers."""
        query = """
        MERGE (e:Entity {id: $id})
        SET e.name                = $name,
            e.type                = $type,
            e.description         = $description,
            e.source_document_ids = $source_document_ids,
            e.properties          = $properties
        RETURN e {.id, .name, .type} AS entity
        """
        properties = entity_data.get("properties", "{}")
        if not isinstance(properties, str):
            properties = json.dumps(properties)

        return cls.execute_write_sync(query, {
            "id": entity_data["id"],
            "name": entity_data["name"],
            "type": entity_data.get("type", "Unknown"),
            "description": entity_data.get("description", ""),
            "source_document_ids": entity_data.get("source_document_ids", []),
            "properties": properties,
        })

    # -----------------------------------------------------------------------
    # Relationship operations
    # -----------------------------------------------------------------------

    @classmethod
    async def create_relationship(
        cls,
        from_id: str,
        to_id: str,
        rel_type: str,
        properties: dict | None = None,
    ) -> list[dict]:
        """
        Create a relationship between two nodes identified by their `id` property.

        Supported rel_types: MENTIONS, RELATES_TO, NEXT_CHUNK.
        Extra properties are set on the relationship.
        """
        props = properties or {}

        if rel_type == "MENTIONS":
            query = """
            MATCH (from:Chunk {id: $from_id})
            MATCH (to:Entity {id: $to_id})
            MERGE (from)-[r:MENTIONS]->(to)
            SET r += $props
            RETURN type(r) AS rel_type
            """
        elif rel_type == "RELATES_TO":
            query = """
            MATCH (from:Entity {id: $from_id})
            MATCH (to:Entity {id: $to_id})
            MERGE (from)-[r:RELATES_TO]->(to)
            SET r += $props
            RETURN type(r) AS rel_type
            """
        elif rel_type == "NEXT_CHUNK":
            query = """
            MATCH (from:Chunk {id: $from_id})
            MATCH (to:Chunk {id: $to_id})
            MERGE (from)-[r:NEXT_CHUNK]->(to)
            RETURN type(r) AS rel_type
            """
        else:
            # Generic fallback
            query = f"""
            MATCH (from {{id: $from_id}})
            MATCH (to {{id: $to_id}})
            MERGE (from)-[r:`{rel_type}`]->(to)
            SET r += $props
            RETURN type(r) AS rel_type
            """

        return await cls.execute_write(query, {
            "from_id": from_id,
            "to_id": to_id,
            "props": props,
        })

    @classmethod
    def create_relationship_sync(
        cls,
        from_id: str,
        to_id: str,
        rel_type: str,
        properties: dict | None = None,
    ) -> list[dict]:
        """Sync version of ``create_relationship`` for Celery workers."""
        props = properties or {}

        if rel_type == "MENTIONS":
            query = """
            MATCH (from:Chunk {id: $from_id})
            MATCH (to:Entity {id: $to_id})
            MERGE (from)-[r:MENTIONS]->(to)
            SET r += $props
            RETURN type(r) AS rel_type
            """
        elif rel_type == "RELATES_TO":
            query = """
            MATCH (from:Entity {id: $from_id})
            MATCH (to:Entity {id: $to_id})
            MERGE (from)-[r:RELATES_TO]->(to)
            SET r += $props
            RETURN type(r) AS rel_type
            """
        elif rel_type == "NEXT_CHUNK":
            query = """
            MATCH (from:Chunk {id: $from_id})
            MATCH (to:Chunk {id: $to_id})
            MERGE (from)-[r:NEXT_CHUNK]->(to)
            RETURN type(r) AS rel_type
            """
        else:
            query = f"""
            MATCH (from {{id: $from_id}})
            MATCH (to {{id: $to_id}})
            MERGE (from)-[r:`{rel_type}`]->(to)
            SET r += $props
            RETURN type(r) AS rel_type
            """

        return cls.execute_write_sync(query, {
            "from_id": from_id,
            "to_id": to_id,
            "props": props,
        })

    # -----------------------------------------------------------------------
    # Vector search
    # -----------------------------------------------------------------------

    @classmethod
    async def vector_search(
        cls,
        embedding: list[float],
        top_k: int = 5,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        """
        Perform a vector similarity search against the chunk_embedding_index.

        Returns up to `top_k` chunks ordered by similarity.
        Optionally filter by document_ids.
        """
        if document_ids:
            query = """
            CALL db.index.vector.queryNodes('chunk_embedding_index', $top_k, $embedding)
            YIELD node, score
            WHERE node.document_id IN $document_ids
            RETURN node {.id, .document_id, .text, .index, .page_number, .section} AS chunk,
                   score
            ORDER BY score DESC
            """
            params = {"embedding": embedding, "top_k": top_k, "document_ids": document_ids}
        else:
            query = """
            CALL db.index.vector.queryNodes('chunk_embedding_index', $top_k, $embedding)
            YIELD node, score
            RETURN node {.id, .document_id, .text, .index, .page_number, .section} AS chunk,
                   score
            ORDER BY score DESC
            """
            params = {"embedding": embedding, "top_k": top_k}

        return await cls.execute_read(query, params)

    # -----------------------------------------------------------------------
    # Graph traversal
    # -----------------------------------------------------------------------

    @classmethod
    async def get_entity_neighborhood(cls, entity_id: str, depth: int = 1) -> dict:
        """
        Get an entity and its connected entities up to the given depth.

        Returns:
            {
                "center": {id, name, type, description, properties},
                "nodes":  [{id, name, type, description}, ...],
                "relationships": [{source, target, type, description, weight}, ...],
            }
        """
        query = """
        MATCH (center:Entity {id: $entity_id})
        CALL {
            WITH center
            MATCH path = (center)-[r:RELATES_TO*1..$depth]-(neighbor:Entity)
            UNWIND relationships(path) AS rel
            WITH DISTINCT rel,
                 startNode(rel) AS src,
                 endNode(rel) AS tgt
            RETURN collect(DISTINCT {
                id:          tgt.id,
                name:        tgt.name,
                type:        tgt.type,
                description: tgt.description
            }) + collect(DISTINCT {
                id:          src.id,
                name:        src.name,
                type:        src.type,
                description: src.description
            }) AS neighbor_nodes,
            collect(DISTINCT {
                source:      src.id,
                target:      tgt.id,
                type:        rel.type,
                description: rel.description,
                weight:      rel.weight
            }) AS rels
        }
        RETURN center {.id, .name, .type, .description, .properties} AS center,
               neighbor_nodes,
               rels
        """
        # Neo4j doesn't allow parameterised path lengths in all versions,
        # so we inline the depth safely (integer only).
        safe_depth = max(1, min(int(depth), 5))
        expanded_query = query.replace("$depth", str(safe_depth))

        rows = await cls.execute_read(expanded_query, {"entity_id": entity_id})
        if not rows:
            return {"center": None, "nodes": [], "relationships": []}

        row = rows[0]
        center = row["center"]
        neighbor_nodes = row.get("neighbor_nodes", [])
        rels = row.get("rels", [])

        # Deduplicate nodes — include center
        seen_ids: set[str] = set()
        unique_nodes: list[dict] = []
        for n in [center, *neighbor_nodes]:
            if n and n.get("id") and n["id"] not in seen_ids:
                seen_ids.add(n["id"])
                unique_nodes.append(n)

        return {
            "center": center,
            "nodes": unique_nodes,
            "relationships": rels,
        }

    @classmethod
    def get_entity_neighborhood_sync(cls, entity_id: str, depth: int = 1) -> dict:
        """Sync version of ``get_entity_neighborhood`` for sync views."""
        query = """
        MATCH (center:Entity {id: $entity_id})
        CALL {
            WITH center
            MATCH path = (center)-[r:RELATES_TO*1..$depth]-(neighbor:Entity)
            UNWIND relationships(path) AS rel
            WITH DISTINCT rel,
                 startNode(rel) AS src,
                 endNode(rel) AS tgt
            RETURN collect(DISTINCT {
                id:          tgt.id,
                name:        tgt.name,
                type:        tgt.type,
                description: tgt.description
            }) + collect(DISTINCT {
                id:          src.id,
                name:        src.name,
                type:        src.type,
                description: src.description
            }) AS neighbor_nodes,
            collect(DISTINCT {
                source:      src.id,
                target:      tgt.id,
                type:        rel.type,
                description: rel.description,
                weight:      rel.weight
            }) AS rels
        }
        RETURN center {.id, .name, .type, .description, .properties} AS center,
               neighbor_nodes,
               rels
        """
        safe_depth = max(1, min(int(depth), 5))
        expanded_query = query.replace("$depth", str(safe_depth))

        rows = cls.execute_read_sync(expanded_query, {"entity_id": entity_id})
        if not rows:
            return {"center": None, "nodes": [], "relationships": []}

        row = rows[0]
        center = row["center"]
        neighbor_nodes = row.get("neighbor_nodes", [])
        rels = row.get("rels", [])

        seen_ids: set[str] = set()
        unique_nodes: list[dict] = []
        for node in [center, *neighbor_nodes]:
            if node and node.get("id") and node["id"] not in seen_ids:
                seen_ids.add(node["id"])
                unique_nodes.append(node)

        return {
            "center": center,
            "nodes": unique_nodes,
            "relationships": rels,
        }

    # -----------------------------------------------------------------------
    # Visualization data
    # -----------------------------------------------------------------------

    @classmethod
    async def get_visualization_data(
        cls,
        document_ids: list[str] | None = None,
        limit: int = 500,
    ) -> dict:
        """
        Return nodes and edges suitable for react-force-graph rendering.

        Returns:
            {"nodes": [...], "relationships": [...]}
        """
        if document_ids:
            node_query = """
            MATCH (c:Chunk)
            WHERE c.document_id IN $document_ids
            OPTIONAL MATCH (c)-[:MENTIONS]->(e:Entity)
            WITH collect(DISTINCT {
                id:   c.id,
                name: 'Chunk #' + toString(c.index),
                type: 'Chunk',
                description: left(c.text, 120),
                document_id: c.document_id
            }) AS chunk_nodes,
            collect(DISTINCT {
                id:          e.id,
                name:        e.name,
                type:        e.type,
                description: e.description
            }) AS entity_nodes
            RETURN chunk_nodes, entity_nodes
            """
            rel_query = """
            MATCH (c:Chunk)
            WHERE c.document_id IN $document_ids
            OPTIONAL MATCH (c)-[r1]->(t1)
            WITH collect(DISTINCT {
                source: c.id,
                target: t1.id,
                type:   type(r1),
                description: r1.description,
                weight: r1.weight
            }) AS chunk_rels
            MATCH (c2:Chunk)
            WHERE c2.document_id IN $document_ids
            OPTIONAL MATCH (c2)-[:MENTIONS]->(e:Entity)
            WITH chunk_rels, collect(DISTINCT e) AS entities
            UNWIND entities AS e1
            OPTIONAL MATCH (e1)-[r2:RELATES_TO]->(e2:Entity)
            WHERE e2 IN entities
            WITH chunk_rels, collect(DISTINCT {
                source:      e1.id,
                target:      e2.id,
                type:        type(r2),
                description: r2.description,
                weight:      r2.weight
            }) AS entity_rels
            RETURN chunk_rels + entity_rels AS relationships
            """
            params: dict = {"document_ids": document_ids, "limit": limit}
        else:
            node_query = """
            MATCH (e:Entity)
            WITH collect(DISTINCT {
                id:          e.id,
                name:        e.name,
                type:        e.type,
                description: e.description
            })[0..$limit] AS entity_nodes
            RETURN [] AS chunk_nodes, entity_nodes
            """
            rel_query = """
            MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
            RETURN DISTINCT
                e1.id         AS source,
                e2.id         AS target,
                type(r)       AS type,
                r.description AS description,
                r.weight      AS weight
            LIMIT $limit
            """
            params = {"limit": limit}

        node_rows = await cls.execute_read(node_query, params)
        rel_rows = await cls.execute_read(rel_query, params)

        # Flatten node results
        nodes: list[dict] = []
        if node_rows:
            row = node_rows[0]
            for n in row.get("chunk_nodes", []):
                if n and n.get("id"):
                    nodes.append(n)
            for n in row.get("entity_nodes", []):
                if n and n.get("id"):
                    nodes.append(n)

        # Flatten relationship results
        relationships: list[dict] = []
        if rel_rows:
            if "relationships" in rel_rows[0]:
                # Aggregated format
                for r in rel_rows[0]["relationships"]:
                    if r and r.get("source") and r.get("target"):
                        relationships.append(r)
            else:
                # Row-per-relationship format
                for r in rel_rows:
                    if r and r.get("source") and r.get("target"):
                        relationships.append(r)

        return {
            "nodes": nodes[:limit],
            "relationships": relationships[:limit],
        }

    @classmethod
    def get_visualization_data_sync(
        cls,
        document_ids: list[str] | None = None,
        limit: int = 500,
    ) -> dict:
        """Sync version of ``get_visualization_data`` for sync views."""
        if document_ids:
            node_query = """
            MATCH (c:Chunk)
            WHERE c.document_id IN $document_ids
            OPTIONAL MATCH (c)-[:MENTIONS]->(e:Entity)
            WITH collect(DISTINCT {
                id:   c.id,
                name: 'Chunk #' + toString(c.index),
                type: 'Chunk',
                description: left(c.text, 120),
                document_id: c.document_id
            }) AS chunk_nodes,
            collect(DISTINCT {
                id:          e.id,
                name:        e.name,
                type:        e.type,
                description: e.description
            }) AS entity_nodes
            RETURN chunk_nodes, entity_nodes
            """
            rel_query = """
            MATCH (c:Chunk)
            WHERE c.document_id IN $document_ids
            OPTIONAL MATCH (c)-[r1]->(t1)
            WITH collect(DISTINCT {
                source: c.id,
                target: t1.id,
                type:   type(r1),
                description: r1.description,
                weight: r1.weight
            }) AS chunk_rels
            MATCH (c2:Chunk)
            WHERE c2.document_id IN $document_ids
            OPTIONAL MATCH (c2)-[:MENTIONS]->(e:Entity)
            WITH chunk_rels, collect(DISTINCT e) AS entities
            UNWIND entities AS e1
            OPTIONAL MATCH (e1)-[r2:RELATES_TO]->(e2:Entity)
            WHERE e2 IN entities
            WITH chunk_rels, collect(DISTINCT {
                source:      e1.id,
                target:      e2.id,
                type:        type(r2),
                description: r2.description,
                weight:      r2.weight
            }) AS entity_rels
            RETURN chunk_rels + entity_rels AS relationships
            """
            params: dict = {"document_ids": document_ids, "limit": limit}
        else:
            node_query = """
            MATCH (e:Entity)
            WITH collect(DISTINCT {
                id:          e.id,
                name:        e.name,
                type:        e.type,
                description: e.description
            })[0..$limit] AS entity_nodes
            RETURN [] AS chunk_nodes, entity_nodes
            """
            rel_query = """
            MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
            RETURN DISTINCT
                e1.id         AS source,
                e2.id         AS target,
                type(r)       AS type,
                r.description AS description,
                r.weight      AS weight
            LIMIT $limit
            """
            params = {"limit": limit}

        node_rows = cls.execute_read_sync(node_query, params)
        rel_rows = cls.execute_read_sync(rel_query, params)

        nodes: list[dict] = []
        if node_rows:
            row = node_rows[0]
            for node in row.get("chunk_nodes", []):
                if node and node.get("id"):
                    nodes.append(node)
            for node in row.get("entity_nodes", []):
                if node and node.get("id"):
                    nodes.append(node)

        relationships: list[dict] = []
        if rel_rows:
            if "relationships" in rel_rows[0]:
                for rel in rel_rows[0]["relationships"]:
                    if rel and rel.get("source") and rel.get("target"):
                        relationships.append(rel)
            else:
                for rel in rel_rows:
                    if rel and rel.get("source") and rel.get("target"):
                        relationships.append(rel)

        return {
            "nodes": nodes[:limit],
            "relationships": relationships[:limit],
        }
