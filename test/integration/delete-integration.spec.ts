import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { TaskManager } from '@/lib/task-manager';
import { CLITestRunner } from '@test/helpers/cli-runner';
import { NotFoundError } from '@/lib/errors';

describe('Delete Integration Tests', () => {
  let workspace: TestWorkspace;
  let taskManager: TaskManager;
  let cli: CLITestRunner;

  beforeEach(async () => {
    workspace = await TestWorkspace.create('delete-integration-');
    taskManager = await TaskManager.create({
      tasksDir: workspace.tasksDirectory
    });
    cli = new CLITestRunner({ cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('task deletion with filesystem operations', () => {
    it('should delete task and remove file from filesystem', async () => {
      // Purpose: Verify end-to-end deletion removes actual files from disk
      const task = await taskManager.create({
        title: 'Test Task for Deletion',
        content: 'This task will be deleted from the filesystem'
      });

      // Verify task file exists on disk
      const taskFiles = await fs.readdir(workspace.tasksDirectory);
      const expectedFileName = `${task.id}-test-task-for-deletion.md`;
      expect(taskFiles).toContain(expectedFileName);

      // Verify file content before deletion
      const taskFilePath = path.join(workspace.tasksDirectory, expectedFileName);
      const fileContent = await fs.readFile(taskFilePath, 'utf8');
      expect(fileContent).toContain('Test Task for Deletion');
      expect(fileContent).toContain('This task will be deleted');

      // Delete task through TaskManager
      await taskManager.delete(task.id);

      // Verify file is completely removed from filesystem
      const filesAfterDeletion = await fs.readdir(workspace.tasksDirectory);
      expect(filesAfterDeletion).not.toContain(expectedFileName);

      // Verify no partial files or backups remain
      const remainingFiles = filesAfterDeletion.filter((f) => f.startsWith(`${task.id}-`));
      expect(remainingFiles).toHaveLength(0);

      // Verify task is no longer accessible through TaskManager
      await expect(taskManager.get(task.id)).rejects.toThrow(NotFoundError);
    });

    it('should handle deletion of tasks with complex content', async () => {
      // Purpose: Verify deletion works correctly for tasks with rich markdown content
      const complexContent = `
# Complex Task Content

This task has **various** markdown features:

- Bullet points
- Code blocks:

\`\`\`typescript
const example = "code";
\`\`\`

> Blockquotes and other formatting

## Details

Technical implementation notes with special characters: !@#$%^&*()

## Validation

- [ ] Test checklist item
- [x] Completed item
      `.trim();

      const task = await taskManager.create({
        title: 'Complex Content Task',
        content: complexContent,
        tags: ['complex', 'markdown', 'test'],
        status: 'in-progress'
      });

      // Verify task creation
      const retrievedTask = await taskManager.get(task.id);
      expect(retrievedTask.content).toBe(complexContent);
      expect(retrievedTask.tags).toEqual(['complex', 'markdown', 'test']);

      // Delete the complex task
      await taskManager.delete(task.id);

      // Verify complete removal
      await expect(taskManager.get(task.id)).rejects.toThrow(NotFoundError);

      // Verify file system cleanup
      const taskFiles = await fs.readdir(workspace.tasksDirectory);
      const remainingFiles = taskFiles.filter((f) => f.startsWith(`${task.id}-`));
      expect(remainingFiles).toHaveLength(0);
    });
  });

  describe('dependency relationship validation', () => {
    it('should prevent deletion when task has standard dependencies', async () => {
      // Purpose: Verify dependency validation works with real task relationships via CLI
      const { taskId: parentId } = await cli.addTask('Parent Task', {
        content: 'This task will have dependents'
      });

      // Create child task with dependency using direct CLI call
      const addChildResult = await cli.run(['add', 'Child Task', '--description',
        'This task depends on the parent', '--deps', parentId.toString()]);
      expect(addChildResult.exitCode).toBe(0);
      const childId = parseInt(addChildResult.stdout.trim(), 10);

      // Verify dependency relationship was established
      const retrievedChild = await taskManager.get(childId);
      expect(retrievedChild.dependencies).toContain(parentId);

      // Attempt to delete parent task via CLI should fail
      const deleteResult = await cli.run(['delete', parentId.toString()]);
      expect(deleteResult.exitCode).toBe(1);
      expect(deleteResult.stderr).toContain('Cannot delete task');
      expect(deleteResult.stderr).toContain('depend on it');

      // Verify parent task still exists
      const stillExistingParent = await taskManager.get(parentId);
      expect(stillExistingParent).toBeDefined();
      expect(stillExistingParent.title).toBe('Parent Task');

      // Verify child task still exists
      const stillExistingChild = await taskManager.get(childId);
      expect(stillExistingChild).toBeDefined();
      expect(stillExistingChild.dependencies).toContain(parentId);

      // Delete child first, then parent should work
      const deleteChildResult = await cli.run(['delete', childId.toString()]);
      expect(deleteChildResult.exitCode).toBe(0);

      // Now parent deletion should succeed
      const deleteParentResult = await cli.run(['delete', parentId.toString()]);
      expect(deleteParentResult.exitCode).toBe(0);

      // Verify both are completely removed
      await expect(taskManager.get(parentId)).rejects.toThrow(NotFoundError);
      await expect(taskManager.get(childId)).rejects.toThrow(NotFoundError);
    });

    it('should handle complex dependency chains', async () => {
      // Purpose: Verify dependency validation works with multi-level task hierarchies via CLI
      const { taskId: taskAId } = await cli.addTask('Task A - Foundation', {
        content: 'Base task'
      });

      // Create task B with dependency on A using direct CLI call
      const addBResult = await cli.run(['add', 'Task B - Depends on A', '--description',
        'Builds on task A', '--deps', taskAId.toString()]);
      expect(addBResult.exitCode).toBe(0);
      const taskBId = parseInt(addBResult.stdout.trim(), 10);

      // Create task C with dependency on B using direct CLI call
      const addCResult = await cli.run(['add', 'Task C - Depends on B', '--description',
        'Builds on task B', '--deps', taskBId.toString()]);
      expect(addCResult.exitCode).toBe(0);
      const taskCId = parseInt(addCResult.stdout.trim(), 10);

      // Create task D with dependencies on A and B using direct CLI call
      const addDResult = await cli.run(['add', 'Task D - Depends on A and B', '--description',
        'Builds on both A and B', '--deps', `${taskAId},${taskBId}`]);
      expect(addDResult.exitCode).toBe(0);
      const taskDId = parseInt(addDResult.stdout.trim(), 10);

      // Cannot delete A (B and D depend on it)
      const deleteAResult1 = await cli.run(['delete', taskAId.toString()]);
      expect(deleteAResult1.exitCode).toBe(1);
      expect(deleteAResult1.stderr).toContain('Cannot delete task');

      // Cannot delete B (C and D depend on it)
      const deleteBResult1 = await cli.run(['delete', taskBId.toString()]);
      expect(deleteBResult1.exitCode).toBe(1);
      expect(deleteBResult1.stderr).toContain('Cannot delete task');

      // Can delete C (no dependencies)
      const deleteCResult = await cli.run(['delete', taskCId.toString()]);
      expect(deleteCResult.exitCode).toBe(0);

      // Still cannot delete A or B
      const deleteAResult2 = await cli.run(['delete', taskAId.toString()]);
      expect(deleteAResult2.exitCode).toBe(1);
      const deleteBResult2 = await cli.run(['delete', taskBId.toString()]);
      expect(deleteBResult2.exitCode).toBe(1);

      // Delete D
      const deleteDResult = await cli.run(['delete', taskDId.toString()]);
      expect(deleteDResult.exitCode).toBe(0);

      // Now can delete B (only A depends on nothing)
      const deleteBResult3 = await cli.run(['delete', taskBId.toString()]);
      expect(deleteBResult3.exitCode).toBe(0);

      // Finally can delete A
      const deleteAResult3 = await cli.run(['delete', taskAId.toString()]);
      expect(deleteAResult3.exitCode).toBe(0);

      // Verify all tasks are gone
      await expect(taskManager.get(taskAId)).rejects.toThrow(NotFoundError);
      await expect(taskManager.get(taskBId)).rejects.toThrow(NotFoundError);
      await expect(taskManager.get(taskCId)).rejects.toThrow(NotFoundError);
      await expect(taskManager.get(taskDId)).rejects.toThrow(NotFoundError);
    });

    it('should detect dependencies in unknown fields', async () => {
      // Purpose: Verify dependency validation handles custom dependency fields via CLI
      const { taskId: parentId } = await cli.addTask('Parent with Unknown Field Dependencies', {
        content: 'This task will have custom dependents'
      });

      // Create task with standard dependency using direct CLI call
      const addStandardChildResult = await cli.run(['add', 'Standard Dependent', '--description',
        'Uses standard dependencies field', '--deps', parentId.toString()]);
      expect(addStandardChildResult.exitCode).toBe(0);
      const standardChildId = parseInt(addStandardChildResult.stdout.trim(), 10);

      // Manually create task file with unknown field dependency
      // Note: We'll use a high ID to avoid conflicts
      const customChildId = 9999;
      const customTaskContent = `---
schema: 1
id: ${customChildId}
title: Custom Dependent
status: pending
tags: []
dependencies: []
depends_on: ["${parentId}"]
created: ${new Date().toISOString()}
updated: ${new Date().toISOString()}
---

Uses custom depends_on field for dependency relationship`;

      const customTaskFile = `${customChildId}-custom-dependent.md`;
      const customTaskPath = path.join(workspace.tasksDirectory, customTaskFile);
      await fs.writeFile(customTaskPath, customTaskContent);

      // Verify both dependencies are detected via CLI
      const deleteResult = await cli.run(['delete', parentId.toString()]);
      expect(deleteResult.exitCode).toBe(1);
      expect(deleteResult.stderr).toContain('Cannot delete task');
      expect(deleteResult.stderr).toContain('2 task(s) depend on it');

      // Clean up by removing dependencies
      const deleteStandardResult = await cli.run(['delete', standardChildId.toString()]);
      expect(deleteStandardResult.exitCode).toBe(0);

      await fs.unlink(customTaskPath);

      // Now parent deletion should succeed
      const deleteParentResult = await cli.run(['delete', parentId.toString()]);
      expect(deleteParentResult.exitCode).toBe(0);
    });
  });

  describe('force deletion scenarios', () => {
    it('should allow force deletion despite dependencies', async () => {
      // Purpose: Verify force deletion bypasses dependency validation via CLI
      const { taskId: parentId } = await cli.addTask('Parent Task for Force Delete', {
        content: 'This will be force deleted'
      });

      // Create child task with dependency using direct CLI call
      const addChildResult = await cli.run(['add', 'Orphaned Child', '--description',
        'This will become orphaned', '--deps', parentId.toString()]);
      expect(addChildResult.exitCode).toBe(0);
      const childId = parseInt(addChildResult.stdout.trim(), 10);

      // Force delete parent (this would normally fail)
      const forceDeleteResult = await cli.run(['delete', parentId.toString(), '--force']);
      expect(forceDeleteResult.exitCode).toBe(0);

      // Parent should be gone
      await expect(taskManager.get(parentId)).rejects.toThrow(NotFoundError);

      // Child should still exist but now has broken dependency
      const orphanedChild = await taskManager.get(childId);
      expect(orphanedChild).toBeDefined();
      expect(orphanedChild.dependencies).toContain(parentId); // Broken reference

      // Clean up orphaned child
      const deleteChildResult = await cli.run(['delete', childId.toString()]);
      expect(deleteChildResult.exitCode).toBe(0);
    });
  });

  describe('error handling with real filesystem', () => {
    it('should handle deletion of non-existent tasks', async () => {
      // Purpose: Verify proper error handling when trying to delete non-existent tasks
      const nonExistentId = 99999;

      await expect(taskManager.delete(nonExistentId)).rejects.toThrow(NotFoundError);

      // Verify no side effects on filesystem
      const taskFiles = await fs.readdir(workspace.tasksDirectory);
      expect(taskFiles).toHaveLength(0);
    });

    it('should handle concurrent deletion attempts', async () => {
      // Purpose: Verify file locking prevents corruption during concurrent operations
      const task = await taskManager.create({
        title: 'Concurrent Delete Test',
        content: 'Testing concurrent operations'
      });

      // Attempt concurrent deletions via TaskManager directly (since this tests file locking)
      const deletePromises = [
        taskManager.delete(task.id),
        taskManager.delete(task.id),
        taskManager.delete(task.id)
      ];

      // One should succeed, others should fail appropriately
      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // At least one should succeed
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Failed attempts can be either NotFoundError or FileSystemError due to file locking
      for (const failure of failed) {
        if (failure.status === 'rejected') {
          // The error could be NotFoundError (file already deleted)
          // or FileSystemError (lock/permissions)
          expect(failure.reason).toBeInstanceOf(Error);
        }
      }

      // Task should be gone
      await expect(taskManager.get(task.id)).rejects.toThrow(NotFoundError);
    });

    it('should maintain workspace integrity after deletions', async () => {
      // Purpose: Verify workspace remains valid after multiple deletion operations
      const tasks = await Promise.all([
        taskManager.create({ title: 'Task 1', content: 'Content 1' }),
        taskManager.create({ title: 'Task 2', content: 'Content 2' }),
        taskManager.create({ title: 'Task 3', content: 'Content 3' }),
        taskManager.create({ title: 'Task 4', content: 'Content 4' }),
        taskManager.create({ title: 'Task 5', content: 'Content 5' })
      ]);

      // Verify all tasks exist
      const allTasks = await taskManager.list();
      expect(allTasks).toHaveLength(5);

      // Delete every other task
      await taskManager.delete(tasks[0].id);
      await taskManager.delete(tasks[2].id);
      await taskManager.delete(tasks[4].id);

      // Verify remaining tasks are still accessible
      const remainingTasks = await taskManager.list();
      expect(remainingTasks).toHaveLength(2);

      const remainingIds = remainingTasks.map((t) => t.id);
      expect(remainingIds).toContain(tasks[1].id);
      expect(remainingIds).toContain(tasks[3].id);

      // Verify remaining tasks are fully functional
      const task2 = await taskManager.get(tasks[1].id);
      expect(task2.title).toBe('Task 2');

      const task4 = await taskManager.get(tasks[3].id);
      expect(task4.title).toBe('Task 4');

      // Verify workspace directory only contains remaining files
      const taskFiles = await fs.readdir(workspace.tasksDirectory);
      const markdownFiles = taskFiles.filter((f) => f.endsWith('.md'));
      expect(markdownFiles).toHaveLength(2);
    });
  });

  describe('TaskManager delete method integration', () => {
    it('should properly integrate with TaskManager delete implementation', async () => {
      // Purpose: Verify integration with existing TaskManager.delete() functionality
      const task = await taskManager.create({
        title: 'Integration Test Task',
        content: 'Testing TaskManager integration',
        tags: ['integration', 'test'],
        status: 'pending'
      });

      // Verify task exists in list
      const beforeDeletion = await taskManager.list();
      expect(beforeDeletion.some((t) => t.id === task.id)).toBe(true);

      // Delete using TaskManager method
      await taskManager.delete(task.id);

      // Verify task is removed from list
      const afterDeletion = await taskManager.list();
      expect(afterDeletion.some((t) => t.id === task.id)).toBe(false);

      // Verify file system state
      const taskFiles = await fs.readdir(workspace.tasksDirectory);
      const taskFile = taskFiles.find((f) => f.startsWith(`${task.id}-`));
      expect(taskFile).toBeUndefined();
    });

    it('should handle TaskManager errors appropriately', async () => {
      // Purpose: Verify proper error propagation from TaskManager
      const invalidId = 'not-a-number' as unknown as number;

      // TaskManager should handle invalid IDs
      await expect(taskManager.delete(invalidId)).rejects.toThrow();
    });
  });
});

