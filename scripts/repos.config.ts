/**
 * Configuração central dos repositórios da org `lifesystemsufpr`.
 * O bootstrap-repo.ts itera sobre essa lista pra aplicar templates e regras.
 *
 * Quando rodar com o MCP do GitHub conectado, ajustar `packageManager`, `coverageThreshold`
 * e `workingDirectory` conforme o estado real de cada repo.
 */

export type RepoType = 'node-backend' | 'node-frontend' | 'node-mobile' | 'kotlin';

export type PackageManager = 'pnpm' | 'npm' | 'yarn';

export interface RepoConfig {
  /** Nome do repositório (sem org). */
  name: string;
  /** Tipo, determina qual ci template + workflow reutilizável aplicar. */
  type: RepoType;
  /** Branch principal do repo. */
  defaultBranch: string;
  /** Package manager (Node) ou ignorado (Kotlin). */
  packageManager?: PackageManager;
  /** Path relativo do código dentro do repo, se for monorepo. */
  workingDirectory?: string;
  /** Comando extra pós-install no CI (ex.: 'npx prisma generate'). */
  setupCommand?: string;
  /** Threshold de cobertura inicial. */
  coverageThreshold: number;
  /** Aplicar branch protection no defaultBranch? */
  protectBranch: boolean;
  /** Quantos reviews obrigatórios em PR. */
  requiredReviews: number;
  /** Status checks obrigatórios pra merge (devem bater com job names do CI). */
  requiredChecks: string[];
}

export const ORG = 'lifesystemsufpr';

export const REPOS: RepoConfig[] = [
  {
    name: 'auth-service',
    type: 'node-backend',
    defaultBranch: 'main',
    packageManager: 'npm',
    setupCommand: 'npx prisma generate', // @prisma/client precisa do client gerado p/ build/lint
    coverageThreshold: 60, // crítico, threshold maior
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['Lint', 'Typecheck', 'Unit tests', 'Build'],
  },
  {
    name: 'tecnoaging-back',
    type: 'node-backend',
    defaultBranch: 'main',
    packageManager: 'npm',
    coverageThreshold: 50,
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['Lint', 'Typecheck', 'Unit tests', 'Build'],
  },
  {
    name: 'ivcf-back',
    type: 'node-backend',
    defaultBranch: 'main',
    packageManager: 'npm',
    coverageThreshold: 50,
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['Lint', 'Typecheck', 'Unit tests', 'Build'],
  },
  {
    name: 'tecnoaging-front',
    type: 'node-frontend',
    defaultBranch: 'main',
    packageManager: 'npm',
    coverageThreshold: 40,
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['Lint', 'Typecheck', 'Component + unit tests', 'Build'],
  },
  {
    name: 'ivcf-front',
    type: 'node-frontend',
    defaultBranch: 'main',
    packageManager: 'npm',
    coverageThreshold: 40,
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['Lint', 'Typecheck', 'Component + unit tests', 'Build'],
  },
  {
    name: 'ivcf-mobile',
    type: 'node-mobile',
    defaultBranch: 'main',
    packageManager: 'npm',
    coverageThreshold: 30,
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['Lint', 'Typecheck', 'Unit + component tests'],
  },
  {
    name: 'equilibrium-mobile',
    type: 'kotlin',
    defaultBranch: 'master',
    coverageThreshold: 30,
    protectBranch: true,
    requiredReviews: 1,
    requiredChecks: ['ktlint + detekt', 'Unit tests (JUnit)', 'Assemble debug'],
  },
];

/** Mapeia o tipo do repo pro template de ci.yml correspondente. */
export const CI_TEMPLATE_BY_TYPE: Record<RepoType, string> = {
  'node-backend': 'templates/.github/workflows/ci-backend.yml',
  'node-frontend': 'templates/.github/workflows/ci-frontend.yml',
  'node-mobile': 'templates/.github/workflows/ci-mobile.yml',
  kotlin: 'templates/.github/workflows/ci-kotlin.yml',
};

/**
 * Arquivos que vão pra TODOS os repos, independente do tipo.
 * Map: caminho-no-template -> caminho-no-repo-destino
 */
export const COMMON_FILES: Record<string, string> = {
  'templates/CODEOWNERS': '.github/CODEOWNERS',
  'templates/.github/PULL_REQUEST_TEMPLATE.md': '.github/PULL_REQUEST_TEMPLATE.md',
  'templates/.github/ISSUE_TEMPLATE/bug_report.md': '.github/ISSUE_TEMPLATE/bug_report.md',
  'templates/.github/ISSUE_TEMPLATE/feature_request.md': '.github/ISSUE_TEMPLATE/feature_request.md',
  'templates/.github/dependabot.yml': '.github/dependabot.yml',
};
