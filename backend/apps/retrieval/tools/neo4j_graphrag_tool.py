"""Neo4j GraphRAG tool -- entity-first graph reasoning with multi-hop traversal."""

from __future__ import annotations

import logging
import re
import time
from itertools import combinations

from .base import BaseGraphTool, GraphToolResult, RetrievedContext

logger = logging.getLogger(__name__)

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "between",
    "by",
    "can",
    "do",
    "does",
    "for",
    "from",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "the",
    "their",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
}


class Neo4jGraphRAGTool(BaseGraphTool):
    """Graph retrieval centered on entities, relationships, and supporting chunks."""

    tool_name = "neo4j_graphrag"
    description = (
        "Entity-first GraphRAG with query-entity matching, multi-hop relationship "
        "paths, and supporting document chunks"
    )

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        document_ids: list[str] | None = None,
    ) -> GraphToolResult:
        start = time.time()
        try:
            direct_matches = await self._search_query_entities(
                query=query,
                limit=max(4, top_k),
                document_ids=document_ids,
            )
            chunk_seeds = await self._discover_entities_from_chunks(
                query=query,
                limit=max(4, top_k),
                document_ids=document_ids,
            )

            seeds = self._merge_seed_entities(
                direct_matches=direct_matches,
                chunk_matches=chunk_seeds,
                limit=max(4, top_k),
            )
            if not seeds:
                return await self._vector_fallback(query, top_k, document_ids, start)

            seed_ids = [seed["id"] for seed in seeds]
            direct_relationships = await self._fetch_direct_relationships(
                entity_ids=seed_ids,
                limit=max(top_k * 4, 8),
                document_ids=document_ids,
            )
            path_results = await self._fetch_shortest_paths(
                entity_ids=seed_ids,
                max_pairs=max(3, top_k),
            )

            nodes = self._build_node_map(seeds, direct_relationships, path_results)
            relationships = self._build_relationships(direct_relationships, path_results)
            supporting_chunks = await self._fetch_supporting_chunks(
                entity_ids=list(nodes.keys()),
                limit=max(top_k, 4),
                document_ids=document_ids,
            )

            graph_summary = self._build_graph_summary(
                seeds=seeds,
                nodes=nodes,
                relationships=relationships,
                paths=path_results,
                supporting_chunks=supporting_chunks,
            )
            path_contexts = self._build_path_contexts(path_results, top_k=top_k)
            chunk_contexts = self._build_chunk_contexts(supporting_chunks, top_k=top_k)

            contexts = [
                RetrievedContext(
                    text=self._format_graph_context(graph_summary, seeds, nodes, relationships),
                    score=1.0,
                    source="Knowledge Graph",
                    metadata={
                        "kind": "graph_summary",
                        "matched_entities": [seed["name"] for seed in seeds],
                    },
                ),
                *path_contexts,
                *chunk_contexts,
            ]

            latency = (time.time() - start) * 1000
            return GraphToolResult(
                contexts=contexts,
                tool_name=self.tool_name,
                query=query,
                latency_ms=latency,
                metadata={
                    "retrieval_mode": "entity_first_graph_reasoning",
                    "matched_entities": [
                        {
                            "id": seed["id"],
                            "name": seed["name"],
                            "type": seed["type"],
                            "score": round(seed["score"], 3),
                            "match_sources": sorted(seed["match_sources"]),
                        }
                        for seed in seeds
                    ],
                    "path_count": len(path_results),
                    "supporting_chunk_count": len(supporting_chunks),
                    "graph_context": {
                        "entities": self._format_graph_nodes(nodes),
                        "relationships": self._format_graph_relationships(relationships),
                        "subgraph_summary": graph_summary,
                    },
                },
            )
        except Exception as exc:
            logger.error("Neo4j GraphRAG retrieval failed: %s", exc, exc_info=True)
            latency = (time.time() - start) * 1000
            return GraphToolResult(
                contexts=[],
                tool_name=self.tool_name,
                query=query,
                latency_ms=latency,
                metadata={"error": str(exc)},
            )

    async def _search_query_entities(
        self,
        query: str,
        limit: int,
        document_ids: list[str] | None,
    ) -> list[dict]:
        from apps.knowledge_graph.neo4j_client import Neo4jClient

        terms = self._extract_query_terms(query)
        exact_match_cypher = """
        MATCH (e:Entity)
        WHERE (
            toLower(e.name) IN $terms
            OR (
                size(split(e.name, ' ')) > 1
                AND toLower($raw_query) CONTAINS toLower(e.name)
            )
        )
          AND (
            $has_document_filter = false
            OR ANY(doc_id IN $document_ids WHERE doc_id IN coalesce(e.source_document_ids, []))
          )
        RETURN e {
            .id, .name, .type, .description, .source_document_ids
        } AS entity,
        CASE
            WHEN toLower(e.name) IN $terms THEN 6.0
            WHEN size(split(e.name, ' ')) > 1
              AND toLower($raw_query) CONTAINS toLower(e.name)
            THEN 4.0
            ELSE 0.0
        END + (1.0 / (1 + size(split(e.name, ' ')))) AS score
        ORDER BY score DESC, size(split(entity.name, ' ')) ASC, entity.name
        LIMIT $limit
        """
        exact_rows = await Neo4jClient.execute_read(
            exact_match_cypher,
            {
                "raw_query": query.lower(),
                "terms": terms,
                "limit": limit,
                "document_ids": document_ids or [],
                "has_document_filter": bool(document_ids),
            },
        )
        if exact_rows:
            return [
                {
                    **row["entity"],
                    "score": float(row.get("score", 0.0)),
                    "match_source": "query_match",
                }
                for row in exact_rows
                if row.get("entity")
            ]

        fulltext_query = self._build_fulltext_query(query)
        params = {
            "query": fulltext_query,
            "limit": limit,
            "document_ids": document_ids or [],
            "has_document_filter": bool(document_ids),
        }
        cypher = """
        CALL db.index.fulltext.queryNodes('entity_name_fulltext', $query)
        YIELD node, score
        WHERE $has_document_filter = false
           OR ANY(doc_id IN $document_ids WHERE doc_id IN coalesce(node.source_document_ids, []))
        RETURN node {
            .id, .name, .type, .description, .source_document_ids
        } AS entity,
        score
        ORDER BY score DESC
        LIMIT $limit
        """

        try:
            rows = await Neo4jClient.execute_read(cypher, params)
        except Exception as exc:
            logger.warning("Fulltext entity search failed, falling back to CONTAINS: %s", exc)
            rows = []

        if rows:
            return [
                {
                    **row["entity"],
                    "score": float(row.get("score", 0.0)) * 2.0,
                    "match_source": "query_match",
                }
                for row in rows
                if row.get("entity")
            ]

        if not terms:
            return []

        fallback_cypher = """
        MATCH (e:Entity)
        WITH e,
             reduce(
               score = 0.0,
               term IN $terms |
                 score + CASE
                   WHEN toLower(e.name) CONTAINS term
                     OR toLower(coalesce(e.description, '')) CONTAINS term
                   THEN 1.0
                   ELSE 0.0
                 END
             ) AS match_score
        WHERE match_score > 0
          AND (
            $has_document_filter = false
            OR ANY(doc_id IN $document_ids WHERE doc_id IN coalesce(e.source_document_ids, []))
          )
        RETURN e {
            .id, .name, .type, .description, .source_document_ids
        } AS entity,
        match_score AS score
        ORDER BY score DESC, entity.name
        LIMIT $limit
        """
        fallback_rows = await Neo4jClient.execute_read(
            fallback_cypher,
            {
                "terms": terms,
                "limit": limit,
                "document_ids": document_ids or [],
                "has_document_filter": bool(document_ids),
            },
        )
        return [
            {
                **row["entity"],
                "score": float(row.get("score", 0.0)) * 1.5,
                "match_source": "query_contains",
            }
            for row in fallback_rows
            if row.get("entity")
        ]

    async def _discover_entities_from_chunks(
        self,
        query: str,
        limit: int,
        document_ids: list[str] | None,
    ) -> list[dict]:
        from apps.knowledge_graph.neo4j_client import Neo4jClient
        from apps.retrieval.embeddings import EmbeddingService

        query_embedding = EmbeddingService.embed_single(query)
        chunk_hits = await Neo4jClient.vector_search(
            embedding=query_embedding,
            top_k=max(limit, 4),
            document_ids=document_ids,
        )
        rows = [
            {
                "chunk_id": row.get("chunk", {}).get("id"),
                "score": float(row.get("score", 0.0)),
            }
            for row in chunk_hits
            if row.get("chunk", {}).get("id")
        ]
        if not rows:
            return []

        cypher = """
        UNWIND $rows AS row
        MATCH (c:Chunk {id: row.chunk_id})-[:MENTIONS]->(e:Entity)
        WHERE $has_document_filter = false
           OR ANY(doc_id IN $document_ids WHERE doc_id IN coalesce(e.source_document_ids, []))
        WITH e,
             sum(row.score) AS graph_score,
             count(DISTINCT c) AS supporting_chunks
        RETURN e {
            .id, .name, .type, .description, .source_document_ids
        } AS entity,
        graph_score AS score,
        supporting_chunks
        ORDER BY score DESC, supporting_chunks DESC, entity.name
        LIMIT $limit
        """
        entity_rows = await Neo4jClient.execute_read(
            cypher,
            {
                "rows": rows,
                "limit": limit,
                "document_ids": document_ids or [],
                "has_document_filter": bool(document_ids),
            },
        )
        return [
            {
                **row["entity"],
                "score": float(row.get("score", 0.0)),
                "match_source": "chunk_mentions",
                "supporting_chunks": int(row.get("supporting_chunks", 0)),
            }
            for row in entity_rows
            if row.get("entity")
        ]

    @staticmethod
    def _merge_seed_entities(
        *,
        direct_matches: list[dict],
        chunk_matches: list[dict],
        limit: int,
    ) -> list[dict]:
        merged: dict[str, dict] = {}
        for entry in [*direct_matches, *chunk_matches]:
            entity_id = entry["id"]
            current = merged.setdefault(
                entity_id,
                {
                    "id": entity_id,
                    "name": entry.get("name", ""),
                    "type": entry.get("type", "Unknown"),
                    "description": entry.get("description", ""),
                    "source_document_ids": entry.get("source_document_ids", []),
                    "score": 0.0,
                    "match_sources": set(),
                },
            )
            current["score"] += float(entry.get("score", 0.0))
            current["match_sources"].add(entry.get("match_source", "unknown"))
        ranked = sorted(
            merged.values(),
            key=lambda entity: (
                entity["score"],
                len(entity["match_sources"]),
                entity["name"],
            ),
            reverse=True,
        )
        return ranked[:limit]

    async def _fetch_direct_relationships(
        self,
        entity_ids: list[str],
        limit: int,
        document_ids: list[str] | None,
    ) -> list[dict]:
        from apps.knowledge_graph.neo4j_client import Neo4jClient

        if not entity_ids:
            return []

        cypher = """
        MATCH (seed:Entity)-[r:RELATES_TO]-(neighbor:Entity)
        WHERE seed.id IN $entity_ids
          AND (
            $has_document_filter = false
            OR ANY(doc_id IN $document_ids WHERE doc_id IN coalesce(neighbor.source_document_ids, []))
          )
        RETURN seed {
            .id, .name, .type, .description, .source_document_ids
        } AS seed,
        neighbor {
            .id, .name, .type, .description, .source_document_ids
        } AS neighbor,
        {
            source: startNode(r).id,
            target: endNode(r).id,
            type: coalesce(r.type, 'RELATED_TO'),
            description: coalesce(r.description, ''),
            weight: coalesce(r.weight, 1.0)
        } AS relationship
        ORDER BY relationship.weight DESC, seed.name, neighbor.name
        LIMIT $limit
        """
        return await Neo4jClient.execute_read(
            cypher,
            {
                "entity_ids": entity_ids,
                "limit": limit,
                "document_ids": document_ids or [],
                "has_document_filter": bool(document_ids),
            },
        )

    async def _fetch_shortest_paths(
        self,
        entity_ids: list[str],
        max_pairs: int,
    ) -> list[dict]:
        from apps.knowledge_graph.neo4j_client import Neo4jClient

        pairs = [
            {"source_id": source_id, "target_id": target_id}
            for source_id, target_id in combinations(entity_ids[:6], 2)
        ][:max_pairs]
        if not pairs:
            return []

        cypher = """
        UNWIND $pairs AS pair
        MATCH (source:Entity {id: pair.source_id})
        MATCH (target:Entity {id: pair.target_id})
        OPTIONAL MATCH path = shortestPath((source)-[:RELATES_TO*..4]-(target))
        WITH pair, path
        WHERE path IS NOT NULL
        RETURN pair.source_id AS source_id,
               pair.target_id AS target_id,
               [node IN nodes(path) | node {
                   .id, .name, .type, .description, .source_document_ids
               }] AS nodes,
               [rel IN relationships(path) | {
                   source: startNode(rel).id,
                   target: endNode(rel).id,
                   type: coalesce(rel.type, 'RELATED_TO'),
                   description: coalesce(rel.description, ''),
                   weight: coalesce(rel.weight, 1.0)
               }] AS relationships
        """
        return await Neo4jClient.execute_read(cypher, {"pairs": pairs})

    async def _fetch_supporting_chunks(
        self,
        entity_ids: list[str],
        limit: int,
        document_ids: list[str] | None,
    ) -> list[dict]:
        from apps.knowledge_graph.neo4j_client import Neo4jClient

        if not entity_ids:
            return []

        cypher = """
        MATCH (c:Chunk)-[:MENTIONS]->(e:Entity)
        WHERE e.id IN $entity_ids
          AND ($has_document_filter = false OR c.document_id IN $document_ids)
        WITH c,
             collect(DISTINCT e {.id, .name, .type}) AS matched_entities,
             count(DISTINCT e) AS matched_count
        RETURN c {
            .id, .document_id, .text, .index, .page_number, .section
        } AS chunk,
        matched_entities,
        matched_count
        ORDER BY matched_count DESC, chunk.index ASC
        LIMIT $limit
        """
        return await Neo4jClient.execute_read(
            cypher,
            {
                "entity_ids": entity_ids,
                "limit": limit,
                "document_ids": document_ids or [],
                "has_document_filter": bool(document_ids),
            },
        )

    async def _vector_fallback(
        self,
        query: str,
        top_k: int,
        document_ids: list[str] | None,
        start: float,
    ) -> GraphToolResult:
        from apps.knowledge_graph.neo4j_client import Neo4jClient
        from apps.retrieval.embeddings import EmbeddingService

        query_embedding = EmbeddingService.embed_single(query)
        raw_results = await Neo4jClient.vector_search(
            embedding=query_embedding,
            top_k=top_k,
            document_ids=document_ids,
        )
        contexts = [
            RetrievedContext(
                text=row.get("chunk", {}).get("text", ""),
                score=float(row.get("score", 0.0)),
                source=f"Chunk {row.get('chunk', {}).get('index', '?')}",
                metadata={
                    "kind": "fallback_chunk",
                    "chunk_id": row.get("chunk", {}).get("id", ""),
                    "document_id": row.get("chunk", {}).get("document_id", ""),
                },
            )
            for row in raw_results
        ]
        return GraphToolResult(
            contexts=contexts,
            tool_name=self.tool_name,
            query=query,
            latency_ms=(time.time() - start) * 1000,
            metadata={
                "retrieval_mode": "vector_fallback",
                "graph_context": {
                    "entities": [],
                    "relationships": [],
                    "subgraph_summary": "No graph entities matched the query, so GraphRAG fell back to chunk retrieval.",
                },
            },
        )

    @staticmethod
    def _build_node_map(
        seeds: list[dict],
        direct_relationships: list[dict],
        path_results: list[dict],
    ) -> dict[str, dict]:
        nodes: dict[str, dict] = {}
        for seed in seeds:
            nodes[seed["id"]] = seed
        for row in direct_relationships:
            for key in ("seed", "neighbor"):
                node = row.get(key)
                if node and node.get("id"):
                    nodes[node["id"]] = node
        for row in path_results:
            for node in row.get("nodes", []):
                if node and node.get("id"):
                    nodes[node["id"]] = node
        return nodes

    @staticmethod
    def _build_relationships(
        direct_relationships: list[dict],
        path_results: list[dict],
    ) -> list[dict]:
        deduped: dict[tuple[str, str, str], dict] = {}
        for row in path_results:
            for relationship in row.get("relationships", []):
                key = (
                    relationship.get("source", ""),
                    relationship.get("target", ""),
                    relationship.get("type", "RELATED_TO"),
                )
                deduped[key] = relationship
        for row in direct_relationships:
            relationship = row.get("relationship")
            if relationship:
                key = (
                    relationship.get("source", ""),
                    relationship.get("target", ""),
                    relationship.get("type", "RELATED_TO"),
                )
                deduped.setdefault(key, relationship)
        return list(deduped.values())

    @staticmethod
    def _build_graph_summary(
        *,
        seeds: list[dict],
        nodes: dict[str, dict],
        relationships: list[dict],
        paths: list[dict],
        supporting_chunks: list[dict],
    ) -> str:
        matched_names = ", ".join(seed["name"] for seed in seeds[:4]) or "no direct entities"
        return (
            f"Matched {len(seeds)} query entities ({matched_names}), expanded to "
            f"{len(nodes)} graph entities and {len(relationships)} relationships, "
            f"and collected {len(paths)} multi-hop paths with {len(supporting_chunks)} supporting chunks."
        )

    def _build_path_contexts(
        self,
        path_results: list[dict],
        top_k: int,
    ) -> list[RetrievedContext]:
        contexts: list[RetrievedContext] = []
        for row in path_results[: max(2, min(top_k, 4))]:
            nodes = row.get("nodes", [])
            relationships = row.get("relationships", [])
            if len(nodes) < 2 or not relationships:
                continue
            labels_by_id = {
                node.get("id", ""): node.get("name", node.get("id", ""))
                for node in nodes
            }
            node_labels = " -> ".join(node.get("name", node.get("id", "")) for node in nodes)
            rel_labels = " | ".join(
                f"{labels_by_id.get(rel.get('source', ''), rel.get('source', ''))} "
                f"-[{rel.get('type', 'RELATED_TO')}]-> "
                f"{labels_by_id.get(rel.get('target', ''), rel.get('target', ''))}"
                for rel in relationships
            )
            contexts.append(
                RetrievedContext(
                    text=(
                        "[Graph Path]\n"
                        f"Path: {node_labels}\n"
                        f"Relationships: {rel_labels}"
                    ),
                    score=0.95,
                    source="Graph Path",
                    metadata={
                        "kind": "graph_path",
                        "source_id": row.get("source_id"),
                        "target_id": row.get("target_id"),
                    },
                )
            )
        return contexts

    @staticmethod
    def _build_chunk_contexts(
        supporting_chunks: list[dict],
        top_k: int,
    ) -> list[RetrievedContext]:
        contexts: list[RetrievedContext] = []
        for row in supporting_chunks[: max(2, top_k)]:
            chunk = row.get("chunk", {})
            matched_entities = row.get("matched_entities", [])
            entity_names = ", ".join(entity.get("name", "") for entity in matched_entities[:6])
            contexts.append(
                RetrievedContext(
                    text=(
                        "[Supporting Chunk]\n"
                        f"Entities: {entity_names}\n"
                        f"{chunk.get('text', '')}"
                    ),
                    score=float(row.get("matched_count", 0)),
                    source=f"Chunk {chunk.get('index', '?')} (Doc: {chunk.get('document_id', '?')})",
                    metadata={
                        "kind": "supporting_chunk",
                        "chunk_id": chunk.get("id", ""),
                        "document_id": chunk.get("document_id", ""),
                        "page_number": chunk.get("page_number"),
                        "section": chunk.get("section"),
                    },
                )
            )
        return contexts

    @staticmethod
    def _format_graph_context(
        graph_summary: str,
        seeds: list[dict],
        nodes: dict[str, dict],
        relationships: list[dict],
    ) -> str:
        labels_by_id = {
            node_id: node.get("name", node_id)
            for node_id, node in nodes.items()
        }
        matched_lines = [
            f"- {seed['name']} ({seed['type']}): {seed.get('description') or 'No description'}"
            for seed in seeds[:6]
        ]
        relationship_lines = [
            f"- {labels_by_id.get(rel.get('source', ''), rel.get('source', ''))} "
            f"-[{rel.get('type', 'RELATED_TO')}]-> "
            f"{labels_by_id.get(rel.get('target', ''), rel.get('target', ''))}: "
            f"{rel.get('description') or 'No description'}"
            for rel in relationships[:12]
        ]
        if not relationship_lines:
            relationship_lines = ["- No explicit graph relationships were found for the matched entities."]

        return "\n".join(
            [
                "[Graph Summary]",
                graph_summary,
                "",
                "[Matched Entities]",
                *matched_lines,
                "",
                "[Graph Relationships]",
                *relationship_lines,
            ]
        )

    @staticmethod
    def _format_graph_nodes(nodes: dict[str, dict]) -> list[dict]:
        return [
            {
                "id": node_id,
                "label": node.get("name", node_id),
                "entity_type": node.get("type", "Unknown"),
                "properties": {
                    "description": node.get("description", ""),
                    "source_document_ids": node.get("source_document_ids", []),
                },
            }
            for node_id, node in list(nodes.items())[:24]
        ]

    @staticmethod
    def _format_graph_relationships(relationships: list[dict]) -> list[dict]:
        return [
            {
                "id": f"{rel.get('source', '')}:{rel.get('type', 'RELATED_TO')}:{rel.get('target', '')}",
                "source": rel.get("source", ""),
                "target": rel.get("target", ""),
                "relationship_type": rel.get("type", "RELATED_TO"),
                "weight": rel.get("weight", 1.0),
                "properties": {"description": rel.get("description", "")},
            }
            for rel in relationships[:32]
        ]

    @staticmethod
    def _extract_query_terms(query: str) -> list[str]:
        terms = re.findall(r"[A-Za-z0-9][A-Za-z0-9.+-]*", query.lower())
        return [
            term
            for term in terms
            if len(term) > 2 and term not in _STOPWORDS
        ][:8]

    @classmethod
    def _build_fulltext_query(cls, query: str) -> str:
        terms = cls._extract_query_terms(query)
        if not terms:
            return query
        return " OR ".join(f'"{term}"' for term in terms)

    async def health_check(self) -> bool:
        try:
            from apps.knowledge_graph.neo4j_client import Neo4jClient

            result = await Neo4jClient.health_check()
            return result.get("connected", False)
        except Exception:
            return False
