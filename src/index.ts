/**
 * Simple Task Master - Library exports
 *
 * This file exports the public API for programmatic use of STM
 */

// Core classes
export { TaskManager } from './lib/task-manager';
export { LockManager } from './lib/lock-manager';

// Workspace utilities
export { findWorkspaceRoot, getTasksDirectory, getWorkspaceRoot } from './lib/workspace';

// Types
export type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListFilters,
  TaskManagerConfig,
  Config,
  LockFile
} from './lib/types';

// Validation functions
export { isTask, isConfig, isLockFile, validateTask, validateConfig } from './lib/schema';

// Error classes
export { ValidationError, FileSystemError, LockError, NotFoundError } from './lib/errors';

// Constants
export { CURRENT_SCHEMA_VERSION, DEFAULT_CONFIG } from './lib/constants';
