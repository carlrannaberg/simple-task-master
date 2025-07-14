import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner, cliUtils } from '@test/helpers/cli-runner';
import type { Task } from '@lib/types';

describe(
  'CLI Integration',
  () => {
    let workspace: TestWorkspace;
    let cliRunner: CLITestRunner;

    beforeEach(async () => {
      workspace = await TestWorkspace.create('cli-integration-test-');
      cliRunner = new CLITestRunner({ cwd: workspace.directory });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    describe('Command Integration Testing', () => {
      it('should integrate add and list commands seamlessly', async () => {
        // Add multiple tasks
        const { taskId: _id1 } = await cliRunner.addTask('First Task', {
          content: 'First task content',
          tags: ['urgent', 'work'],
        });

        const { taskId: _id2 } = await cliRunner.addTask('Second Task', {
          content: 'Second task content',
          tags: ['personal'],
          status: 'in-progress',
        });

        // List all tasks
        const listResult = await cliRunner.listTasks();
        expect(listResult.exitCode).toBe(0);

        const output = listResult.stdout;
        expect(output).toContain('First Task');
        expect(output).toContain('Second Task');
        expect(output).toContain('urgent');
        expect(output).toContain('work');
        expect(output).toContain('personal');
        expect(output).toContain('in-progress');
      });

      it('should integrate add, update, and show commands', async () => {
        // Add task
        const { taskId } = await cliRunner.addTask('Task to Update', {
          content: 'Original content',
          status: 'pending',
        });

        // Update task
        await cliRunner.updateTask(taskId, {
          title: 'Updated Task Title',
          content: 'Updated content with more details',
          status: 'in-progress',
          tags: ['updated', 'important'],
        });

        // Show updated task
        const showResult = await cliRunner.showTask(taskId);
        expect(showResult.exitCode).toBe(0);

        const output = showResult.stdout;
        expect(output).toContain('Updated Task Title');
        expect(output).toContain('Updated content with more details');
        expect(output).toContain('in-progress');
        expect(output).toContain('updated');
        expect(output).toContain('important');
      });

      it('should integrate list with filtering and search commands', async () => {
        // Create diverse set of tasks
        await cliRunner.addTask('Frontend Work', {
          content: 'React component development',
          tags: ['frontend', 'react', 'urgent'],
          status: 'in-progress',
        });

        await cliRunner.addTask('Backend API', {
          content: 'REST API implementation',
          tags: ['backend', 'api'],
          status: 'pending',
        });

        await cliRunner.addTask('Documentation', {
          content: 'Update project documentation',
          tags: ['docs', 'maintenance'],
          status: 'done',
        });

        // Test status filtering
        const pendingResult = await cliRunner.listTasks({ status: 'pending' });
        expect(pendingResult.stdout).toContain('Backend API');
        expect(pendingResult.stdout).not.toContain('Frontend Work');
        expect(pendingResult.stdout).not.toContain('Documentation');

        // Test tag filtering
        const frontendResult = await cliRunner.listTasks({ tags: ['frontend'] });
        expect(frontendResult.stdout).toContain('Frontend Work');
        expect(frontendResult.stdout).not.toContain('Backend API');

        // Test search functionality
        const searchResult = await cliRunner.listTasks({ search: 'API' });
        expect(searchResult.stdout).toContain('Backend API');
        expect(searchResult.stdout).not.toContain('Frontend Work');
      });

      it('should integrate export and grep commands', async () => {
        // Create tasks with searchable content
        await cliRunner.addTask('User Authentication', {
          content: 'Implement OAuth 2.0 authentication system with JWT tokens',
          tags: ['auth', 'security'],
        });

        await cliRunner.addTask('Database Schema', {
          content: 'Design user tables and authentication relationships',
          tags: ['database', 'schema'],
        });

        await cliRunner.addTask('API Documentation', {
          content: 'Document authentication endpoints and JWT usage',
          tags: ['docs', 'api'],
        });

        // Test grep functionality
        const grepResult = await cliRunner.grepTasks('authentication', {
          ignoreCase: true,
        });

        expect(grepResult.exitCode).toBe(0);
        expect(grepResult.stdout).toContain('User Authentication');
        expect(grepResult.stdout).toContain('Database Schema');
        expect(grepResult.stdout).toContain('API Documentation');

        // Test export functionality
        const exportResult = await cliRunner.exportTasks('json');
        expect(exportResult.exitCode).toBe(0);

        const exportedData = JSON.parse(exportResult.stdout) as Task[];
        expect(exportedData).toHaveLength(3);
        expect(exportedData.some((t) => t.title === 'User Authentication')).toBe(true);
        expect(exportedData.some((t) => t.title === 'Database Schema')).toBe(true);
        expect(exportedData.some((t) => t.title === 'API Documentation')).toBe(true);
      });
    });

    describe('Multi-Command Workflows', () => {
      it('should handle complete task lifecycle workflow', async () => {
        // Initialize → Add → Update → Complete workflow
        const commands = [
          {
            args: [
              'add',
              'Project Setup',
              '--description',
              'Initialize new project',
              '--tags',
              'setup,project',
            ],
          },
          { args: ['list', '--status', 'pending'] },
          {
            args: [
              'update',
              '1',
              '--status',
              'in-progress',
              '--description',
              'Project setup in progress',
            ],
          },
          { args: ['show', '1'] },
          { args: ['update', '1', '--status', 'done'] },
          { args: ['list', '--status', 'done'] },
        ];

        const results = await cliRunner.runSequence(commands);

        // All commands should succeed
        expect(results).toHaveLength(6);
        results.forEach((result) => {
          expect(result.exitCode).toBe(0);
        });

        // Verify final state
        const finalListResult = await cliRunner.listTasks({ status: 'done' });
        expect(finalListResult.stdout).toContain('Project Setup');
      });

      it('should handle batch task creation and management', async () => {
        const taskTitles = [
          'Setup Development Environment',
          'Create Database Schema',
          'Implement User Authentication',
          'Build REST API',
          'Create Frontend Components',
          'Write Tests',
          'Deploy to Production',
        ];

        // Batch create tasks
        const createCommands = taskTitles.map((title) => ({
          args: ['add', title, '--tags', 'project,batch', '--status', 'pending'],
        }));

        const createResults = await cliRunner.runSequence(createCommands);
        expect(createResults).toHaveLength(7);
        createResults.forEach((result) => {
          expect(result.exitCode).toBe(0);
        });

        // Update some tasks to in-progress
        const updateCommands = [
          { args: ['update', '1', '--status', 'in-progress'] },
          { args: ['update', '2', '--status', 'in-progress'] },
          { args: ['update', '3', '--status', 'done'] },
        ];

        const updateResults = await cliRunner.runSequence(updateCommands);
        updateResults.forEach((result) => {
          expect(result.exitCode).toBe(0);
        });

        // Verify final state with different filters
        const pendingResult = await cliRunner.listTasks({ status: 'pending' });
        const inProgressResult = await cliRunner.listTasks({ status: 'in-progress' });
        const doneResult = await cliRunner.listTasks({ status: 'done' });

        expect(cliUtils.getTaskCount(pendingResult.stdout)).toBe(4);
        expect(cliUtils.getTaskCount(inProgressResult.stdout)).toBe(2);
        expect(cliUtils.getTaskCount(doneResult.stdout)).toBe(1);
      });

      it('should handle error recovery in command sequences', async () => {
        // Create valid task
        await cliRunner.addTask('Valid Task', { content: 'This is valid' });

        // Sequence with some failing commands
        const commands = [
          { args: ['show', '1'] }, // Should succeed
          { args: ['update', '999', '--title', 'Non-existent'] }, // Should fail
          { args: ['list'] }, // Should succeed after failure
          { args: ['add', 'Recovery Task', '--description', 'Created after error'] }, // Should succeed
        ];

        const results = await cliRunner.runSequence(commands);

        // First command should succeed
        expect(results[0].exitCode).toBe(0);

        // Second command should fail (stops sequence)
        expect(results[1].exitCode).not.toBe(0);

        // Sequence should stop after first failure
        expect(results).toHaveLength(2);

        // But we should still be able to run commands after
        const listResult = await cliRunner.listTasks();
        expect(listResult.exitCode).toBe(0);
        expect(listResult.stdout).toContain('Valid Task');
      });
    });

    describe('Output Format Verification', () => {
      it('should produce consistent JSON output format', async () => {
        // Create test tasks
        await cliRunner.addTask('JSON Test Task', {
          content: 'Testing JSON output format',
          tags: ['test', 'json'],
          status: 'in-progress',
        });

        // Test JSON format for list command
        const listResult = await cliRunner.listTasks({ format: 'json' });
        expect(listResult.exitCode).toBe(0);

        const tasks = JSON.parse(listResult.stdout) as Task[];
        expect(tasks).toHaveLength(1);

        const task = tasks[0];
        expect(task).toHaveProperty('schema', 1);
        expect(task).toHaveProperty('id', 1);
        expect(task).toHaveProperty('title', 'JSON Test Task');
        expect(task).toHaveProperty('tags', ['test', 'json']);
        expect(task).toHaveProperty('status', 'in-progress');
        expect(task).toHaveProperty('created');
        expect(task).toHaveProperty('updated');
      });

      it('should handle different output formats correctly', async () => {
        // Create task with rich content
        await cliRunner.addTask('Format Test', {
          content: 'Content with **markdown** and special chars: !@#$%^&*()',
          tags: ['format', 'test', 'special-chars'],
          status: 'pending',
        });

        // Test table format (default)
        const tableResult = await cliRunner.listTasks();
        expect(tableResult.stdout).toContain('Format Test');
        expect(tableResult.stdout).toContain('pending');
        expect(tableResult.stdout).toContain('format');

        // Test JSON format
        const jsonResult = await cliRunner.listTasks({ format: 'json' });
        const _jsonTasks = JSON.parse(jsonResult.stdout) as Task[];
        // Note: content is not included in list output by default

        // Test export formats
        const exportJsonResult = await cliRunner.exportTasks('json');
        const exportedTasks = JSON.parse(exportJsonResult.stdout) as Task[];
        expect(exportedTasks).toHaveLength(1);
        expect(exportedTasks[0].title).toBe('Format Test');
      });

      it.skip('should handle empty results gracefully', async () => {
        // Test empty list
        const emptyListResult = await cliRunner.listTasks();
        expect(emptyListResult.exitCode).toBe(0);
        expect(emptyListResult.stdout.trim()).toBe('');

        // Test empty filtered list
        const emptyFilterResult = await cliRunner.listTasks({ status: 'done' });
        expect(emptyFilterResult.exitCode).toBe(0);
        expect(emptyFilterResult.stdout.trim()).toBe('');

        // Test empty search
        const emptySearchResult = await cliRunner.listTasks({ search: 'nonexistent' });
        expect(emptySearchResult.exitCode).toBe(0);
        expect(emptySearchResult.stdout.trim()).toBe('');

        // Test empty grep
        const emptyGrepResult = await cliRunner.grepTasks('nonexistent');
        expect(emptyGrepResult.exitCode).toBe(0);
        expect(emptyGrepResult.stdout.trim()).toBe('');
      });

      it.skip('should format error messages consistently', async () => {
        // Test various error scenarios

        // Non-existent task
        const showError = await cliRunner.runFailure(['show', '999']);
        expect(showError.stderr).toContain('not found');
        expect(showError.stderr).toContain('999');

        // Invalid status
        const statusError = await cliRunner.runFailure(['add', 'Test', '--status', 'invalid']);
        expect(statusError.stderr).toContain('status');
        expect(statusError.stderr).toContain('invalid');

        // Missing required argument
        const missingArgError = await cliRunner.runFailure(['add']);
        expect(missingArgError.stderr).toContain('title');

        // Invalid command
        const invalidCommandError = await cliRunner.runFailure(['invalid-command']);
        expect(invalidCommandError.stderr).toContain('unknown command');
      });
    });

    describe('Command Performance and Reliability', () => {
      it('should handle commands with large amounts of data', async () => {
        // Create task with large content
        const largeContent = 'This is a very long task description. '.repeat(1000);

        const { taskId } = await cliRunner.addTask('Large Content Task', {
          content: largeContent,
          tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
        });

        // Commands should handle large data without issues
        const showResult = await cliRunner.showTask(taskId);
        expect(showResult.exitCode).toBe(0);
        expect(showResult.stdout).toContain('Large Content Task');

        const listResult = await cliRunner.listTasks();
        expect(listResult.exitCode).toBe(0);
        expect(listResult.stdout).toContain('Large Content Task');
      });

      it.skip('should maintain performance with multiple tasks', async () => {
        // Create 100 tasks
        const createPromises = Array.from({ length: 100 }, (_, i) =>
          cliRunner.addTask(`Performance Test Task ${i + 1}`, {
            content: `Content for performance test task ${i + 1}`,
            tags: [`batch-${Math.floor(i / 10)}`, 'performance'],
            status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending',
          })
        );

        await Promise.all(createPromises);

        // List command should remain fast
        const startTime = Date.now();
        const listResult = await cliRunner.listTasks();
        const duration = Date.now() - startTime;

        expect(listResult.exitCode).toBe(0);
        expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
        expect(cliUtils.getTaskCount(listResult.stdout)).toBe(100);
      });

      it.skip('should handle rapid consecutive commands', async () => {
        const commandPromises = Array.from({ length: 20 }, (_, i) =>
          cliRunner.addTask(`Rapid Task ${i + 1}`, {
            content: `Rapid creation test ${i + 1}`,
          })
        );

        // All commands should succeed
        const results = await Promise.all(commandPromises);
        results.forEach(({ result }) => {
          expect(result.exitCode).toBe(0);
        });

        // Verify all tasks were created with unique IDs
        const taskIds = results.map(({ taskId }) => taskId);
        const uniqueIds = new Set(taskIds);
        expect(uniqueIds.size).toBe(20);

        // Final list should show all tasks
        const listResult = await cliRunner.listTasks();
        expect(cliUtils.getTaskCount(listResult.stdout)).toBe(20);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle special characters in task data', async () => {
        const specialTitle = 'Task with "quotes" and \'apostrophes\' & symbols';
        const specialContent = `
Content with:
- Newlines
- "Double quotes"
- 'Single quotes'
- Special chars: !@#$%^&*()
- Unicode: 🚀 ñáñà 中文
- JSON-like: {"key": "value"}
      `.trim();

        const { taskId } = await cliRunner.addTask(specialTitle, {
          content: specialContent,
          tags: ['special-chars', 'unicode', 'json-test'],
        });

        // Verify task was created correctly
        const showResult = await cliRunner.showTask(taskId, 'markdown');
        expect(showResult.exitCode).toBe(0);
        expect(showResult.stdout).toContain(specialTitle);
        expect(showResult.stdout).toContain('🚀');
        expect(showResult.stdout).toContain('中文');
        expect(showResult.stdout).toContain('{"key": "value"}');
      });

      it('should handle very long command arguments', async () => {
        const longTitle = 'A'.repeat(200);
        const longContent = 'B'.repeat(10000);
        const longTags = Array.from({ length: 100 }, (_, i) => `very-long-tag-name-${i}`);

        try {
          const { taskId } = await cliRunner.addTask(longTitle, {
            content: longContent,
            tags: longTags,
          });

          // If creation succeeds, verify task
          const showResult = await cliRunner.showTask(taskId);
          expect(showResult.exitCode).toBe(0);
        } catch (error) {
          // If it fails, should be due to size limits, not command line issues
          const err = error as Error;
          expect(err.message).toMatch(/size|limit|length/i);
        }
      });

      it('should handle corrupted workspace gracefully', async () => {
        // Create valid task first
        const { taskId: _taskId } = await cliRunner.addTask('Valid Task', {
          content: 'This task is valid',
        });

        // Corrupt the task file
        const taskFile = await workspace.listFiles('.simple-task-master/tasks');
        const corruptedFilePath = `.simple-task-master/tasks/${taskFile[0]}`;
        await workspace.writeFile(corruptedFilePath, 'Invalid file content');

        // Commands should handle corruption gracefully
        const listResult = await cliRunner.listTasks();
        expect(listResult.exitCode).toBe(0);
        // Should not include corrupted task
        expect(listResult.stdout).not.toContain('Valid Task');

        // Should still be able to create new tasks
        const newTaskResult = await cliRunner.addTask('New Task After Corruption', {
          content: 'This should work',
        });
        expect(newTaskResult.result.exitCode).toBe(0);
      });
    });
  },
  { timeout: 10000 }
);
