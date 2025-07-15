import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/performance/**/*.spec.ts'],
    testTimeout: 60000, // 60 seconds for performance tests
    hookTimeout: 70000,
    pool: 'forks', // Use forks instead of threads for performance tests
    isolate: false
  }
});
