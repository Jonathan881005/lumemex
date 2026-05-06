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

## Local Verification (CLI MVP)

### 1) Create `config.json`

Copy `config.example.json` to `config.json` (note: `config.json` is gitignored).
Required fields:
- `api_base_url`
- `api_key`
- `model`
- `raw_dir` (e.g. `./raw`)
- `wiki_dir` (e.g. `./wiki`)
- `max_tokens_per_compilation`

### 2) Add a `raw/` source file

Every raw file MUST include YAML frontmatter like:

```md
---
source: "https://example.com/some-article"
ingested_at: "2026-05-06T10:00:00+08:00"
title: "Some Article Title"
---

<content here>
```

### 3) Run ingest

After dependencies are installed, run:

```bash
npm --workspace @lumemex/cli run build
node packages/cli/dist/bin.js ingest raw/url/your-source.md
```

Query/save is confirm-first: if the model proposes saving, the CLI will ask for confirmation before writing into `wiki/`.

## Runtime Consistency (Volta)

This project pins runtime via Volta in root `package.json`:
- `node`: `24.15.0`
- `npm`: `11.12.1`

Recommended verification:

```bash
volta run node -v
volta run npm -v
volta run npm run build
volta run npm run cli -- ingest raw/url/your-source.md
```
