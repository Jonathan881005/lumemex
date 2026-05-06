# RAG vs Persistent Wiki Follow-up

This page summarizes the follow-up notes comparing classic Retrieval-Augmented Generation (RAG) pipelines with the persistent wiki workflow used in the [[LLM Wiki Pattern]].

## Core Arguments
- **RAG**: Highly effective for rapid retrieval across fresh, large corpora, but suffers from statelessness, where the LLM must re-reason through the same snippets repeatedly.
- **Persistent Wiki**: Focuses on the accumulation of curated syntheses. Each ingestion process improves the quality of future answers by building a durable knowledge base.

## Trade-off Summary

| Approach | Strengths | Weaknesses |
| :--- | :--- | :--- |
| **RAG** | Freshness, low editorial overhead, direct source citation. |
| **Persistent Wiki** | Compounding knowledge, explicit concept pages, durable cross-links. | Requires active maintenance, quality control, and periodic [[Lint]]ing. |

## Operational Recommendations
To maximize efficiency, the notes suggest a hybrid approach:
1. **Discovery**: Use RAG for initial grounding and finding information in raw data.
2. **Persistence**: Save high-value conclusions and recurring patterns into dedicated wiki pages (e.g., [[Core Idea of LLM Wiki Pattern]] or [[Persistent Wiki]]).
3. **Maintenance**: Regularly perform linting to identify orphan pages or stale claims.

## Sources
- `raw/text/second-article.md` ("RAG vs Persistent Wiki Follow-up")