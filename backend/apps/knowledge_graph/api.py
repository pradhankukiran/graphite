"""Django Ninja API endpoints for the Knowledge Graph app."""

import logging
from typing import Optional

from django.http import HttpRequest
from ninja import Query, Router
from ninja_jwt.authentication import JWTAuth

from apps.knowledge_graph.schemas import (
    EntityOut,
    GraphStatsOut,
    GraphVisualizationOut,
    NeighborhoodOut,
)
from apps.knowledge_graph.services import (
    get_entity_details,
    get_entity_neighborhood,
    get_graph_stats,
    get_visualization_data,
    search_entities,
)

logger = logging.getLogger(__name__)

router = Router(tags=["Knowledge Graph"], auth=JWTAuth())


@router.get("/stats", response=GraphStatsOut)
def graph_stats(request: HttpRequest):
    """Get graph statistics: node counts, edge counts, type distribution."""
    try:
        stats = get_graph_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get graph stats: {e}")
        return GraphStatsOut(
            node_count=0,
            edge_count=0,
            chunk_count=0,
            entity_type_distribution=[],
        )


@router.get("/visualize", response=GraphVisualizationOut)
def visualize_graph(
    request: HttpRequest,
    document_ids: Optional[str] = Query(None, description="Comma-separated document IDs"),
    limit: int = Query(500, ge=1, le=5000),
):
    """Get graph data for react-force-graph rendering.

    Optionally filter by document IDs (comma-separated) and limit the number of results.
    """
    doc_id_list = None
    if document_ids:
        doc_id_list = [d.strip() for d in document_ids.split(",") if d.strip()]

    try:
        graph = get_visualization_data(document_ids=doc_id_list, limit=limit)
        return graph
    except Exception as e:
        logger.error(f"Failed to get visualization data: {e}")
        return GraphVisualizationOut(nodes=[], links=[])


@router.get("/entities", response=list[EntityOut])
def list_entities(
    request: HttpRequest,
    query: Optional[str] = Query(None, description="Search term for entity names"),
    type: Optional[str] = Query(None, alias="type", description="Filter by entity type"),
    limit: int = Query(20, ge=1, le=100),
):
    """Search entities by name and optional type filter."""
    if not query:
        # Return all entities up to limit if no query provided
        query = ""

    try:
        entities = search_entities(query=query, entity_type=type, limit=limit)
        return entities
    except Exception as e:
        logger.error(f"Failed to search entities: {e}")
        return []


@router.get("/entities/{entity_id}", response={200: EntityOut, 404: dict})
def get_entity(request: HttpRequest, entity_id: str):
    """Get details for a specific entity."""
    try:
        entity = get_entity_details(entity_id)
        if entity is None:
            return 404, {"detail": "Entity not found"}
        return 200, entity
    except Exception as e:
        logger.error(f"Failed to get entity {entity_id}: {e}")
        return 404, {"detail": "Entity not found"}


@router.get(
    "/entities/{entity_id}/neighborhood",
    response={200: NeighborhoodOut, 404: dict},
)
def entity_neighborhood(
    request: HttpRequest,
    entity_id: str,
    depth: int = Query(1, ge=1, le=5),
):
    """Get the neighborhood subgraph around an entity."""
    try:
        result = get_entity_neighborhood(entity_id, depth=depth)
        if result.get("center_entity") is None:
            return 404, {"detail": "Entity not found"}
        return 200, result
    except Exception as e:
        logger.error(f"Failed to get neighborhood for entity {entity_id}: {e}")
        return 404, {"detail": "Entity not found"}
