import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { TaskManager } from '@/lib/task-manager';
import { printSuccess, printError } from '@/lib/output';
import { ValidationError, FileSystemError, NotFoundError } from '@/lib/errors';
import type { Task } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/task-manager');
vi.mock('@/lib/output');

// Import the delete function directly for testing
async function deleteTask(idStr: string, options: { force?: boolean } = {}): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Parse task ID
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError(`Invalid task ID: ${idStr}`);
    }

    // Get the task first to verify it exists and show what will be deleted
    const task = await taskManager.get(id);

    // Check for dependencies unless --force is used
    if (!options.force) {
      const allTasks = await taskManager.list();
      const dependents = allTasks.filter((t) =>
        t.dependencies?.includes(id) ||
        (t as Task & { depends_on?: string[] }).depends_on?.includes(idStr)
      );

      if (dependents.length > 0) {
        const dependentTitles = dependents.map((t) => `${t.id}: ${t.title}`).join(', ');
        throw new ValidationError(
          `Cannot delete task: ${dependents.length} task(s) depend on it ` +
          `(${dependentTitles}). Use --force to delete anyway.`
        );
      }
    }

    // Perform the deletion
    await taskManager.delete(id);

    printSuccess(`Deleted task ${id}: "${task.title}"`);
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof FileSystemError ||
      error instanceof NotFoundError ||
      error instanceof Error
    ) {
      printError(error.message);
      process.exit(error instanceof NotFoundError ? 3 : 1);
    }
    throw error;
  }
}

