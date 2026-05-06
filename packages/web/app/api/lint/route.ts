import { NextResponse } from 'next/server';
import { runLint } from '@lumemex/core';

export async function POST() {
  const report = await runLint();
  return NextResponse.json(report);
}

