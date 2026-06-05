// @ts-check
// Flat config (ESLint 9). Lint do tooling próprio do devops-hub (scripts/).
// Dashboard e demo têm toolchain próprio e ficam de fora deste lint.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Dashboard tem lint próprio (next). Da demo, lintamos só o código autoral
    // do pipeline; src/ (app gerado) e artefatos ficam de fora.
    ignores: [
      'node_modules',
      'dist',
      'coverage',
      '.next',
      'dashboard',
      'demo/src',
      'demo/node_modules',
      'demo/coverage',
      'demo/dist',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.ts', 'demo/pipeline/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { process: 'readonly', console: 'readonly' },
    },
    rules: {
      // Permite descartar args/vars com prefixo _ (padrão em handlers e catch).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` é ruído pontual no tooling de glue; avisa em vez de quebrar.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
