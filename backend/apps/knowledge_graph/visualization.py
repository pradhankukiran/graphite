"""Transform Neo4j graph data into react-force-graph format."""

from __future__ import annotations

ENTITY_COLORS: dict[str, str] = {
    "Person": "#E76F51",
    "Organization": "#264653",
    "Location": "#2A9D8F",
    "Concept": "#F4A261",
    "Event": "#E9C46A",
    "Technology": "#606C38",
}

DEFAULT_ENTITY_COLOR = "#6C757D"
CHUNK_COLOR = "#ADB5BD"

# Relative node sizes by type
ENTITY_SIZES: dict[str, int] = {
    "Person": 8,
    "Organization": 10,
    "Location": 7,
    "Concept": 6,
    "Event": 5,
    "Technology": 6,
    "Chunk": 3,
}

DEFAULT_ENTITY_SIZE = 5


def _node_color(entity_type: str) -> str:
    """Return the display color for an entity type."""
    if entity_type == "Chunk":
        return CHUNK_COLOR
    return ENTITY_COLORS.get(entity_type, DEFAULT_ENTITY_COLOR)


def _node_size(entity_type: str) -> int:
    """Return the relative display size for an entity type."""
    return ENTITY_SIZES.get(entity_type, DEFAULT_ENTITY_SIZE)


def neo4j_to_force_graph(nodes: list[dict], relationships: list[dict]) -> dict:
    """
    Convert Neo4j query results to react-force-graph format.

    Parameters
    ----------
    nodes:
        List of dicts, each having at least ``id``, ``name``, ``type``.
        Optional keys: ``description``, ``properties``, ``document_id``.
    relationships:
        List of dicts, each having at least ``source``, ``target``, ``type``.
        Optional keys: ``description``, ``weight``.

    Returns
    -------
    dict with keys ``nodes`` and ``links``.

    Each node:
        {id, name, type, val (size), color, description, properties}

    Each link:
        {source, target, type, description, weight}
    """
    seen_ids: set[str] = set()
    fg_nodes: list[dict] = []

    for node in nodes:
        nid = node.get("id")
        if not nid or nid in seen_ids:
            continue
        seen_ids.add(nid)

        entity_type = node.get("type", "Unknown")
        fg_nodes.append({
            "id": nid,
            "name": node.get("name", nid),
            "type": entity_type,
            "val": _node_size(entity_type),
            "color": _node_color(entity_type),
            "description": node.get("description", ""),
            "properties": node.get("properties"),
        })

    fg_links: list[dict] = []
    for rel in relationships:
        source = rel.get("source")
        target = rel.get("target")
        if not source or not target:
            continue
        fg_links.append({
            "source": source,
            "target": target,
            "type": rel.get("type", "RELATES_TO"),
            "description": rel.get("description", ""),
            "weight": rel.get("weight", 1.0),
        })

    return {"nodes": fg_nodes, "links": fg_links}


def get_entity_type_distribution(stats: dict) -> list[dict]:
    """
    Produce a list suitable for pie/donut charts from graph stats.

    Parameters
    ----------
    stats:
        The dict returned by ``Neo4jClient.get_graph_stats()``, which contains
        ``node_counts`` mapping label -> count.

    Returns
    -------
    List of ``{"type": str, "count": int, "color": str}`` dicts,
    sorted by count descending.
    """
    node_counts: dict[str, int] = stats.get("node_counts", {})
    distribution: list[dict] = []

    for label, count in node_counts.items():
        if count <= 0:
            continue
        distribution.append({
            "type": label,
            "count": count,
            "color": _node_color(label),
        })

    distribution.sort(key=lambda d: d["count"], reverse=True)
    return distribution


async def get_subgraph_for_query(entity_ids: list[str], depth: int = 1) -> dict:
    """
    Extract a relevant subgraph centred on the given entities.

    Fetches neighbourhoods for each entity and merges them into a single
    react-force-graph payload.

    Parameters
    ----------
    entity_ids:
        List of entity IDs to use as starting points.
    depth:
        How many hops from each entity to traverse (max 5).

    Returns
    -------
    dict with ``nodes`` and ``links`` in react-force-graph format.
    """
    from apps.knowledge_graph.neo4j_client import Neo4jClient

    all_nodes: list[dict] = []
    all_rels: list[dict] = []

    for eid in entity_ids:
        neighborhood = await Neo4jClient.get_entity_neighborhood(eid, depth=depth)
        all_nodes.extend(neighborhood.get("nodes", []))
        all_rels.extend(neighborhood.get("relationships", []))

    return neo4j_to_force_graph(all_nodes, all_rels)
