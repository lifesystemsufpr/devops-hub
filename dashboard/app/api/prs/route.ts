import { NextResponse } from 'next/server';
import { octokit, recentPRs } from '@/lib/github';

export const dynamic = 'force-dynamic';

// PRs abertos no devops-hub (os do pipeline, feat/demo-*, vêm primeiro).
export async function GET() {
  return NextResponse.json(await recentPRs(octokit()));
}
