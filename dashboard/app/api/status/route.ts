import { NextResponse } from 'next/server';
import { octokit, REPOS, getRepoStatus } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ok = octokit();
  const data = await Promise.all(REPOS.map((r) => getRepoStatus(ok, r)));
  return NextResponse.json(data);
}
