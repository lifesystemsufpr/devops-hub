/**
 * Utilidades puras sobre a configuração de repos — testáveis sem rede.
 *
 * `validateRepos` roda como pré-flight no sync-branch-protection (e pode ser
 * reusado no bootstrap) pra falhar cedo com mensagem clara, em vez de só
 * descobrir o erro quando a API do GitHub recusa.
 */
import { CI_TEMPLATE_BY_TYPE, type RepoConfig } from './repos.config.js';

/** Tipos que exigem package manager (Node). Kotlin não usa. */
const NODE_TYPES = new Set<RepoConfig['type']>(['node-backend', 'node-frontend', 'node-mobile']);

/** Valida a lista de repos; devolve as mensagens de problema (vazio = tudo ok). */
export function validateRepos(repos: RepoConfig[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const r of repos) {
    const tag = r.name || '(sem nome)';
    if (!r.name) problems.push('Repo sem `name`.');
    if (seen.has(r.name)) problems.push(`${tag}: nome duplicado.`);
    seen.add(r.name);

    if (!r.defaultBranch) problems.push(`${tag}: defaultBranch vazio.`);
    if (!(r.type in CI_TEMPLATE_BY_TYPE)) problems.push(`${tag}: tipo "${r.type}" sem template de CI.`);

    if (typeof r.coverageThreshold !== 'number' || r.coverageThreshold < 0 || r.coverageThreshold > 100) {
      problems.push(`${tag}: coverageThreshold deve estar entre 0 e 100 (atual: ${r.coverageThreshold}).`);
    }
    if (typeof r.requiredReviews !== 'number' || r.requiredReviews < 0) {
      problems.push(`${tag}: requiredReviews deve ser >= 0.`);
    }
    if (!Array.isArray(r.requiredChecks) || r.requiredChecks.length === 0) {
      problems.push(`${tag}: requiredChecks não pode ser vazio (branch protection travaria o merge).`);
    }
    if (NODE_TYPES.has(r.type) && !r.packageManager) {
      problems.push(`${tag}: tipo Node exige packageManager.`);
    }
  }

  return problems;
}

/**
 * Nome qualificado do check como o GitHub reporta quando um ci.yml chama um
 * workflow reutilizável: `<job-do-caller> / <job-da-reusable>`. Foot-gun nº 1
 * da branch protection — requiredChecks precisa bater com isso.
 */
export function qualifiedCheck(callerJob: string, reusableJob: string): string {
  return `${callerJob} / ${reusableJob}`;
}

/**
 * Aplica os defaults do repo a um template de ci.yml: threshold de cobertura,
 * package manager (npm/pnpm/yarn) e branch de gatilho. Pura/testável.
 */
export function applyCiTemplate(
  template: string,
  repo: Pick<RepoConfig, 'coverageThreshold' | 'packageManager' | 'defaultBranch' | 'setupCommand'>,
): string {
  let ci = template.replace(/coverage-threshold: \d+/, `coverage-threshold: ${repo.coverageThreshold}`);
  if (repo.packageManager) {
    ci = ci.replace(/package-manager: '[^']*'/, `package-manager: '${repo.packageManager}'`);
  }
  if (repo.defaultBranch !== 'main') {
    ci = ci.replace(/branches: \[main\]/g, `branches: [${repo.defaultBranch}]`);
  }
  if (repo.setupCommand) {
    // injeta o setup-command logo após o coverage-threshold (mesmo bloco `with:`)
    ci = ci.replace(
      /(coverage-threshold: \d+)/,
      `$1\n      setup-command: '${repo.setupCommand}'`,
    );
  }
  return ci;
}
