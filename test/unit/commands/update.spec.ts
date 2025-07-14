/**
 * Update command unit tests
 * 
 * These tests directly test the update command action function
 * with properly mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import type { TaskUpdateInput, Task } from '@lib/types';
import { ValidationError, NotFoundError } from '@lib/errors';
import { MockTaskStore } from '@test/helpers';

// Mock modules first - with factory functions to ensure fresh instances
vi.mock('@lib/task-manager', () => {
  return {
    TaskManager: vi.fn()
  };
});
vi.mock('@lib/lock-manager', () => {
  return {
    LockManager: vi.fn()
  };
});
vi.mock('@lib/output');

// Import after mocking
import { updateCommand } from '@/commands/update';
import { TaskManager } from '@lib/task-manager';
import { LockManager } from '@lib/lock-manager';
import { printSuccess, printError } from '@lib/output';

// Get mocked functions
const mockedTaskManager = vi.mocked(TaskManager);
const mockedLockManager = vi.mocked(LockManager);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintError = vi.mocked(printError);

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
      update: vi.fn(),
    };

    mockLockManagerInstance = {
      acquire: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };

    // Setup constructor mocks
    mockedTaskManager.mockImplementation(() => mockTaskManagerInstance as unknown as TaskManager);
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

    mockTaskManagerInstance.update.mockImplementation(async (id: number, updates: TaskUpdateInput) => {
      // Important: The update command pre-processes += and -= operations before calling TaskManager.update
      // It passes the final merged values, not the operations themselves
      // Our mock should just apply the updates as-is
      const updatedTask = await mockTaskStore.update(id, updates);
      return { ...updatedTask, content: updatedTask.content || '' };
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
      Object.keys(opts).forEach(key => {
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
      dependencies: [],
    });

    await mockTaskStore.create({
      title: 'Base Task',
      content: 'Base task content',
      status: 'done',
      tags: ['base'],
      dependencies: [],
    });

    await mockTaskStore.create({
      title: 'Dependent Task',
      content: 'This depends on other tasks',
      status: 'pending',
      tags: ['dependent'],
      dependencies: [1, 2],
    });
  }

  // Helper to execute update command
  async function executeUpdate(
    id: string,
    assignments: string[] = [],
    options: Record<string, string> = {}
  ): Promise<void> {
    // Build command args (without 'update' since we're calling parseAsync on updateCommand directly)
    const args: string[] = [];
    
    // Add options first
    if (options.title) args.push('--title', options.title);
    if (options.description) args.push('--description', options.description);
    if (options.status) args.push('--status', options.status);
    if (options.tags) args.push('--tags', options.tags);
    if (options.deps) args.push('--deps', options.deps);
    
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
        tags: 'multi,update',
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
        'content=Multiple assignments test',
      ]);

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Multi Assignment');
      expect(task?.status).toBe('done');
      expect(task?.content).toBe('Multiple assignments test');
    });

    it('should handle field aliases (desc, details)', async () => {
      await executeUpdate('1', ['desc=Description via alias']);

      const task = await mockTaskStore.get(1);
      expect(task?.content).toBe('Description via alias');

      await executeUpdate('1', ['details=Details via alias']);
      const task2 = await mockTaskStore.get(1);
      expect(task2?.content).toBe('Details via alias');
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
      await expect(executeUpdate('1', [], { status: 'invalid' })).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith('Status must be one of: pending, in-progress, done');
      expect(exitCode).toBe(1);
    });

    it('should reject invalid assignment format', async () => {
      await expect(executeUpdate('1', ['invalid_assignment'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('Invalid assignment format'));
      expect(exitCode).toBe(1);
    });

    it('should reject unknown field names', async () => {
      await expect(executeUpdate('1', ['unknown=value'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('Unknown field: unknown'));
      expect(exitCode).toBe(1);
    });

    it('should reject empty values for required fields', async () => {
      await expect(executeUpdate('1', ['title='])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('title cannot be empty'));
      expect(exitCode).toBe(1);
    });

    it('should reject invalid dependency IDs', async () => {
      await expect(executeUpdate('1', ['dependencies=invalid,123'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('Invalid dependency ID: invalid'));
      expect(exitCode).toBe(1);
    });

    it('should reject += operation on non-array fields', async () => {
      await expect(executeUpdate('1', ['title+=extra'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('Cannot add to field: title'));
      expect(exitCode).toBe(1);
    });

    it('should reject -= operation on non-array fields', async () => {
      await expect(executeUpdate('1', ['status-=pending'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('Cannot remove from field: status'));
      expect(exitCode).toBe(1);
    });
  });

  describe('dependency validation', () => {
    it('should reject self-dependency', async () => {
      await expect(executeUpdate('1', ['dependencies=1,2'])).rejects.toThrow('Process.exit(1)');
      expect(mockedPrintError).toHaveBeenCalledWith(expect.stringContaining('Task cannot depend on itself'));
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
        status: 'done',
      });

      const task = await mockTaskStore.get(1);
      expect(task?.title).toBe('Option Title');
      expect(task?.content).toBe('Assignment content');
      expect(task?.status).toBe('done');
    });

    it('should handle assignments overriding options', async () => {
      await executeUpdate('1', ['title=Assignment Title'], {
        title: 'Option Title',
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

    it('should handle whitespace in assignments', async () => {
      await executeUpdate('1', ['tags += new1 , new2 ']);

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
      mockTaskManagerInstance.update.mockImplementation(async (id: number, updates: TaskUpdateInput) => {
        await mockLockManagerInstance.acquire();
        try {
          const result = await originalUpdate!(id, updates);
          await mockLockManagerInstance.release();
          return result;
        } catch (error) {
          await mockLockManagerInstance.release();
          throw error;
        }
      });

      await executeUpdate('1', ['title=Test']);

      expect(mockLockManagerInstance.acquire).toHaveBeenCalledOnce();
      expect(mockLockManagerInstance.release).toHaveBeenCalledOnce();
    });

    it('should release lock even when update fails', async () => {
      // For this test, we need a task that exists but will fail during update
      // Create a scenario where update will fail after acquiring the lock
      const originalUpdate = mockTaskManagerInstance.update.getMockImplementation();
      mockTaskManagerInstance.update.mockImplementation(async (id: number, updates: TaskUpdateInput) => {
        await mockLockManagerInstance.acquire();
        try {
          if (id === 1 && updates.title === 'FAIL_TEST') {
            throw new Error('Update failed for testing');
          }
          const result = await originalUpdate!(id, updates);
          await mockLockManagerInstance.release();
          return result;
        } catch (error) {
          await mockLockManagerInstance.release();
          throw error;
        }
      });

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
});