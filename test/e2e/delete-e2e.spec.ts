import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner, runSTM, runSTMSuccess, runSTMFailure } from '@test/helpers/cli-runner';

describe('Delete Command E2E Tests', () => {
  let workspace: TestWorkspace;
  let cli: CLITestRunner;

  beforeEach(async () => {
    workspace = await TestWorkspace.create('delete-e2e-');
    cli = new CLITestRunner({ cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('basic delete command functionality', () => {
    it('should delete task via CLI command', async () => {
      // Purpose: Verify complete CLI workflow from creation to deletion
      const { taskId } = await cli.addTask('Task to Delete', {
        content: 'This task will be deleted via CLI'
      });

      // Verify task exists before deletion
      const showResult = await runSTMSuccess(['show', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(showResult.stdout).toContain('Task to Delete');
      expect(showResult.stdout).toContain('This task will be deleted via CLI');

      // Delete task using CLI
      const deleteResult = await runSTMSuccess(['delete', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteResult.exitCode).toBe(0);
      expect(deleteResult.stderr).toContain(`✓ Deleted task ${taskId}: "Task to Delete"`);

      // Verify task no longer exists
      const showAfterDelete = await runSTMFailure(['show', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(showAfterDelete.exitCode).toBe(3);
      expect(showAfterDelete.stderr).toContain('Task not found');

      // Verify task doesn't appear in list
      const listResult = await runSTMSuccess(['list'], {
        cwd: workspace.directory
      });
      expect(listResult.stdout.trim()).toBe(''); // Empty list
    });

    it('should delete task with complex properties', async () => {
      // Purpose: Verify deletion works for tasks with various properties
      const { taskId } = await cli.addTask('Complex Task for Deletion', {
        content: 'Task with multiple properties',
        tags: ['complex', 'deletion', 'test'],
        status: 'in-progress'
      });

      // Verify task properties before deletion
      const showResult = await runSTMSuccess(['show', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(showResult.stdout).toContain('Complex Task for Deletion');
      expect(showResult.stdout).toContain('in-progress');
      expect(showResult.stdout).toContain('complex');
      expect(showResult.stdout).toContain('deletion');

      // Delete the complex task
      const deleteResult = await runSTMSuccess(['delete', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteResult.exitCode).toBe(0);
      expect(deleteResult.stderr).toContain('Deleted task');
      expect(deleteResult.stderr).toContain('Complex Task for Deletion');

      // Verify complete removal
      const listResult = await runSTMSuccess(['list'], {
        cwd: workspace.directory
      });
      expect(listResult.stdout).not.toContain('Complex Task for Deletion');
    });
  });

  describe('dependency validation via CLI', () => {
    it('should prevent deletion when dependencies exist', async () => {
      // Purpose: Verify CLI dependency validation and error messages
      const { taskId: parentId } = await cli.addTask('Parent Task', {
        content: 'This task will have dependents'
      });

      const { taskId: childId } = await cli.addTask('Child Task', {
        content: 'This task depends on the parent',
        dependencies: [parentId]
      });

      // Verify dependency relationship
      const showChildResult = await runSTMSuccess(['show', childId.toString()], {
        cwd: workspace.directory
      });
      expect(showChildResult.stdout).toContain(parentId.toString());

      // Attempt to delete parent should fail
      const deleteResult = await runSTMFailure(['delete', parentId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteResult.exitCode).toBe(1);
      expect(deleteResult.stderr).toContain('Cannot delete task');
      expect(deleteResult.stderr).toContain('task(s) depend on it');
      expect(deleteResult.stderr).toContain(`${childId}: Child Task`);
      expect(deleteResult.stderr).toContain('Use --force to delete anyway');

      // Verify parent task still exists
      const showParentResult = await runSTMSuccess(['show', parentId.toString()], {
        cwd: workspace.directory
      });
      expect(showParentResult.stdout).toContain('Parent Task');

      // Delete child first, then parent should work
      const deleteChildResult = await runSTMSuccess(['delete', childId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteChildResult.exitCode).toBe(0);

      // Now parent deletion should succeed
      const deleteParentResult = await runSTMSuccess(['delete', parentId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteParentResult.exitCode).toBe(0);
      expect(deleteParentResult.stderr).toContain('Deleted task');
    });

    it('should handle force deletion with dependencies', async () => {
      // Purpose: Verify force flag bypasses dependency validation via CLI
      const { taskId: parentId } = await cli.addTask('Force Delete Parent', {
        content: 'This will be force deleted'
      });

      const { taskId: childId } = await cli.addTask('Orphaned Child', {
        content: 'This will become orphaned',
        dependencies: [parentId]
      });

      // Force delete parent despite dependency
      const forceDeleteResult = await runSTMSuccess(['delete', parentId.toString(), '--force'], {
        cwd: workspace.directory
      });
      expect(forceDeleteResult.exitCode).toBe(0);
      expect(forceDeleteResult.stderr).toContain(`Deleted task ${parentId}: "Force Delete Parent"`);

      // Verify parent is gone
      const showParentResult = await runSTMFailure(['show', parentId.toString()], {
        cwd: workspace.directory
      });
      expect(showParentResult.exitCode).toBe(3);

      // Child should still exist (but now has broken dependency)
      const showChildResult = await runSTMSuccess(['show', childId.toString()], {
        cwd: workspace.directory
      });
      expect(showChildResult.stdout).toContain('Orphaned Child');

      // Clean up orphaned child
      await runSTMSuccess(['delete', childId.toString()], {
        cwd: workspace.directory
      });
    });

    it('should handle force deletion with short flag', async () => {
      // Purpose: Verify short form of force flag works correctly
      const { taskId: parentId } = await cli.addTask('Short Flag Parent');
      const { taskId: childId } = await cli.addTask('Dependent Child', {
        dependencies: [parentId]
      });

      // Use short -f flag for force deletion
      const forceDeleteResult = await runSTMSuccess(['delete', parentId.toString(), '-f'], {
        cwd: workspace.directory
      });
      expect(forceDeleteResult.exitCode).toBe(0);
      expect(forceDeleteResult.stderr).toContain('Deleted task');

      // Clean up
      await runSTMSuccess(['delete', childId.toString()], {
        cwd: workspace.directory
      });
    });

    it('should handle multiple dependencies correctly', async () => {
      // Purpose: Verify dependency validation with multiple dependent tasks
      const { taskId: parentId } = await cli.addTask('Popular Parent Task');

      const childIds = [];
      for (let i = 1; i <= 3; i++) {
        const { taskId } = await cli.addTask(`Dependent Child ${i}`, {
          dependencies: [parentId]
        });
        childIds.push(taskId);
      }

      // Attempt to delete parent should list all dependents
      const deleteResult = await runSTMFailure(['delete', parentId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteResult.exitCode).toBe(1);
      expect(deleteResult.stderr).toContain('Cannot delete task: 3 task(s) depend on it');

      // Should list all dependent tasks
      for (let i = 0; i < 3; i++) {
        expect(deleteResult.stderr).toContain(`${childIds[i]}: Dependent Child ${i + 1}`);
      }

      // Clean up all children, then parent
      for (const childId of childIds) {
        await runSTMSuccess(['delete', childId.toString()], {
          cwd: workspace.directory
        });
      }
      await runSTMSuccess(['delete', parentId.toString()], {
        cwd: workspace.directory
      });
    });
  });

  describe('error handling via CLI', () => {
    it('should show helpful error for nonexistent task', async () => {
      // Purpose: Verify user-friendly error messages for invalid input
      const result = await runSTMFailure(['delete', '999'], {
        cwd: workspace.directory
      });
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain('Task not found: 999');
    });

    it('should handle invalid task ID formats', async () => {
      // Purpose: Verify proper validation of task ID input
      const invalidInputs = [
        { id: 'abc', expectedExit: 1, expectedError: 'Invalid task ID: abc' },
        { id: '0', expectedExit: 1, expectedError: 'Invalid task ID: 0' },
        { id: '12.5', expectedExit: 3, expectedError: 'Task not found: 12' }, // parseInt truncates to 12
        { id: 'null', expectedExit: 1, expectedError: 'Invalid task ID: null' },
        { id: '', expectedExit: 1, expectedError: 'Invalid task ID:' } // Empty string validation error
      ];

      for (const { id, expectedExit, expectedError } of invalidInputs) {
        const result = await runSTMFailure(['delete', id], {
          cwd: workspace.directory
        });
        expect(result.exitCode).toBe(expectedExit);
        expect(result.stderr.toLowerCase()).toContain(expectedError.toLowerCase());
      }

      // Test negative ID separately as it's interpreted as an option by commander
      const negativeResult = await runSTMFailure(['delete', '--', '-1'], {
        cwd: workspace.directory
      });
      expect(negativeResult.exitCode).toBe(1);
      expect(negativeResult.stderr).toContain('Invalid task ID: -1');
    });

    it('should handle missing task ID argument', async () => {
      // Purpose: Verify proper error when required argument is missing
      const result = await runSTM(['delete'], {
        cwd: workspace.directory
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('missing required argument');
    });

    it('should handle workspace errors gracefully', async () => {
      // Purpose: Verify error handling when workspace operations fail
      const { taskId } = await cli.addTask('Test Task');

      // Corrupt the workspace by removing the tasks directory
      const tasksDir = workspace.tasksDirectory;
      await fs.rm(tasksDir, { recursive: true, force: true });

      const deleteResult = await runSTMFailure(['delete', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteResult.exitCode).toBe(3); // Task not found error after workspace corruption
      expect(deleteResult.stderr).toMatch(/not found|error/i);
    });
  });

  describe('help and command structure', () => {
    it('should show help information correctly', async () => {
      // Purpose: Verify help command output provides useful information
      const helpResult = await runSTMSuccess(['delete', '--help'], {
        cwd: workspace.directory
      });
      expect(helpResult.stdout).toContain('Delete a task permanently');
      expect(helpResult.stdout).toContain('Usage:');
      expect(helpResult.stdout).toContain('<id>');
      expect(helpResult.stdout).toContain('Task ID to delete');
      expect(helpResult.stdout).toContain('-f, --force');
      expect(helpResult.stdout).toContain('Force deletion even if other tasks depend on it');
    });

    it('should appear in main help output', async () => {
      // Purpose: Verify delete command is registered and visible in main help
      const mainHelpResult = await runSTMSuccess(['--help'], {
        cwd: workspace.directory
      });
      expect(mainHelpResult.stdout).toContain('delete');
      expect(mainHelpResult.stdout).toContain('Delete a task permanently');
    });
  });

  describe('integration with other commands', () => {
    it('should work seamlessly with other CLI commands', async () => {
      // Purpose: Verify delete command integrates properly with full CLI workflow

      // Create multiple tasks
      const { taskId: task1 } = await cli.addTask('First Task', {
        content: 'First task content',
        tags: ['test']
      });

      const { taskId: task2 } = await cli.addTask('Second Task', {
        content: 'Second task content',
        tags: ['test'],
        status: 'in-progress'
      });

      const { taskId: task3 } = await cli.addTask('Third Task', {
        content: 'Third task content',
        dependencies: [task1]
      });

      // Verify all tasks exist in list
      const listResult = await runSTMSuccess(['list'], {
        cwd: workspace.directory
      });
      const tasks = listResult.stdout.trim().split('\n').filter((line) => line.trim());
      expect(tasks).toHaveLength(3);

      // Delete independent task
      await runSTMSuccess(['delete', task2.toString()], {
        cwd: workspace.directory
      });

      // Verify only 2 tasks remain
      const listAfterDelete = await runSTMSuccess(['list'], {
        cwd: workspace.directory
      });
      const remainingTasks = listAfterDelete.stdout.trim().split('\n').filter((line) => line.trim());
      expect(remainingTasks).toHaveLength(2);

      // Cannot delete task1 due to dependency
      const deleteTask1Result = await runSTMFailure(['delete', task1.toString()], {
        cwd: workspace.directory
      });
      expect(deleteTask1Result.exitCode).toBe(1);

      // Delete dependent task first
      await runSTMSuccess(['delete', task3.toString()], {
        cwd: workspace.directory
      });

      // Now can delete task1
      await runSTMSuccess(['delete', task1.toString()], {
        cwd: workspace.directory
      });

      // Verify all tasks are gone
      const finalListResult = await runSTMSuccess(['list'], {
        cwd: workspace.directory
      });
      expect(finalListResult.stdout.trim()).toBe('');
    });

    it('should maintain task numbering after deletions', async () => {
      // Purpose: Verify task ID management remains consistent after deletions

      // Create several tasks
      const taskIds = [];
      for (let i = 1; i <= 5; i++) {
        const { taskId } = await cli.addTask(`Task ${i}`);
        taskIds.push(taskId);
      }

      // Delete middle tasks
      await runSTMSuccess(['delete', taskIds[1].toString()], {
        cwd: workspace.directory
      });
      await runSTMSuccess(['delete', taskIds[3].toString()], {
        cwd: workspace.directory
      });

      // Create new task - should get next available ID
      const { taskId: newTaskId } = await cli.addTask('New Task After Deletions');
      expect(newTaskId).toBeGreaterThan(Math.max(...taskIds));

      // Verify remaining tasks are still accessible
      await runSTMSuccess(['show', taskIds[0].toString()], {
        cwd: workspace.directory
      });
      await runSTMSuccess(['show', taskIds[2].toString()], {
        cwd: workspace.directory
      });
      await runSTMSuccess(['show', taskIds[4].toString()], {
        cwd: workspace.directory
      });
      await runSTMSuccess(['show', newTaskId.toString()], {
        cwd: workspace.directory
      });
    });
  });

  describe('output format consistency', () => {
    it('should provide consistent success and error message formats', async () => {
      // Purpose: Verify output format matches established CLI patterns
      const { taskId } = await cli.addTask('Output Format Test Task');

      // Success message format
      const deleteResult = await runSTMSuccess(['delete', taskId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteResult.stderr).toMatch(/✓ Deleted task \d+: ".+"/);

      // Error message format for not found
      const notFoundResult = await runSTMFailure(['delete', '999'], {
        cwd: workspace.directory
      });
      expect(notFoundResult.stderr).toMatch(/Error: Task not found: \d+/);
    });

    it('should handle special characters in task titles', async () => {
      // Purpose: Verify deletion works with tasks containing special characters
      const specialTitles = [
        'Task with "quotes" and symbols !@#',
        'Unicode task: 测试 🚀 ñáñà',
        'Task with \'apostrophes\' & ampersands'
      ];

      const taskIds = [];
      for (const title of specialTitles) {
        const { taskId } = await cli.addTask(title);
        taskIds.push({ id: taskId, title });
      }

      // Delete each task and verify proper output
      for (const { id, title } of taskIds) {
        const deleteResult = await runSTMSuccess(['delete', id.toString()], {
          cwd: workspace.directory
        });
        expect(deleteResult.stderr).toContain(`Deleted task ${id}`);
        expect(deleteResult.stderr).toContain(title);
      }
    });
  });
});

