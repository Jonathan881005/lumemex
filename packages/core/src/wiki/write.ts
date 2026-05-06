import fs from 'node:fs/promises';
import path from 'node:path';
import type { WikiCategory, WikiPage } from '@lumemex/shared';
import { wikiPagePath, ensureWikiCategoryDir } from './paths';

export async function writeWikiPageFile(params: {
  wikiDir: string;
  category: WikiCategory;
  slug: string;
  markdown: string;
}): Promise<{ path: string }> {
  const { wikiDir, category, slug, markdown } = params;
  const dir = ensureWikiCategoryDir(wikiDir, category);
  await fs.mkdir(dir, { recursive: true });
  const filePath = wikiPagePath(wikiDir, category, slug);
  await fs.writeFile(filePath, markdown, 'utf8');
  return { path: filePath };
}

export async function appendWikiLog(params: { wikiDir: string; logEntryMarkdown: string }): Promise<void> {
  const { wikiDir, logEntryMarkdown } = params;
  const logPath = path.join(wikiDir, 'log.md');
  const current = await fs.readFile(logPath, 'utf8');
  const next = current.trimEnd() + '\n\n' + logEntryMarkdown.trimEnd() + '\n';
  await fs.writeFile(logPath, next, 'utf8');
}

export function makeIndexLine(params: {
  slug: string;
  category: WikiCategory;
  title: string; // should be [[Title]] in index line
  summary: string;
  updatedAt: string; // YYYY-MM-DD
  tags?: string[];
}): string {
  const tags = params.tags && params.tags.length ? ` | tags: ${params.tags.join(',')}` : '';
  return `- slug: ${params.slug} | category: ${params.category} | title: [[${params.title}]] | summary: ${params.summary} | updated_at: ${params.updatedAt}${tags}`;
}

