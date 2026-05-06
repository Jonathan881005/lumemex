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

type LintIssue = {
  type: string;
  severity: 'S1' | 'S2' | 'S3';
  pages: string[];
  description: string;
  suggested_fix: string;
};

function extractWikiLinksFromMarkdown(markdown: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  for (const m of markdown.matchAll(re)) {
    const t = String(m[1] ?? '').trim();
    if (t) out.push(t);
  }
  return out;
}

function hasSourcesSection(markdown: string): boolean {
  if (!/^##\s+Sources\s*$/im.test(markdown)) return false;
  const lines = markdown.split(/\r?\n/);
  const idx = lines.findIndex((line) => /^##\s+Sources\s*$/i.test(line.trim()));
  if (idx < 0) return false;
  let nextIdx = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i].trim())) {
      nextIdx = i;
      break;
    }
  }
  return lines
    .slice(idx + 1, nextIdx)
    .some((line) => Boolean(line.trim()));
}

function withSourceTag(issue: LintIssue, source: 'deterministic' | 'llm'): LintIssue {
  return {
    ...issue,
    description: `[${source}] ${issue.description}`,
    suggested_fix: `[${source}] ${issue.suggested_fix}`,
  };
}

function deterministicLint(pages: Array<{ slug: string; title: string; content: string }>): LintIssue[] {
  const issues: LintIssue[] = [];
  const bySlug = new Map<string, { slug: string; title: string; content: string }>();
  const byTitle = new Map<string, { slug: string; title: string; content: string }>();
  const inboundCount = new Map<string, number>();

  for (const p of pages) {
    bySlug.set(p.slug, p);
    byTitle.set(p.title, p);
    inboundCount.set(p.slug, 0);
  }

  for (const p of pages) {
    const content = p.content ?? '';
    if (!hasSourcesSection(content)) {
      issues.push(
        withSourceTag(
          {
            type: 'missing-sources',
            severity: 'S2',
            pages: [p.slug],
            description: `Page "${p.slug}" is missing a non-empty ## Sources section.`,
            suggested_fix: `Add a ## Sources section with at least one raw source reference in "${p.slug}".`,
          },
          'deterministic'
        )
      );
    }

    const linkTexts = [...new Set(extractWikiLinksFromMarkdown(content))];
    const brokenTargets: string[] = [];
    for (const linkText of linkTexts) {
      const bySlugTarget = bySlug.get(linkText);
      const byTitleTarget = byTitle.get(linkText);
      const targetSlug = bySlugTarget?.slug ?? byTitleTarget?.slug;
      if (!targetSlug) {
        brokenTargets.push(linkText);
        continue;
      }
      if (targetSlug !== p.slug) {
        inboundCount.set(targetSlug, Number(inboundCount.get(targetSlug) ?? 0) + 1);
      }
    }

    if (brokenTargets.length > 0) {
      issues.push(
        withSourceTag(
          {
            type: 'broken-link',
            severity: 'S2',
            pages: [p.slug],
            description: `Page "${p.slug}" links to missing targets: ${brokenTargets.join(', ')}.`,
            suggested_fix: `Create the missing target pages or update invalid [[wiki-links]] in "${p.slug}".`,
          },
          'deterministic'
        )
      );
    }
  }

  for (const p of pages) {
    if (Number(inboundCount.get(p.slug) ?? 0) === 0) {
      issues.push(
        withSourceTag(
          {
            type: 'orphan',
            severity: 'S3',
            pages: [p.slug],
            description: `Page "${p.slug}" has no inbound links from other wiki pages.`,
            suggested_fix: `Add at least one inbound [[wiki-link]] to "${p.slug}" from a related page.`,
          },
          'deterministic'
        )
      );
    }
  }

  return issues;
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
  const deterministicIssues = deterministicLint(
    pageMetaRows.map((r) => ({
      slug: String(r.slug),
      title: String(r.title),
      content: String(r.content ?? ''),
    }))
  );

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
    issues: [
      ...deterministicIssues,
      ...((Array.isArray(modelOutput?.issues) ? modelOutput.issues : []).map((i: any) =>
        withSourceTag(
          {
            type: String(i?.type ?? 'unknown'),
            severity: (String(i?.severity ?? 'S3') as 'S1' | 'S2' | 'S3'),
            pages: Array.isArray(i?.pages) ? i.pages.map((p: unknown) => String(p)) : [],
            description: String(i?.description ?? ''),
            suggested_fix: String(i?.suggested_fix ?? ''),
          },
          'llm'
        )
      )),
    ],
    proposedActions: modelOutput?.proposed_actions ?? [],
  };
}

