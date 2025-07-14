import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/e2e/**/*.test.ts', 'test/e2e/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // E2E tests should run sequentially to avoid conflicts
    sequence: { shuffle: false },
    // Run tests one at a time to avoid resource conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      enabled: false, // E2E tests focus on workflow, not coverage
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@commands': resolve(__dirname, './src/commands'),
      '@lib': resolve(__dirname, './src/lib'),
      '@types': resolve(__dirname, './src/types'),
      '@test': resolve(__dirname, './test'),
    },
  },
});
