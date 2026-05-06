# RAG vs Persistent Wiki

This page compares the characteristics, trade-offs, and operational roles of classic Retrieval-Augmented Generation (RAG) pipelines versus a persistent wiki workflow, as part of the broader [[LLM Wiki Pattern]].

This comparison is grounded in the detailed analysis found in [[RAG vs Persistent Wiki Follow-up]].

## Trade-off Analysis

| Feature | Classic RAG | Persistent Wiki |
| :--- | :--- | :--- |
| **Primary Strength** | Freshness & low editorial overhead | Compounding knowledge & durable structure |
| **Citation Style** | Direct citation from raw source chunks | Traceable synthesis from wiki $\rightarrow$ raw |
| **Reasoning** | Often stateless and repetitive | Incremental and cumulative |
| **Synthesis** | Fragile cross-document synthesis | Explicit concept pages and cross-links |
| **Maintenance** | Low (automated indexing) | Requires active maintenance and [[Lint]]ing |
| **Weakness** | Weak long-term structure | Requires active maintenance and [[Lint]]ing |

## Operational Recommendation

Rather than viewing these as mutually exclusive, the optimal workflow integrates both:

1. **Discovery & Grounding**: Use RAG for quick retrieval over fresh corpora to find relevant information.
2. **Synthesis**: Save high-value conclusions and recurring patterns into dedicated wiki pages (e.g., [[Core Idea of LLM Wiki Pattern]]).
3. **Maintenance**: Periodically run linting operations to detect orphan pages, weak links, and stale claims to ensure the wiki remains a high-fidelity knowledge base.

## Related Concepts
- [[Knowledge Management]] (Missing page)
- [[Persistent Wiki]]
- [[RAG]] (Missing page)

## Sources
- `raw/text/second-article.md` ("RAG vs Persistent Wiki Follow-up")
- [[RAG vs Persistent Wiki Follow-up]]