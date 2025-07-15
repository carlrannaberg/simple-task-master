import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/e2e/**/*.spec.ts'],
    testTimeout: 30000, // 30 seconds for e2e tests
    hookTimeout: 40000,
    threads: false, // Disable worker threads for e2e tests
    isolate: false
  }
});
