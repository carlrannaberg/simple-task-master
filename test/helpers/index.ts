/**
 * Test helpers index - exports all testing utilities
 */

// Test workspace utilities
export { TestWorkspace } from './test-workspace';

// Mock implementations
export { MockFileSystem, MockTaskStore } from './mocks';

// Test data builders
export { TaskBuilder, TaskFactory } from './builders';

// CLI testing utilities
export {
  runSTM,
  runSTMSuccess,
  runSTMFailure,
  CLITestRunner,
  cliUtils,
  type CLIResult,
  type CLIRunOptions,
} from './cli-runner';

// Custom matchers
export { taskMatchers } from './assertions/custom-matchers';

// Temporary directory utilities
export {
  TempDirManager,
  tempUtils,
  globalTempManager,
  temp,
  type DirectoryStructure,
} from './temp-utils';

// Test fixtures
export { TestFixtures } from '../fixtures/fixtures';

// Setup utilities (from setup.ts)
export {
  createTempDirectory,
  cleanupTempDirectory,
  testEnv,
  testIsolation,
  performance,
  errorTesting,
} from '../setup';
