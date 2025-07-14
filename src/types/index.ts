/**
 * Core data models and TypeScript types for Simple Task Master
 */

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  DONE = 'done',
}

/**
 * Task interface matching the YAML schema
 */
export interface Task {
  /** Schema version */
  schema: number;

  /** Unique task identifier */
  id: number;

  /** Task title */
  title: string;

  /** Current task status */
  status: TaskStatus;

  /** ISO 8601 timestamp of when the task was created */
  created: string;

  /** ISO 8601 timestamp of when the task was last updated */
  updated: string;

  /** Array of tags associated with the task */
  tags: string[];

  /** Array of task IDs that this task depends on */
  dependencies: number[];
}

/**
 * Configuration interface for config.json
 */
export interface Config {
  /** Schema version */
  schema: number;

  /** Lock timeout in milliseconds (default: 30000) */
  lockTimeoutMs: number;

  /** Maximum task file size in bytes (default: 1048576) */
  maxTaskSizeBytes: number;
}

/**
 * Lock file interface for concurrent operation management
 */
export interface LockFile {
  /** Process ID holding the lock */
  pid: number;

  /** Command that acquired the lock */
  command: string;

  /** Timestamp when the lock was acquired */
  timestamp: number;
}

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

/**
 * Type guard to check if an object is a valid Task
 */
export function isTask(obj: unknown): obj is Task {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const task = obj as Record<string, unknown>;

  return (
    typeof task.schema === 'number' &&
    typeof task.id === 'number' &&
    typeof task.title === 'string' &&
    isTaskStatus(task.status) &&
    typeof task.created === 'string' &&
    typeof task.updated === 'string' &&
    Array.isArray(task.tags) &&
    task.tags.every((tag: unknown) => typeof tag === 'string') &&
    Array.isArray(task.dependencies) &&
    task.dependencies.every((dep: unknown) => typeof dep === 'number')
  );
}

/**
 * Type guard to check if an object is a valid Config
 */
export function isConfig(obj: unknown): obj is Config {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  return (
    typeof config.schema === 'number' &&
    typeof config.lockTimeoutMs === 'number' &&
    typeof config.maxTaskSizeBytes === 'number'
  );
}

/**
 * Type guard to check if an object is a valid LockFile
 */
export function isLockFile(obj: unknown): obj is LockFile {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const lock = obj as Record<string, unknown>;

  return (
    typeof lock.pid === 'number' &&
    typeof lock.command === 'string' &&
    typeof lock.timestamp === 'number'
  );
}
