import fs from 'node:fs/promises';
import path from 'node:path';
import type { WikiCategory } from '@lumemex/shared';
import { slugify } from '@lumemex/shared';

export interface IndexEntry {
  slug: string;
  category: WikiCategory;
  title: string;
  summary?: string;
  updatedAt?: string;
  tags?: string[];
}

export function parseIndexEntryLine(line: string): IndexEntry | null {
  const trimmed = (line ?? '').trim();
  if (!trimmed || !trimmed.startsWith('-')) return null;

  // Example:
  // - slug: contrastive-learning | category: concept | title: [[Contrastive Learning]] | summary: ... | updated_at: 2026-05-06 | tags: ml,representation
  const parts = trimmed
    .replace(/^-+\s*/, '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  const get = (key: string) => {
    const part = parts.find((p) => p.toLowerCase().startsWith(`${key.toLowerCase()}:`));
    if (!part) return undefined;
    return part.slice(part.indexOf(':') + 1).trim();
  };

  const slug = get('slug');
  const categoryRaw = get('category');
  const titleRaw = get('title');
  if (!slug || !categoryRaw || !titleRaw) return null;

  const category = categoryRaw as WikiCategory;
  if (!['entity', 'concept', 'summary', 'comparison', 'synthesis', 'query-answer', 'meta'].includes(category)) {
    return null;
  }

  // title: [[Some Title]]
  const m = titleRaw.match(/\[\[([^\]]+)\]\]/);
  const title = m?.[1]?.trim() || titleRaw.trim();

  const summary = get('summary');
  const updatedAt = get('updated_at') || get('updated_at:');
  const tagsRaw = get('tags');
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

  return {
    slug: slug.trim() || slugify(title),
    category,
    title,
    summary,
    updatedAt,
    tags,
  };
}

export async function readWikiIndex(wikiDir: string): Promise<{
  entries: IndexEntry[];
  bySlug: Map<string, IndexEntry>;
  byTitle: Map<string, IndexEntry>;
}> {
  const indexPath = path.join(wikiDir, 'index.md');
  const raw = await fs.readFile(indexPath, 'utf8');

  const entries: IndexEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const e = parseIndexEntryLine(line);
    if (e) entries.push(e);
  }

  const bySlug = new Map<string, IndexEntry>();
  const byTitle = new Map<string, IndexEntry>();
  for (const e of entries) {
    bySlug.set(e.slug, e);
    byTitle.set(e.title, e);
  }

  return { entries, bySlug, byTitle };
}

