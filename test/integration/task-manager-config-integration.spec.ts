import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TaskManager } from '@lib/task-manager';
import { PATHS, CURRENT_SCHEMA_VERSION } from '@lib/constants';
import type { Config } from '@lib/types';

describe('TaskManager ConfigManager integration', () => {
  let testDir: string;
  let workspaceRoot: string;
  let configPath: string;
  let customTasksDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(process.cwd(), 'test-config-integration-'));
    workspaceRoot = testDir;

    // Create STM workspace structure
    const stmDir = path.join(workspaceRoot, PATHS.BASE_DIR);
    await fs.mkdir(stmDir, { recursive: true });

    configPath = path.join(stmDir, PATHS.CONFIG_FILE);
    customTasksDir = path.join(workspaceRoot, 'my-custom-tasks');

    // Change to test directory
    process.chdir(workspaceRoot);
  });

  afterEach(async () => {
    // Change back to original directory
    process.chdir(path.dirname(workspaceRoot));

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should use default tasks directory when no config.json exists', async () => {
    // Create TaskManager without config.json
    const taskManager = await TaskManager.create();

    // Create a task
    const task = await taskManager.create({ title: 'Test task' });

    // Verify task properties
    expect(task.id).toBe(1);
    expect(task.title).toBe('Test task');

    // Verify task was created in default location
    const defaultTasksDir = path.join(workspaceRoot, PATHS.BASE_DIR, PATHS.TASKS_DIR);
    const files = await fs.readdir(defaultTasksDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^1-test-task\.md$/);
  });

  it('should use custom relative tasks directory from config.json', async () => {
    // Create config.json with custom relative path
    const config: Config = {
      schema: CURRENT_SCHEMA_VERSION,
      lockTimeoutMs: 30000,
      maxTaskSizeBytes: 1048576,
      tasksDir: 'my-custom-tasks'
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Create TaskManager
    const taskManager = await TaskManager.create();

    // Create a task
    const task = await taskManager.create({ title: 'Custom location task' });

    // Verify task properties
    expect(task.id).toBe(1);
    expect(task.title).toBe('Custom location task');

    // Verify task was created in custom location
    const files = await fs.readdir(customTasksDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^1-custom-location-task\.md$/);

    // Verify default location is empty
    const defaultTasksDir = path.join(workspaceRoot, PATHS.BASE_DIR, PATHS.TASKS_DIR);
    await expect(fs.readdir(defaultTasksDir)).rejects.toThrow();
  });

  it('should use custom absolute tasks directory from config.json', async () => {
    // Create a custom directory outside workspace
    const absoluteTasksDir = await fs.mkdtemp(path.join(process.cwd(), 'absolute-tasks-'));

    try {
      // Create config.json with absolute path
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: absoluteTasksDir
      };
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Create TaskManager
      const taskManager = await TaskManager.create();

      // Create a task
      const task = await taskManager.create({ title: 'Absolute path task' });

      // Verify task properties
      expect(task.id).toBe(1);
      expect(task.title).toBe('Absolute path task');

      // Verify task was created in absolute location
      const files = await fs.readdir(absoluteTasksDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^1-absolute-path-task\.md$/);
    } finally {
      // Clean up absolute directory
      await fs.rm(absoluteTasksDir, { recursive: true, force: true });
    }
  });

  it('should use maxTaskSizeBytes from config.json', async () => {
    // Create config.json with small max size
    const config: Config = {
      schema: CURRENT_SCHEMA_VERSION,
      lockTimeoutMs: 30000,
      maxTaskSizeBytes: 100, // Very small limit
      tasksDir: 'tasks'
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Create TaskManager
    const taskManager = await TaskManager.create();

    // Try to create a task with large content
    const largeContent = 'x'.repeat(200);
    await expect(
      taskManager.create({ title: 'Large task', content: largeContent })
    ).rejects.toThrow(/exceeds maximum size of 100 bytes/);
  });

  it('should allow overriding config values via TaskManager.create()', async () => {
    // Create config.json
    const config: Config = {
      schema: CURRENT_SCHEMA_VERSION,
      lockTimeoutMs: 30000,
      maxTaskSizeBytes: 1048576,
      tasksDir: 'config-tasks'
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Create override directory
    const overrideDir = path.join(workspaceRoot, 'override-tasks');
    await fs.mkdir(overrideDir, { recursive: true });

    // Create TaskManager with override
    const taskManager = await TaskManager.create({
      tasksDir: overrideDir
    });

    // Create a task
    const task = await taskManager.create({ title: 'Override task' });

    // Verify task properties
    expect(task.id).toBe(1);
    expect(task.title).toBe('Override task');

    // Verify task was created in override location
    const files = await fs.readdir(overrideDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^1-override-task\.md$/);

    // Verify config location is empty
    const configTasksDir = path.join(workspaceRoot, 'config-tasks');
    await expect(fs.readdir(configTasksDir)).rejects.toThrow();
  });

  it('should maintain backward compatibility for existing code', async () => {
    // Don't create config.json - test backward compatibility

    // Create TaskManager without any config
    const taskManager = await TaskManager.create();

    // Verify it still works as before
    const task = await taskManager.create({
      title: 'Backward compatible task',
      status: 'pending',
      tags: ['test']
    });

    expect(task.id).toBe(1);
    expect(task.title).toBe('Backward compatible task');
    expect(task.status).toBe('pending');
    expect(task.tags).toEqual(['test']);

    // Verify list works
    const tasks = await taskManager.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(1);
  });
});
