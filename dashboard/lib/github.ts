import { Octokit } from '@octokit/rest';

export const ORG = 'lifesystemsufpr';
export const PIPELINE_REPO = 'devops-hub';
export const PIPELINE_WORKFLOW = 'pipeline.yml';

export interface RepoRef {
  name: string;
  defaultBranch: string;
  type: string;
}

/** Espelha devops-hub/scripts/repos.config.ts + os repos de infra (nossos). */
export const REPOS: RepoRef[] = [
  { name: 'auth-service', defaultBranch: 'main', type: 'backend' },
  { name: 'tecnoaging-back', defaultBranch: 'main', type: 'backend' },
  { name: 'ivcf-back', defaultBranch: 'main', type: 'backend' },
  { name: 'tecnoaging-front', defaultBranch: 'main', type: 'frontend' },
  { name: 'ivcf-front', defaultBranch: 'main', type: 'frontend' },
  { name: 'ivcf-mobile', defaultBranch: 'main', type: 'mobile' },
  { name: 'equilibrium-mobile', defaultBranch: 'master', type: 'kotlin' },
  { name: 'devops-hub', defaultBranch: 'main', type: 'infra' },
  { name: 'ai-toolkit', defaultBranch: 'main', type: 'infra' },
];

export function octokit(): Octokit {
  const auth = process.env.GITHUB_TOKEN;
  return new Octokit(auth ? { auth } : {});
}

export type CiState = 'success' | 'failure' | 'in_progress' | 'unknown';

export interface RepoStatus {
  name: string;
  type: string;
  url: string;
  ci: CiState;
  ciUrl?: string;
  lastRunAt?: string;
  openPRs: number;
}

export async function getRepoStatus(ok: Octokit, r: RepoRef): Promise<RepoStatus> {
  const url = `https://github.com/${ORG}/${r.name}`;
  let ci: CiState = 'unknown';
  let ciUrl: string | undefined;
  let lastRunAt: string | undefined;
  try {
    const runs = await ok.actions.listWorkflowRunsForRepo({
      owner: ORG,
      repo: r.name,
      branch: r.defaultBranch,
      per_page: 1,
    });
    const run = runs.data.workflow_runs[0];
    if (run) {
      ciUrl = run.html_url;
      lastRunAt = run.updated_at;
      ci = run.status !== 'completed' ? 'in_progress' : run.conclusion === 'success' ? 'success' : 'failure';
    }
  } catch {
    /* repo sem Actions ou sem acesso */
  }
  let openPRs = 0;
  try {
    const prs = await ok.pulls.list({ owner: ORG, repo: r.name, state: 'open', per_page: 100 });
    openPRs = prs.data.length;
  } catch {
    /* ignore */
  }
  return { name: r.name, type: r.type, url, ci, ciUrl, lastRunAt, openPRs };
}

const SENSITIVE = new Set(['clinical', 'auth', 'schema']);

export interface SpecInfo {
  id: string;
  title: string;
  area: string;
  path: string; // relativo a demo/ (ex.: specs/001-apply-discount.md)
  sensitive: boolean;
}

function parseFront(raw: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return meta;
}

async function fetchRaw(ok: Octokit, path: string): Promise<string> {
  const r = await ok.repos.getContent({
    owner: ORG,
    repo: PIPELINE_REPO,
    path,
    mediaType: { format: 'raw' },
  });
  // Com format raw o octokit devolve string em data
  return typeof r.data === 'string'
    ? r.data
    : Buffer.from((r.data as { content: string }).content, 'base64').toString('utf8');
}

export async function listSpecs(ok: Octokit): Promise<SpecInfo[]> {
  const res = await ok.repos.getContent({ owner: ORG, repo: PIPELINE_REPO, path: 'demo/specs' });
  const files = Array.isArray(res.data) ? res.data.filter((f) => f.name.endsWith('.md')) : [];
  const specs: SpecInfo[] = [];
  for (const f of files) {
    let meta: Record<string, string> = {};
    try {
      meta = parseFront(await fetchRaw(ok, f.path));
    } catch {
      /* ignore */
    }
    const area = meta.area ?? 'general';
    specs.push({
      id: meta.id ?? f.name.replace(/\.md$/, ''),
      title: meta.title ?? f.name,
      area,
      path: `specs/${f.name}`,
      sensitive: SENSITIVE.has(area),
    });
  }
  return specs.sort((a, b) => a.path.localeCompare(b.path));
}

export function isSensitiveArea(area: string): boolean {
  return SENSITIVE.has(area);
}

export interface PipelineRun {
  id: number;
  name: string;
  number: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null;
  url: string;
  at: string;
  event: string;
}

export async function pipelineRuns(ok: Octokit, perPage = 8): Promise<PipelineRun[]> {
  try {
    const res = await ok.actions.listWorkflowRuns({
      owner: ORG,
      repo: PIPELINE_REPO,
      workflow_id: PIPELINE_WORKFLOW,
      per_page: perPage,
    });
    return res.data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name ?? 'Pipeline',
      number: run.run_number,
      status: run.status ?? 'unknown',
      conclusion: run.conclusion,
      url: run.html_url,
      at: run.updated_at,
      event: run.event,
    }));
  } catch {
    return [];
  }
}

export async function recentRuns(ok: Octokit, perPage = 10): Promise<PipelineRun[]> {
  try {
    const res = await ok.actions.listWorkflowRunsForRepo({
      owner: ORG,
      repo: PIPELINE_REPO,
      per_page: perPage,
    });
    return res.data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name ?? 'CI',
      number: run.run_number,
      status: run.status ?? 'unknown',
      conclusion: run.conclusion,
      url: run.html_url,
      at: run.updated_at,
      event: run.event,
    }));
  } catch {
    return [];
  }
}

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  branch: string;
  author: string;
  draft: boolean;
  createdAt: string;
  isPipeline: boolean; // PR gerado pelo pipeline (branch feat/demo-*)
}

/** PRs abertos no devops-hub — os do pipeline (feat/demo-*) vêm primeiro. */
export async function recentPRs(ok: Octokit, perPage = 15): Promise<PullRequest[]> {
  try {
    const res = await ok.pulls.list({
      owner: ORG,
      repo: PIPELINE_REPO,
      state: 'open',
      per_page: perPage,
      sort: 'created',
      direction: 'desc',
    });
    const prs = res.data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      branch: pr.head.ref,
      author: pr.user?.login ?? '—',
      draft: pr.draft ?? false,
      createdAt: pr.created_at,
      isPipeline: pr.head.ref.startsWith('feat/demo-'),
    }));
    return prs.sort((a, b) => Number(b.isPipeline) - Number(a.isPipeline));
  } catch {
    return [];
  }
}

export async function dispatchPipeline(ok: Octokit, spec: string): Promise<void> {
  await ok.actions.createWorkflowDispatch({
    owner: ORG,
    repo: PIPELINE_REPO,
    workflow_id: PIPELINE_WORKFLOW,
    ref: 'main',
    inputs: { spec },
  });
}
