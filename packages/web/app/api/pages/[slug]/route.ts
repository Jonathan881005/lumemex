import { NextResponse } from 'next/server';
import { initDb } from '@lumemex/core';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const db = initDb();
  const page = db
    .prepare('SELECT slug, title, category, content, updated_at FROM wiki_pages WHERE slug = ?')
    .get(slug) as
    | { slug: string; title: string; category: string; content: string; updated_at: string }
    | undefined;

  if (!page) {
    return NextResponse.json({ error: 'page not found' }, { status: 404 });
  }

  return NextResponse.json(page);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = body?.content;
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const db = initDb();
  const existing = db
    .prepare('SELECT slug, title, category, path FROM wiki_pages WHERE slug = ?')
    .get(slug) as
    | { slug: string; title: string; category: string; path: string }
    | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'page not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  await fs.writeFile(existing.path, content, 'utf8');

  db.prepare('UPDATE wiki_pages SET content = ?, content_hash = ?, updated_at = ? WHERE slug = ?').run(
    content,
    contentHash,
    now,
    slug
  );

  return NextResponse.json({ ok: true, slug, updated_at: now });
}

