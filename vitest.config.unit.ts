import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/unit/**/*.test.ts', 'test/unit/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    testTimeout: 5000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**/*',
        'src/types/write-file-atomic.d.ts'
      ],
      thresholds: {
        lines: 95,
        functions: 90,
        branches: 85,
        statements: 95
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@commands': resolve(__dirname, './src/commands'),
      '@lib': resolve(__dirname, './src/lib'),
      '@types': resolve(__dirname, './src/types'),
      '@test': resolve(__dirname, './test')
    }
  }
});
