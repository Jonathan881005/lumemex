import { NextResponse } from 'next/server';

import { queryQuestion } from '@lumemex/core';

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}));
  const question = body?.question;
  if (typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question is required.' }, { status: 400 });
  }

  const result = await queryQuestion(question);
  return NextResponse.json(result);
}

