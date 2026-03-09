from ninja import NinjaAPI
from ninja_jwt.authentication import JWTAuth  # noqa: F401

api = NinjaAPI(
    title="Graphite API",
    version="1.0.0",
    description="Enterprise GraphRAG Application",
    urls_namespace="api",
)


@api.get("/health", tags=["System"])
def health_check(request):
    """Basic health check endpoint."""
    return {"status": "ok"}


# Register routers
from apps.accounts.api import router as accounts_router  # noqa: E402
from apps.documents.api import router as documents_router  # noqa: E402
from apps.knowledge_graph.api import router as graph_router  # noqa: E402
from apps.retrieval.api import query_router, settings_router  # noqa: E402

api.add_router("/auth/", accounts_router)
api.add_router("/documents/", documents_router)
api.add_router("/graph/", graph_router)
api.add_router("/query/", query_router)
api.add_router("/settings/", settings_router)
