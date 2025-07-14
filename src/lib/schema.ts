/**
 * Schema validation for Simple Task Master
 */

import { isTask, isConfig, isLockFile, type Task, type Config, type LockFile } from './types';

// Re-export type guards from types
export { isTask, isConfig, isLockFile };

/**
 * Current schema version
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Error thrown when schema validation fails
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Required fields for Task schema
 */
const REQUIRED_TASK_FIELDS = [
  'schema',
  'id',
  'title',
  'status',
  'created',
  'updated',
  'tags',
  'dependencies'
] as const;

/**
 * Allowed fields for Task schema (fail-fast on unknown fields)
 */
const ALLOWED_TASK_FIELDS = new Set(REQUIRED_TASK_FIELDS);

/**
 * Required fields for Config schema
 */
const REQUIRED_CONFIG_FIELDS = ['schema', 'lockTimeoutMs', 'maxTaskSizeBytes'] as const;

/**
 * Allowed fields for Config schema
 */
const ALLOWED_CONFIG_FIELDS = new Set(REQUIRED_CONFIG_FIELDS);

/**
 * Required fields for LockFile schema
 */
const REQUIRED_LOCK_FIELDS = ['pid', 'command', 'timestamp'] as const;

/**
 * Allowed fields for LockFile schema
 */
const ALLOWED_LOCK_FIELDS = new Set(REQUIRED_LOCK_FIELDS);

/**
 * Validates that an object has all required fields and no unknown fields
 */
function validateFields(
  obj: Record<string, unknown>,
  requiredFields: readonly string[],
  allowedFields: Set<string>,
  schemaName: string
): void {
  // Check for required fields
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new SchemaValidationError(`Missing required field '${field}' in ${schemaName}`, field);
    }
  }

  // Check for unknown fields (fail-fast)
  for (const field of Object.keys(obj)) {
    if (!allowedFields.has(field)) {
      throw new SchemaValidationError(
        `Unknown field '${field}' in ${schemaName}. Allowed fields: ${Array.from(allowedFields).join(', ')}`,
        field
      );
    }
  }
}

/**
 * Validates a Task object against the schema
 */
export function validateTask(obj: unknown): Task {
  if (typeof obj !== 'object' || obj === null) {
    throw new SchemaValidationError('Task must be an object');
  }

  const task = obj as Record<string, unknown>;

  // Validate required fields and reject unknown fields
  validateFields(task, REQUIRED_TASK_FIELDS, ALLOWED_TASK_FIELDS, 'Task');

  // Validate schema version
  if (task.schema !== CURRENT_SCHEMA_VERSION) {
    throw new SchemaValidationError(
      `Unsupported schema version ${task.schema}. Expected version ${CURRENT_SCHEMA_VERSION}`,
      'schema'
    );
  }

  // Validate field types
  if (!isTask(task)) {
    // Provide specific error messages for type mismatches
    if (typeof task.id !== 'number') {
      throw new SchemaValidationError('Task id must be a number', 'id');
    }
    if (typeof task.title !== 'string') {
      throw new SchemaValidationError('Task title must be a string', 'title');
    }
    if (
      typeof task.status !== 'string' ||
      !['pending', 'in-progress', 'done'].includes(task.status)
    ) {
      throw new SchemaValidationError(
        'Task status must be one of: pending, in-progress, done',
        'status'
      );
    }
    if (typeof task.created !== 'string') {
      throw new SchemaValidationError('Task created must be an ISO 8601 string', 'created');
    }
    if (typeof task.updated !== 'string') {
      throw new SchemaValidationError('Task updated must be an ISO 8601 string', 'updated');
    }
    if (!Array.isArray(task.tags)) {
      throw new SchemaValidationError('Task tags must be an array', 'tags');
    }
    if (!task.tags.every((tag: unknown) => typeof tag === 'string')) {
      throw new SchemaValidationError('All task tags must be strings', 'tags');
    }
    if (!Array.isArray(task.dependencies)) {
      throw new SchemaValidationError('Task dependencies must be an array', 'dependencies');
    }
    if (!task.dependencies.every((dep: unknown) => typeof dep === 'number')) {
      throw new SchemaValidationError('All task dependencies must be numbers', 'dependencies');
    }

    // Generic fallback (shouldn't reach here)
    throw new SchemaValidationError('Invalid task object');
  }

  // Validate ISO 8601 timestamps
  validateISO8601(task.created as string, 'created');
  validateISO8601(task.updated as string, 'updated');

  return task as Task;
}

