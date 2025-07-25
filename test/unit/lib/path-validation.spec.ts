/**
 * Tests for path validation utilities
 */

import { describe, it, expect } from 'vitest';
import { validateTasksDir } from '@lib/path-validation';
import { ValidationError } from '@lib/errors';
import * as path from 'path';

describe('validateTasksDir', () => {
  describe('basic normalization', () => {
    it('should normalize paths and remove trailing slashes', () => {
      expect(validateTasksDir('tasks/')).toBe('tasks');
      expect(validateTasksDir('./tasks/')).toBe('tasks');
      expect(validateTasksDir('my-tasks///')).toBe('my-tasks');
    });

    it('should normalize path separators', () => {
      expect(validateTasksDir('./tasks')).toBe('tasks');
      // On Windows, backslashes are normalized to forward slashes
      // On Unix systems, backslashes are preserved as literal characters
      const result = validateTasksDir('.\\tasks');
      expect(result === 'tasks' || result === '.\\tasks').toBe(true);
    });
  });

  describe('directory traversal prevention', () => {
    it('should reject paths with .. sequences', () => {
      expect(() => validateTasksDir('../tasks')).toThrow(ValidationError);
      expect(() => validateTasksDir('../tasks')).toThrow(
        'Tasks directory path cannot contain directory traversal sequences (..)'
      );
      expect(() => validateTasksDir('tasks/../other')).toThrow(ValidationError);
      expect(() => validateTasksDir('../../tasks')).toThrow(ValidationError);
    });
  });

  describe('system directory prevention', () => {
    it('should reject system directories', () => {
      expect(() => validateTasksDir('/etc/tasks')).toThrow(ValidationError);
      expect(() => validateTasksDir('/etc/tasks')).toThrow(
        'Cannot use system directories for task storage'
      );
      expect(() => validateTasksDir('/usr/tasks')).toThrow(ValidationError);
      expect(() => validateTasksDir('/bin/tasks')).toThrow(ValidationError);
      expect(() => validateTasksDir('/dev/tasks')).toThrow(ValidationError);
      expect(() => validateTasksDir('/proc/tasks')).toThrow(ValidationError);
      expect(() => validateTasksDir('/sys/tasks')).toThrow(ValidationError);
    });

    it('should allow temp directories even if they are in system paths', () => {
      expect(() => validateTasksDir('/tmp/test-tasks')).not.toThrow();
      expect(() => validateTasksDir('/var/folders/test/tasks')).not.toThrow();
      expect(() => validateTasksDir('/private/var/folders/test/tasks')).not.toThrow();
    });
  });

  describe('absolute path handling', () => {
    it('should allow absolute paths within reasonable distance', () => {
      // These should work if they're not too far from the project
      const cwd = process.cwd();
      const parentDir = path.dirname(cwd);
      const siblingDir = path.join(parentDir, 'sibling-tasks');

      // Should allow sibling directories (one level up)
      expect(() => validateTasksDir(siblingDir)).not.toThrow();
    });

    it('should reject absolute paths too far outside project', () => {
      // Create a path that goes up more than 5 levels
      // Since we're in /Users/carl/Development/agents/simple-task-master (6 levels deep),
      // a path at root level will go up exactly 5 levels, so we need to use a different approach
      const farPath = '/tasks'; // This should be far enough on most systems

      // Only test if we're deep enough in the file system
      const cwd = process.cwd();
      const cwdDepth = cwd.split(path.sep).filter((p) => p).length;

      if (cwdDepth > 5) {
        expect(() => validateTasksDir(farPath)).toThrow(ValidationError);
        expect(() => validateTasksDir(farPath)).toThrow(
          'Absolute paths too far outside the project directory'
        );
      } else {
        // Skip this test if we're not deep enough in the file system
        // Test will pass silently when directory structure doesn't allow testing this scenario
      }
    });
  });

  describe('file path prevention', () => {
    it('should reject paths that appear to be files', () => {
      expect(() => validateTasksDir('tasks.json')).toThrow(ValidationError);
      expect(() => validateTasksDir('tasks.json')).toThrow(
        'Tasks directory path appears to be a file, not a directory'
      );
      expect(() => validateTasksDir('my-tasks.md')).toThrow(ValidationError);
      expect(() => validateTasksDir('data.txt')).toThrow(ValidationError);
    });

    it('should allow directories with dots that are not file extensions', () => {
      expect(() => validateTasksDir('tasks.v2')).not.toThrow();
      expect(() => validateTasksDir('my.tasks.dir')).not.toThrow();
    });
  });

  describe('valid paths', () => {
    it('should accept valid relative paths', () => {
      expect(validateTasksDir('tasks')).toBe('tasks');
      expect(validateTasksDir('./tasks')).toBe('tasks');
      expect(validateTasksDir('my-tasks')).toBe('my-tasks');
      expect(validateTasksDir('project/tasks')).toBe('project/tasks');
    });

    it('should accept valid nested paths', () => {
      expect(validateTasksDir('data/tasks')).toBe('data/tasks');
      expect(validateTasksDir('./data/tasks')).toBe('data/tasks');
      expect(validateTasksDir('projects/my-project/tasks')).toBe('projects/my-project/tasks');
    });
  });
});

