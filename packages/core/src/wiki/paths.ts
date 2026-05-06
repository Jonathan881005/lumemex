import path from 'node:path';
import type { WikiCategory } from '@lumemex/shared';

const CATEGORY_TO_DIR: Record<WikiCategory, string> = {
  entity: 'entity',
  concept: 'concept',
  summary: 'summary',
  comparison: 'comparison',
  synthesis: 'synthesis',
  'query-answer': 'query-answer',
  meta: 'meta',
};

export function wikiPagePath(wikiDir: string, category: WikiCategory, slug: string): string {
  const subDir = CATEGORY_TO_DIR[category];
  return path.join(wikiDir, subDir, `${slug}.md`);
}

export function ensureWikiCategoryDir(wikiDir: string, category: WikiCategory): string {
  const subDir = CATEGORY_TO_DIR[category];
  const dir = path.join(wikiDir, subDir);
  return dir;
}

