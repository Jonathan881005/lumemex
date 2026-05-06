import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { initDb, loadConfig } from '@lumemex/core';

type StatsResponse = {
  raw: {
    total: number;
    byStatus: {
      pending: number;
      done: number;
      error: number;
    };
  };
  wiki: {
    total: number;
    byCategory: Record<string, number>;
  };
  links: {
    total: number;
  };
  lastIngestAt: string | null;
  recentLogLines: string[];
};

function mapRawStatusToBucket(status: string): 'pending' | 'done' | 'error' {
  if (status === 'processed') return 'done';
  if (status === 'failed') return 'error';
  return 'pending'; // pending + processing + unknown
}

export async function GET() {
  const db = initDb();
  const config = await loadConfig();

  const rawRows = db
    .prepare('SELECT status, COUNT(*) as n FROM raw_items GROUP BY status')
    .all() as Array<{ status: string; n: number }>;
  const rawTotalRow = db.prepare('SELECT COUNT(*) as n FROM raw_items').get() as { n: number };
  const rawByStatus = { pending: 0, done: 0, error: 0 };
  for (const r of rawRows) {
    rawByStatus[mapRawStatusToBucket(r.status)] += Number(r.n);
  }

  const wikiRows = db
    .prepare('SELECT category, COUNT(*) as n FROM wiki_pages GROUP BY category')
    .all() as Array<{ category: string; n: number }>;
  const wikiTotalRow = db.prepare('SELECT COUNT(*) as n FROM wiki_pages').get() as { n: number };
  const wikiByCategory: Record<string, number> = {};
  for (const r of wikiRows) wikiByCategory[r.category] = Number(r.n);

  const linkTotalRow = db.prepare('SELECT COUNT(*) as n FROM wiki_links').get() as { n: number };
  const lastIngestRow = db
    .prepare('SELECT ingested_at as t FROM raw_items ORDER BY ingested_at DESC LIMIT 1')
    .get() as { t: string } | undefined;

  const logPath = path.join(config.wiki_dir, 'log.md');
  let recentLogLines: string[] = [];
  try {
    const logRaw = await fs.readFile(logPath, 'utf8');
    const lines = logRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    recentLogLines = lines.slice(Math.max(0, lines.length - 10));
  } catch {
    recentLogLines = [];
  }

  const payload: StatsResponse = {
    raw: {
      total: Number(rawTotalRow?.n ?? 0),
      byStatus: rawByStatus,
    },
    wiki: {
      total: Number(wikiTotalRow?.n ?? 0),
      byCategory: wikiByCategory,
    },
    links: {
      total: Number(linkTotalRow?.n ?? 0),
    },
    lastIngestAt: lastIngestRow?.t ?? null,
    recentLogLines,
  };

  return NextResponse.json(payload);
}

