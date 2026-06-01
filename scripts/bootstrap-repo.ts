#!/usr/bin/env tsx
/**
 * bootstrap-repo.ts
 *
 * Aplica os arquivos de governança (ci.yml, CODEOWNERS, templates, dependabot)
 * em todos os repos configurados em repos.config.ts, abrindo 1 PR por repo.
 *
 * Uso:
 *   GITHUB_TOKEN=ghp_xxx tsx scripts/bootstrap-repo.ts            # roda em todos
 *   GITHUB_TOKEN=ghp_xxx tsx scripts/bootstrap-repo.ts auth-service  # só um
 *   DRY_RUN=1 tsx scripts/bootstrap-repo.ts                       # não abre PR
 *
 * O token precisa de escopo `repo` (e `workflow` se forem alterar workflows).
 * Recomendado: criar um fine-grained PAT com acesso só aos 7 repos da org.
 */

import { Octokit } from '@octokit/rest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPOS,
  ORG,
  CI_TEMPLATE_BY_TYPE,
  COMMON_FILES,
  type RepoConfig,
} from './repos.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB_ROOT = resolve(__dirname, '..');

const TOKEN = process.env.GITHUB_TOKEN;
const DRY_RUN = process.env.DRY_RUN === '1';
const BRANCH_NAME = process.env.BOOTSTRAP_BRANCH ?? 'chore/devops-hub-bootstrap';

if (!TOKEN && !DRY_RUN) {
  console.error('❌ GITHUB_TOKEN não definido. Use DRY_RUN=1 pra testar sem token.');
  process.exit(1);
}

const octokit = new Octokit({ auth: TOKEN });

/** Lê um arquivo do hub e retorna como string. */
function readTemplate(relativePath: string): string {
  const full = resolve(HUB_ROOT, relativePath);
  if (!existsSync(full)) {
    throw new Error(`Template não encontrado: ${relativePath}`);
  }
  return readFileSync(full, 'utf8');
}

