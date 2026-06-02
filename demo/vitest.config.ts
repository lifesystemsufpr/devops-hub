import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // json-summary é o que o gate de cobertura do devops-hub lê (coverage/coverage-summary.json)
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
