import { NextResponse } from 'next/server';

import { initDb } from '@lumemex/core';

type GraphEdge = {
  source: string;
  target: string;
  kind: 'wiki-link' | 'source-of';
  weight: number;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const showRaw = url.searchParams.get('showRaw') === '1' || url.searchParams.get('showRaw') === 'true';

  const db = initDb();

  const wikiNodes = db
    .prepare(`SELECT slug, title, category, updated_at FROM wiki_pages ORDER BY updated_at DESC LIMIT 500`)
    .all() as Array<any>;

  const wikiSlugSet = new Set(wikiNodes.map((n) => n.slug));

  const wikiEdges = db.prepare('SELECT from_slug, to_slug FROM wiki_links').all() as Array<any>;

  const degreeMap = new Map<string, number>();
  for (const e of wikiEdges) {
    degreeMap.set(e.from_slug, (degreeMap.get(e.from_slug) ?? 0) + 1);
    degreeMap.set(e.to_slug, (degreeMap.get(e.to_slug) ?? 0) + 1);
  }

  const nodes = wikiNodes.map((n) => ({
    id: n.slug,
    label: n.title,
    type: 'wiki' as const,
    category: n.category,
    degree: degreeMap.get(n.slug) ?? 0,
    updatedAt: n.updated_at,
  }));

  const edges: GraphEdge[] = wikiEdges.map((e) => ({
    source: e.from_slug,
    target: e.to_slug,
    kind: 'wiki-link',
    weight: 1,
  }));

  if (showRaw) {
    const rawNodes = db
      .prepare(
        `SELECT id, title, source_type, ingested_at
         FROM raw_items
         ORDER BY ingested_at DESC
         LIMIT 200`
      )
      .all() as Array<any>;

    for (const r of rawNodes) {
      nodes.push({
        id: r.id,
        label: r.title,
        type: 'raw' as const,
        category: r.source_type,
        degree: 0,
        updatedAt: r.ingested_at,
      } as any);
    }

    const rawRefs = db
      .prepare('SELECT raw_id, wiki_slug FROM raw_to_wiki_refs')
      .all() as Array<any>;

    for (const rr of rawRefs) {
      if (!wikiSlugSet.has(rr.wiki_slug)) continue;
      edges.push({
        source: rr.raw_id,
        target: rr.wiki_slug,
        kind: 'source-of',
        weight: 1,
      });
    }
  }

  return NextResponse.json({ nodes, edges });
}

