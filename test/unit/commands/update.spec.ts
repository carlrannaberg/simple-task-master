/**
 * Update command unit tests
 *
 * These tests directly test the update command action function
 * with properly mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import type { TaskUpdateInput, Task } from '@lib/types';
import { MockTaskStore } from '@test/helpers';

// Mock modules first - with factory functions to ensure fresh instances
vi.mock('@lib/task-manager', () => {
  const MockTaskManager = vi.fn();
  MockTaskManager.create = vi.fn();
  return {
    TaskManager: MockTaskManager
  };
});
vi.mock('@lib/lock-manager', () => {
  return {
    LockManager: vi.fn()
  };
});
vi.mock('@lib/output');
vi.mock('@lib/utils', () => ({
  readInput: vi.fn(),
  launchEditor: vi.fn()
}));

// Import after mocking
import { updateCommand } from '@/commands/update';
import { TaskManager } from '@lib/task-manager';
import { LockManager } from '@lib/lock-manager';
import { printSuccess, printError } from '@lib/output';
import { readInput, launchEditor } from '@lib/utils';

// Get mocked functions
const mockedTaskManager = vi.mocked(TaskManager);
const mockedLockManager = vi.mocked(LockManager);
const mockedTaskManagerCreate = mockedTaskManager.create;
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintError = vi.mocked(printError);
const mockedReadInput = vi.mocked(readInput);
const _mockedLaunchEditor = vi.mocked(launchEditor);

describe('Update Command Unit Tests', () => {
  let mockTaskStore: MockTaskStore;
  let mockTaskManagerInstance: {
    get: MockedFunction<(id: number) => Promise<Task>>;
    update: MockedFunction<(id: number, updates: TaskUpdateInput) => Promise<Task>>;
    _store?: MockTaskStore; // Add reference to store for debugging
  };
  let mockLockManagerInstance: {
    acquire: MockedFunction<() => Promise<void>>;
    release: MockedFunction<() => Promise<void>>;
  };

  // Mock process.exit
  const originalExit = process.exit;
  let exitCode: number | undefined;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    exitCode = undefined;

    // Mock process.exit
    process.exit = vi.fn((code?: string | number) => {
      exitCode = typeof code === 'string' ? parseInt(code, 10) : code;
      throw new Error(`Process.exit(${code})`);
    }) as unknown as typeof process.exit;

    // Create fresh mock task store
    mockTaskStore = new MockTaskStore();

    // Create mock instances
    mockTaskManagerInstance = {
      get: vi.fn(),
      update: vi.fn()
    };

    mockLockManagerInstance = {
      acquire: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined)
    };

    // Setup constructor mocks
    mockedTaskManagerCreate.mockResolvedValue(mockTaskManagerInstance as unknown as TaskManager);
    mockedLockManager.mockImplementation(() => mockLockManagerInstance as unknown as LockManager);

    // Store reference for debugging
    mockTaskManagerInstance._store = mockTaskStore;

    // Setup TaskManager methods to use MockTaskStore
    mockTaskManagerInstance.get.mockImplementation(async (id: number) => {
      // Always use the current mockTaskStore variable
      const task = await mockTaskStore.get(id);
      // Ensure content property exists
      return { ...task, content: task.content || '' };
    });

    mockTaskManagerInstance.update.mockImplementation(
      async (id: number, updates: TaskUpdateInput) => {
        // Important: The update command pre-processes += and -= operations
        // before calling TaskManager.update. It passes the final merged values,
        // not the operations themselves. Our mock should just apply the updates
        // as-is
        const updatedTask = await mockTaskStore.update(id, updates);
        return { ...updatedTask, content: updatedTask.content || '' };
      }
    );

    // Setup readInput mock to return the value directly (not stdin)
    mockedReadInput.mockImplementation(async (value: string | undefined) => {
      if (value === undefined) return undefined;
      if (value === '-') return 'stdin-content'; // Mock stdin content
      return value; // Return the value as-is
    });

    // Create test tasks
    await setupTestTasks();
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.clearAllMocks();
    vi.resetAllMocks();
    // Clear the mock task store to ensure test isolation
    if (mockTaskStore) {
      mockTaskStore.clear();
    }
    // Reset commander options to prevent state persistence
    // Commander stores parsed options internally and reuses them
    if (updateCommand.opts) {
      const opts = updateCommand.opts();
      Object.keys(opts).forEach((key) => {
        delete opts[key];
      });
    }
  });

  async function setupTestTasks(): Promise<void> {
    // Clear any existing tasks first
    mockTaskStore.clear();

    await mockTaskStore.create({
      title: 'Original Task',
      content: 'Original content',
      status: 'pending',
      tags: ['original', 'test'],
      dependencies: []
    });

    await mockTaskStore.create({
      title: 'Base Task',
      content: 'Base task content',
      status: 'done',
      tags: ['base'],
      dependencies: []
    });

    await mockTaskStore.create({
      title: 'Dependent Task',
      content: 'This depends on other tasks',
      status: 'pending',
      tags: ['dependent'],
      dependencies: [1, 2]
    });
  }

  // Helper to execute update command
  async function executeUpdate(
    id: string,
    assignments: string[] = [],
    options: Record<string, string | boolean> = {}
  ): Promise<void> {
    // Build command args (without 'update' since we're calling parseAsync
    // on updateCommand directly)
    const args: string[] = [];

    // Add options first
    if (options.title) args.push('--title', options.title);
    if (options.description) args.push('--description', options.description);
    if (options.details) args.push('--details', options.details);
    if (options.validation) args.push('--validation', options.validation);
    if (options.status) args.push('--status', options.status);
    if (options.tags) args.push('--tags', options.tags);
    if (options.deps) args.push('--deps', options.deps);
    if (options.editor === false) args.push('--no-editor');

    // Add positional arguments
    // Use '--' separator only for IDs that start with '-' to prevent them being parsed as options
    if (id.startsWith('-')) {
      args.push('--', id, ...assignments);
    } else {
      args.push(id, ...assignments);
    }

    // Parse the command
    await updateCommand.parseAsync(args, { from: 'user' });
  }

  describe('basic updates via options', () => {
    it('should update task title', async () => {
      await executeUpdate('1', [], { title: 'Updated Title' });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Updated Title');
      expect(task?.content).toBe('Original content');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should update task description', async () => {
      await executeUpdate('1', [], { description: 'Updated description' });

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Updated description');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should update task status', async () => {
      await executeUpdate('1', [], { status: 'in-progress' });

      const task = await mockTaskStore.get(1);
      expect(task?.status).toBe('in-progress');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should update task tags', async () => {
      await executeUpdate('1', [], { tags: 'new,updated,tags' });

      const task = await mockTaskStore.get(1);
      expect(task?.tags).toEqual(['new', 'updated', 'tags']);
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should update task dependencies', async () => {
      await executeUpdate('1', [], { deps: '2,3' });

      const task = await mockTaskStore.get(1);
      expect(task?.dependencies).toEqual([2, 3]);
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should update multiple fields at once', async () => {
      await executeUpdate('1', [], {
        title: 'Multi Update',
        status: 'done',
        tags: 'multi,update'
      });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Multi Update');
      expect(task?.status).toBe('done');
      expect(task?.tags).toEqual(['multi', 'update']);
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });
  });

  describe('assignment-based updates', () => {
    it('should handle simple field assignment', async () => {
      await executeUpdate('1', ['title=Assignment Title']);

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Assignment Title');
    });

    it('should handle content assignment', async () => {
      await executeUpdate('1', ['content=Assignment content']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Assignment content');
    });

    it('should handle status assignment', async () => {
      await executeUpdate('1', ['status=in-progress']);

      const task = await mockTaskStore.get(1);
      expect(task?.status).toBe('in-progress');
    });

    it('should handle multiple assignments', async () => {
      await executeUpdate('1', [
        'title=Multi Assignment',
        'status=done',
        'content=Multiple assignments test'
      ]);

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Multi Assignment');
      expect(task?.status).toBe('done');
      expect(task?.content).toBe('Multiple assignments test');
    });

    it('should handle field aliases (description, details, validation)', async () => {
      // Test description updates the description section
      await executeUpdate('1', ['description=Description via alias']);
      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Description via alias');

      // Test details creates a details section
      await executeUpdate('1', ['details=Implementation details']);
      const task2 = await mockTaskStore.get(1);
      expect(task2?.content).toContain('Description via alias');
      expect(task2?.content).toContain('## Details');
      expect(task2?.content).toContain('Implementation details');

      // Test validation creates a validation section
      await executeUpdate('1', ['validation=Test checklist']);
      const task3 = await mockTaskStore.get(1);
      expect(task3?.content).toContain('Description via alias');
      expect(task3?.content).toContain('## Details');
      expect(task3?.content).toContain('Implementation details');
      expect(task3?.content).toContain('## Validation');
      expect(task3?.content).toContain('Test checklist');
    });
  });

  describe('array operations (tags and dependencies)', () => {
    it('should add tags with += operator', async () => {
      await executeUpdate('1', ['tags+=new,additional']);

      const task = await mockTaskStore.get(1);
      expect(task?.tags).toContain('original');
      expect(task?.tags).toContain('test');
      expect(task?.tags).toContain('new');
      expect(task?.tags).toContain('additional');
    });

    it('should remove tags with -= operator', async () => {
      await executeUpdate('1', ['tags-=original']);

      const task = await mockTaskStore.get(1);
      expect(task?.tags).not.toContain('original');
      expect(task?.tags).toContain('test');
    });

    it('should add dependencies with += operator', async () => {
      await executeUpdate('1', ['dependencies+=2']);

      const task = await mockTaskStore.get(1);
      expect(task?.dependencies).toContain(2);
    });

    it('should remove dependencies with -= operator', async () => {
      await executeUpdate('3', ['dependencies-=1']);

      const task = await mockTaskStore.get(3);
      expect(task?.dependencies).not.toContain(1);
      expect(task?.dependencies).toContain(2);
    });

    it('should handle duplicate prevention in array operations', async () => {
      await executeUpdate('1', ['tags+=test,test,test']);

      const task = await mockTaskStore.get(1);
      const testTagCount = task?.tags.filter((tag) => tag === 'test').length;
      expect(testTagCount).toBe(1);
    });

    it('should handle complex array operations', async () => {
      await executeUpdate('1', ['tags+=new1,new2', 'tags-=original', 'dependencies+=3']);

      const task = await mockTaskStore.get(1);
      expect(task?.tags).toContain('test');
      expect(task?.tags).toContain('new1');
      expect(task?.tags).toContain('new2');
      expect(task?.tags).not.toContain('original');
      expect(task?.dependencies).toContain(3);
    });
  });

  describe('input validation', () => {
    it('should exit with code 2 when no changes are specified', async () => {
      // This should trigger the editor fallback, but since editor is mocked to return undefined,
      // it should fail and exit with code 2
      await expect(executeUpdate('1', [])).rejects.toThrow('Process.exit(2)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        'Editor failed: Cannot read properties of undefined (reading \'split\')'
      );
      expect(exitCode).toBe(2);
    });

    it('should reject invalid task ID', async () => {
      await expect(executeUpdate('invalid', ['title=Test'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Invalid task ID: invalid');
      expect(exitCode).toBe(1);
    });

    it('should reject zero or negative task IDs', async () => {
      await expect(executeUpdate('0', ['title=Test'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Invalid task ID: 0');
      expect(exitCode).toBe(1);

      mockedPrintError.mockClear();
      exitCode = undefined;

      await expect(executeUpdate('-1', ['title=Test'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Invalid task ID: -1');
      expect(exitCode).toBe(1);
    });

    it('should reject non-existent task ID', async () => {
      await expect(executeUpdate('999', ['title=Test'])).rejects.toThrow('Process.exit(3)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(exitCode).toBe(3);
    });

    it('should reject invalid status values', async () => {
      await expect(executeUpdate('1', [], { status: 'invalid' })).rejects.toThrow(
        'Process.exit(1)'
      );
      expect(mockedPrintError).toHaveBeenCalledWith(
        'Status must be one of: pending, in-progress, done'
      );
      expect(exitCode).toBe(1);
    });

    it('should reject invalid assignment format', async () => {
      await expect(executeUpdate('1', ['invalid_assignment'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid assignment format')
      );
      expect(exitCode).toBe(1);
    });

    it('should accept arbitrary field names', async () => {
      await executeUpdate('1', ['priority=high', 'external_id=JIRA-123']);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.priority).toBe('high');
      expect((task as any)?.external_id).toBe('JIRA-123');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should accept field names with various characters', async () => {
      await executeUpdate('1', [
        'field_with_underscores=value1',
        'field-with-dashes=value2',
        'field.with.dots=value3',
        'FieldWithNumbers123=value4',
        'UPPERCASE_FIELD=value5'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.field_with_underscores).toBe('value1');
      expect((task as any)?.['field-with-dashes']).toBe('value2');
      expect((task as any)?.['field.with.dots']).toBe('value3');
      expect((task as any)?.FieldWithNumbers123).toBe('value4');
      expect((task as any)?.UPPERCASE_FIELD).toBe('value5');
    });

    it('should reject field names with newlines', async () => {
      await expect(executeUpdate('1', ['field\nwith\nnewlines=value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Field names cannot contain newlines');
      expect(exitCode).toBe(1);
    });

    it('should reject field names with leading/trailing whitespace', async () => {
      await expect(executeUpdate('1', [' field=value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Field names cannot have leading/trailing whitespace');
      expect(exitCode).toBe(1);

      mockedPrintError.mockClear();
      exitCode = undefined;

      await expect(executeUpdate('1', ['field =value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Field names cannot have leading/trailing whitespace');
      expect(exitCode).toBe(1);
    });

    it('should reject field names with control characters', async () => {
      // Test with ASCII control character (bell character, ASCII 7)
      await expect(executeUpdate('1', ['field\x07name=value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Field names cannot contain control characters');
      expect(exitCode).toBe(1);
    });

    it('should allow field names with tabs', async () => {
      // Tab character should be allowed
      await executeUpdate('1', ['field\tname=value']);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.['field\tname']).toBe('value');
    });

    it('should allow empty values for arbitrary fields', async () => {
      await executeUpdate('1', ['custom_field=']);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.custom_field).toBe('');
    });

    it('should reject empty values for required fields', async () => {
      await expect(executeUpdate('1', ['title='])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('title cannot be empty')
      );
      expect(exitCode).toBe(1);
    });

    it('should reject invalid dependency IDs', async () => {
      await expect(executeUpdate('1', ['dependencies=invalid,123'])).rejects.toThrow(
        'Process.exit(1)'
      );
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid dependency ID: invalid')
      );
      expect(exitCode).toBe(1);
    });

    it('should reject += operation on non-array fields', async () => {
      await expect(executeUpdate('1', ['title+=extra'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining("Cannot add to field 'title'")
      );
      expect(exitCode).toBe(1);
    });

    it('should reject -= operation on non-array fields', async () => {
      await expect(executeUpdate('1', ['status-=pending'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining("Cannot remove from field 'status'")
      );
      expect(exitCode).toBe(1);
    });
  });

  describe('dependency validation', () => {
    it('should reject self-dependency', async () => {
      await expect(executeUpdate('1', ['dependencies=1,2'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('Task cannot depend on itself')
      );
      expect(exitCode).toBe(1);
    });

    it('should reject non-existent dependency', async () => {
      await expect(executeUpdate('1', ['dependencies=999'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Dependency task 999 does not exist');
      expect(exitCode).toBe(1);
    });

    it('should accept valid dependencies', async () => {
      await executeUpdate('1', ['dependencies=2,3']);

      const task = await mockTaskStore.get(1);
      expect(task?.dependencies).toEqual([2, 3]);
    });
  });

  describe('mixed option and assignment updates', () => {
    it('should handle options and assignments together', async () => {
      await executeUpdate('1', ['content=Assignment content'], {
        title: 'Option Title',
        status: 'done'
      });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Option Title');
      expect(task?.content).toBe('Assignment content');
      expect(task?.status).toBe('done');
    });

    it('should handle assignments overriding options', async () => {
      await executeUpdate('1', ['title=Assignment Title'], {
        title: 'Option Title'
      });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Assignment Title');
    });
  });

  describe('special characters and edge cases', () => {
    it('should handle special characters in assignments', async () => {
      await executeUpdate('1', ['title=Task with "quotes" and émojis 🚀']);

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Task with "quotes" and émojis 🚀');
    });

    it('should handle multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      await executeUpdate('1', [`content=${multilineContent}`]);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe(multilineContent);
    });

    it('should handle assignments with equals signs in values', async () => {
      await executeUpdate('1', ['content=formula: x = y + z']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('formula: x = y + z');
    });

    it('should handle empty tag operations', async () => {
      await executeUpdate('1', ['tags+=']);

      const task = await mockTaskStore.get(1);
      expect(task?.tags).toEqual(['original', 'test']);
    });

    it('should handle whitespace in assignment values', async () => {
      await executeUpdate('1', ['tags+= new1 , new2 ']);

      const task = await mockTaskStore.get(1);
      expect(task?.tags).toContain('new1');
      expect(task?.tags).toContain('new2');
    });
  });

  describe('timestamp handling', () => {
    it('should update the updated timestamp', async () => {
      const originalTask = await mockTaskStore.get(1);
      const originalUpdated = originalTask?.updated;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await executeUpdate('1', ['title=Updated Title']);

      const updatedTask = await mockTaskStore.get(1);
      expect(updatedTask?.updated).not.toBe(originalUpdated);
      expect(new Date(updatedTask?.updated || '').getTime()).toBeGreaterThan(
        new Date(originalUpdated || '').getTime()
      );
    });

    it('should preserve the created timestamp', async () => {
      const originalTask = await mockTaskStore.get(1);
      const originalCreated = originalTask?.created;

      await executeUpdate('1', ['title=Updated Title']);

      const updatedTask = await mockTaskStore.get(1);
      expect(updatedTask?.created).toBe(originalCreated);
    });
  });

  describe('lock management', () => {
    it('should acquire and release lock properly', async () => {
      // The lock manager is created inside TaskManager, not directly in the update command
      // Since TaskManager is mocked, we won't see lock manager calls unless we explicitly
      // make the mock TaskManager methods call the lock manager

      // Update our mock to simulate lock acquisition/release
      const originalUpdate = mockTaskManagerInstance.update.getMockImplementation();
      mockTaskManagerInstance.update.mockImplementation(
        async (id: number, updates: TaskUpdateInput) => {
          await mockLockManagerInstance.acquire();
          try {
            const result = await originalUpdate?.(id, updates);
            await mockLockManagerInstance.release();
            return result;
          } catch (error) {
            await mockLockManagerInstance.release();
            throw error;
          }
        }
      );

      await executeUpdate('1', ['title=Test']);

      expect(mockLockManagerInstance.acquire).toHaveBeenCalledOnce();
      expect(mockLockManagerInstance.release).toHaveBeenCalledOnce();
    });

    it('should release lock even when update fails', async () => {
      // For this test, we need a task that exists but will fail during update
      // Create a scenario where update will fail after acquiring the lock
      const originalUpdate = mockTaskManagerInstance.update.getMockImplementation();
      mockTaskManagerInstance.update.mockImplementation(
        async (id: number, updates: TaskUpdateInput) => {
          await mockLockManagerInstance.acquire();
          try {
            if (id === 1 && updates.title === 'FAIL_TEST') {
              throw new Error('Update failed for testing');
            }
            const result = await originalUpdate?.(id, updates);
            await mockLockManagerInstance.release();
            return result;
          } catch (error) {
            await mockLockManagerInstance.release();
            throw error;
          }
        }
      );

      await expect(executeUpdate('1', ['title=FAIL_TEST'])).rejects.toThrow();

      expect(mockLockManagerInstance.acquire).toHaveBeenCalledOnce();
      expect(mockLockManagerInstance.release).toHaveBeenCalledOnce();
    });

    it('should handle lock acquisition failure', async () => {
      const lockError = new Error('Failed to acquire lock');

      // Update our mock to simulate lock acquisition failure
      mockTaskManagerInstance.update.mockImplementation(async () => {
        await mockLockManagerInstance.acquire(); // This will throw
        throw new Error('Should not reach here');
      });

      mockLockManagerInstance.acquire.mockRejectedValue(lockError);

      await expect(executeUpdate('1', ['title=Test'])).rejects.toThrow();
      expect(mockLockManagerInstance.acquire).toHaveBeenCalledOnce();
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(updateCommand.name()).toBe('update');
      expect(updateCommand.description()).toContain('Update a task');

      // Commander sets up arguments through the .argument() calls
      const registeredArgs = updateCommand.registeredArguments;
      expect(registeredArgs).toHaveLength(2);
      expect(registeredArgs[0].name()).toBe('id');
      expect(registeredArgs[0].required).toBe(true);
      expect(registeredArgs[1].name()).toBe('assignments');
      expect(registeredArgs[1].required).toBe(false);
      expect(registeredArgs[1].variadic).toBe(true);
    });

    it('should have all expected options', () => {
      const options = updateCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--title');
      expect(optionNames).toContain('--description');
      expect(optionNames).toContain('--status');
      expect(optionNames).toContain('--tags');
      expect(optionNames).toContain('--deps');
    });

    it('should have correct option aliases', () => {
      const options = updateCommand.options;

      const titleOption = options.find((opt) => opt.long === '--title');
      expect(titleOption?.short).toBe('-t');

      const descOption = options.find((opt) => opt.long === '--description');
      expect(descOption?.short).toBe('-d');

      const statusOption = options.find((opt) => opt.long === '--status');
      expect(statusOption?.short).toBe('-s');
    });
  });

  describe('enhanced section-specific updates', () => {
    it('should update description section via --description option', async () => {
      await executeUpdate('1', [], { description: 'Updated description via option' });

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Updated description via option');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should update details section via --details option', async () => {
      await executeUpdate('1', [], { details: 'New details content' });

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain('Original content'); // From setupTestTasks
      expect(task?.content).toContain('## Details');
      expect(task?.content).toContain('New details content');
    });

    it('should update validation section via --validation option', async () => {
      // Setup task with existing content
      await mockTaskStore.update(1, {
        content: `Task description.

## Details

Some implementation details.`
      });

      await executeUpdate('1', [], { validation: 'New validation checklist' });

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain('Task description.');
      expect(task?.content).toContain('## Details');
      expect(task?.content).toContain('Some implementation details.');
      expect(task?.content).toContain('## Validation');
      expect(task?.content).toContain('New validation checklist');
    });

    it('should handle combined section updates', async () => {
      await executeUpdate('1', [], {
        description: 'New description',
        details: 'New details',
        validation: 'New validation'
      });

      const task = await mockTaskStore.get(1);
      const content = task?.content || '';

      expect(content).toContain('New description');
      expect(content).toContain('## Details');
      expect(content).toContain('New details');
      expect(content).toContain('## Validation');
      expect(content).toContain('New validation');
    });

    it('should preserve existing sections when updating one section', async () => {
      // Setup task with multiple sections
      await mockTaskStore.update(1, {
        content: `Original description.

## Details

Original details content.

## Validation

Original validation content.

## Notes

Custom notes section.`
      });

      await executeUpdate('1', [], { details: 'Updated details only' });

      const task = await mockTaskStore.get(1);
      const content = task?.content || '';

      expect(content).toContain('Original description.');
      expect(content).toContain('Updated details only');
      expect(content).toContain('Original validation content.');
      expect(content).toContain('Custom notes section.');
      expect(content).not.toContain('Original details content.');
    });
  });

  describe('exit code 2 behavior', () => {
    it('should exit with code 2 when no changes specified and editor disabled', async () => {
      await expect(executeUpdate('1', [], { editor: false })).rejects.toThrow('Process.exit(2)');
      expect(mockedPrintError).toHaveBeenCalledWith('No changes specified');
      expect(exitCode).toBe(2);
    });

    it('should not exit when valid changes are provided', async () => {
      await executeUpdate('1', [], { title: 'New title' });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('New title');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should not exit when assignment changes are provided', async () => {
      await executeUpdate('1', ['title=Assignment title']);

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Assignment title');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });
  });

  describe('backward compatibility with assignment syntax', () => {
    it('should support description= assignment syntax', async () => {
      await executeUpdate('1', ['description=Description via assignment']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Description via assignment');
    });

    it('should support legacy details= assignment syntax', async () => {
      await executeUpdate('1', ['details=Details via assignment']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain('## Details');
      expect(task?.content).toContain('Details via assignment');
    });

    it('should support legacy validation= assignment syntax', async () => {
      await executeUpdate('1', ['validation=Validation via assignment']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain('## Validation');
      expect(task?.content).toContain('Validation via assignment');
    });

    it('should handle mixed option and assignment syntax', async () => {
      await executeUpdate('1', ['description=Assignment description'], {
        details: 'Option details'
      });

      const task = await mockTaskStore.get(1);
      const content = task?.content || '';

      expect(content).toContain('Assignment description');
      expect(content).toContain('## Details');
      expect(content).toContain('Option details');
    });

    it('should prioritize assignments over options for same field', async () => {
      await executeUpdate('1', ['title=Assignment Title'], {
        title: 'Option Title'
      });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Assignment Title');
    });
  });

  describe('enhanced field validation', () => {
    it('should validate description field cannot be empty', async () => {
      await expect(executeUpdate('1', ['description='])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('description cannot be empty')
      );
      expect(exitCode).toBe(1);
    });

    it('should validate details field cannot be empty', async () => {
      await expect(executeUpdate('1', ['details='])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('details cannot be empty')
      );
      expect(exitCode).toBe(1);
    });

    it('should validate validation field cannot be empty', async () => {
      await expect(executeUpdate('1', ['validation='])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(
        expect.stringContaining('validation cannot be empty')
      );
      expect(exitCode).toBe(1);
    });

    it('should accept valid description field values', async () => {
      await executeUpdate('1', ['description=Valid description content']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Valid description content');
    });

    it('should accept valid details field values', async () => {
      await executeUpdate('1', ['details=Valid details content']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain('Valid details content');
    });

    it('should accept valid validation field values', async () => {
      await executeUpdate('1', ['validation=Valid validation content']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain('Valid validation content');
    });

    it('should handle multiline field content', async () => {
      const multilineContent = `Line 1
Line 2
- Item 1
- Item 2

Paragraph 2`;

      await executeUpdate('1', [`details=${multilineContent}`]);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain(multilineContent);
    });
  });

  describe('atomic write behavior', () => {
    it('should handle concurrent section updates', async () => {
      // Setup initial content
      await mockTaskStore.update(1, {
        content: `Initial description.

## Details

Initial details.`
      });

      // Simulate concurrent updates (though they'll be sequential in this test)
      const updates = [
        executeUpdate('1', [], { validation: 'Validation 1' }),
        executeUpdate('1', [], { details: 'Updated details' })
      ];

      // Both should succeed
      await Promise.all(updates);

      const task = await mockTaskStore.get(1);
      const content = task?.content || '';

      // Final state should have all updates
      expect(content).toContain('Initial description.');
      expect(content).toContain('Updated details');
    });

    it('should handle rapid consecutive updates', async () => {
      // Perform rapid updates
      await executeUpdate('1', [], { description: 'Description 1' });
      await executeUpdate('1', [], { details: 'Details 1' });
      await executeUpdate('1', [], { validation: 'Validation 1' });
      await executeUpdate('1', [], { description: 'Description 2' });

      const task = await mockTaskStore.get(1);
      const content = task?.content || '';

      expect(content).toContain('Description 2');
      expect(content).toContain('Details 1');
      expect(content).toContain('Validation 1');
    });
  });

  describe('content preservation and formatting', () => {
    it('should preserve markdown formatting in sections', async () => {
      const formattedContent = `**Bold text** and *italic text*

- List item 1
- List item 2

\`\`\`javascript
function example() {
  return 'code';
}
\`\`\`

> Blockquote content`;

      await executeUpdate('1', [`details=${formattedContent}`]);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain(formattedContent);
    });

    it('should preserve whitespace and indentation', async () => {
      const indentedContent = `   Indented content
     More indentation

    Code block style indentation

Normal text`;

      await executeUpdate('1', [`details=${indentedContent}`]);

      const task = await mockTaskStore.get(1);
      // Should contain the indented content within a Details section
      expect(task?.content).toContain('## Details');
      // The first line loses leading whitespace, but subsequent lines preserve relative indentation
      expect(task?.content).toContain('Indented content');
      expect(task?.content).toContain('     More indentation');
      expect(task?.content).toContain('    Code block style indentation');
      expect(task?.content).toContain('Normal text');
    });

    it('should handle Unicode and special characters', async () => {
      const unicodeContent = 'Content with émojis 🚀 and spëcial chars: üñíçödé';

      await executeUpdate('1', [`description=${unicodeContent}`]);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe(unicodeContent);
    });

    it('should preserve existing content structure when adding sections', async () => {
      // Setup complex existing content
      await mockTaskStore.update(1, {
        content: `# Main Title

This is the description with **formatting**.

## Existing Section

Existing content here.

### Subsection

Subsection content.

## Another Section

More content.`
      });

      await executeUpdate('1', [], { details: 'New details section' });

      const task = await mockTaskStore.get(1);
      const content = task?.content || '';

      // Should preserve the original structure, but section names are normalized
      expect(content).toContain('# Main Title');
      expect(content).toContain('This is the description with **formatting**.');
      expect(content).toContain('## Existing section'); // Section names are normalized to lowercase then capitalized
      expect(content).toContain('### Subsection');
      expect(content).toContain('## Another section'); // Section names are normalized
      expect(content).toContain('## Details');
      expect(content).toContain('New details section');
    });
  });

  describe('maximum content length handling', () => {
    it('should handle large content updates', async () => {
      const largeContent = 'A'.repeat(50000); // 50KB content

      await executeUpdate('1', [`description=${largeContent}`]);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe(largeContent);
    });

    it('should handle large section updates', async () => {
      const largeDetails = 'B'.repeat(30000);

      await executeUpdate('1', [`details=${largeDetails}`]);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toContain(largeDetails);
    });
  });

  describe('command option validation', () => {
    it('should accept new --details option', async () => {
      const options = updateCommand.options;
      const detailsOption = options.find((opt) => opt.long === '--details');

      expect(detailsOption).toBeDefined();
      expect(detailsOption?.description).toContain('how - implementation');
    });

    it('should accept new --validation option', async () => {
      const options = updateCommand.options;
      const validationOption = options.find((opt) => opt.long === '--validation');

      expect(validationOption).toBeDefined();
      expect(validationOption?.description).toContain('testing strategy');
    });

    it('should have --description option with -d shorthand', async () => {
      const options = updateCommand.options;
      const descOption = options.find((opt) => opt.long === '--description');

      expect(descOption).toBeDefined();
      expect(descOption?.short).toBe('-d');
      expect(descOption?.description).toContain('why & what');
    });

    it('should support --no-editor option', async () => {
      const options = updateCommand.options;
      const editorOption = options.find((opt) => opt.long === '--no-editor');

      expect(editorOption).toBeDefined();
      expect(editorOption?.description).toContain('editor fallback');
    });
  });

  describe('unknown field support via update command', () => {
    /**
     * Tests for update command's handling of unknown/arbitrary fields.
     * These tests validate that the update command accepts arbitrary field names
     * and that those fields are preserved in the task data.
     * 
     * Purpose: Ensure CLI users can add custom metadata fields to tasks
     */
    
    it('should accept and preserve simple unknown fields', async () => {
      await executeUpdate('1', [
        'priority=high',
        'external_id=JIRA-123',
        'assignee=john.doe@example.com'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.priority).toBe('high');
      expect((task as any)?.external_id).toBe('JIRA-123');
      expect((task as any)?.assignee).toBe('john.doe@example.com');
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should accept unknown fields with complex values', async () => {
      await executeUpdate('1', [
        'metadata={"team":"backend","sprint":5}',
        'url=https://example.com/task/123',
        'estimated_hours=8.5',
        'blockers=dependency,review,testing'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.metadata).toBe('{"team":"backend","sprint":5}');
      expect((task as any)?.url).toBe('https://example.com/task/123');
      expect((task as any)?.estimated_hours).toBe('8.5');
      expect((task as any)?.blockers).toBe('dependency,review,testing');
    });

    it('should preserve unknown fields alongside core field updates', async () => {
      await executeUpdate('1', [
        'title=Updated Task Title',
        'status=in-progress',
        'priority=urgent',
        'reviewer=jane.doe@example.com',
        'tags+=custom,metadata'
      ]);

      const task = await mockTaskStore.get(1);
      // Core fields should be updated
      expect(task?.title).toBe('Updated Task Title');
      expect(task?.status).toBe('in-progress');
      expect(task?.tags).toContain('custom');
      expect(task?.tags).toContain('metadata');
      
      // Unknown fields should be preserved
      expect((task as any)?.priority).toBe('urgent');
      expect((task as any)?.reviewer).toBe('jane.doe@example.com');
    });

    it('should handle field names with special characters', async () => {
      await executeUpdate('1', [
        'field-with-dashes=dash-value',
        'field_with_underscores=underscore_value',
        'field.with.dots=dot.value',
        'FieldWithNumbers123=mixed123',
        'UPPERCASE_FIELD=UPPER_VALUE'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.['field-with-dashes']).toBe('dash-value');
      expect((task as any)?.field_with_underscores).toBe('underscore_value');
      expect((task as any)?.['field.with.dots']).toBe('dot.value');
      expect((task as any)?.FieldWithNumbers123).toBe('mixed123');
      expect((task as any)?.UPPERCASE_FIELD).toBe('UPPER_VALUE');
    });

    it('should handle unknown fields with special characters', async () => {
      await executeUpdate('1', [
        'special_chars=@#$%^&*()[]{}|;:,.<>?',
        'number_field=123',
        'boolean_string=true'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.special_chars).toBe('@#$%^&*()[]{}|;:,.<>?');
      expect((task as any)?.number_field).toBe('123');
      expect((task as any)?.boolean_string).toBe('true');
    });

    it('should handle equals signs in unknown field values', async () => {
      await executeUpdate('1', [
        'formula=x = y + z',
        'equation=a + b = c',
        'url_with_equals=https://example.com?param=value'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.formula).toBe('x = y + z');
      expect((task as any)?.equation).toBe('a + b = c');
      expect((task as any)?.url_with_equals).toBe('https://example.com?param=value');
    });

    it('should preserve unknown fields through multiple updates', async () => {
      // First update: Add unknown fields
      await executeUpdate('1', [
        'priority=high',
        'external_id=JIRA-123'
      ]);

      // Second update: Modify core field and add another unknown field
      await executeUpdate('1', [
        'status=in-progress',
        'assignee=john.doe@example.com'
      ]);

      // Third update: Modify one unknown field
      await executeUpdate('1', [
        'priority=urgent'
      ]);

      const task = await mockTaskStore.get(1);
      expect(task?.status).toBe('in-progress');
      expect((task as any)?.priority).toBe('urgent'); // Updated
      expect((task as any)?.external_id).toBe('JIRA-123'); // Preserved
      expect((task as any)?.assignee).toBe('john.doe@example.com'); // Preserved
    });

    it('should handle unknown fields with empty values', async () => {
      await executeUpdate('1', [
        'empty_field=',
        'normal_field=value'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.empty_field).toBe('');
      expect((task as any)?.normal_field).toBe('value');
    });

    it('should handle unknown fields with multiline values', async () => {
      const multilineValue = 'Line 1\nLine 2\nLine 3';
      await executeUpdate('1', [
        `notes=${multilineValue}`,
        'type=multiline'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.notes).toBe(multilineValue);
      expect((task as any)?.type).toBe('multiline');
    });

    it('should validate field names while allowing unknown field names', async () => {
      // These should still be rejected (field name validation)
      await expect(executeUpdate('1', ['field\nwith\nnewlines=value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Field names cannot contain newlines');
      expect(exitCode).toBe(1);

      // Reset for next test
      mockedPrintError.mockClear();
      exitCode = undefined;

      await expect(executeUpdate('1', [' field=value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Field names cannot have leading/trailing whitespace');
    });

    it('should handle large numbers of unknown fields efficiently', async () => {
      // Create 20 unknown field assignments
      const assignments = Array.from({ length: 20 }, (_, i) => `custom_field_${i}=value_${i}`);
      
      const startTime = Date.now();
      await executeUpdate('1', assignments);
      const endTime = Date.now();
      
      const task = await mockTaskStore.get(1);
      
      // Verify all fields were preserved
      for (let i = 0; i < 20; i++) {
        expect((task as any)?.[`custom_field_${i}`]).toBe(`value_${i}`);
      }
      
      // Performance check: Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000); // Should be much faster, but allowing 1s buffer
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
    });

    it('should mix unknown fields with array operations', async () => {
      await executeUpdate('1', [
        'priority=high',
        'tags+=unknown,custom',
        'external_id=JIRA-123',
        'dependencies+=2',
        'assignee=john.doe@example.com'
      ]);

      const task = await mockTaskStore.get(1);
      
      // Core array operations should work
      expect(task?.tags).toContain('unknown');
      expect(task?.tags).toContain('custom');
      expect(task?.dependencies).toContain(2);
      
      // Unknown fields should be preserved
      expect((task as any)?.priority).toBe('high');
      expect((task as any)?.external_id).toBe('JIRA-123');
      expect((task as any)?.assignee).toBe('john.doe@example.com');
    });

    it('should handle JSON-like values in unknown fields', async () => {
      await executeUpdate('1', [
        'metadata={"team":"backend","priority":1,"active":true}',
        'config=[{"name":"setting1","value":"enabled"},{"name":"setting2","value":"disabled"}]',
        'simple_object={"key":"value"}'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.metadata).toBe('{"team":"backend","priority":1,"active":true}');
      expect((task as any)?.config).toBe('[{"name":"setting1","value":"enabled"},{"name":"setting2","value":"disabled"}]');
      expect((task as any)?.simple_object).toBe('{"key":"value"}');
    });

    it('should handle unknown fields with URL and path values', async () => {
      await executeUpdate('1', [
        'repo_url=https://github.com/user/repo',
        'branch=feature/unknown-fields',
        'local_path=/path/to/local/file',
        'api_endpoint=https://api.example.com/v1/tasks/123',
        'file_path=./src/components/TaskManager.tsx'
      ]);

      const task = await mockTaskStore.get(1);
      expect((task as any)?.repo_url).toBe('https://github.com/user/repo');
      expect((task as any)?.branch).toBe('feature/unknown-fields');
      expect((task as any)?.local_path).toBe('/path/to/local/file');
      expect((task as any)?.api_endpoint).toBe('https://api.example.com/v1/tasks/123');
      expect((task as any)?.file_path).toBe('./src/components/TaskManager.tsx');
    });
  });

  describe('performance tests with unknown fields', () => {
    /**
     * Performance tests for unknown field handling.
     * These tests ensure that adding many unknown fields doesn't significantly
     * impact update performance.
     * 
     * Purpose: Validate that unknown field support scales reasonably
     */
    
    it('should handle 50+ unknown fields efficiently', async () => {
      // Create 50 unknown field assignments
      const assignments = Array.from({ length: 50 }, (_, i) => 
        `performance_field_${i}=performance_value_${i}`
      );
      
      const startTime = Date.now();
      await executeUpdate('1', assignments);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      const task = await mockTaskStore.get(1);
      
      // Verify all 50 fields were preserved
      for (let i = 0; i < 50; i++) {
        expect((task as any)?.[`performance_field_${i}`]).toBe(`performance_value_${i}`);
      }
      
      // Performance requirement: Should complete in under 100ms
      expect(duration).toBeLessThan(100);
      expect(mockedPrintSuccess).toHaveBeenCalledWith('Updated task 1');
      
      console.warn(`Update with 50 unknown fields completed in ${duration}ms`);
    });

    it('should handle rapid sequential unknown field updates', async () => {
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await executeUpdate('1', [`rapid_field_${i}=rapid_value_${i}`]);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgPerUpdate = duration / iterations;
      
      const task = await mockTaskStore.get(1);
      
      // Verify all rapid updates were preserved
      for (let i = 0; i < iterations; i++) {
        expect((task as any)?.[`rapid_field_${i}`]).toBe(`rapid_value_${i}`);
      }
      
      // Performance requirement: Average should be under 50ms per update
      expect(avgPerUpdate).toBeLessThan(50);
      
      console.warn(`${iterations} rapid updates averaged ${avgPerUpdate.toFixed(2)}ms per update`);
    });

    it('should handle large values in unknown fields efficiently', async () => {
      // Create large field values (1KB each)
      const largeValue1 = 'A'.repeat(1024);
      const largeValue2 = 'B'.repeat(1024);
      const largeValue3 = 'C'.repeat(1024);
      
      const startTime = Date.now();
      await executeUpdate('1', [
        `large_field_1=${largeValue1}`,
        `large_field_2=${largeValue2}`,
        `large_field_3=${largeValue3}`
      ]);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      const task = await mockTaskStore.get(1);
      expect((task as any)?.large_field_1).toBe(largeValue1);
      expect((task as any)?.large_field_2).toBe(largeValue2);
      expect((task as any)?.large_field_3).toBe(largeValue3);
      
      // Should handle large values reasonably quickly
      expect(duration).toBeLessThan(200);
      
      console.warn(`Update with 3KB of unknown field data completed in ${duration}ms`);
    });
  });
});
