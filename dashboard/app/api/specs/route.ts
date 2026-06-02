import { NextResponse } from 'next/server';
import { octokit, listSpecs } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listSpecs(octokit()));
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
