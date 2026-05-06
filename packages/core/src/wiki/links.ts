import { extractWikiLinks } from '@lumemex/shared';
import type { IndexEntry } from './index-md';

export function extractWikiLinkTitles(markdown: string): string[] {
  return extractWikiLinks(markdown);
}

export function resolveWikiLinkTitlesToSlugs(params: {
  linkTitles: string[];
  byTitle: Map<string, IndexEntry>;
  bySlug: Map<string, IndexEntry>;
}): { resolvedSlugs: string[]; missingTitles: string[] } {
  const { linkTitles, byTitle, bySlug } = params;
  const resolvedSlugs: string[] = [];
  const missingTitles: string[] = [];

  const seen = new Set<string>();
  for (const t0 of linkTitles) {
    const t = (t0 ?? '').trim();
    if (!t) continue;

    // If the title string already equals a slug in index, accept it.
    const bySlugHit = bySlug.get(t);
    if (bySlugHit) {
      if (!seen.has(bySlugHit.slug)) {
        resolvedSlugs.push(bySlugHit.slug);
        seen.add(bySlugHit.slug);
      }
      continue;
    }

    const byTitleHit = byTitle.get(t);
    if (byTitleHit) {
      if (!seen.has(byTitleHit.slug)) {
        resolvedSlugs.push(byTitleHit.slug);
        seen.add(byTitleHit.slug);
      }
      continue;
    }

    missingTitles.push(t);
  }

  return { resolvedSlugs, missingTitles };
}

