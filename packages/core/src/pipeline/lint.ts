import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { initDb } from '../storage/db';
import { loadConfig } from '../config/load-config';
import { readWikiIndex } from '../wiki/index-md';
import { readWikiLogTail } from '../wiki/log';
import { appendWikiLog } from '../wiki/write';
import { lintSystemPrompt, lintUserPromptTemplate } from '../llm/prompts/lint.prompt';
import { completeJson } from '../llm/client';
import { repoRootFromCwd } from '../utils/repo-root';

function uuid(): string {
  return crypto.randomUUID();
}

export async function runLint(): Promise<{
  issues: unknown;
  proposedActions: unknown;
}> {
  const config = await loadConfig();
  const db = initDb();

  const wikiDir = config.wiki_dir;
  const repoRoot = repoRootFromCwd();
  const schemaMd = await fs.readFile(path.join(repoRoot, 'SCHEMA.md'), 'utf8');
  const indexMd = await fs.readFile(path.join(wikiDir, 'index.md'), 'utf8');
  await readWikiIndex(wikiDir); // validate parse/format early (MVP)
  const logTail = await readWikiLogTail(wikiDir, 10);

  const jobId = uuid();
  db.prepare('INSERT INTO jobs (id, operation, status, started_at, model, provider_base_url) VALUES (?, ?, ?, ?, ?, ?)').run(
    jobId,
    'lint',
    'running',
    new Date().toISOString(),
    config.model,
    config.api_base_url
  );

  db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
    jobId,
    'job_started',
    JSON.stringify({}),
    new Date().toISOString()
  );

  // Page metadata from DB (MVP).
  const pageMetaRows = db
    .prepare(
      `SELECT slug, category, title, updated_at, content
       FROM wiki_pages
       ORDER BY updated_at DESC
       LIMIT 80`
    )
    .all() as Array<any>;

  const pageMetadata = pageMetaRows.map((r) => {
    const outLinks = (r.content ? (r.content.match(/\[\[([^\]]+)\]\]/g) ?? []) : []).slice(0, 60);
    return {
      slug: r.slug,
      category: r.category,
      title: r.title,
      updated_at: r.updated_at,
      out_links: outLinks,
      in_links: [],
    };
  });

  const samplePages = pageMetaRows.slice(0, 3).map((r) => ({ slug: r.slug, content: r.content }));

  const filledUserPrompt = lintUserPromptTemplate
    .replaceAll('{{SCHEMA_MD}}', schemaMd)
    .replaceAll('{{INDEX_MD}}', indexMd)
    .replaceAll('{{LOG_TAIL}}', logTail)
    .replaceAll('{{PAGE_METADATA_JSON}}', JSON.stringify(pageMetadata))
    .replaceAll('{{SAMPLE_PAGES_JSON}}', JSON.stringify(samplePages));

  let modelOutput: any;
  try {
    modelOutput = await completeJson({
      config,
      operation: 'lint',
      systemPrompt: lintSystemPrompt,
      userPrompt: filledUserPrompt,
      maxTokens: config.max_tokens_per_compilation,
    });
  } catch (e: any) {
    db.prepare('UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run(
      'failed',
      String(e?.message ?? e),
      new Date().toISOString(),
      jobId
    );
    db.prepare('INSERT INTO job_events (job_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
      jobId,
      'llm_failed',
      JSON.stringify({ message: e?.message ?? String(e) }),
      new Date().toISOString()
    );
    throw e;
  }

  const logEntry = modelOutput?.log_entry;
  if (typeof logEntry !== 'string' || !logEntry.trim()) {
    throw new Error('LLM lint output missing log_entry.');
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
    JSON.stringify({}),
    new Date().toISOString()
  );

  return {
    issues: modelOutput?.issues ?? [],
    proposedActions: modelOutput?.proposed_actions ?? [],
  };
}

