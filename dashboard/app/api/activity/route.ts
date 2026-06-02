import { NextResponse } from 'next/server';
import { octokit, recentRuns } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await recentRuns(octokit()));
}
