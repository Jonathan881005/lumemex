import { NextResponse } from 'next/server';

import { ingestOneRawPath } from '@lumemex/core';

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}));
  const rawPath = body?.rawPath;
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return NextResponse.json({ error: 'rawPath is required.' }, { status: 400 });
  }

  const result = await ingestOneRawPath(rawPath);
  return NextResponse.json(result);
}

