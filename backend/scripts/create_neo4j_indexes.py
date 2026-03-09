"""Create Neo4j indexes and constraints for Graphite."""

import asyncio
import os
import sys

# Add backend root to sys.path so Django modules resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django  # noqa: E402

django.setup()

from apps.knowledge_graph.neo4j_client import Neo4jClient  # noqa: E402

INDEXES: list[str] = [
    # Vector index for chunk embeddings (384-dim, cosine similarity)
    """
    CREATE VECTOR INDEX chunk_embedding_index IF NOT EXISTS
    FOR (c:Chunk) ON (c.embedding)
    OPTIONS {indexConfig: {
        `vector.dimensions`: 384,
        `vector.similarity_function`: 'cosine'
    }}
    """,
    # Fulltext index for entity name/description search
    """
    CREATE FULLTEXT INDEX entity_name_fulltext IF NOT EXISTS
    FOR (e:Entity) ON EACH [e.name, e.description]
    """,
    # Regular index for filtering entities by type
    "CREATE INDEX entity_type_idx IF NOT EXISTS FOR (e:Entity) ON (e.type)",
    # Uniqueness constraints
    "CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
]


async def create_indexes() -> None:
    """Create all Neo4j indexes and constraints."""
    print("Creating Neo4j indexes and constraints...")

    for idx, query in enumerate(INDEXES, 1):
        try:
            await Neo4jClient.execute_write(query.strip())
            print(f"  [{idx}/{len(INDEXES)}] OK")
        except Exception as e:
            msg = str(e).lower()
            if "already exists" in msg or "equivalent index" in msg:
                print(f"  [{idx}/{len(INDEXES)}] Already exists, skipping")
            else:
                print(f"  [{idx}/{len(INDEXES)}] Error: {e}")

    await Neo4jClient.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(create_indexes())