/** Lê o conteúdo atual de um arquivo no repo remoto, retorna null se não existir. */
async function getRemoteFile(repo: string, path: string, ref: string) {
  try {
    const { data } = await octokit.repos.getContent({ owner: ORG, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file') return null;
    return {
      sha: data.sha,
      content: Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf8'),
    };
  } catch (err: any) {
    if (err.status === 404) return null;
    throw err;
  }
}

/** Cria ou atualiza um arquivo no branch. */
async function upsertFile(
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
) {
  const existing = await getRemoteFile(repo, path, branch);
  if (existing && existing.content === content) {
    console.log(`  · ${path} — sem mudança, skip`);
    return false;
  }
  if (DRY_RUN) {
    console.log(`  · [dry-run] ${existing ? 'update' : 'create'} ${path}`);
    return true;
  }
  await octokit.repos.createOrUpdateFileContents({
    owner: ORG,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    sha: existing?.sha,
  });
  console.log(`  ✓ ${existing ? 'updated' : 'created'} ${path}`);
  return true;
}

/** Cria o branch de bootstrap a partir do default branch, se não existir. */
async function ensureBranch(repo: string, base: string, branch: string) {
  try {
    await octokit.repos.getBranch({ owner: ORG, repo, branch });
    console.log(`  · branch ${branch} já existe`);
    return;
  } catch (err: any) {
    if (err.status !== 404) throw err;
  }
  const { data: baseRef } = await octokit.git.getRef({
    owner: ORG,
    repo,
    ref: `heads/${base}`,
  });
  if (DRY_RUN) {
    console.log(`  · [dry-run] criaria branch ${branch} a partir de ${base}@${baseRef.object.sha.slice(0, 7)}`);
    return;
  }
  await octokit.git.createRef({
    owner: ORG,
    repo,
    ref: `refs/heads/${branch}`,
    sha: baseRef.object.sha,
  });
  console.log(`  ✓ branch ${branch} criado`);
}

/** Abre o PR (ou retorna o existente). */
async function openPR(repo: RepoConfig, branch: string) {
  const { data: existing } = await octokit.pulls.list({
    owner: ORG,
    repo: repo.name,
    head: `${ORG}:${branch}`,
    state: 'open',
  });
  if (existing.length) {
    console.log(`  · PR já aberto: #${existing[0].number} ${existing[0].html_url}`);
    return existing[0];
  }
  if (DRY_RUN) {
    console.log(`  · [dry-run] abriria PR ${branch} → ${repo.defaultBranch}`);
    return null;
  }
  const { data: pr } = await octokit.pulls.create({
    owner: ORG,
    repo: repo.name,
    head: branch,
    base: repo.defaultBranch,
    title: 'chore: bootstrap CI e governança via devops-hub',
    body: prBody(repo),
  });
  console.log(`  ✓ PR aberto: #${pr.number} ${pr.html_url}`);
  return pr;
}

function prBody(repo: RepoConfig): string {
  return [
    '## O que esse PR faz',
    '',
    'Configura CI/CD e governança neste repositório a partir do `devops-hub` central:',
    '',
    `- \`.github/workflows/ci.yml\` chamando o workflow reutilizável \`${repo.type}\` da org`,
    '- `.github/CODEOWNERS` sincronizado',
    '- Template de PR e issues (bug, feature)',
    '- `.github/dependabot.yml` (npm/gradle + github-actions)',
    '',
    '## Threshold de cobertura inicial',
    '',
    `\`${repo.coverageThreshold}%\` — será apertado gradualmente em PRs futuros.`,
    '',
    '## Próximos passos pós-merge',
    '',
    '- [ ] Verificar que o primeiro run do CI passa',
    '- [ ] Habilitar branch protection (automatizado via `sync-branch-protection.ts`)',
    '- [ ] Backfill de testes unitários (issue separada)',
    '',
    '---',
    '',
    '_Gerado automaticamente por `bootstrap-repo.ts` do [devops-hub](https://github.com/lifesystemsufpr/devops-hub)._',
  ].join('\n');
}

async function processRepo(repo: RepoConfig) {
  console.log(`\n📦 ${repo.name} (${repo.type})`);

  // Garante branch
  await ensureBranch(repo.name, repo.defaultBranch, BRANCH_NAME);

  // 1. ci.yml específico do tipo
  const ciTemplate = readTemplate(CI_TEMPLATE_BY_TYPE[repo.type]);
  // Threshold por repo: substitui o default do template pelo configurado
  const ci = ciTemplate.replace(
    /coverage-threshold: \d+/,
    `coverage-threshold: ${repo.coverageThreshold}`,
  );
  await upsertFile(
    repo.name,
    BRANCH_NAME,
    '.github/workflows/ci.yml',
    ci,
    'chore(ci): add reusable CI workflow',
  );

  // 2. Arquivos comuns
  for (const [src, dest] of Object.entries(COMMON_FILES)) {
    const content = readTemplate(src);
    await upsertFile(
      repo.name,
      BRANCH_NAME,
      dest,
      content,
      `chore: sync ${dest} from devops-hub`,
    );
  }

  // 3. PR
  await openPR(repo, BRANCH_NAME);
}

async function main() {
  const filter = process.argv[2];
  const targets = filter ? REPOS.filter((r) => r.name === filter) : REPOS;
  if (!targets.length) {
    console.error(`❌ Nenhum repo bate com filtro: ${filter}`);
    console.error(`   Disponíveis: ${REPOS.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`Bootstrap de ${targets.length} repo(s) em @${ORG}`);
  if (DRY_RUN) console.log('🔬 DRY_RUN ativo — nada será escrito no GitHub\n');

  const results: { repo: string; ok: boolean; error?: string }[] = [];
  for (const repo of targets) {
    try {
      await processRepo(repo);
      results.push({ repo: repo.name, ok: true });
    } catch (err: any) {
      console.error(`  ❌ ${repo.name}: ${err.message}`);
      results.push({ repo: repo.name, ok: false, error: err.message });
    }
  }

  console.log('\n=== Resumo ===');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.repo}${r.error ? ` — ${r.error}` : ''}`);
  }
  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
