import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import type { QueryResult } from '@lumemex/shared';
import { extractWikiLinks } from '@lumemex/shared';
import { sha256Hex } from '../utils/hash';
import { loadConfig } from '../config/load-config';
import { initDb } from '../storage/db';
import { readWikiIndex } from '../wiki/index-md';
import { readWikiLogTail } from '../wiki/log';
import { appendWikiLog, writeWikiPageFile } from '../wiki/write';
import { writeUpdatedIndexFile } from '../wiki/index-update';
import { wikiPagePath } from '../wiki/paths';
import { completeJson } from '../llm/client';
import { querySystemPrompt, queryUserPromptTemplate } from '../llm/prompts/query.prompt';
import type { IndexEntry } from '../wiki/index-md';

import type { WikiCategory } from '@lumemex/shared';
import { repoRootFromCwd } from '../utils/repo-root';

function uuid(): string {
  return crypto.randomUUID();
}

function truncateForPrompt(s: string, maxChars: number): string {
  const t = s ?? '';
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars);
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}

function toFtsQuery(input: string): string {
  const tokens = (input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (tokens.length === 0) return '*';
  return tokens.map((t) => `"${t}"`).join(' OR ');
}

export async function queryQuestion(question: string): Promise<QueryResult> {
  const config = await loadConfig();
  const db = initDb();

  const wikiDir = config.wiki_dir;
  const repoRoot = repoRootFromCwd();
  const schemaMd = await fs.readFile(path.join(repoRoot, 'SCHEMA.md'), 'utf8');
  const index = await readWikiIndex(wikiDir);
  const logTail = await readWikiLogTail(wikiDir, 10);

  const jobId = uuid();
  db.prepare(
    'INSERT INTO jobs (id, operation, status, started_at, model, provider_base_url) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(jobId, 'query', 'running', new Date().toISOString(), config.model, config.api_base_url);
  db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
    jobId,
    'job_started',
    JSON.stringify({ question }),
    new Date().toISOString()
  );

  // Candidate retrieval (MVP): FTS over wiki_fts; fall back to empty list.
  const ftsQuery = toFtsQuery(question);
  let candidatePages: Array<any> = [];
  try {
    candidatePages = db
      .prepare(
        `
        SELECT w.slug, w.title, w.path, w.category, w.content
        FROM wiki_pages w
        JOIN wiki_fts f ON f.wiki_slug = w.slug
        WHERE wiki_fts MATCH ?
        LIMIT 8
        `
      )
      .all(ftsQuery) as Array<any>;
  } catch {
    // Fallback to recent pages if FTS query parsing fails.
    candidatePages = db
      .prepare(`SELECT slug, title, path, category, content FROM wiki_pages ORDER BY updated_at DESC LIMIT 8`)
      .all() as Array<any>;
  }

  const candidatesJson = JSON.stringify(
    candidatePages.map((p) => ({
      slug: p.slug,
      title: p.title,
      path: p.path,
      category: p.category,
      content: truncateForPrompt(p.content ?? '', 12000),
    }))
  );

  const userPrompt = fillTemplate(queryUserPromptTemplate, {
    SCHEMA_MD: schemaMd,
    INDEX_MD: await fs.readFile(path.join(wikiDir, 'index.md'), 'utf8'),
    QUESTION: question,
    CANDIDATE_PAGES_JSON: candidatesJson,
    RAW_SNIPPETS_JSON: JSON.stringify([]),
  });

  const started = Date.now();
  let modelOutput: any;
  try {
    modelOutput = await completeJson({
      config,
      operation: 'query',
      systemPrompt: querySystemPrompt,
      userPrompt,
      maxTokens: config.max_tokens_per_compilation,
    });
  } catch (e: any) {
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
      jobId,
      'llm_failed',
      JSON.stringify({ message: e?.message ?? String(e) }),
      new Date().toISOString()
    );
    db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run(
      'failed',
      String(e?.message ?? e),
      new Date().toISOString(),
      jobId
    );
    throw e;
  }

  const answerMarkdown = modelOutput?.answer_markdown;
  const citations = Array.isArray(modelOutput?.citations) ? modelOutput.citations : [];
  const saveCandidate = modelOutput?.save_candidate;
  const usedWikiSlugs = Array.isArray(modelOutput?.usedWikiSlugs) ? modelOutput.usedWikiSlugs : [];
  const usedIndexFirst = Boolean(modelOutput?.usedIndexFirst);
  const logEntry = modelOutput?.log_entry;

  if (!answerMarkdown || !saveCandidate || !logEntry) {
    db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run(
      'failed',
      'LLM output missing required fields for query.',
      new Date().toISOString(),
      jobId
    );
    throw new Error('LLM query output missing required fields.');
  }

  await appendWikiLog({ wikiDir, logEntryMarkdown: logEntry });

  db.prepare('UPDATE jobs SET status = ?, finished_at = ? WHERE id = ?').run(
    'success',
    new Date().toISOString(),
    jobId
  );
  db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
    jobId,
    'job_finished',
    JSON.stringify({ savedProposed: Boolean(saveCandidate?.should_save) }),
    new Date().toISOString()
  );

  return {
    jobId,
    question,
    answerMarkdown,
    citations,
    usedIndexFirst,
    usedWikiSlugs,
    saveCandidate,
    compilation: {
      operation: 'query',
      jobId,
      model: config.model,
      providerBaseUrl: config.api_base_url,
      pagesCreated: [],
      pagesUpdated: [],
      indexUpdated: false,
      logAppended: true,
      warnings: [],
      durationMs: Date.now() - started,
    },
  } satisfies QueryResult;
}

