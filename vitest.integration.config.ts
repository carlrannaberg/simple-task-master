import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/integration/**/*.spec.ts'],
    testTimeout: 10000, // 10 seconds for integration tests
    hookTimeout: 15000,
    pool: 'forks', // Use forks instead of threads for integration tests
    isolate: false
  }
});
