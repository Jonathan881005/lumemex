import { NextResponse } from 'next/server';
import { saveQueryCandidate } from '@lumemex/core';

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}));
  const saveCandidate = body?.saveCandidate;
  if (!saveCandidate || typeof saveCandidate !== 'object') {
    return NextResponse.json({ error: 'saveCandidate is required.' }, { status: 400 });
  }

  const saved = await saveQueryCandidate({ saveCandidate });
  return NextResponse.json(saved);
}

