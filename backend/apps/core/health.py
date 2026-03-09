"""
Health check utilities for verifying service connectivity.
"""

import logging

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)


def check_postgres() -> dict:
    """Check PostgreSQL connectivity."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return {"status": "ok", "service": "postgres"}
    except Exception as exc:
        logger.error("PostgreSQL health check failed: %s", exc)
        return {"status": "error", "service": "postgres", "detail": str(exc)}


def check_redis() -> dict:
    """Check Redis connectivity."""
    try:
        import redis as redis_lib

        broker_url = getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/1")
        client = redis_lib.from_url(broker_url)
        client.ping()
        client.close()
        return {"status": "ok", "service": "redis"}
    except Exception as exc:
        logger.error("Redis health check failed: %s", exc)
        return {"status": "error", "service": "redis", "detail": str(exc)}


def check_neo4j() -> dict:
    """Check Neo4j connectivity."""
    try:
        from neo4j import GraphDatabase

        uri = getattr(settings, "NEO4J_URI", "bolt://localhost:7687")
        user = getattr(settings, "NEO4J_USER", "neo4j")
        password = getattr(settings, "NEO4J_PASSWORD", "")

        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        driver.close()
        return {"status": "ok", "service": "neo4j"}
    except Exception as exc:
        logger.error("Neo4j health check failed: %s", exc)
        return {"status": "error", "service": "neo4j", "detail": str(exc)}


def check_celery() -> dict:
    """Check Celery worker connectivity via ping."""
    try:
        from config.celery import app as celery_app

        inspect = celery_app.control.inspect(timeout=2.0)
        ping_result = inspect.ping()
        if ping_result:
            return {"status": "ok", "service": "celery", "workers": len(ping_result)}
        return {"status": "warning", "service": "celery", "detail": "No workers responding"}
    except Exception as exc:
        logger.error("Celery health check failed: %s", exc)
        return {"status": "error", "service": "celery", "detail": str(exc)}


def check_all() -> dict:
    """Run all health checks and return aggregated result."""
    checks = {
        "postgres": check_postgres(),
        "redis": check_redis(),
        "neo4j": check_neo4j(),
        "celery": check_celery(),
    }
    all_ok = all(c["status"] == "ok" for c in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "services": checks,
    }
