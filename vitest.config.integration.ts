import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/integration/**/*.test.ts', 'test/integration/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    testTimeout: 15000,
    hookTimeout: 20000,
    // Integration tests may run slower and need more time
    sequence: { shuffle: false },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**/*',
        'src/types/write-file-atomic.d.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 75,
        statements: 85
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
