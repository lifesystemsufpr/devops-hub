import { describe, it, expect } from 'vitest';
import { validateRepos, qualifiedCheck, applyCiTemplate } from './config-utils.js';
import { REPOS, type RepoConfig } from './repos.config.js';

const base: RepoConfig = {
  name: 'svc',
  type: 'node-backend',
  defaultBranch: 'main',
  packageManager: 'npm',
  coverageThreshold: 50,
  protectBranch: true,
  requiredReviews: 1,
  requiredChecks: ['Lint'],
};

describe('validateRepos', () => {
  it('aceita a configuração real (REPOS) sem problemas', () => {
    expect(validateRepos(REPOS)).toEqual([]);
  });

  it('aceita um repo válido isolado', () => {
    expect(validateRepos([base])).toEqual([]);
  });

  it('acusa coverageThreshold fora de 0..100', () => {
    const out = validateRepos([{ ...base, coverageThreshold: 150 }]);
    expect(out.some((p) => /coverageThreshold/.test(p))).toBe(true);
  });

  it('acusa requiredChecks vazio', () => {
    const out = validateRepos([{ ...base, requiredChecks: [] }]);
    expect(out.some((p) => /requiredChecks/.test(p))).toBe(true);
  });

  it('exige packageManager em tipos Node', () => {
    const out = validateRepos([{ ...base, packageManager: undefined }]);
    expect(out.some((p) => /packageManager/.test(p))).toBe(true);
  });

  it('não exige packageManager em Kotlin', () => {
    const kotlin: RepoConfig = {
      ...base,
      name: 'k',
      type: 'kotlin',
      packageManager: undefined,
      requiredChecks: ['ktlint + detekt'],
    };
    expect(validateRepos([kotlin])).toEqual([]);
  });

  it('acusa nome duplicado', () => {
    const out = validateRepos([base, { ...base }]);
    expect(out.some((p) => /duplicado/.test(p))).toBe(true);
  });

  it('acusa defaultBranch vazio', () => {
    const out = validateRepos([{ ...base, defaultBranch: '' }]);
    expect(out.some((p) => /defaultBranch/.test(p))).toBe(true);
  });
});

describe('qualifiedCheck', () => {
  it('formata <caller> / <reusable> (foot-gun da branch protection)', () => {
    expect(qualifiedCheck('ci', 'Lint')).toBe('ci / Lint');
  });
});

describe('applyCiTemplate', () => {
  const tpl = [
    'on:',
    '  pull_request:',
    '    branches: [main]',
    '  push:',
    '    branches: [main]',
    'with:',
    "  package-manager: 'pnpm'",
    '  coverage-threshold: 30',
  ].join('\n');

  it('substitui o threshold de cobertura', () => {
    const out = applyCiTemplate(tpl, { coverageThreshold: 60, packageManager: 'npm', defaultBranch: 'main' });
    expect(out).toContain('coverage-threshold: 60');
    expect(out).not.toContain('coverage-threshold: 30');
  });

  it('substitui o package manager quando definido', () => {
    const out = applyCiTemplate(tpl, { coverageThreshold: 30, packageManager: 'npm', defaultBranch: 'main' });
    expect(out).toContain("package-manager: 'npm'");
    expect(out).not.toContain("package-manager: 'pnpm'");
  });

  it('mantém o package manager do template quando não definido (kotlin)', () => {
    const out = applyCiTemplate(tpl, { coverageThreshold: 30, packageManager: undefined, defaultBranch: 'main' });
    expect(out).toContain("package-manager: 'pnpm'");
  });

  it('troca todas as ocorrências de branch quando defaultBranch != main', () => {
    const out = applyCiTemplate(tpl, { coverageThreshold: 30, packageManager: 'npm', defaultBranch: 'master' });
    expect(out).toContain('branches: [master]');
    expect(out).not.toContain('branches: [main]');
  });

  it('não mexe nas branches quando defaultBranch é main', () => {
    const out = applyCiTemplate(tpl, { coverageThreshold: 30, packageManager: 'npm', defaultBranch: 'main' });
    expect((out.match(/branches: \[main\]/g) ?? []).length).toBe(2);
  });

  it('injeta setup-command no bloco with quando definido', () => {
    const out = applyCiTemplate(tpl, {
      coverageThreshold: 60,
      packageManager: 'npm',
      defaultBranch: 'main',
      setupCommand: 'npx prisma generate',
    });
    expect(out).toContain("coverage-threshold: 60\n      setup-command: 'npx prisma generate'");
  });

  it('não injeta setup-command quando ausente', () => {
    const out = applyCiTemplate(tpl, { coverageThreshold: 30, packageManager: 'npm', defaultBranch: 'main' });
    expect(out).not.toContain('setup-command');
  });
});