export async function saveQueryCandidate(params: {
  saveCandidate: NonNullable<QueryResult['saveCandidate']>;
  extraLogEntryMarkdown?: string;
}): Promise<{ slug: string; path: string }> {
  const config = await loadConfig();
  const db = initDb();

  const { saveCandidate, extraLogEntryMarkdown } = params;
  if (!saveCandidate.should_save) {
    throw new Error('saveCandidate.should_save is false.');
  }

  const wikiDir = config.wiki_dir;
  const category = saveCandidate.category as WikiCategory;
  const pageSlug = saveCandidate.slug;
  const pageMarkdown = saveCandidate.markdown;
  const pageTitle = saveCandidate.title;

  await writeWikiPageFile({
    wikiDir,
    category,
    slug: pageSlug,
    markdown: pageMarkdown,
  });

  const rawIndexEntry = saveCandidate.index_entry as any;
  const indexEntry: IndexEntry = {
    slug: String(rawIndexEntry.slug),
    category: rawIndexEntry.category as WikiCategory,
    title: String(rawIndexEntry.title),
    summary: String(rawIndexEntry.summary ?? ''),
    tags: Array.isArray(rawIndexEntry.tags) ? rawIndexEntry.tags : undefined,
    updatedAt: String(rawIndexEntry.updated_at ?? rawIndexEntry.updatedAt ?? new Date().toISOString().slice(0, 10)),
  };

  await writeUpdatedIndexFile({ wikiDir, entry: indexEntry });

  // Persist to DB
  const nowIso = new Date().toISOString();
  const pageId = uuid();

  const wikiPath = wikiPagePath(wikiDir, category, pageSlug).replaceAll('\\', '/');
  const pageContentHash = sha256Hex(pageMarkdown);

  // Basic overwrite semantics: if the slug already exists, update it.
  db.prepare('INSERT OR IGNORE INTO wiki_pages (id, slug, title, path, category, summary_line, content_hash, created_at, updated_at, generated_by, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    pageId,
    pageSlug,
    pageTitle,
    wikiPath,
    category,
    String(indexEntry.summary ?? ''),
    pageContentHash,
    nowIso,
    nowIso,
    'query',
    pageMarkdown
  );

  db.prepare('UPDATE wiki_pages SET title = ?, path = ?, category = ?, summary_line = ?, content_hash = ?, updated_at = ?, generated_by = ?, content = ? WHERE slug = ?').run(
    pageTitle,
    wikiPath,
    category,
    String(indexEntry.summary ?? ''),
    pageContentHash,
    nowIso,
    'query',
    pageMarkdown,
    pageSlug
  );

  // Update outgoing links based on [[wiki-links]] inside the saved page.
  // For MVP, we resolve to slugs only via slugify; lint will catch missing pages.
  const linkTitles = extractWikiLinks(pageMarkdown);
  const outSlugs = linkTitles.map((t) => t.trim()).filter(Boolean).map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));

  db.prepare('DELETE FROM wiki_links WHERE from_slug = ?').run(pageSlug);
  for (const toSlug of outSlugs) {
    db.prepare('INSERT OR IGNORE INTO wiki_links (from_slug, to_slug, created_at) VALUES (?, ?, ?)').run(pageSlug, toSlug, nowIso);
  }

  const logEntry = extraLogEntryMarkdown ?? `## [${new Date().toISOString().slice(0, 10)}] save | ${saveCandidate.title}\n- should_save: ${String(saveCandidate.should_save)}\n- slug: ${saveCandidate.slug}\n`;
  await appendWikiLog({ wikiDir, logEntryMarkdown: logEntry });

  // raw_to_wiki_refs: not modeled for query MVP (sources may be wiki pages and/or raw).
  return { slug: pageSlug, path: wikiPath };
}

