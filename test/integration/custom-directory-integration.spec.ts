import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner } from '@test/helpers/cli-runner';
import { TaskManager } from '@lib/task-manager';
import { CURRENT_SCHEMA_VERSION } from '@lib/constants';
import type { Config } from '@lib/types';

describe('Custom Directory Integration Tests', () => {
  let workspace: TestWorkspace;
  let cliRunner: CLITestRunner;

  beforeEach(async () => {
    workspace = await TestWorkspace.createClean('custom-dir-integration-');
    cliRunner = new CLITestRunner({ cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('Workspace Initialization with Custom Directory', () => {
    it('should initialize workspace with relative custom directory via CLI', async () => {
      const customDir = 'my-tasks';

      // Initialize with custom tasks directory
      const initResult = await cliRunner.run(['init', '--tasks-dir', customDir]);
      expect(initResult.exitCode).toBe(0);
      expect(initResult.stderr).toContain('Initialized STM repository');
      expect(initResult.stderr).toContain(`Using custom tasks directory: ${customDir}`);

      // Verify directory structure was created
      expect(await workspace.fileExists(customDir)).toBe(true);
      expect(await workspace.fileExists('.simple-task-master')).toBe(true);
      expect(await workspace.fileExists('.simple-task-master/config.json')).toBe(true);

      // Verify config.json contains the custom directory
      const configContent = await workspace.readFile('.simple-task-master/config.json');
      const config = JSON.parse(configContent);
      expect(config.tasksDir).toBe(customDir);
    });

    it('should initialize workspace with absolute custom directory via CLI', async () => {
      const absoluteCustomDir = path.join(workspace.directory, 'absolute-tasks');

      // Initialize with absolute custom tasks directory
      const initResult = await cliRunner.run(['init', '--tasks-dir', absoluteCustomDir]);
      expect(initResult.exitCode).toBe(0);

      // Verify directory was created
      expect(await workspace.fileExists('absolute-tasks')).toBe(true);

      // Verify config contains relative path (for portability)
      const configContent = await workspace.readFile('.simple-task-master/config.json');
      const config = JSON.parse(configContent);
      expect(config.tasksDir).toBe('absolute-tasks');
    });

    it('should initialize workspace with nested custom directory', async () => {
      const nestedDir = 'project/tasks';

      // Initialize with nested custom tasks directory
      const initResult = await cliRunner.run(['init', '--tasks-dir', nestedDir]);
      expect(initResult.exitCode).toBe(0);

      // Verify nested directory structure was created
      expect(await workspace.fileExists('project')).toBe(true);
      expect(await workspace.fileExists('project/tasks')).toBe(true);

      // Verify config
      const configContent = await workspace.readFile('.simple-task-master/config.json');
      const config = JSON.parse(configContent);
      expect(config.tasksDir).toBe(nestedDir);
    });

    it('should fail gracefully when custom directory is invalid', async () => {
      // Test directory traversal attack
      const invalidResult1 = await cliRunner.run(['init', '--tasks-dir', '../malicious']);
      expect(invalidResult1.exitCode).not.toBe(0);
      expect(invalidResult1.stderr).toContain('directory traversal');

      // Test system directory
      const invalidResult2 = await cliRunner.run(['init', '--tasks-dir', '/etc']);
      expect(invalidResult2.exitCode).not.toBe(0);
      expect(invalidResult2.stderr).toContain('Cannot use system directories');
    });
  });

  describe('TaskManager Integration with Custom Directory', () => {
    it('should use custom relative directory from config', async () => {
      const customDir = 'custom-tasks';

      // Create config manually first
      await fs.mkdir(path.join(workspace.directory, '.simple-task-master'), { recursive: true });
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: customDir
      };

      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Create custom directory
      await fs.mkdir(path.join(workspace.directory, customDir), { recursive: true });

      // Create TaskManager and verify it uses custom directory
      const taskManager = await TaskManager.create({ workspaceRoot: workspace.directory });

      // Create a task
      const task = await taskManager.create({
        title: 'Test task in custom directory',
        content: 'This task should be in the custom directory'
      });

      // Verify task properties
      expect(task.id).toBe(1);
      expect(task.title).toBe('Test task in custom directory');

      // Verify task was created in custom location
      const customTaskFiles = await fs.readdir(path.join(workspace.directory, customDir));
      expect(customTaskFiles).toHaveLength(1);
      expect(customTaskFiles[0]).toMatch(/^1-test-task-in-custom-directory\.md$/);

      // Verify task was NOT created in default location
      const defaultTasksDir = path.join(workspace.directory, '.simple-task-master', 'tasks');
      await expect(fs.readdir(defaultTasksDir)).rejects.toThrow();
    });

    it('should use custom absolute directory from config', async () => {
      const absoluteCustomDir = path.join(workspace.directory, 'absolute-custom-tasks');

      // Create config with absolute path (stored as relative)
      await fs.mkdir(path.join(workspace.directory, '.simple-task-master'), { recursive: true });
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: 'absolute-custom-tasks'
      };

      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Create custom directory
      await fs.mkdir(absoluteCustomDir, { recursive: true });

      // Create TaskManager
      const taskManager = await TaskManager.create({ workspaceRoot: workspace.directory });

      // Create a task
      const task = await taskManager.create({
        title: 'Absolute path task',
        content: 'This task is in an absolute path directory'
      });

      // Verify task properties
      expect(task.id).toBe(1);
      expect(task.title).toBe('Absolute path task');

      // Verify task was created in custom location
      const customTaskFiles = await fs.readdir(absoluteCustomDir);
      expect(customTaskFiles).toHaveLength(1);
      expect(customTaskFiles[0]).toMatch(/^1-absolute-path-task\.md$/);

      // Verify task file contains correct content
      const taskFilePath = path.join(absoluteCustomDir, customTaskFiles[0]);
      const taskFileContent = await fs.readFile(taskFilePath, 'utf8');
      expect(taskFileContent).toContain('title: Absolute path task');
      expect(taskFileContent).toContain('This task is in an absolute path directory');
    });

    it('should override config directory with TaskManager create options', async () => {
      const configDir = 'config-tasks';
      const overrideDir = 'override-tasks';

      // Create config with one directory
      await fs.mkdir(path.join(workspace.directory, '.simple-task-master'), { recursive: true });
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: configDir
      };

      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Create both directories
      await fs.mkdir(path.join(workspace.directory, configDir), { recursive: true });
      await fs.mkdir(path.join(workspace.directory, overrideDir), { recursive: true });

      // Create TaskManager with override
      const taskManager = await TaskManager.create({
        workspaceRoot: workspace.directory,
        tasksDir: path.join(workspace.directory, overrideDir)
      });

      // Create a task
      const task = await taskManager.create({
        title: 'Override test task',
        content: 'This should be in override directory'
      });

      // Verify task properties
      expect(task.id).toBe(1);
      expect(task.title).toBe('Override test task');

      // Verify task was created in override location
      const overrideTaskFiles = await fs.readdir(path.join(workspace.directory, overrideDir));
      expect(overrideTaskFiles).toHaveLength(1);
      expect(overrideTaskFiles[0]).toMatch(/^1-override-test-task\.md$/);

      // Verify config location is empty
      const configTaskFiles = await fs.readdir(path.join(workspace.directory, configDir));
      expect(configTaskFiles).toHaveLength(0);
    });
  });

  describe('End-to-End Task Operations with Custom Directory', () => {
    it('should perform complete task lifecycle in custom directory', async () => {
      const customDir = 'workflow-tasks';

      // Initialize with custom directory
      await cliRunner.run(['init', '--tasks-dir', customDir]);

      // Add a task via CLI
      const addResult = await cliRunner.addTask('Lifecycle Test Task', {
        content: 'Testing complete task lifecycle',
        tags: ['lifecycle', 'test'],
        status: 'pending'
      });

      const taskId = addResult.taskId;
      expect(taskId).toBe(1);

      // Verify task file was created in custom directory
      const taskFiles = await fs.readdir(path.join(workspace.directory, customDir));
      expect(taskFiles).toHaveLength(1);
      expect(taskFiles[0]).toMatch(/^1-lifecycle-test-task\.md$/);

      // Update task status
      await cliRunner.updateTask(taskId, { status: 'in-progress' });

      // Show task and verify content
      const showResult = await cliRunner.showTask(taskId);
      expect(showResult.stdout).toContain('Lifecycle Test Task');
      expect(showResult.stdout).toContain('in-progress');
      expect(showResult.stdout).toContain('lifecycle');

      // List tasks and verify they appear
      const listResult = await cliRunner.listTasks();
      expect(listResult.stdout).toContain('Lifecycle Test Task');
      expect(listResult.stdout).toContain('in-progress');

      // Search in tasks
      const grepResult = await cliRunner.grepTasks('lifecycle', { ignoreCase: true });
      expect(grepResult.stdout).toContain('Lifecycle Test Task');

      // Export tasks
      const exportResult = await cliRunner.exportTasks('json');
      expect(exportResult.exitCode).toBe(0);
      const exportedTasks = JSON.parse(exportResult.stdout);
      expect(exportedTasks).toHaveLength(1);
      expect(exportedTasks[0].title).toBe('Lifecycle Test Task');

      // Complete task
      await cliRunner.updateTask(taskId, { status: 'done' });

      // Verify final state
      const finalShowResult = await cliRunner.showTask(taskId);
      expect(finalShowResult.stdout).toContain('done');
    });

    it('should handle multiple tasks across different custom directories', async () => {
      // Create multiple workspaces with different custom directories
      const workspace2 = await TestWorkspace.createClean('custom-dir-2-');
      const cliRunner2 = new CLITestRunner({ cwd: workspace2.directory });

      try {
        // Initialize first workspace with 'tasks-a'
        await cliRunner.run(['init', '--tasks-dir', 'tasks-a']);

        // Initialize second workspace with 'tasks-b'
        await cliRunner2.run(['init', '--tasks-dir', 'tasks-b']);

        // Create tasks in each workspace
        const task1 = await cliRunner.addTask('Task from workspace A', {
          content: 'Content from workspace A'
        });

        const task2 = await cliRunner2.addTask('Task from workspace B', {
          content: 'Content from workspace B'
        });

        // Verify task IDs
        expect(task1.taskId).toBe(1);
        expect(task2.taskId).toBe(1);

        // Verify tasks are in their respective directories
        const workspace1Files = await fs.readdir(path.join(workspace.directory, 'tasks-a'));
        expect(workspace1Files).toHaveLength(1);
        expect(workspace1Files[0]).toContain('task-from-workspace-a');

        const workspace2Files = await fs.readdir(path.join(workspace2.directory, 'tasks-b'));
        expect(workspace2Files).toHaveLength(1);
        expect(workspace2Files[0]).toContain('task-from-workspace-b');

        // Verify isolation - workspace A should not see workspace B's tasks
        const listA = await cliRunner.listTasks();
        expect(listA.stdout).toContain('Task from workspace A');
        expect(listA.stdout).not.toContain('Task from workspace B');

        const listB = await cliRunner2.listTasks();
        expect(listB.stdout).toContain('Task from workspace B');
        expect(listB.stdout).not.toContain('Task from workspace A');

      } finally {
        await workspace2.cleanup();
      }
    });

    it('should verify files are NOT created in default location when using custom directory', async () => {
      const customDir = 'non-default-tasks';

      // Initialize with custom directory
      await cliRunner.run(['init', '--tasks-dir', customDir]);

      // Create multiple tasks
      await cliRunner.addTask('Task 1', { content: 'First task' });
      await cliRunner.addTask('Task 2', { content: 'Second task' });
      await cliRunner.addTask('Task 3', { content: 'Third task' });

      // Verify all tasks are in custom directory
      const customFiles = await fs.readdir(path.join(workspace.directory, customDir));
      expect(customFiles).toHaveLength(3);
      customFiles.forEach((file) => {
        expect(file).toMatch(/^\d+-.*\.md$/);
      });

      // Verify default tasks directory doesn't exist or is empty
      const defaultTasksDir = path.join(workspace.directory, '.simple-task-master', 'tasks');
      try {
        const defaultFiles = await fs.readdir(defaultTasksDir);
        expect(defaultFiles.filter((f) => f.endsWith('.md'))).toHaveLength(0);
      } catch (error) {
        // Directory doesn't exist, which is expected
        expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });

  describe('Shared Directory Scenarios', () => {
    it('should handle shared directory between multiple STM workspaces', async () => {
      // Create a shared tasks directory
      const sharedTasksDir = path.join(workspace.directory, 'shared-tasks');
      await fs.mkdir(sharedTasksDir, { recursive: true });

      // Create two separate STM configurations using the same shared directory
      const workspace1Dir = path.join(workspace.directory, 'project1');
      const workspace2Dir = path.join(workspace.directory, 'project2');

      await fs.mkdir(workspace1Dir, { recursive: true });
      await fs.mkdir(workspace2Dir, { recursive: true });

      // Initialize both workspaces with shared directory
      const cliRunner1 = new CLITestRunner({ cwd: workspace1Dir });
      const cliRunner2 = new CLITestRunner({ cwd: workspace2Dir });

      await cliRunner1.run(['init', '--tasks-dir', sharedTasksDir]);
      await cliRunner2.run(['init', '--tasks-dir', sharedTasksDir]);

      // Create tasks from both workspaces
      const task1 = await cliRunner1.addTask('Task from project 1', {
        content: 'Content from project 1'
      });

      const task2 = await cliRunner2.addTask('Task from project 2', {
        content: 'Content from project 2'
      });

      // Verify task IDs
      expect(task1.taskId).toBe(1);
      expect(task2.taskId).toBe(2);

      // Verify both tasks are in shared directory
      const sharedFiles = await fs.readdir(sharedTasksDir);
      expect(sharedFiles).toHaveLength(2);

      // Both workspaces should see both tasks
      const list1 = await cliRunner1.listTasks();
      expect(list1.stdout).toContain('Task from project 1');
      expect(list1.stdout).toContain('Task from project 2');

      const list2 = await cliRunner2.listTasks();
      expect(list2.stdout).toContain('Task from project 1');
      expect(list2.stdout).toContain('Task from project 2');
    });

    it('should handle concurrent operations on shared directory', async () => {
      const sharedDir = 'concurrent-shared-tasks';

      // Initialize with shared directory
      await cliRunner.run(['init', '--tasks-dir', sharedDir]);

      // Create multiple tasks concurrently with more robust error handling
      const concurrentPromises = Array.from({ length: 5 }, async (_, i) => {
        try {
          // Add a small staggered delay to reduce lock contention
          await new Promise((resolve) => setTimeout(resolve, i * 50));

          const result = await cliRunner.addTask(`Concurrent Task ${i + 1}`, {
            content: `Content for concurrent task ${i + 1}`
          });

          return result;
        } catch (error) {
          console.error(`Failed to create concurrent task ${i + 1}:`, error);
          throw error;
        }
      });

      const results = await Promise.all(concurrentPromises);

      // Verify all tasks were created successfully with unique IDs
      const taskIds = results.map((r) => r.taskId);
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(5); // All IDs should be unique

      // Verify all task files exist
      const sharedFiles = await fs.readdir(path.join(workspace.directory, sharedDir));
      expect(sharedFiles.filter((f) => f.endsWith('.md'))).toHaveLength(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing custom directory gracefully', async () => {
      // Create config with non-existent custom directory
      await fs.mkdir(path.join(workspace.directory, '.simple-task-master'), { recursive: true });
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: 'missing-directory'
      };

      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // TaskManager should create the directory when needed
      const taskManager = await TaskManager.create({ workspaceRoot: workspace.directory });

      // Should be able to create tasks (directory gets created automatically)
      const task = await taskManager.create({
        title: 'Task in auto-created directory',
        content: 'This directory should be created automatically'
      });

      // Verify task properties
      expect(task.id).toBe(1);
      expect(task.title).toBe('Task in auto-created directory');

      // Verify directory was created and task exists
      expect(await workspace.fileExists('missing-directory')).toBe(true);
      const taskFiles = await fs.readdir(path.join(workspace.directory, 'missing-directory'));
      expect(taskFiles).toHaveLength(1);
    });

    it('should handle corrupted custom directory configuration', async () => {
      // Create config with invalid tasksDir value
      await fs.mkdir(path.join(workspace.directory, '.simple-task-master'), { recursive: true });
      const invalidConfig = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: null // Invalid value
      };

      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

      // TaskManager should fall back to default behavior
      const taskManager = await TaskManager.create({ workspaceRoot: workspace.directory });

      // Should use default tasks directory
      const task = await taskManager.create({
        title: 'Fallback task',
        content: 'Should go to default location'
      });

      // Verify task properties
      expect(task.id).toBe(1);
      expect(task.title).toBe('Fallback task');

      // Verify task was created in default location
      const defaultTasksDir = path.join(workspace.directory, '.simple-task-master', 'tasks');
      const taskFiles = await fs.readdir(defaultTasksDir);
      expect(taskFiles).toHaveLength(1);
    });

    it('should handle very long custom directory paths', async () => {
      // Create a nested directory path that's quite long
      const longPath = Array.from({ length: 10 }, (_, i) => `level-${i}`).join('/');

      // Should work fine with long paths
      const initResult = await cliRunner.run(['init', '--tasks-dir', longPath]);
      expect(initResult.exitCode).toBe(0);

      // Verify the deeply nested structure was created
      expect(await workspace.fileExists(longPath)).toBe(true);

      // Should be able to create tasks
      const addResult = await cliRunner.addTask('Deep nested task', {
        content: 'This task is in a deeply nested directory'
      });
      expect(addResult.result.exitCode).toBe(0);

      // Verify task file exists in the deep path
      const deepFiles = await fs.readdir(path.join(workspace.directory, longPath));
      expect(deepFiles).toHaveLength(1);
    });

    it('should preserve custom directory setting after re-initialization', async () => {
      const customDir = 'persistent-tasks';

      // Initial initialization
      await cliRunner.run(['init', '--tasks-dir', customDir]);

      // Create a task
      await cliRunner.addTask('Initial task', { content: 'First task' });

      // Try to re-initialize (should warn but not change anything)
      const reinitResult = await cliRunner.run(['init', '--tasks-dir', 'different-tasks']);
      expect(reinitResult.exitCode).toBe(0);
      expect(reinitResult.stderr).toContain('already initialized');

      // Verify original configuration is preserved
      const configContent = await workspace.readFile('.simple-task-master/config.json');
      const config = JSON.parse(configContent);
      expect(config.tasksDir).toBe(customDir);

      // Verify original task still exists
      const originalFiles = await fs.readdir(path.join(workspace.directory, customDir));
      expect(originalFiles).toHaveLength(1);

      // New directory should not be created
      expect(await workspace.fileExists('different-tasks')).toBe(false);
    });
  });

  describe('File Location Verification', () => {
    it('should verify exact file locations for different directory configurations', async () => {
      // Test different directory configurations and verify exact locations
      const testCases = [
        { dir: 'simple-tasks', label: 'simple directory name' },
        { dir: './relative-tasks', label: 'explicit relative path' },
        { dir: 'nested/deep/tasks', label: 'nested directory structure' },
        { dir: 'tasks-with-dashes', label: 'directory with dashes' }
      ];

      for (const testCase of testCases) {
        // Create a separate workspace for each test case
        const testWorkspace = await TestWorkspace.createClean(`location-test-${testCase.dir.replace(/[^a-z0-9]/gi, '-')}-`);
        const testRunner = new CLITestRunner({ cwd: testWorkspace.directory });

        try {
          // Initialize with custom directory
          await testRunner.run(['init', '--tasks-dir', testCase.dir]);

          // Create a task
          const taskTitle = `Test task for ${testCase.label}`;
          await testRunner.addTask(taskTitle, { content: `Content for ${testCase.label}` });

          // Verify exact file location
          const expectedDir = path.join(testWorkspace.directory, testCase.dir.replace(/^\.\//, ''));
          const files = await fs.readdir(expectedDir);
          expect(files).toHaveLength(1);
          expect(files[0]).toMatch(/^1-test-task-for-.*\.md$/);

          // Verify file content
          const taskFile = path.join(expectedDir, files[0]);
          const content = await fs.readFile(taskFile, 'utf8');
          expect(content).toContain(`title: ${taskTitle}`);
          expect(content).toContain(`Content for ${testCase.label}`);

          // Verify NOT in default location
          const defaultPath = path.join(testWorkspace.directory, '.simple-task-master', 'tasks');
          try {
            const defaultFiles = await fs.readdir(defaultPath);
            expect(defaultFiles.filter((f) => f.endsWith('.md'))).toHaveLength(0);
          } catch (error) {
            // Directory doesn't exist, which is fine
            expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
          }

        } finally {
          await testWorkspace.cleanup();
        }
      }
    });

    it('should verify task operations work with various directory structures', async () => {
      const customDir = 'operations-test/tasks';

      // Initialize with nested custom directory
      await cliRunner.run(['init', '--tasks-dir', customDir]);

      // Perform various task operations
      const tasks = [];

      // Create tasks
      tasks.push(await cliRunner.addTask('Task 1', {
        content: 'First task',
        status: 'pending',
        tags: ['test', 'operations']
      }));

      tasks.push(await cliRunner.addTask('Task 2', {
        content: 'Second task',
        status: 'in-progress',
        tags: ['test', 'operations']
      }));

      tasks.push(await cliRunner.addTask('Task 3', {
        content: 'Third task',
        status: 'done',
        tags: ['test', 'completed']
      }));

      // Verify all tasks are in custom directory
      const customFiles = await fs.readdir(path.join(workspace.directory, customDir));
      expect(customFiles.filter((f) => f.endsWith('.md'))).toHaveLength(3);

      // Test list with filters
      const pendingTasks = await cliRunner.listTasks({ status: 'pending' });
      expect(pendingTasks.stdout).toContain('Task 1');
      expect(pendingTasks.stdout).not.toContain('Task 2');
      expect(pendingTasks.stdout).not.toContain('Task 3');

      const operationsTasks = await cliRunner.listTasks({ tags: ['operations'] });
      expect(operationsTasks.stdout).toContain('Task 1');
      expect(operationsTasks.stdout).toContain('Task 2');
      expect(operationsTasks.stdout).not.toContain('Task 3');

      // Test search
      const searchResult = await cliRunner.grepTasks('Second', { ignoreCase: true });
      expect(searchResult.stdout).toContain('Task 2');

      // Test update
      await cliRunner.updateTask(tasks[0].taskId, { status: 'in-progress' });
      const updatedTask = await cliRunner.showTask(tasks[0].taskId);
      expect(updatedTask.stdout).toContain('in-progress');

      // Test export
      const exportResult = await cliRunner.exportTasks('json');
      const exportedTasks = JSON.parse(exportResult.stdout);
      expect(exportedTasks).toHaveLength(3);

      // Verify all files still in custom directory after operations
      const finalFiles = await fs.readdir(path.join(workspace.directory, customDir));
      expect(finalFiles.filter((f) => f.endsWith('.md'))).toHaveLength(3);
    });
  });
});
