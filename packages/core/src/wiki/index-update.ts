import fs from 'node:fs/promises';
import path from 'node:path';
import type { IndexEntry } from './index-md';

const CATEGORY_TO_SECTION: Record<IndexEntry['category'], string> = {
  entity: 'Entities',
  concept: 'Concepts',
  summary: 'Summaries',
  comparison: 'Comparisons',
  synthesis: 'Syntheses',
  'query-answer': 'Query Answers',
  meta: 'Meta',
};

export function indexLineForEntry(entry: IndexEntry): string {
  // Uses the canonical format required by SCHEMA.md.
  const tags = entry.tags && entry.tags.length ? ` | tags: ${entry.tags.join(',')}` : '';
  const updatedAt = entry.updatedAt ?? new Date().toISOString().slice(0, 10);
  const normalizedTitle = String(entry.title ?? '').replace(/^\[\[|\]\]$/g, '').trim();
  return `- slug: ${entry.slug} | category: ${entry.category} | title: [[${normalizedTitle}]] | summary: ${entry.summary ?? ''} | updated_at: ${updatedAt}${tags}`;
}

export function upsertIndexEntryLine(params: {
  indexMd: string;
  entry: IndexEntry;
}): string {
  const { indexMd, entry } = params;
  const index = indexMd ?? '';
  const slugNeedle = `slug: ${entry.slug}`;
  if (index.includes(slugNeedle)) return index;

  const section = CATEGORY_TO_SECTION[entry.category];
  const sectionRe = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm');
  const nextHeadingRe = /^##\s+/m;

  const m = index.match(sectionRe);
  if (!m || m.index == null) {
    // If the section doesn't exist, append at end.
    return index.trimEnd() + `\n\n${section ? `## ${section}\n` : ''}${indexLineForEntry(entry)}\n`;
  }

  const start = m.index;
  nextHeadingRe.lastIndex = start + m[0].length;
  const next = nextHeadingRe.exec(index);
  const insertPos = next ? next.index : index.length;

  const before = index.slice(0, insertPos).trimEnd();
  const after = index.slice(insertPos);

  // Insert right before next heading (so it's within section by construction).
  return before + '\n' + indexLineForEntry(entry) + '\n' + after;
}

export async function writeUpdatedIndexFile(params: {
  wikiDir: string;
  entry: IndexEntry;
}): Promise<void> {
  const { wikiDir, entry } = params;
  const indexPath = path.join(wikiDir, 'index.md');
  const current = await fs.readFile(indexPath, 'utf8');
  const updated = upsertIndexEntryLine({ indexMd: current, entry });
  await fs.writeFile(indexPath, updated, 'utf8');
}

