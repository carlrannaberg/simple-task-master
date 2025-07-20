/**
 * Schema validation unit tests
 *
 * Tests schema validation functionality for unknown field preservation
 * and core field validation. These tests validate that:
 * - Schema validation allows unknown fields in Tasks
 * - Core STM field types are validated strictly
 * - Unknown fields are preserved without validation
 * - Config and LockFile validation remains strict
 */

import { describe, it, expect } from 'vitest';

// Type alias for tasks with unknown fields
type ValidatedTask = Record<string, unknown>;
import {
  validateTask,
  validateConfig,
  validateLockFile,
  SchemaValidationError,
  CURRENT_SCHEMA_VERSION
} from '@lib/schema';
import type { Task, Config, LockFile } from '@lib/types';

describe('Schema Validation Unit Tests', () => {
  const createValidTask = (): Task => ({
    schema: CURRENT_SCHEMA_VERSION,
    id: 1,
    title: 'Test Task',
    status: 'pending',
    created: '2025-01-01T00:00:00.000Z',
    updated: '2025-01-01T00:00:00.000Z',
    tags: ['test'],
    dependencies: [],
    content: 'Test content'
  });

  const createValidConfig = (): Config => ({
    schema: CURRENT_SCHEMA_VERSION,
    lockTimeoutMs: 30000,
    maxTaskSizeBytes: 1048576
  });

  const createValidLockFile = (): LockFile => ({
    pid: 12345,
    command: 'stm update 1',
    timestamp: Date.now()
  });

  describe('Task schema validation with unknown fields', () => {
    it('should validate a basic task without unknown fields', () => {
      const task = createValidTask();
      const validated = validateTask(task);

      expect(validated).toEqual(task);
      expect(validated.id).toBe(1);
      expect(validated.title).toBe('Test Task');
      expect(validated.status).toBe('pending');
    });

    it('should preserve unknown fields in tasks', () => {
      const taskWithUnknownFields = {
        ...createValidTask(),
        priority: 'high',
        external_id: 'JIRA-123',
        custom_metadata: { team: 'backend', sprint: 5 },
        assignee: 'john.doe@example.com'
      };

      const validated = validateTask(taskWithUnknownFields);

      // Core fields should be validated and preserved
      expect(validated.id).toBe(1);
      expect(validated.title).toBe('Test Task');
      expect(validated.status).toBe('pending');

      // Unknown fields should be preserved without validation
      expect((validated as ValidatedTask).priority).toBe('high');
      expect((validated as ValidatedTask).external_id).toBe('JIRA-123');
      expect((validated as ValidatedTask).custom_metadata).toEqual({ team: 'backend', sprint: 5 });
      expect((validated as ValidatedTask).assignee).toBe('john.doe@example.com');
    });

    it('should validate core field types strictly while preserving unknown fields', () => {
      const taskWithMixedFields = {
        ...createValidTask(),
        // Valid unknown fields with various types
        string_field: 'text value',
        number_field: 42,
        boolean_field: true,
        array_field: ['item1', 'item2'],
        object_field: { nested: 'value' },
        null_field: null,
        undefined_field: undefined
      };

      const validated = validateTask(taskWithMixedFields);

      // All unknown fields should be preserved regardless of type
      expect((validated as ValidatedTask).string_field).toBe('text value');
      expect((validated as ValidatedTask).number_field).toBe(42);
      expect((validated as ValidatedTask).boolean_field).toBe(true);
      expect((validated as ValidatedTask).array_field).toEqual(['item1', 'item2']);
      expect((validated as ValidatedTask).object_field).toEqual({ nested: 'value' });
      expect((validated as ValidatedTask).null_field).toBe(null);
      expect((validated as ValidatedTask).undefined_field).toBe(undefined);
    });

    it('should reject invalid core field types', () => {
      const invalidTask = {
        ...createValidTask(),
        id: 'not-a-number', // Invalid core field type
        priority: 'high' // Valid unknown field
      };

      expect(() => validateTask(invalidTask)).toThrow(SchemaValidationError);
      expect(() => validateTask(invalidTask)).toThrow('Core field \'id\' in Task must be of type number, got string');
    });

    it('should reject missing required core fields', () => {
      const incompleteTask = {
        schema: CURRENT_SCHEMA_VERSION,
        title: 'Test Task',
        // Missing required fields: id, status, created, updated, tags, dependencies
        priority: 'high' // Unknown field should not affect validation
      };

      expect(() => validateTask(incompleteTask)).toThrow(SchemaValidationError);
      expect(() => validateTask(incompleteTask)).toThrow('Missing required core field \'id\' in Task');
    });

    it('should validate required core field types with unknown fields present', () => {
      const invalidCoreFieldTask = {
        ...createValidTask(),
        status: 'invalid-status', // Invalid core field value
        priority: 'high', // Valid unknown field
        external_id: 'JIRA-123' // Valid unknown field
      };

      expect(() => validateTask(invalidCoreFieldTask)).toThrow(SchemaValidationError);
      expect(() => validateTask(invalidCoreFieldTask)).toThrow('Task status must be one of: pending, in-progress, done');
    });

    it('should preserve unknown fields with special characters and various data types', () => {
      const taskWithSpecialFields = {
        ...createValidTask(),
        'field-with-dashes': 'dash value',
        'field_with_underscores': 'underscore value',
        'field.with.dots': 'dot value',
        'FieldWithNumbers123': 'mixed case value',
        'UPPERCASE_FIELD': 'uppercase value',
        'field\tname': 'tab value', // Tab characters should be allowed
        'unicode_field': 'unicode value 🚀',
        nested_object: {
          deep: {
            value: 'nested',
            array: [1, 2, 3],
            boolean: false
          }
        },
        large_array: Array.from({ length: 100 }, (_, i) => `item${i}`),
        timestamp_field: '2025-01-01T12:00:00Z',
        numeric_string: '12345'
      };

      const validated = validateTask(taskWithSpecialFields);

      // All special field names and values should be preserved
      expect((validated as ValidatedTask)['field-with-dashes']).toBe('dash value');
      expect((validated as ValidatedTask)['field_with_underscores']).toBe('underscore value');
      expect((validated as ValidatedTask)['field.with.dots']).toBe('dot value');
      expect((validated as ValidatedTask)['FieldWithNumbers123']).toBe('mixed case value');
      expect((validated as ValidatedTask)['UPPERCASE_FIELD']).toBe('uppercase value');
      expect((validated as ValidatedTask)['field\tname']).toBe('tab value');
      expect((validated as ValidatedTask)['unicode_field']).toBe('unicode value 🚀');
      expect((validated as ValidatedTask).nested_object).toEqual({
        deep: {
          value: 'nested',
          array: [1, 2, 3],
          boolean: false
        }
      });
      expect((validated as ValidatedTask).large_array).toHaveLength(100);
      expect((validated as ValidatedTask).timestamp_field).toBe('2025-01-01T12:00:00Z');
      expect((validated as ValidatedTask).numeric_string).toBe('12345');
    });

    it('should validate ISO 8601 timestamps for core fields', () => {
      const taskWithInvalidTimestamp = {
        ...createValidTask(),
        created: 'invalid-timestamp',
        priority: 'high' // Unknown field
      };

      expect(() => validateTask(taskWithInvalidTimestamp)).toThrow(SchemaValidationError);
      expect(() => validateTask(taskWithInvalidTimestamp)).toThrow('Invalid ISO 8601 timestamp');
    });

    it('should validate schema version strictly', () => {
      const taskWithInvalidSchema = {
        ...createValidTask(),
        schema: 999, // Invalid schema version
        priority: 'high' // Unknown field
      };

      expect(() => validateTask(taskWithInvalidSchema)).toThrow(SchemaValidationError);
      expect(() => validateTask(taskWithInvalidSchema)).toThrow('Unsupported schema version 999');
    });

    it('should validate array field contents for core fields', () => {
      const taskWithInvalidArrays = {
        ...createValidTask(),
        tags: ['valid', 123, 'invalid'], // Mixed types in core array field
        priority: ['high', 'urgent'] // Unknown array field (should be preserved)
      };

      expect(() => validateTask(taskWithInvalidArrays)).toThrow(SchemaValidationError);
      expect(() => validateTask(taskWithInvalidArrays)).toThrow('All task tags must be strings');
    });

    it('should preserve unknown fields with empty values', () => {
      const taskWithEmptyFields = {
        ...createValidTask(),
        empty_string: '',
        empty_array: [],
        empty_object: {},
        zero_number: 0,
        false_boolean: false
      };

      const validated = validateTask(taskWithEmptyFields);

      expect((validated as ValidatedTask).empty_string).toBe('');
      expect((validated as ValidatedTask).empty_array).toEqual([]);
      expect((validated as ValidatedTask).empty_object).toEqual({});
      expect((validated as ValidatedTask).zero_number).toBe(0);
      expect((validated as ValidatedTask).false_boolean).toBe(false);
    });
  });

  describe('Config schema validation remains strict', () => {
    it('should validate a basic config without unknown fields', () => {
      const config = createValidConfig();
      const validated = validateConfig(config);

      expect(validated).toEqual(config);
    });

    it('should reject unknown fields in config', () => {
      const configWithUnknownFields = {
        ...createValidConfig(),
        unknownField: 'should be rejected'
      };

      expect(() => validateConfig(configWithUnknownFields)).toThrow(SchemaValidationError);
      expect(() => validateConfig(configWithUnknownFields)).toThrow(
        'Unknown field \'unknownField\' in Config'
      );
    });

    it('should validate config field types strictly', () => {
      const invalidConfig = {
        ...createValidConfig(),
        lockTimeoutMs: 'not-a-number'
      };

      expect(() => validateConfig(invalidConfig)).toThrow(SchemaValidationError);
      expect(() => validateConfig(invalidConfig)).toThrow('Config lockTimeoutMs must be a number');
    });

    it('should validate config field ranges', () => {
      const configWithInvalidRange = {
        ...createValidConfig(),
        lockTimeoutMs: -1
      };

      expect(() => validateConfig(configWithInvalidRange)).toThrow(SchemaValidationError);
      expect(() => validateConfig(configWithInvalidRange)).toThrow('Config lockTimeoutMs must be positive');
    });
  });

  describe('LockFile schema validation remains strict', () => {
    it('should validate a basic lock file without unknown fields', () => {
      const lockFile = createValidLockFile();
      const validated = validateLockFile(lockFile);

      expect(validated).toEqual(lockFile);
    });

    it('should reject unknown fields in lock file', () => {
      const lockFileWithUnknownFields = {
        ...createValidLockFile(),
        unknownField: 'should be rejected'
      };

      expect(() => validateLockFile(lockFileWithUnknownFields)).toThrow(SchemaValidationError);
      expect(() => validateLockFile(lockFileWithUnknownFields)).toThrow(
        'Unknown field \'unknownField\' in LockFile'
      );
    });

    it('should validate lock file field types strictly', () => {
      const invalidLockFile = {
        ...createValidLockFile(),
        pid: 'not-a-number'
      };

      expect(() => validateLockFile(invalidLockFile)).toThrow(SchemaValidationError);
      expect(() => validateLockFile(invalidLockFile)).toThrow('LockFile pid must be a number');
    });

    it('should validate lock file field ranges', () => {
      const lockFileWithInvalidRange = {
        ...createValidLockFile(),
        pid: -1
      };

      expect(() => validateLockFile(lockFileWithInvalidRange)).toThrow(SchemaValidationError);
      expect(() => validateLockFile(lockFileWithInvalidRange)).toThrow('LockFile pid must be positive');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined objects', () => {
      expect(() => validateTask(null)).toThrow('Task must be an object');
      expect(() => validateTask(undefined)).toThrow('Task must be an object');
      expect(() => validateConfig(null)).toThrow('Config must be an object');
      expect(() => validateLockFile(null)).toThrow('LockFile must be an object');
    });

    it('should handle non-object types', () => {
      expect(() => validateTask('string')).toThrow('Task must be an object');
      expect(() => validateTask(123)).toThrow('Task must be an object');
      // Arrays are objects in JavaScript, so they will pass the object check
      // but fail on missing required fields
      expect(() => validateTask([])).toThrow('Missing required core field \'schema\' in Task');
      expect(() => validateConfig(true)).toThrow('Config must be an object');
      expect(() => validateLockFile(false)).toThrow('LockFile must be an object');
    });

    it('should provide specific error field information', () => {
      const invalidTask = {
        ...createValidTask(),
        id: 'invalid'
      };

      try {
        validateTask(invalidTask);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        expect((error as SchemaValidationError).field).toBe('id');
        expect((error as SchemaValidationError).message).toContain('Core field \'id\' in Task must be of type number, got string');
      }
    });

    it('should handle deeply nested unknown fields', () => {
      const taskWithDeepNesting = {
        ...createValidTask(),
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep nested value',
                array: [
                  {
                    nested_array_obj: 'nested in array'
                  }
                ]
              }
            }
          }
        }
      };

      const validated = validateTask(taskWithDeepNesting);
      expect((validated as ValidatedTask).level1.level2.level3.level4.value).toBe('deep nested value');
      expect(
        (validated as ValidatedTask).level1.level2.level3.level4.array[0].nested_array_obj
      ).toBe('nested in array');
    });

    it('should handle circular references in unknown fields gracefully', () => {
      const taskWithCircular = {
        ...createValidTask()
      };

      // Create a circular reference in unknown field
      const circularObj: Record<string, unknown> = { name: 'circular' };
      circularObj.self = circularObj;
      (taskWithCircular as ValidatedTask).circular_field = circularObj;

      // Validation should not crash on circular references
      const validated = validateTask(taskWithCircular);
      expect((validated as ValidatedTask).circular_field.name).toBe('circular');
      expect((validated as ValidatedTask).circular_field.self).toBe(
        (validated as ValidatedTask).circular_field
      );
    });
  });
});
