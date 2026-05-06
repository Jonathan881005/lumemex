# lumemex

Personal knowledge base system following the LLM Wiki pattern:
knowledge is incrementally compiled into a persistent, interlinked wiki instead of being re-derived on every query.

## Core Philosophy

- Human owns `raw/` (immutable source documents)
- LLM owns `wiki/` (summaries, synthesis, cross-references, maintenance)
- `SCHEMA.md` governs behavior, structure, and operational contracts

## Confirmed Design Decisions

1. Wiki organization: categorized directories
2. Query save mode: confirm-first
3. Ingest policy: source versioning enabled
4. `index.md` format: fixed fields
5. `log.md` mode: detailed operation records
6. Lint mode: manual + daily scheduled runs
7. Graph mode: wiki-only by default, optional raw toggle
8. Query output: mandatory `## Sources` section

## Planned Stack

- Monorepo with TypeScript
- CLI: Node.js + TypeScript
- Pipeline: OpenAI-compatible API client (provider-agnostic)
- Storage: SQLite + FTS5 + Markdown files
- Web UI: Next.js App Router + Tailwind + Shadcn/ui + D3.js

## Next Steps

- Add `SCHEMA.md` initial template
- Scaffold `packages/shared`, `packages/core`, `packages/cli`, `packages/web`
- Implement ingest/query/lint pipelines
- Add indexing, graph extraction, and UI workflows
