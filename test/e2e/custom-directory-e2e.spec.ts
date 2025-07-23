import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner, runSTM, runSTMSuccess, runSTMFailure } from '@test/helpers/cli-runner';

describe('Custom Directory E2E Tests', () => {
  let workspace: TestWorkspace;
  let cli: CLITestRunner;

  beforeEach(async () => {
    // Create base workspace without STM initialization
    workspace = await TestWorkspace.create('custom-dir-e2e-');
    // Remove the auto-initialized STM directory to test init from scratch
    await fs.rm(workspace.stmDirectory, { recursive: true, force: true });
    cli = new CLITestRunner({ cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('init command with custom directory', () => {
    it('should initialize STM with custom tasks directory via CLI', async () => {
      // Purpose: Test complete initialization with custom directory path
      const customDir = 'my-tasks';

      const initResult = await runSTMSuccess(['init', '--tasks-dir', customDir], {
        cwd: workspace.directory
      });

      expect(initResult.exitCode).toBe(0);
      expect(initResult.stderr).toContain('Initialized STM repository');
      expect(initResult.stderr).toContain(`Using custom tasks directory: ${customDir}`);

      // Verify directory structure
      expect(await workspace.fileExists('.simple-task-master/config.json')).toBe(true);
      expect(await workspace.fileExists(customDir)).toBe(true);

      // Verify config contains custom directory
      const config = JSON.parse(await workspace.readFile('.simple-task-master/config.json'));
      expect(config.tasksDir).toBe(customDir);

      // Verify .gitignore was updated
      const gitignore = await workspace.readFile('.gitignore');
      expect(gitignore).toContain('my-tasks/');
      expect(gitignore).toContain('.simple-task-master/lock');
    });

    it('should handle relative paths with ./ prefix', async () => {
      // Purpose: Verify relative path handling preserves ./ prefix
      const customDir = './project-tasks';

      const initResult = await runSTMSuccess(['init', '--tasks-dir', customDir], {
        cwd: workspace.directory
      });

      expect(initResult.exitCode).toBe(0);
      expect(initResult.stderr).toContain('Using custom tasks directory: ./project-tasks');

      // Config should preserve the ./ prefix
      const config = JSON.parse(await workspace.readFile('.simple-task-master/config.json'));
      expect(config.tasksDir).toBe('./project-tasks');

      // Directory should be created without the ./
      expect(await workspace.fileExists('project-tasks')).toBe(true);
    });

    it('should handle nested directory paths', async () => {
      // Purpose: Test initialization with nested directory structure
      const customDir = 'docs/tasks/active';

      const initResult = await runSTMSuccess(['init', '--tasks-dir', customDir], {
        cwd: workspace.directory
      });

      expect(initResult.exitCode).toBe(0);
      expect(await workspace.fileExists(customDir)).toBe(true);

      const config = JSON.parse(await workspace.readFile('.simple-task-master/config.json'));
      expect(config.tasksDir).toBe(customDir);
    });

    it('should reject invalid directory paths', async () => {
      // Purpose: Verify security validation for directory paths
      const invalidPaths = [
        '../outside-project',
        '../../etc/passwd',
        '/etc/system',
        'tasks/../../../etc'
      ];

      for (const invalidPath of invalidPaths) {
        const initResult = await runSTMFailure(['init', '--tasks-dir', invalidPath], {
          cwd: workspace.directory
        });

        expect(initResult.exitCode).toBe(1);
        expect(initResult.stderr).toMatch(
          /cannot contain directory traversal|must be within|cannot use system/i
        );
      }
    });

    it('should warn when initializing over existing directory', async () => {
      // Purpose: Test behavior when directory already exists with files
      const existingDir = 'existing-tasks';
      await workspace.writeFile(path.join(existingDir, 'existing.md'), '# Existing file');

      const initResult = await runSTMSuccess(['init', '--tasks-dir', existingDir], {
        cwd: workspace.directory
      });

      expect(initResult.exitCode).toBe(0);
      expect(initResult.stderr).toContain(
        `Directory ${existingDir} already exists and contains files`
      );

      // Existing file should still be there
      expect(await workspace.fileExists(path.join(existingDir, 'existing.md'))).toBe(true);
    });

    it('should reject initialization inside .simple-task-master', async () => {
      // Purpose: Prevent configuration conflicts
      const initResult = await runSTMFailure(
        ['init', '--tasks-dir', '.simple-task-master/custom'],
        {
          cwd: workspace.directory
        }
      );

      expect(initResult.exitCode).toBe(1);
      expect(initResult.stderr).toContain('cannot be inside .simple-task-master directory');
    });
  });

  describe('complete CLI workflow with custom directory', () => {
    beforeEach(async () => {
      // Initialize with custom directory for these tests
      await runSTMSuccess(['init', '--tasks-dir', 'my-custom-tasks'], {
        cwd: workspace.directory
      });
    });

    it('should perform all basic operations with custom directory', async () => {
      // Purpose: Verify full CRUD workflow works with custom directory

      // Add task
      const addResult = await runSTMSuccess(
        ['add', 'Custom Dir Task', '--description', 'Testing custom directory'],
        { cwd: workspace.directory }
      );
      const taskId = parseInt(addResult.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task file is in custom directory
      const taskFiles = await workspace.listFiles('my-custom-tasks');
      expect(taskFiles).toHaveLength(1);
      expect(taskFiles[0]).toMatch(/1-custom-dir-task\.md/);

      // List tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      expect(listResult.stdout).toContain('Custom Dir Task');

      // Show task
      const showResult = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(showResult.stdout).toContain('Custom Dir Task');
      expect(showResult.stdout).toContain('Testing custom directory');

      // Update task
      await runSTMSuccess(
        ['update', '1', '--status', 'in-progress', '--title', 'Updated Custom Task'],
        { cwd: workspace.directory }
      );

      const updatedShow = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(updatedShow.stdout).toContain('Updated Custom Task');
      expect(updatedShow.stdout).toContain('in-progress');

      // Grep functionality
      const grepResult = await runSTMSuccess(['grep', 'custom', '--ignore-case'], {
        cwd: workspace.directory
      });
      expect(grepResult.stdout).toContain('Updated Custom Task');
      expect(grepResult.stdout).toContain('Testing custom directory');

      // Export functionality
      const exportPath = path.join(workspace.directory, 'export.json');
      await runSTMSuccess(['export', '--format', 'json', '--output', exportPath], {
        cwd: workspace.directory
      });

      const exportData = JSON.parse(await workspace.readFile('export.json'));
      expect(exportData).toHaveLength(1);
      expect(exportData[0].title).toBe('Updated Custom Task');

      // Delete task
      const deleteResult = await runSTMSuccess(['delete', '1'], {
        cwd: workspace.directory
      });
      expect(deleteResult.exitCode).toBe(0);

      // Verify task is gone
      const emptyList = await runSTMSuccess(['list'], { cwd: workspace.directory });
      expect(emptyList.stdout.trim()).toBe('');

      // Verify file is removed from custom directory
      const remainingFiles = await workspace.listFiles('my-custom-tasks');
      expect(remainingFiles).toHaveLength(0);
    });

    it('should handle complex operations with dependencies', async () => {
      // Purpose: Test advanced features work with custom directories

      // Create parent task
      const parent = await cli.addTask('Parent Task', {
        content: 'This is the parent',
        tags: ['parent', 'test']
      });

      // Create child tasks with dependencies
      const child1 = await cli.addTask('Child Task 1', {
        content: 'Depends on parent',
        dependencies: [parent.taskId]
      });

      const child2 = await cli.addTask('Child Task 2', {
        content: 'Also depends on parent',
        dependencies: [parent.taskId],
        status: 'in-progress'
      });

      // Verify files are in custom directory
      const taskFiles = await workspace.listFiles('my-custom-tasks');
      expect(taskFiles).toHaveLength(3);

      // Test dependency validation
      const deleteParent = await runSTMFailure(['delete', parent.taskId.toString()], {
        cwd: workspace.directory
      });
      expect(deleteParent.exitCode).toBe(1);
      expect(deleteParent.stderr).toContain('Cannot delete task');
      expect(deleteParent.stderr).toContain('task(s) depend on it');

      // Force delete should work
      await runSTMSuccess(['delete', parent.taskId.toString(), '--force'], {
        cwd: workspace.directory
      });

      // Clean up remaining tasks
      await runSTMSuccess(['delete', child1.taskId.toString()], { cwd: workspace.directory });
      await runSTMSuccess(['delete', child2.taskId.toString()], { cwd: workspace.directory });
    });

    it('should work from subdirectories', async () => {
      // Purpose: Verify workspace discovery works with custom directories

      // Create task from root
      await cli.addTask('Root Task');

      // Create subdirectory and work from there
      const subDir = path.join(workspace.directory, 'sub', 'directory');
      await fs.mkdir(subDir, { recursive: true });

      // List from subdirectory should find workspace
      const listResult = await runSTMSuccess(['list'], { cwd: subDir });
      expect(listResult.stdout).toContain('Root Task');

      // Add task from subdirectory
      const addResult = await runSTMSuccess(['add', 'Subdir Task'], { cwd: subDir });
      const taskId = parseInt(addResult.stdout.trim(), 10);
      expect(taskId).toBe(2);

      // Verify both tasks are in custom directory
      const taskFiles = await workspace.listFiles('my-custom-tasks');
      expect(taskFiles).toHaveLength(2);

      // Show from different subdirectory
      const anotherSubDir = path.join(workspace.directory, 'another');
      await fs.mkdir(anotherSubDir);

      const showResult = await runSTMSuccess(['show', '2'], { cwd: anotherSubDir });
      expect(showResult.stdout).toContain('Subdir Task');
    });
  });

  describe('backward compatibility', () => {
    it('should work with old workspaces without config.json', async () => {
      // Purpose: Ensure backward compatibility with pre-config workspaces

      // Manually create old-style workspace structure
      const stmDir = path.join(workspace.directory, '.simple-task-master');
      const tasksDir = path.join(stmDir, 'tasks');
      await fs.mkdir(stmDir, { recursive: true });
      await fs.mkdir(tasksDir, { recursive: true });

      // Create a task file manually
      const taskContent = `---
id: 1
title: Legacy Task
status: pending
created: 2024-01-01T00:00:00.000Z
updated: 2024-01-01T00:00:00.000Z
tags: [legacy]
dependencies: []
schema: 1
---

# Description

This is a legacy task without config.json`;

      await fs.writeFile(path.join(tasksDir, '1-legacy-task.md'), taskContent, 'utf8');

      // List should work and use default tasks directory
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      expect(listResult.stdout).toContain('Legacy Task');

      // Should be able to add new tasks
      const addResult = await runSTMSuccess(['add', 'New Task in Legacy Workspace'], {
        cwd: workspace.directory
      });
      const taskId = parseInt(addResult.stdout.trim(), 10);
      expect(taskId).toBe(2);

      // Verify task was added to default location
      const taskFiles = await workspace.listFiles('.simple-task-master/tasks');
      expect(taskFiles).toHaveLength(2);
    });

    it('should handle missing config.json gracefully', async () => {
      // Purpose: Test operations when config.json is deleted

      // Initialize normally
      await runSTMSuccess(['init'], { cwd: workspace.directory });

      // Add a task
      await cli.addTask('Test Task');

      // Remove config.json
      await fs.unlink(path.join(workspace.directory, '.simple-task-master', 'config.json'));

      // Operations should still work with defaults
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      expect(listResult.stdout).toContain('Test Task');

      // Should be able to add new tasks
      const addResult = await runSTMSuccess(['add', 'Task Without Config'], {
        cwd: workspace.directory
      });
      const taskId = parseInt(addResult.stdout.trim(), 10);
      expect(taskId).toBe(2);
    });

    it('should handle corrupted config.json', async () => {
      // Purpose: Test error handling for invalid config files

      // Initialize with custom directory
      await runSTMSuccess(['init', '--tasks-dir', 'custom'], { cwd: workspace.directory });

      // Corrupt the config file
      await workspace.writeFile('.simple-task-master/config.json', '{ invalid json }');

      // Operations should fail gracefully
      const listResult = await runSTMFailure(['list'], { cwd: workspace.directory });
      expect(listResult.exitCode).toBe(1);
      expect(listResult.stderr).toContain('Invalid config.json');

      // Fix config and verify recovery
      const validConfig = {
        schema: 1,
        lockTimeoutMs: 5000,
        maxTaskSizeBytes: 1048576,
        tasksDir: 'custom'
      };
      await workspace.writeFile(
        '.simple-task-master/config.json',
        JSON.stringify(validConfig, null, 2)
      );

      // Should work again
      const fixedList = await runSTMSuccess(['list'], { cwd: workspace.directory });
      expect(fixedList.exitCode).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle permission errors on custom directory', async () => {
      // Purpose: Test error handling for filesystem permission issues

      // Skip on Windows due to different permission model
      if (process.platform === 'win32') {
        return;
      }

      // Initialize with custom directory
      await runSTMSuccess(['init', '--tasks-dir', 'restricted'], { cwd: workspace.directory });

      // Make directory read-only
      const restrictedDir = path.join(workspace.directory, 'restricted');
      await fs.chmod(restrictedDir, 0o444);

      // Try to add task
      const addResult = await runSTMFailure(['add', 'Permission Test'], {
        cwd: workspace.directory
      });
      expect(addResult.exitCode).not.toBe(0);
      expect(addResult.stderr).toMatch(/permission|access/i);

      // Restore permissions for cleanup
      await fs.chmod(restrictedDir, 0o755);
    });

    it('should handle very long custom directory paths', async () => {
      // Purpose: Test path length limits
      const longPath = 'very/deeply/nested/directory/structure/for/tasks/storage';

      const initResult = await runSTMSuccess(['init', '--tasks-dir', longPath], {
        cwd: workspace.directory
      });

      expect(initResult.exitCode).toBe(0);

      // Should be able to use it
      const addResult = await runSTMSuccess(['add', 'Task in Deep Directory'], {
        cwd: workspace.directory
      });
      const taskId = parseInt(addResult.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify file location
      const deepFiles = await workspace.listFiles(longPath);
      expect(deepFiles).toHaveLength(1);
    });

    it('should handle special characters in directory names', async () => {
      // Purpose: Test directory names with special characters
      const specialDir = 'tasks-2024 (active)';

      const initResult = await runSTMSuccess(['init', '--tasks-dir', specialDir], {
        cwd: workspace.directory
      });

      expect(initResult.exitCode).toBe(0);

      // Add and verify task
      await cli.addTask('Special Dir Task');

      const files = await workspace.listFiles(specialDir);
      expect(files).toHaveLength(1);
    });

    it('should handle concurrent operations with custom directory', async () => {
      // Purpose: Test thread safety with custom directories

      await runSTMSuccess(['init', '--tasks-dir', 'concurrent-tasks'], {
        cwd: workspace.directory
      });

      // Run multiple add operations concurrently - use fewer to reduce lock contention
      const concurrentCount = 5;
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        runSTM(['add', `Concurrent Task ${i + 1}`], { cwd: workspace.directory })
      );

      const results = await Promise.all(promises);

      // Count successful operations
      let successCount = 0;
      let lockFailures = 0;
      const taskIds: number[] = [];

      for (const result of results) {
        if (result.exitCode === 0) {
          successCount++;
          const taskId = parseInt(result.stdout.trim(), 10);
          if (!isNaN(taskId)) {
            taskIds.push(taskId);
          }
        } else if (
          result.stderr.toLowerCase().includes('lock') ||
          result.stderr.toLowerCase().includes('timeout')
        ) {
          lockFailures++;
        }
      }

      // At least one should succeed
      expect(successCount).toBeGreaterThan(0);

      // Log for debugging if needed
      if (successCount !== taskIds.length) {
        console.warn('Success count:', successCount, 'Task IDs:', taskIds);
      }

      // All successful task IDs should be unique
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(taskIds.length);

      // Wait a bit for file system to catch up
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify files in custom directory
      const files = await workspace.listFiles('concurrent-tasks');
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      // File count should match the number of unique task IDs
      expect(mdFiles.length).toBe(uniqueIds.size);

      // Most failures should be lock-related
      expect(lockFailures).toBeGreaterThanOrEqual(concurrentCount - successCount - 1);
    });

    it('should validate custom directory on every operation', async () => {
      // Purpose: Ensure directory validation happens consistently

      // Initialize with custom directory
      await runSTMSuccess(['init', '--tasks-dir', 'tasks'], { cwd: workspace.directory });

      // Add a task
      await cli.addTask('Test Task');

      // Rename the custom directory
      await fs.rename(
        path.join(workspace.directory, 'tasks'),
        path.join(workspace.directory, 'renamed-tasks')
      );

      // List might succeed but show no tasks (since directory is missing)
      const listResult = await runSTM(['list'], { cwd: workspace.directory });

      // Either it fails or returns empty list
      if (listResult.exitCode === 0) {
        expect(listResult.stdout.trim()).toBe(''); // Empty list
      } else {
        expect(listResult.stderr).toMatch(/not found|error/i);
      }

      // Update config to point to renamed directory
      const config = JSON.parse(await workspace.readFile('.simple-task-master/config.json'));
      config.tasksDir = 'renamed-tasks';
      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));

      // Should work again
      const fixedList = await runSTMSuccess(['list'], { cwd: workspace.directory });
      expect(fixedList.stdout).toContain('Test Task');
    });
  });

  describe('help and documentation', () => {
    it('should show custom directory option in init help', async () => {
      // Purpose: Verify help documentation includes custom directory feature

      const helpResult = await runSTMSuccess(['init', '--help'], {
        cwd: workspace.directory
      });

      expect(helpResult.stdout).toContain('--tasks-dir');
      expect(helpResult.stdout).toContain('Custom directory for storing task files');
    });

    it('should indicate custom directory usage in main help', async () => {
      // Purpose: Ensure users can discover the feature

      const mainHelp = await runSTMSuccess(['--help'], {
        cwd: workspace.directory
      });

      expect(mainHelp.stdout).toContain('init');
      expect(mainHelp.stdout).toContain('Initialize STM repository');
    });
  });

  describe('JSON output with custom directories', () => {
    beforeEach(async () => {
      await runSTMSuccess(['init', '--tasks-dir', 'json-test-tasks'], {
        cwd: workspace.directory
      });
    });

    it('should not expose internal paths in JSON output', async () => {
      // Purpose: Ensure JSON output doesn't leak implementation details

      await cli.addTask('JSON Test Task', {
        content: 'Testing JSON output',
        tags: ['json', 'test']
      });

      // List with JSON format
      const listResult = await runSTMSuccess(['list', '--format', 'json'], {
        cwd: workspace.directory
      });

      const tasks = JSON.parse(listResult.stdout);
      expect(tasks).toHaveLength(1);

      // Should not contain file paths or internal details
      const task = tasks[0];
      expect(task).not.toHaveProperty('filePath');
      expect(task).not.toHaveProperty('tasksDir');
      expect(JSON.stringify(task)).not.toContain('json-test-tasks');

      // Show with JSON format
      const showResult = await runSTMSuccess(['show', '1', '--format', 'json'], {
        cwd: workspace.directory
      });

      const showTask = JSON.parse(showResult.stdout);
      expect(showTask).not.toHaveProperty('filePath');
      expect(JSON.stringify(showTask)).not.toContain('json-test-tasks');
    });
  });
});
