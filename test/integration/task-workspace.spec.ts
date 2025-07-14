import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { TaskManager } from '@lib/task-manager';
import { LockManager } from '@lib/lock-manager';
import type { Task } from '@lib/types';

describe(
  'Task-Workspace Integration',
  () => {
    let workspace: TestWorkspace;
    let taskManager: TaskManager;
    let lockManager: LockManager;

    beforeEach(async () => {
      workspace = await TestWorkspace.create('task-workspace-test-');
      taskManager = new TaskManager({
        tasksDir: workspace.tasksDirectory,
      });
      lockManager = new LockManager(workspace.directory);
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    describe('TaskManager + LockManager Integration', () => {
      it('should acquire lock before task operations', async () => {
        await lockManager.acquire();

        const task = await taskManager.create({
          title: 'Test Task',
          content: 'Test content',
        });

        expect(task.id).toBe(1);
        expect(task.title).toBe('Test Task');

        await lockManager.release();
      });

      it('should handle concurrent task operations with proper locking', async () => {
        const createTask = async (title: string): Promise<Task> => {
          await lockManager.acquire();
          try {
            const task = await taskManager.create({ title });
            return task;
          } finally {
            await lockManager.release();
          }
        };

        // Create multiple tasks concurrently
        const taskPromises = Array.from({ length: 5 }, (_, i) =>
          createTask(`Concurrent Task ${i + 1}`)
        );

        const tasks = await Promise.all(taskPromises);

        // All tasks should have unique IDs
        const ids = tasks.map((t) => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(5);

        // IDs should be sequential
        const sortedIds = [...ids].sort((a, b) => a - b);
        expect(sortedIds).toEqual([1, 2, 3, 4, 5]);
      });

      it.skip('should prevent data corruption during concurrent writes', async () => {
        // Create initial task
        const initialTask = await workspace.addTask({
          title: 'Initial Task',
          content: 'Initial content',
        });

        // Simulate concurrent updates
        const updateOperations = Array.from({ length: 10 }, (_, i) => async () => {
          await lockManager.acquire();
          try {
            await taskManager.update(initialTask.id, {
              content: `Updated content ${i + 1}`,
              tags: [`tag-${i + 1}`],
            });
          } finally {
            await lockManager.release();
          }
        });

        // Execute all updates
        await Promise.all(updateOperations.map((op) => op()));

        // Verify task integrity
        const finalTask = await taskManager.get(initialTask.id);
        expect(finalTask.id).toBe(initialTask.id);
        expect(finalTask.title).toBe('Initial Task');
        expect(finalTask.content).toMatch(/^Updated content \d+$/);
        expect(finalTask.tags).toHaveLength(1);
        expect(finalTask.tags?.[0]).toMatch(/^tag-\d+$/);
      });

      it('should handle lock timeout scenarios gracefully', async () => {
        // Acquire lock in first instance
        await lockManager.acquire();

        // Create second lock manager for same workspace
        const secondLockManager = new LockManager(workspace.directory);

        // Second lock should timeout
        const startTime = Date.now();
        try {
          await secondLockManager.acquire();
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          const elapsed = Date.now() - startTime;
          expect(elapsed).toBeGreaterThan(4500); // Should wait at least 5 seconds
          expect(error).toBeInstanceOf(Error);
        }

        // Release first lock
        await lockManager.release();

        // Now second lock should succeed
        await secondLockManager.acquire();
        await secondLockManager.release();
      });

      it('should clean up stale locks automatically', async () => {
        // Manually create a stale lock file
        const lockPath = path.join(workspace.stmDirectory, 'lock');
        const staleLock = {
          pid: 99999, // Non-existent PID
          command: 'stale command',
          timestamp: Date.now() - 60000, // 1 minute old
        };

        await fs.writeFile(lockPath, JSON.stringify(staleLock));

        // Lock acquisition should clean up stale lock and succeed
        await lockManager.acquire();
        await lockManager.release();

        // Verify lock was cleaned up
        const lockExists = await fs
          .access(lockPath)
          .then(() => true)
          .catch(() => false);
        expect(lockExists).toBe(false);
      });
    });

    describe('File System Interactions', () => {
      it('should create task files with correct structure', async () => {
        const task = await workspace.addTask({
          title: 'File Structure Test',
          content: 'Test content with **markdown**',
          tags: ['tag1', 'tag2'],
          status: 'in-progress',
        });

        const taskFilePath = path.join(
          workspace.tasksDirectory,
          `${task.id}-file-structure-test.md`
        );
        const fileExists = await fs
          .access(taskFilePath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);

        const fileContent = await fs.readFile(taskFilePath, 'utf8');

        // Should contain frontmatter
        expect(fileContent).toContain('---');
        expect(fileContent).toContain('schema: 1');
        expect(fileContent).toContain('id: 1');
        expect(fileContent).toContain('title: File Structure Test');
        expect(fileContent).toContain('status: in-progress');
        expect(fileContent).toContain('tags:');
        expect(fileContent).toContain('- tag1');
        expect(fileContent).toContain('- tag2');

        // Should contain content
        expect(fileContent).toContain('Test content with **markdown**');
      });

      it('should handle file system errors gracefully', async () => {
        // Make tasks directory read-only to simulate permission error
        if (process.platform !== 'win32') {
          await fs.chmod(workspace.tasksDirectory, 0o444);

          try {
            await expect(
              workspace.addTask({
                title: 'Permission Test',
                content: 'Should fail',
              })
            ).rejects.toThrow();
          } finally {
            // Restore permissions for cleanup
            await fs.chmod(workspace.tasksDirectory, 0o755);
          }
        }
      });


      it('should handle workspace directory structure changes', async () => {
        // Create initial task
        const task = await workspace.addTask({
          title: 'Structure Test',
          content: 'Initial content',
        });

        // Verify task exists
        let retrievedTask = await workspace.getTask(task.id);
        expect(retrievedTask.title).toBe('Structure Test');

        // Simulate directory restructuring by moving task file
        const oldPath = path.join(workspace.tasksDirectory, `${task.id}-structure-test.md`);
        const tempPath = path.join(workspace.directory, 'temp-task.md');

        await fs.rename(oldPath, tempPath);

        // Task should not be found
        await expect(workspace.getTask(task.id)).rejects.toThrow();

        // Move file back
        await fs.rename(tempPath, oldPath);

        // Task should be found again
        retrievedTask = await workspace.getTask(task.id);
        expect(retrievedTask.title).toBe('Structure Test');
      });
    });

    describe('Workspace State Management', () => {
      it('should maintain consistent workspace state across operations', async () => {
        // Create multiple tasks with different statuses
        const tasks = await Promise.all([
          workspace.addTask({ title: 'Pending Task', status: 'pending' }),
          workspace.addTask({ title: 'In Progress Task', status: 'in-progress' }),
          workspace.addTask({ title: 'Done Task', status: 'done' }),
        ]);

        // Verify initial state
        const stats = await workspace.getStats();
        expect(stats.totalTasks).toBe(3);
        expect(stats.pendingTasks).toBe(1);
        expect(stats.inProgressTasks).toBe(1);
        expect(stats.doneTasks).toBe(1);

        // Update task statuses
        await workspace.updateTask(tasks[0].id, { status: 'done' });
        await workspace.updateTask(tasks[1].id, { status: 'done' });

        // Verify updated state
        const updatedStats = await workspace.getStats();
        expect(updatedStats.totalTasks).toBe(3);
        expect(updatedStats.pendingTasks).toBe(0);
        expect(updatedStats.inProgressTasks).toBe(0);
        expect(updatedStats.doneTasks).toBe(3);
      });

      it('should handle workspace corruption recovery', async () => {
        // Create valid tasks
        await workspace.createTestTasks(3);

        // Corrupt one task file
        const corruptedPath = path.join(workspace.tasksDirectory, '2-test-task-2.md');
        await fs.writeFile(corruptedPath, 'Invalid content without frontmatter');

        // List operation should handle corruption gracefully
        const tasks = await workspace.listTasks();

        // Should return valid tasks only
        expect(tasks).toHaveLength(2);
        expect(tasks.map((t) => t.id)).toEqual([1, 3]);
      });

      it('should maintain referential integrity during bulk operations', async () => {
        // Create many tasks
        const createdTasks = await workspace.createTestTasks(50);

        // Verify all tasks have unique IDs
        const ids = createdTasks.map((t) => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(50);

        // Verify sequential numbering
        const sortedIds = [...ids].sort((a, b) => a - b);
        expect(sortedIds).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

        // Verify all tasks can be retrieved
        for (const task of createdTasks) {
          const retrieved = await workspace.getTask(task.id);
          expect(retrieved.title).toBe(task.title);
        }
      });
    });

    describe('Performance and Resource Management', () => {
      it('should handle large workspaces efficiently', async () => {
        // Create 100 tasks
        const startTime = Date.now();
        await workspace.createTestTasks(100);
        const creationTime = Date.now() - startTime;

        // Creation should complete in reasonable time
        expect(creationTime).toBeLessThan(10000); // 10 seconds

        // List operation should be fast even with many tasks
        const listStartTime = Date.now();
        const tasks = await workspace.listTasks();
        const listTime = Date.now() - listStartTime;

        expect(tasks).toHaveLength(100);
        expect(listTime).toBeLessThan(2000); // 2 seconds
      });

      it('should manage memory efficiently during bulk operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Perform memory-intensive operations
        for (let i = 0; i < 10; i++) {
          await workspace.createTestTasks(10, `Batch ${i}`);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 100MB)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

        // Verify all tasks were created
        const tasks = await workspace.listTasks();
        expect(tasks).toHaveLength(100);
      });
    });
  },
  { timeout: 10000 }
);
