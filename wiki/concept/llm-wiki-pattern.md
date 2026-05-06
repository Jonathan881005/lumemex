# LLM Wiki Pattern

The **LLM Wiki Pattern** is a methodology for knowledge management where an LLM maintains a persistent, structured wiki based on a set of immutable raw sources. Unlike traditional [[RAG]] (Retrieval-Augmented Generation), which typically re-derives answers from raw snippets for every query, this pattern focuses on the incremental improvement and synthesis of knowledge over time.

## Core Architecture

The pattern separates data into two distinct layers to ensure provenance and flexibility:

- **Raw Layer (`raw/`)**: A human-curated repository of immutable source documents. Once a document is ingested, its semantic content remains unchanged to preserve the original context.
- **Wiki Layer (`wiki/`)**: An LLM-owned layer containing summaries, abstract concepts, comparisons, and syntheses. This layer is designed to be refactored and evolved. This layer is essentially a [[Persistent Wiki]], serving as the stateful memory of the system.

### Navigation and Governance
- **`index.md`**: Serves as the primary navigation layer and content catalog.
- **`log.md`**: An append-only chronological record of all operations performed by the LLM.

## Operational Loop

The lifecycle of knowledge in this pattern follows a continuous loop:
1. **Ingest**: Transform raw sources into structured wiki pages.
2. **Query**: Answer questions using the existing wiki structure and index.
3. **Save**: Persist high-quality query answers back into the wiki as reusable pages.
4. **Lint**: Audit the wiki for contradictions, missing links, or stale information to maintain health.

## Comparison with Classic RAG

| Feature | Classic RAG | LLM Wiki Pattern |
| :--- | :--- | :--- |
| **State** | Stateless/Transient | Persistent/Stateful |
| **Processing** | On-the-fly retrieval | Incremental synthesis |
| **Evolution** | Static index | Evolving knowledge graph |
| **Provenance** | Direct snippet citation | Traceable from wiki $\rightarrow$ raw |

For a detailed analysis of these trade-offs and operational recommendations, see [[RAG vs Persistent Wiki]].

This approach transforms the LLM from a simple retriever into a [[Knowledge Management]] curator, creating a [[Persistent Wiki]] that compounds in value as more information is ingested.

Edited via /editor PATCH test.
Editor save test line.

## Sources
- `raw/url/llm-wiki-pattern-demo.md`