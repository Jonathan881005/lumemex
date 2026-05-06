# Persistent Wiki

A **Persistent Wiki** is a stateful knowledge management artifact that focuses on the accumulation of curated syntheses rather than transient retrieval. In the context of the [[LLM Wiki Pattern]], it represents the "Wiki Layer" where knowledge is incrementally refined and stored.

## Core Characteristics
- **Compounding Value**: Unlike stateless systems, each new ingestion or synthesis improves the quality and connectivity of the existing knowledge base.
- **Durable Structure**: Uses explicit concept pages and stable `[[wiki-links]]` to create a long-term knowledge graph.
- **Curated Synthesis**: Prioritizes high-level abstractions and conclusions over raw data snippets.

## Trade-offs
- **Strengths**: Provides a durable memory for the LLM, reduces repetitive reasoning, and enables complex cross-document synthesis.
- **Weaknesses**: Requires active human or LLM maintenance, strict quality controls, and periodic [[Lint]]ing to prevent decay (e.g., orphan pages or stale claims).

## Relationship to RAG
While [[RAG]] (Retrieval-Augmented Generation) is optimized for freshness and rapid discovery across large corpora, a Persistent Wiki is optimized for depth and structural coherence. The most effective workflows use RAG for the initial "discovery" phase and the Persistent Wiki for the "persistence" phase, as detailed in [[RAG vs Persistent Wiki]].

## Sources
- `raw/text/second-article.md` ("RAG vs Persistent Wiki Follow-up")
- [[RAG vs Persistent Wiki]]