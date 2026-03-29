<div align="center">

# Graphite

### Enterprise Knowledge Graph + RAG Platform

Turn unstructured documents into queryable knowledge graphs with AI-powered retrieval.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Django](https://img.shields.io/badge/Django-5.1-092E20?style=flat-square&logo=django)](https://djangoproject.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-5-4581C3?style=flat-square&logo=neo4j)](https://neo4j.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Demo](https://graphite-puce.vercel.app) &bull; [Getting Started](#getting-started) &bull; [Architecture](#architecture) &bull; [Contributing](#contributing)

</div>

---

## Overview

Graphite is an open-source platform that combines **knowledge graphs** with **retrieval-augmented generation (RAG)** to build intelligent, context-aware AI systems. Upload documents, automatically extract entities and relationships into a Neo4j knowledge graph, and query your data using natural language with LLM-powered retrieval.

### Key Features

- **Document Ingestion Pipeline** &mdash; Upload PDF, DOCX, TXT, Markdown, and HTML files with automatic parsing, chunking, and metadata extraction
- **Knowledge Graph Construction** &mdash; Automatic entity extraction and relationship mapping stored in Neo4j
- **Hybrid RAG Retrieval** &mdash; Combines vector similarity search with graph traversal for more accurate, contextual answers
- **Interactive Graph Visualization** &mdash; Explore knowledge graphs in 2D and 3D with force-directed layouts
- **Multi-LLM Support** &mdash; Connect to OpenAI, Groq, Cerebras, or OpenRouter
- **Real-time Progress** &mdash; WebSocket-powered live updates during document processing
- **Scalable Task Processing** &mdash; Distributed Celery workers with specialized queues for ingestion, embedding, LLM, and graph tasks

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 15)                        │
│              React 19 · TypeScript · Tailwind CSS · Zustand         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API / WebSocket
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Backend (Django + Ninja)                         │
│            Django Channels · JWT Auth · Celery Workers               │
├─────────┬───────────┬───────────────┬──────────────┬────────────────┤
│         │           │               │              │                │
│   PostgreSQL    Neo4j 5         Redis 7       Celery Beat      LLM APIs
│   (Documents,   (Knowledge      (Cache,       (Scheduled       (OpenAI,
│    Users,        Graph)          Broker,        Tasks)          Groq,
│    Chunks)                       Channels)                     Cerebras)
└─────────┴───────────┴───────────────┴──────────────┴────────────────┘
```

### Processing Pipeline

```
Document Upload → Text Extraction → Chunking → Embedding Generation
                                        ↓
                              Entity Extraction → Knowledge Graph (Neo4j)
                                        ↓
                    User Query → Hybrid Retrieval → LLM Response
                                 (Vector + Graph)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand, Radix UI |
| **Backend** | Django 5.1, Django Ninja, Django Channels, Celery |
| **Databases** | PostgreSQL 16, Neo4j 5, Redis 7 |
| **AI/ML** | LangChain, LlamaIndex, sentence-transformers, neo4j-graphrag |
| **Visualization** | react-force-graph-2d, react-force-graph-3d |
| **Infrastructure** | Docker Compose, Uvicorn, Daphne |

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- At least one LLM API key (Groq, OpenAI, Cerebras, or OpenRouter)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/pradhankukiran/graphite.git
cd graphite

# Configure environment
cp .env.example .env
# Edit .env and add your LLM API key(s)

# Start all services
make up

# Run database migrations
make migrate

# Create Neo4j indexes
make neo4j-indexes
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000/api
- **Neo4j Browser:** http://localhost:7474

### Useful Commands

```bash
make up                 # Start all services
make down               # Stop all services
make build              # Rebuild containers
make logs               # Follow all logs
make logs-backend       # Follow backend logs
make logs-celery        # Follow Celery worker logs
make migrate            # Run database migrations
make createsuperuser    # Create admin user
make test               # Run test suite
make lint               # Run linter
make format             # Auto-format code
make shell              # Django shell
make dbshell            # PostgreSQL shell
```

### Environment Variables

See [`.env.example`](.env.example) for all configuration options. Key variables:

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key |
| `CEREBRAS_API_KEY` | Cerebras API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `EMBEDDING_MODEL` | Sentence transformer model (default: `all-MiniLM-L6-v2`) |
| `NEO4J_PASSWORD` | Neo4j database password |

## Project Structure

```
graphite/
├── frontend/                # Next.js 15 application
│   └── src/
│       ├── app/             # App router pages
│       ├── components/      # React components
│       ├── lib/             # Utilities and API client
│       └── stores/          # Zustand state management
├── backend/
│   ├── apps/
│   │   ├── accounts/        # Authentication & user management
│   │   ├── documents/       # Document ingestion & processing
│   │   ├── knowledge_graph/ # Entity extraction & graph building
│   │   ├── retrieval/       # RAG pipeline & LLM integration
│   │   └── websockets/      # Real-time updates
│   └── config/              # Django settings
├── docker-compose.yml       # Production services
├── docker-compose.override.yml  # Dev overrides (hot reload)
└── Makefile                 # Common commands
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License &mdash; see the [LICENSE](LICENSE) file for details.
