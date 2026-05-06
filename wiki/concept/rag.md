# RAG

**RAG** (Retrieval-Augmented Generation) is a technique used to ground LLM responses in external, often fresh, data sources. In the context of the [[LLM Wiki Pattern]], RAG serves as the primary mechanism for the "Discovery" phase of knowledge acquisition.

## Characteristics
- **Freshness**: Optimized for rapid retrieval across large, frequently updated corpora.
- **Statelessness**: Typically operates on a per-query basis, meaning the LLM must re-reason through retrieved snippets for every interaction, leading to repetitive reasoning.
- **Direct Provenance**: Provides high-fidelity citations by linking answers directly to raw source chunks.

## Trade-offs
- **Strengths**: Low editorial overhead and high accuracy for specific, factual retrieval from a wide array of documents.
- **Weaknesses**: Lacks long-term structural coherence, making cross-document synthesis fragile and computationally repetitive.

## Role in Hybrid Workflows
Rather than replacing it, the [[LLM Wiki Pattern]] integrates RAG as a precursor to persistence. The recommended workflow is:
1. **Discovery**: Use [[RAG]] for initial grounding and finding information in raw data.
2. **Persistence**: Save high-value conclusions and recurring patterns into a [[Persistent Wiki]].

For a detailed analysis of these trade-offs, see [[RAG vs Persistent Wiki]].

## Sources
- `raw/text/second-article.md` ("RAG vs Persistent Wiki Follow-up")
