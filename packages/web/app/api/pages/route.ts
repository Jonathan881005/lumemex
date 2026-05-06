import { NextResponse } from 'next/server';
import { initDb } from '@lumemex/core';

export async function GET() {
  const db = initDb();
  const pages = db
    .prepare(
      'SELECT slug, title, category, updated_at FROM wiki_pages ORDER BY updated_at DESC, title ASC'
    )
    .all() as Array<{ slug: string; title: string; category: string; updated_at: string }>;

  return NextResponse.json({ pages });
}

