/**
 * Constants and default values for Simple Task Master
 */

import * as path from 'path';

/**
 * Current schema version
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  /** Default lock timeout in milliseconds (30 seconds) */
  LOCK_TIMEOUT_MS: 30000,

  /** Default maximum task file size in bytes (1MB) */
  MAX_TASK_SIZE_BYTES: 1048576,

  /** Lock check interval in milliseconds */
  LOCK_CHECK_INTERVAL_MS: 100,

  /** Maximum lock acquisition retries (5 seconds total wait) */
  MAX_LOCK_RETRIES: 50,

  /** Schema version */
  SCHEMA_VERSION: 1
} as const;

/**
 * File size limits
 */
export const FILE_LIMITS = {
  /** Maximum task file size in bytes (1MB) */
  MAX_TASK_SIZE: 1048576,

  /** Maximum title length in characters */
  MAX_TITLE_LENGTH: 200,

  /** Maximum description length in bytes (64KB) */
  MAX_DESCRIPTION_LENGTH: 65536,

  /** Maximum number of tags per task */
  MAX_TAGS: 50,

  /** Maximum number of dependencies per task */
  MAX_DEPENDENCIES: 100
} as const;

/**
 * Path constants
 */
export const PATHS = {
  /** Base directory name for STM */
  BASE_DIR: '.simple-task-master',

  /** Tasks subdirectory */
  TASKS_DIR: 'tasks',

  /** Config file name */
  CONFIG_FILE: 'config.json',

  /** Lock file name */
  LOCK_FILE: 'lock',

  /** Get full base directory path */
  getBaseDir: (projectRoot: string): string => path.join(projectRoot, PATHS.BASE_DIR),

  /** Get full tasks directory path */
  getTasksDir: (projectRoot: string): string =>
    path.join(projectRoot, PATHS.BASE_DIR, PATHS.TASKS_DIR),

  /** Get full config file path */
  getConfigPath: (projectRoot: string): string =>
    path.join(projectRoot, PATHS.BASE_DIR, PATHS.CONFIG_FILE),

  /** Get full lock file path */
  getLockPath: (projectRoot: string): string =>
    path.join(projectRoot, PATHS.BASE_DIR, PATHS.LOCK_FILE)
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  // Validation errors
  TITLE_REQUIRED: 'Task title is required',
  TITLE_TOO_LONG: `Task title exceeds ${FILE_LIMITS.MAX_TITLE_LENGTH} characters`,
  TITLE_INVALID_CHARS: 'Task title contains invalid filesystem characters',
  DESCRIPTION_TOO_LONG: `Task description exceeds ${FILE_LIMITS.MAX_DESCRIPTION_LENGTH} bytes`,
  INVALID_STATUS: 'Task status must be one of: pending, in-progress, done',
  INVALID_TASK_ID: 'Invalid task ID',
  TASK_NOT_FOUND: 'Task not found',
  DEPENDENCY_NOT_FOUND: 'Dependency task not found',
  CIRCULAR_DEPENDENCY: 'Circular dependency detected',
  TOO_MANY_TAGS: `Task cannot have more than ${FILE_LIMITS.MAX_TAGS} tags`,
  TOO_MANY_DEPENDENCIES: `Task cannot have more than ${FILE_LIMITS.MAX_DEPENDENCIES} dependencies`,

  // File system errors
  TASK_FILE_TOO_LARGE: `Task file exceeds maximum size of ${FILE_LIMITS.MAX_TASK_SIZE} bytes`,
  DIRECTORY_NOT_INITIALIZED: 'STM directory not initialized. Run "stm init" first',
  CONFIG_NOT_FOUND: 'Configuration file not found',
  INVALID_CONFIG: 'Invalid configuration file',

  // Lock errors
  LOCK_ACQUISITION_FAILED: 'Failed to acquire lock after maximum retries',
  LOCK_ALREADY_HELD: 'Lock is already held by another process',
  STALE_LOCK_DETECTED: 'Stale lock detected and removed',

  // Schema errors
  UNSUPPORTED_SCHEMA: 'Unsupported schema version',
  SCHEMA_MISMATCH: 'Task schema version does not match current version',

  // Generic errors
  UNKNOWN_ERROR: 'An unknown error occurred',
  PERMISSION_DENIED: 'Permission denied',
  DISK_FULL: 'Disk space exhausted'
} as const;

/**
 * File name patterns
 */
export const FILE_PATTERNS = {
  /** Pattern for task files */
  TASK_FILE: /^(\d+)-(.+)\.md$/,

  /** Invalid filename characters (filesystem-specific) */
  INVALID_FILENAME_CHARS: /[<>:"|?*\x00-\x1f]/g,

  /** ISO 8601 timestamp pattern */
  ISO_8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
} as const;

/**
 * CLI constants
 */
export const CLI = {
  /** Default command timeout in milliseconds */
  DEFAULT_TIMEOUT: 5000,

  /** Exit codes */
  EXIT_CODES: {
    SUCCESS: 0,
    ERROR: 1,
    INVALID_USAGE: 2,
    NOT_FOUND: 3,
    LOCK_FAILED: 4
  }
} as const;

/**
 * Output format constants
 */
export const OUTPUT_FORMATS = {
  /** Newline-delimited JSON */
  NDJSON: 'ndjson',

  /** Pretty table format */
  PRETTY: 'pretty',

  /** YAML format */
  YAML: 'yaml',

  /** Markdown format */
  MARKDOWN: 'markdown',

  /** CSV format */
  CSV: 'csv',

  /** JSON format */
  JSON: 'json'
} as const;

/**
 * Task status values
 */
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done'
} as const;

/**
 * Type for task status values
 */
export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
