import { NextResponse } from 'next/server';
import { testApiKey } from '@lumemex/core';

export async function POST() {
  const result = await testApiKey();
  if (result.ok) return NextResponse.json(result);
  return NextResponse.json(result, { status: result.statusCode ?? 500 });
}