/**
 * Validates a Config object against the schema
 */
export function validateConfig(obj: unknown): Config {
  if (typeof obj !== 'object' || obj === null) {
    throw new SchemaValidationError('Config must be an object');
  }

  const config = obj as Record<string, unknown>;

  // Validate required fields and reject unknown fields
  validateFields(config, REQUIRED_CONFIG_FIELDS, ALLOWED_CONFIG_FIELDS, 'Config');

  // Validate schema version
  if (config.schema !== CURRENT_SCHEMA_VERSION) {
    throw new SchemaValidationError(
      `Unsupported schema version ${config.schema}. Expected version ${CURRENT_SCHEMA_VERSION}`,
      'schema'
    );
  }

  // Validate field types
  if (!isConfig(config)) {
    if (typeof config.lockTimeoutMs !== 'number') {
      throw new SchemaValidationError('Config lockTimeoutMs must be a number', 'lockTimeoutMs');
    }
    if (typeof config.maxTaskSizeBytes !== 'number') {
      throw new SchemaValidationError(
        'Config maxTaskSizeBytes must be a number',
        'maxTaskSizeBytes'
      );
    }

    // Generic fallback
    throw new SchemaValidationError('Invalid config object');
  }

  // Validate ranges
  if ((config.lockTimeoutMs as number) <= 0) {
    throw new SchemaValidationError('Config lockTimeoutMs must be positive', 'lockTimeoutMs');
  }
  if ((config.maxTaskSizeBytes as number) <= 0) {
    throw new SchemaValidationError('Config maxTaskSizeBytes must be positive', 'maxTaskSizeBytes');
  }

  return config as Config;
}

/**
 * Validates a LockFile object against the schema
 */
export function validateLockFile(obj: unknown): LockFile {
  if (typeof obj !== 'object' || obj === null) {
    throw new SchemaValidationError('LockFile must be an object');
  }

  const lock = obj as Record<string, unknown>;

  // Validate required fields and reject unknown fields
  validateFields(lock, REQUIRED_LOCK_FIELDS, ALLOWED_LOCK_FIELDS, 'LockFile');

  // Validate field types
  if (!isLockFile(lock)) {
    if (typeof lock.pid !== 'number') {
      throw new SchemaValidationError('LockFile pid must be a number', 'pid');
    }
    if (typeof lock.command !== 'string') {
      throw new SchemaValidationError('LockFile command must be a string', 'command');
    }
    if (typeof lock.timestamp !== 'number') {
      throw new SchemaValidationError('LockFile timestamp must be a number', 'timestamp');
    }

    // Generic fallback
    throw new SchemaValidationError('Invalid lock file object');
  }

  // Validate ranges
  if ((lock.pid as number) <= 0) {
    throw new SchemaValidationError('LockFile pid must be positive', 'pid');
  }
  if ((lock.timestamp as number) <= 0) {
    throw new SchemaValidationError('LockFile timestamp must be positive', 'timestamp');
  }

  return lock as LockFile;
}

/**
 * Validates an ISO 8601 timestamp string
 */
function validateISO8601(timestamp: string, field: string): void {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

  if (!iso8601Regex.test(timestamp)) {
    throw new SchemaValidationError(
      `Invalid ISO 8601 timestamp in field '${field}': ${timestamp}`,
      field
    );
  }

  // Verify it's a valid date
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new SchemaValidationError(`Invalid date in field '${field}': ${timestamp}`, field);
  }
}

/**
 * Creates a default Config object
 */
export function createDefaultConfig(): Config {
  return {
    schema: CURRENT_SCHEMA_VERSION,
    lockTimeoutMs: 30000,
    maxTaskSizeBytes: 1048576
  };
}
