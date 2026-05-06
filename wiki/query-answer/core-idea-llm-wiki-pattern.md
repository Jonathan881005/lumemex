# Core Idea of LLM Wiki Pattern

The core idea of the **LLM Wiki Pattern** is to transition from stateless retrieval (classic RAG) to a stateful, persistent knowledge management system. 

## Key Characteristics
- **Persistence**: Knowledge is stored in a structured wiki rather than being re-generated from snippets on every call.
- **Layering**: Separation between immutable human-curated sources (`raw/`) and an evolving LLM-curated knowledge base (`wiki/`).
- **Incremental Synthesis**: The system focuses on the continuous improvement of concepts and syntheses through an operational loop of Ingest, Query, Save, and Lint.
- **Curatorship**: The LLM functions as a Knowledge Management curator, building a compounding knowledge graph.

## Comparison
Unlike traditional RAG, which is transient, the LLM Wiki Pattern creates a durable artifact that evolves as new information is added and old information is refactored.

## Sources
- [[LLM Wiki Pattern]]