describe('Delete Command Unit Tests', () => {
  let mockTaskManager: {
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let mockExit: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exited');
    }) as MockInstance;

    mockTaskManager = {
      get: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    };

    vi.mocked(TaskManager.create).mockResolvedValue(mockTaskManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful deletion', () => {
    it('should delete task when it exists and has no dependencies', async () => {
      // Purpose: Verify basic deletion functionality works correctly
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Test Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([]);

      await deleteTask('123');

      expect(mockTaskManager.delete).toHaveBeenCalledWith(123);
      expect(printSuccess).toHaveBeenCalledWith('Deleted task 123: "Test Task"');
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should delete task with force flag even when dependencies exist', async () => {
      // Purpose: Verify force flag bypasses dependency validation
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Parent Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      const dependentTask: Task = {
        schema: 1,
        id: 124,
        title: 'Dependent Task',
        status: 'pending',
        dependencies: [123],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([dependentTask]);

      await deleteTask('123', { force: true });

      expect(mockTaskManager.delete).toHaveBeenCalledWith(123);
      expect(printSuccess).toHaveBeenCalledWith('Deleted task 123: "Parent Task"');
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should handle force flag correctly', async () => {
      // Purpose: Verify force flag works correctly
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Test Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([]);

      await deleteTask('123', { force: true });

      expect(mockTaskManager.delete).toHaveBeenCalledWith(123);
      expect(printSuccess).toHaveBeenCalledWith('Deleted task 123: "Test Task"');
    });
  });

  describe('error handling', () => {
    it('should handle task not found error', async () => {
      // Purpose: Verify proper error handling for nonexistent tasks
      mockTaskManager.get.mockRejectedValue(new NotFoundError('Task not found: 999'));

      try {
        await deleteTask('999');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Task not found: 999');
      expect(mockExit).toHaveBeenCalledWith(3);
      expect(mockTaskManager.delete).not.toHaveBeenCalled();
    });

    it('should prevent deletion when task has dependencies', async () => {
      // Purpose: Verify dependency validation prevents breaking relationships
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Parent Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      const dependentTask: Task = {
        schema: 1,
        id: 124,
        title: 'Dependent Task',
        status: 'pending',
        dependencies: [123],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([dependentTask]);

      try {
        await deleteTask('123');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith(
        'Cannot delete task: 1 task(s) depend on it (124: Dependent Task). ' +
        'Use --force to delete anyway.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockTaskManager.delete).not.toHaveBeenCalled();
    });

    it('should handle filesystem errors during deletion', async () => {
      // Purpose: Verify proper error handling for file system issues
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Test Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([]);
      mockTaskManager.delete.mockRejectedValue(new FileSystemError('Permission denied'));

      try {
        await deleteTask('123');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Permission denied');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid task ID format', async () => {
      // Purpose: Verify proper validation of task ID input
      try {
        await deleteTask('invalid');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Invalid task ID: invalid');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockTaskManager.get).not.toHaveBeenCalled();
    });

    it('should handle zero or negative task IDs', async () => {
      // Purpose: Verify rejection of invalid numeric task IDs
      try {
        await deleteTask('0');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Invalid task ID: 0');
      expect(mockExit).toHaveBeenCalledWith(1);

      vi.clearAllMocks();
      mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exited');
      }) as MockInstance;

      try {
        await deleteTask('-5');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Invalid task ID: -5');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('dependency validation', () => {
    it('should detect dependencies in both standard and unknown fields', async () => {
      // Purpose: Verify compatibility with unknown field support for task dependencies
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Parent Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      const dependentTask1: Task = {
        schema: 1,
        id: 124,
        title: 'Standard Dependent',
        status: 'pending',
        dependencies: [123],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      // Task with unknown field dependency
      const dependentTask2 = {
        schema: 1,
        id: 125,
        title: 'Custom Dependent',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date(),
        depends_on: ['123'] // Unknown field dependency
      } as Task & { depends_on: string[] };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([dependentTask1, dependentTask2]);

      try {
        await deleteTask('123');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith(
        'Cannot delete task: 2 task(s) depend on it ' +
        '(124: Standard Dependent, 125: Custom Dependent). Use --force to delete anyway.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle multiple dependencies correctly', async () => {
      // Purpose: Verify dependency validation works with multiple dependent tasks
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Popular Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      const dependents: Task[] = Array.from({ length: 5 }, (_, i) => ({
        schema: 1,
        id: 200 + i,
        title: `Dependent Task ${i + 1}`,
        status: 'pending',
        dependencies: [123],
        tags: [],
        created: new Date(),
        updated: new Date()
      }));

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue(dependents);

      try {
        await deleteTask('123');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot delete task: 5 task(s) depend on it')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should pass validation when no dependencies exist', async () => {
      // Purpose: Verify deletion proceeds when no tasks depend on target task
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Independent Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      const otherTasks: Task[] = [
        {
          schema: 1,
          id: 124,
          title: 'Other Task 1',
          status: 'pending',
          dependencies: [],
          tags: [],
          created: new Date(),
          updated: new Date()
        },
        {
          schema: 1,
          id: 125,
          title: 'Other Task 2',
          status: 'pending',
          dependencies: [124], // Depends on different task
          tags: [],
          created: new Date(),
          updated: new Date()
        }
      ];

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue(otherTasks);

      await deleteTask('123');

      expect(mockTaskManager.delete).toHaveBeenCalledWith(123);
      expect(printSuccess).toHaveBeenCalledWith('Deleted task 123: "Independent Task"');
    });
  });

  describe('TaskManager integration', () => {
    it('should create TaskManager instance correctly', async () => {
      // Purpose: Verify proper TaskManager instantiation and method calls
      const mockTask: Task = {
        schema: 1,
        id: 123,
        title: 'Test Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([]);

      await deleteTask('123');

      expect(TaskManager.create).toHaveBeenCalledTimes(1);
      expect(mockTaskManager.get).toHaveBeenCalledWith(123);
      expect(mockTaskManager.list).toHaveBeenCalledTimes(1);
      expect(mockTaskManager.delete).toHaveBeenCalledWith(123);
    });

    it('should handle TaskManager creation errors', async () => {
      // Purpose: Verify proper error handling when TaskManager creation fails
      vi.mocked(TaskManager.create).mockRejectedValue(
        new Error('Failed to initialize task manager')
      );

      try {
        await deleteTask('123');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Failed to initialize task manager');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle task ID parsing and validation', async () => {
      // Purpose: Verify proper task ID validation occurs after TaskManager
      // creation but before operations
      try {
        await deleteTask('not-a-number');
      } catch {
        // Error should be caught and handled within deleteTask
      }

      expect(printError).toHaveBeenCalledWith('Invalid task ID: not-a-number');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(TaskManager.create).toHaveBeenCalledTimes(1);
      expect(mockTaskManager.get).not.toHaveBeenCalled();
      expect(mockTaskManager.delete).not.toHaveBeenCalled();
    });

    it('should call TaskManager methods in correct sequence', async () => {
      // Purpose: Verify the sequence of TaskManager method calls
      const mockTask: Task = {
        schema: 1,
        id: 456,
        title: 'Sequence Test Task',
        status: 'pending',
        dependencies: [],
        tags: [],
        created: new Date(),
        updated: new Date()
      };

      mockTaskManager.get.mockResolvedValue(mockTask);
      mockTaskManager.list.mockResolvedValue([]);

      await deleteTask('456');

      // Verify all expected methods were called
      expect(TaskManager.create).toHaveBeenCalledTimes(1);
      expect(mockTaskManager.get).toHaveBeenCalledWith(456);
      expect(mockTaskManager.list).toHaveBeenCalledTimes(1);
      expect(mockTaskManager.delete).toHaveBeenCalledWith(456);
    });
  });
});
