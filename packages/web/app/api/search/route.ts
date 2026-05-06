import { NextResponse } from 'next/server';

import { initDb } from '@lumemex/core';

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const query = q.trim();
  if (!query) return NextResponse.json({ results: [] });

  const db = initDb();
  const ftsQuery = toFtsQuery(query);

  let results: Array<{
    slug: string;
    title: string;
    category: string;
    snippet: string;
  }> = [];
  try {
    const wikiRows = db
      .prepare(
        `
        SELECT w.slug, w.title, w.category, snippet(wiki_fts, 2, '...', '...', 14) as snippet
        FROM wiki_fts
        JOIN wiki_pages w ON w.slug = wiki_fts.wiki_slug
        WHERE wiki_fts MATCH ?
        ORDER BY rank
        LIMIT 30
        `
      )
      .all(ftsQuery) as Array<any>;
    results = wikiRows.map((w) => ({
      slug: w.slug,
      title: w.title,
      category: w.category,
      snippet: String(w.snippet ?? ''),
    }));
  } catch {
    const like = `%${query}%`;
    const wikiRows = db
      .prepare(
        `
        SELECT slug, title, category, substr(content, 1, 240) as snippet
        FROM wiki_pages
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY updated_at DESC
        LIMIT 30
        `
      )
      .all(like, like) as Array<any>;
    results = wikiRows.map((w) => ({
      slug: w.slug,
      title: w.title,
      category: w.category,
      snippet: String(w.snippet ?? ''),
    }));
  }

  return NextResponse.json({ results });
}

