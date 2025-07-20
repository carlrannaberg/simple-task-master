/**
 * Core types and interfaces for Simple Task Master
 */

export type TaskStatus = 'pending' | 'in-progress' | 'done';

export interface Task {
  /** Schema version for migration purposes */
  schema: number;
  /** Unique identifier for the task */
  id: number;
  /** Task title (used in filename generation) */
  title: string;
  /** Current status of the task */
  status: TaskStatus;
  /** Creation timestamp in ISO format */
  created: string;
  /** Last update timestamp in ISO format */
  updated: string;
  /** Associated tags for categorization */
  tags: string[];
  /** Task IDs that this task depends on */
  dependencies: number[];
  /** Markdown content body (description, details, validation) */
  content?: string;
  /** Allow arbitrary fields for external tool integration */
  [key: string]: unknown;
}

export interface TaskCreateInput {
  title: string;
  content?: string;
  tags?: string[];
  dependencies?: number[];
  status?: TaskStatus;
  /** Allow arbitrary fields for external tool integration */
  [key: string]: unknown;
}

export interface TaskUpdateInput {
  title?: string;
  status?: TaskStatus;
  tags?: string[];
  dependencies?: number[];
  content?: string;
  /** Allow arbitrary fields for external tool integration */
  [key: string]: unknown;
}

export interface TaskListFilters {
  status?: TaskStatus;
  tags?: string[];
  search?: string;
}

export interface TaskManagerConfig {
  /** Base directory for task storage */
  tasksDir: string;
  /** Maximum task file size in bytes (default: 1MB) */
  maxTaskSizeBytes?: number;
  /** Maximum task title length (default: 200) */
  maxTitleLength?: number;
  /** Maximum description length (default: 64KB) */
  maxDescriptionLength?: number;
}

// Error classes moved to ./errors.ts to avoid duplication

export interface Config {
  schema: number;
  lockTimeoutMs: number;
  maxTaskSizeBytes: number;
}

export interface LockFile {
  pid: number;
  command: string;
  timestamp: number;
}

export type OutputFormat = 'ndjson' | 'json' | 'yaml' | 'table' | 'csv' | 'markdown';

// Type guards
export function isTask(obj: unknown): obj is Task {
  const task = obj as Record<string, unknown>;
  return (
    typeof task === 'object' &&
    task !== null &&
    typeof task.schema === 'number' &&
    typeof task.id === 'number' &&
    typeof task.title === 'string' &&
    typeof task.status === 'string' &&
    ['pending', 'in-progress', 'done'].includes(task.status) &&
    typeof task.created === 'string' &&
    typeof task.updated === 'string' &&
    Array.isArray(task.tags) &&
    task.tags.every((tag: unknown) => typeof tag === 'string') &&
    Array.isArray(task.dependencies) &&
    task.dependencies.every((dep: unknown) => typeof dep === 'number')
  );
}

export function isConfig(obj: unknown): obj is Config {
  const config = obj as Record<string, unknown>;
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.schema === 'number' &&
    typeof config.lockTimeoutMs === 'number' &&
    typeof config.maxTaskSizeBytes === 'number'
  );
}

export function isLockFile(obj: unknown): obj is LockFile {
  const lock = obj as Record<string, unknown>;
  return (
    typeof lock === 'object' &&
    lock !== null &&
    typeof lock.pid === 'number' &&
    typeof lock.command === 'string' &&
    typeof lock.timestamp === 'number'
  );
}
