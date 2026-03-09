"""Service functions for knowledge graph operations."""

import logging

from apps.knowledge_graph.neo4j_client import Neo4jClient
from apps.knowledge_graph.visualization import (
    get_entity_type_distribution,
    neo4j_to_force_graph,
)

logger = logging.getLogger(__name__)


def get_graph_stats() -> dict:
    """Get aggregate graph statistics.

    Returns a dict with:
        node_count: int
        edge_count: int
        chunk_count: int
        entity_type_distribution: list[dict] with {type, count, color}
    """
    stats = Neo4jClient.get_graph_stats_sync()
    node_counts = stats.get("node_counts", {})
    distribution = get_entity_type_distribution(stats)

    return {
        "node_count": stats.get("total_nodes", 0),
        "edge_count": stats.get("total_rels", 0),
        "chunk_count": node_counts.get("Chunk", 0),
        "entity_type_distribution": distribution,
    }


def search_entities(
    query: str, entity_type: str = None, limit: int = 20
) -> list[dict]:
    """Search entities using Neo4j fulltext index or CONTAINS fallback.

    Args:
        query: Search term to match against entity names.
        entity_type: Optional entity type filter (Person, Organization, etc.).
        limit: Maximum number of results to return.

    Returns:
        List of entity dicts with id, name, type, description.
    """
    if entity_type:
        cypher = """
        MATCH (e:Entity)
        WHERE e.type = $entity_type
          AND toLower(e.name) CONTAINS toLower($query)
        RETURN e {.id, .name, .type, .description} AS entity
        ORDER BY e.name
        LIMIT $limit
        """
        params = {"query": query, "entity_type": entity_type, "limit": limit}
    else:
        # Try fulltext index first, fall back to CONTAINS
        cypher = """
        MATCH (e:Entity)
        WHERE toLower(e.name) CONTAINS toLower($query)
        RETURN e {.id, .name, .type, .description} AS entity
        ORDER BY e.name
        LIMIT $limit
        """
        params = {"query": query, "limit": limit}

    rows = Neo4jClient.execute_read_sync(cypher, params)
    return [row["entity"] for row in rows if row.get("entity")]


def get_entity_details(entity_id: str) -> dict | None:
    """Get a single entity with all its properties.

    Args:
        entity_id: The entity's unique id.

    Returns:
        Entity dict or None if not found.
    """
    cypher = """
    MATCH (e:Entity {id: $entity_id})
    RETURN e {
        .id, .name, .type, .description,
        .source_document_ids, .properties
    } AS entity
    """
    rows = Neo4jClient.execute_read_sync(cypher, {"entity_id": entity_id})
    if not rows:
        return None
    return rows[0].get("entity")


def get_entity_neighborhood(entity_id: str, depth: int = 1) -> dict:
    """Get an entity's neighborhood in force-graph format.

    Args:
        entity_id: The center entity's id.
        depth: How many hops to traverse (1-5).

    Returns:
        dict with keys: center_entity, nodes, links, depth
    """
    neighborhood = Neo4jClient.get_entity_neighborhood_sync(entity_id, depth=depth)

    center = neighborhood.get("center")
    nodes = neighborhood.get("nodes", [])
    relationships = neighborhood.get("relationships", [])

    # Transform to force-graph format
    graph = neo4j_to_force_graph(nodes, relationships)

    return {
        "center_entity": center,
        "nodes": graph["nodes"],
        "links": graph["links"],
        "depth": depth,
    }


def get_visualization_data(
    document_ids: list[str] | None = None, limit: int = 500
) -> dict:
    """Get graph visualization data in force-graph format.

    Args:
        document_ids: Optional list of document IDs to filter by.
        limit: Maximum number of nodes/edges to return.

    Returns:
        dict with keys: nodes, links
    """
    raw = Neo4jClient.get_visualization_data_sync(document_ids=document_ids, limit=limit)
    return neo4j_to_force_graph(
        raw.get("nodes", []),
        raw.get("relationships", []),
    )
