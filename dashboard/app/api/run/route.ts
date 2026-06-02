import { NextRequest, NextResponse } from 'next/server';
import { octokit, listSpecs, dispatchPipeline, pipelineRuns } from '@/lib/github';

export const dynamic = 'force-dynamic';

// Status ao vivo: últimos runs do pipeline.yml
export async function GET() {
  return NextResponse.json(await pipelineRuns(octokit()));
}

// Acionar o pipeline (workflow_dispatch), com guard-rail e secret opcional.
export async function POST(req: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;
  if (secret && req.headers.get('x-dashboard-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado (token de ação inválido).' }, { status: 401 });
  }

  let spec = '';
  try {
    const body = await req.json();
    spec = body?.spec ?? '';
  } catch {
    /* corpo inválido */
  }
  if (!spec) return NextResponse.json({ error: 'spec ausente' }, { status: 400 });

  const ok = octokit();

  // Guard-rail server-side (defesa em profundidade)
  const specs = await listSpecs(ok);
  const found = specs.find((s) => s.path === spec);
  if (found?.sensitive) {
    return NextResponse.json(
      {
        error: `Guard-rail: área "${found.area}" é sensível (clínico/auth/schema). Exige revisão humana — o pipeline não dispara automaticamente.`,
      },
      { status: 422 },
    );
  }

  try {
    await dispatchPipeline(ok, spec);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao disparar o workflow';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
