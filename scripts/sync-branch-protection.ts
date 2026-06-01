#!/usr/bin/env tsx
/**
 * sync-branch-protection.ts
 *
 * Aplica regras de branch protection no `defaultBranch` de cada repo
 * configurado em repos.config.ts. Idempotente — pode rodar quantas vezes quiser.
 *
 * Uso:
 *   GITHUB_TOKEN=ghp_xxx tsx scripts/sync-branch-protection.ts
 *   DRY_RUN=1 tsx scripts/sync-branch-protection.ts
 *
 * O token precisa de escopo `repo` E permissão admin no repo (pra alterar protection).
 */

import { Octokit } from '@octokit/rest';
import { REPOS, ORG, type RepoConfig } from './repos.config.js';

const TOKEN = process.env.GITHUB_TOKEN;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!TOKEN && !DRY_RUN) {
  console.error('❌ GITHUB_TOKEN não definido.');
  process.exit(1);
}

const octokit = new Octokit({ auth: TOKEN });

async function protect(repo: RepoConfig) {
  console.log(`\n🔒 ${repo.name} → branch ${repo.defaultBranch}`);
  if (!repo.protectBranch) {
    console.log('  · protectBranch=false, skip');
    return;
  }
  if (DRY_RUN) {
    console.log(`  · [dry-run] aplicaria: ${repo.requiredReviews} review(s), checks: ${repo.requiredChecks.join(', ')}`);
    return;
  }

  await octokit.repos.updateBranchProtection({
    owner: ORG,
    repo: repo.name,
    branch: repo.defaultBranch,
    required_status_checks: {
      strict: true, // exige branch atualizado com base antes do merge
      contexts: repo.requiredChecks,
    },
    enforce_admins: false, // permite admin bypass (pra hotfix), mude pra true se quiser estrito
    required_pull_request_reviews: {
      required_approving_review_count: repo.requiredReviews,
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
    },
    restrictions: null, // sem restrição de quem pode push (org inteira)
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    required_conversation_resolution: true,
  });

  console.log(`  ✓ proteção aplicada`);
}

async function main() {
  console.log(`Aplicando branch protection em ${REPOS.length} repos @${ORG}`);
  if (DRY_RUN) console.log('🔬 DRY_RUN ativo\n');

  const results: { repo: string; ok: boolean; error?: string }[] = [];
  for (const repo of REPOS) {
    try {
      await protect(repo);
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
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
