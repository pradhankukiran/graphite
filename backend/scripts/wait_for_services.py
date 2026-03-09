#!/usr/bin/env python
"""
Wait for external services (PostgreSQL, Redis, Neo4j) to become available.
Used as an entrypoint helper before starting Django or Celery workers.
"""

import os
import socket
import sys
import time


def wait_for_port(host: str, port: int, timeout: float = 30.0, interval: float = 1.0) -> bool:
    """Wait until a TCP port is accepting connections."""
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=2):
                return True
        except OSError:
            time.sleep(interval)
    return False


def main():
    services = [
        ("PostgreSQL", os.environ.get("POSTGRES_HOST", "postgres"), int(os.environ.get("POSTGRES_PORT", "5432"))),
        ("Redis", os.environ.get("REDIS_HOST", "redis"), 6379),
        ("Neo4j", os.environ.get("NEO4J_HOST", "neo4j"), 7687),
    ]

    timeout = float(os.environ.get("SERVICE_WAIT_TIMEOUT", "60"))

    for name, host, port in services:
        print(f"Waiting for {name} at {host}:{port}...", flush=True)
        if wait_for_port(host, port, timeout=timeout):
            print(f"  {name} is ready.", flush=True)
        else:
            print(f"  ERROR: {name} at {host}:{port} did not become available within {timeout}s", file=sys.stderr)
            sys.exit(1)

    print("All services are ready.", flush=True)


if __name__ == "__main__":
    main()
