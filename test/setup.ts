import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

// Import custom matchers
import './helpers/assertions/custom-matchers';

/**
 * Global test setup and configuration
 */

// Track temporary directories created during tests
const tempDirectories = new Set<string>();

// Original working directory
let _originalCwd: string;

// Global setup - runs once before all tests
beforeAll(async () => {
  _originalCwd = process.cwd();

  // Set up any global test configuration
  process.env.NODE_ENV = 'test';

  // Increase timeout for slow operations in tests
  process.env.TEST_TIMEOUT = '30000';

  // Console setup for tests
  setupTestConsole();
});

// Global teardown - runs once after all tests
afterAll(async () => {
  // Clean up any remaining temporary directories
  await cleanupTempDirectories();

  // Restore console
  restoreConsole();
});

// Per-test setup
beforeEach(() => {
  // Reset any global state
  vi.clearAllMocks();

  // Reset console mocks if they exist
  // eslint-disable-next-line no-console
  if (vi.isMockFunction(console.log)) {
    // eslint-disable-next-line no-console
    vi.mocked(console.log).mockClear();
  }
  if (vi.isMockFunction(console.warn)) {
    vi.mocked(console.warn).mockClear();
  }
  if (vi.isMockFunction(console.error)) {
    vi.mocked(console.error).mockClear();
  }
});

// Per-test teardown
afterEach(async () => {
  // Clean up any temp directories created in this test
  await cleanupTempDirectories();
});

/**
 * Console setup for testing
 */
let originalConsole: {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  info: typeof console.info;
  debug: typeof console.debug;
};

function setupTestConsole(): void {
  // Store original console methods
  originalConsole = {
    // eslint-disable-next-line no-console
    log: console.log,
    warn: console.warn,
    error: console.error,
    // eslint-disable-next-line no-console
    info: console.info,
    // eslint-disable-next-line no-console
    debug: console.debug
  };

  // Set up quiet mode for tests unless debugging
  const isDebug = process.env.DEBUG === 'true' || process.env.VITEST_DEBUG === 'true';

  if (!isDebug) {
    // Suppress console output during tests unless it's an error
    // eslint-disable-next-line no-console
    console.log = vi.fn();
    // eslint-disable-next-line no-console
    console.info = vi.fn();
    // eslint-disable-next-line no-console
    console.debug = vi.fn();

    // Keep warnings and errors visible but track them
    console.warn = vi.fn((...args) => {
      if (process.env.SHOW_WARNINGS === 'true') {
        originalConsole.warn(...args);
      }
    });

    console.error = vi.fn((...args) => {
      if (process.env.SHOW_ERRORS !== 'false') {
        originalConsole.error(...args);
      }
    });
  }
}

function restoreConsole(): void {
  if (originalConsole) {
    // eslint-disable-next-line no-console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    // eslint-disable-next-line no-console
    console.info = originalConsole.info;
    // eslint-disable-next-line no-console
    console.debug = originalConsole.debug;
  }
}

/**
 * Temporary directory management
 */
export async function createTempDirectory(prefix = 'stm-test-'): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), prefix));
  tempDirectories.add(tempDir);
  return tempDir;
}

export async function cleanupTempDirectory(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDirectories.delete(tempDir);
  } catch (error) {
    console.warn(`Failed to clean up temp directory ${tempDir}: ${error}`);
  }
}

async function cleanupTempDirectories(): Promise<void> {
  const cleanupPromises = Array.from(tempDirectories).map((dir) => cleanupTempDirectory(dir));
  await Promise.allSettled(cleanupPromises);
  tempDirectories.clear();
}

/**
 * Test environment utilities
 */
export const testEnv = {
  /**
   * Check if we're in debug mode
   */
  isDebug(): boolean {
    return process.env.DEBUG === 'true' || process.env.VITEST_DEBUG === 'true';
  },

  /**
   * Check if we're running in CI
   */
  isCI(): boolean {
    return process.env.CI === 'true';
  },

  /**
   * Get test timeout from environment
   */
  getTimeout(): number {
    const timeout = process.env.TEST_TIMEOUT;
    return timeout ? parseInt(timeout, 10) : 5000;
  },

  /**
   * Enable console output for debugging
   */
  enableConsole(): void {
    restoreConsole();
  },

  /**
   * Disable console output
   */
  disableConsole(): void {
    setupTestConsole();
  }
};

/**
 * Test isolation utilities
 */
export const testIsolation = {
  /**
   * Run a test in an isolated directory
   */
  async inTempDir<T>(fn: (tempDir: string) => Promise<T>): Promise<T> {
    const tempDir = await createTempDirectory();

    try {
      return await fn(tempDir);
    } finally {
      await cleanupTempDirectory(tempDir);
    }
  },

  /**
   * Run a test with environment variables
   */
  async withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const originalEnv: Record<string, string | undefined> = {};

    // Store original values and set new ones
    for (const [key, value] of Object.entries(env)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }

    try {
      return await fn();
    } finally {
      // Restore original values
      for (const [key, originalValue] of Object.entries(originalEnv)) {
        if (originalValue === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalValue;
        }
      }
    }
  },

  /**
   * Run a test with mocked time
   */
  withMockedTime<T>(mockDate: Date, fn: () => T): T {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
    const dateConstructorSpy = vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

    try {
      return fn();
    } finally {
      dateSpy.mockRestore();
      dateConstructorSpy.mockRestore();
    }
  }
};

/**
 * Performance testing utilities
 */
export const performance = {
  /**
   * Measure execution time
   */
  async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  /**
   * Assert that an operation completes within a time limit
   */
  async expectWithinTime<T>(fn: () => Promise<T>, maxDuration: number): Promise<T> {
    const { result, duration } = await this.measure(fn);

    if (duration > maxDuration) {
      throw new Error(`Operation took ${duration}ms, expected <= ${maxDuration}ms`);
    }

    return result;
  },

  /**
   * Run a function multiple times and get statistics
   */
  async benchmark<T>(
    fn: () => Promise<T>,
    iterations = 10
  ): Promise<{
    results: T[];
    durations: number[];
    average: number;
    min: number;
    max: number;
    median: number;
  }> {
    const results: T[] = [];
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measure(fn);
      results.push(result);
      durations.push(duration);
    }

    const sorted = [...durations].sort((a, b) => a - b);

    return {
      results,
      durations,
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }
};

/**
 * Error testing utilities
 */
export const errorTesting = {
  /**
   * Assert that a function throws a specific error
   */
  async expectError<E extends Error>(
    fn: () => Promise<unknown>,
    errorClass: new (...args: unknown[]) => E,
    messagePattern?: string | RegExp
  ): Promise<E> {
    let thrownError: unknown;

    try {
      await fn();
      throw new Error('Expected function to throw an error, but it did not');
    } catch (error) {
      thrownError = error;
    }

    if (!(thrownError instanceof errorClass)) {
      throw new Error(
        `Expected error of type ${errorClass.name}, but got ${thrownError?.constructor.name}`
      );
    }

    if (messagePattern) {
      const pattern =
        typeof messagePattern === 'string'
          ? new RegExp(messagePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          : messagePattern;

      if (!pattern.test(thrownError.message)) {
        throw new Error(
          `Expected error message to match ${pattern}, but got: ${thrownError.message}`
        );
      }
    }

    return thrownError;
  }
};

// Export setup utilities for use in tests
export { setupTestConsole, restoreConsole, cleanupTempDirectories };
