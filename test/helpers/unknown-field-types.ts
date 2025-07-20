/**
 * Type helpers for unknown field testing
 */

import type { Task } from '@lib/types';

/**
 * Task type with unknown fields for testing
 */
export type TaskWithUnknownFields = Task & Record<string, unknown>;

/**
 * Type assertion helper for unknown fields
 */
export function asTaskWithUnknownFields(task: Task): TaskWithUnknownFields {
  return task as TaskWithUnknownFields;
}

/**
 * Type guard for checking if a value is a Task with unknown fields
 */
export function isTaskWithUnknownFields(value: unknown): value is TaskWithUnknownFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'status' in value
  );
}
