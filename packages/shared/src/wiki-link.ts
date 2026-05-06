const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Extracts all wiki links like [[Some Title]] from a markdown string.
 * Returns the raw inner text (no slug resolution).
 */
export function extractWikiLinks(markdown: string): string[] {
  const out: string[] = [];
  const text = markdown ?? '';
  for (;;) {
    const m = WIKI_LINK_RE.exec(text);
    if (!m) break;
    out.push(m[1].trim());
  }
  return out;
}

export function normalizeWikiLinkText(s: string): string {
  return (s ?? '').trim();
}

