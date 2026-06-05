import { describe, it, expect } from 'vitest';
import { validateRepos, qualifiedCheck } from './config-utils.js';
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
