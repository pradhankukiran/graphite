"""Django Ninja schemas for the knowledge_graph app."""

from __future__ import annotations

import uuid
from datetime import datetime

from ninja import Schema


# ---------------------------------------------------------------------------
# Entity
# ---------------------------------------------------------------------------


class EntityOut(Schema):
    """Public representation of a graph Entity node."""

    id: str
    name: str
    type: str
    description: str = ""
    properties: dict | str | None = None


# ---------------------------------------------------------------------------
# Graph statistics
# ---------------------------------------------------------------------------


class EntityTypeDistribution(Schema):
    type: str
    count: int
    color: str


class GraphStatsOut(Schema):
    """High-level statistics for the knowledge graph."""

    node_count: int
    edge_count: int
    chunk_count: int
    entity_type_distribution: list[EntityTypeDistribution] = []


# ---------------------------------------------------------------------------
# Visualization
# ---------------------------------------------------------------------------


class ForceGraphNode(Schema):
    id: str
    name: str
    type: str
    val: int = 5
    color: str = "#6C757D"
    description: str = ""
    properties: dict | str | None = None


class ForceGraphLink(Schema):
    source: str
    target: str
    type: str = "RELATES_TO"
    description: str = ""
    weight: float | None = 1.0


class GraphVisualizationOut(Schema):
    """Payload for react-force-graph rendering."""

    nodes: list[ForceGraphNode]
    links: list[ForceGraphLink]


# ---------------------------------------------------------------------------
# Neighborhood
# ---------------------------------------------------------------------------


class NeighborhoodOut(Schema):
    """Entity neighbourhood subgraph."""

    center_entity: EntityOut | None = None
    nodes: list[ForceGraphNode] = []
    links: list[ForceGraphLink] = []
    depth: int = 1


# ---------------------------------------------------------------------------
# Graph build job
# ---------------------------------------------------------------------------


class GraphBuildJobOut(Schema):
    """Status of a graph build job."""

    id: uuid.UUID
    document_id: uuid.UUID
    status: str
    celery_task_id: str | None = None
    entities_extracted: int = 0
    relations_extracted: int = 0
    entities_created: int = 0
    relations_created: int = 0
    error_message: str = ""
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
