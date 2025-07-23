/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { ConfigManager } from '@lib/config';
import { ValidationError, FileSystemError } from '@lib/errors';
import { TestWorkspace } from '../helpers/test-workspace';
import type { Config } from '@lib/types';
import { DEFAULT_CONFIG, CURRENT_SCHEMA_VERSION } from '@lib/constants';

describe('ConfigManager', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('load', () => {
    it('should load config from file', async () => {
      // Purpose: Verify config loading works with valid JSON
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: './custom-tasks'
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      const loaded = await manager.load();

      expect(loaded).toEqual(config);
    });

    it('should return defaults when config missing', async () => {
      // Purpose: Verify backward compatibility when no config exists
      // Delete the config file that TestWorkspace creates
      const fs = await import('fs/promises');
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.unlink(configPath);

      const manager = new ConfigManager(workspace.directory);
      const loaded = await manager.load();

      expect(loaded.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(loaded.lockTimeoutMs).toBe(DEFAULT_CONFIG.LOCK_TIMEOUT_MS);
      expect(loaded.maxTaskSizeBytes).toBe(DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES);
      expect(loaded.tasksDir).toBeUndefined();
    });

    it('should cache loaded config', async () => {
      // Purpose: Verify config is cached after first load
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 45000,
        maxTaskSizeBytes: 2048576
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);

      // First load
      const loaded1 = await manager.load();
      expect(loaded1.lockTimeoutMs).toBe(45000);

      // Modify file on disk
      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify({
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 60000,
        maxTaskSizeBytes: 2048576
      }, null, 2));

      // Second load should return cached value
      const loaded2 = await manager.load();
      expect(loaded2.lockTimeoutMs).toBe(45000);
      expect(loaded2).toBe(loaded1); // Same object reference
    });

    it('should validate schema version', async () => {
      // Purpose: Verify incompatible schemas are rejected
      const config = {
        schema: 2, // Unsupported version
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);

      await expect(manager.load()).rejects.toThrow(ValidationError);
      await expect(manager.load()).rejects.toThrow(
        'Unsupported config schema version: 2'
      );
    });

    it('should handle invalid JSON', async () => {
      // Purpose: Verify proper error handling for malformed JSON
      await workspace.writeFile('.simple-task-master/config.json', '{ invalid json');
      const manager = new ConfigManager(workspace.directory);

      await expect(manager.load()).rejects.toThrow(ValidationError);
      await expect(manager.load()).rejects.toThrow(/Invalid config\.json/);
    });

    it('should handle file system errors', async () => {
      // Purpose: Verify proper error handling for filesystem issues
      // Replace config.json with a directory
      const fs = await import('fs/promises');
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');

      // Remove existing config.json file
      await fs.unlink(configPath);
      // Create config.json as a directory
      await fs.mkdir(configPath);

      const manager = new ConfigManager(workspace.directory);

      await expect(manager.load()).rejects.toThrow(FileSystemError);
      await expect(manager.load()).rejects.toThrow(/Failed to load config/);
    });
  });

  describe('getTasksDir', () => {
    it('should return default tasks directory when no custom dir specified', async () => {
      // Purpose: Verify default directory calculation
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, '.simple-task-master', 'tasks')
      );
    });

    it('should return custom relative directory resolved to workspace', async () => {
      // Purpose: Verify relative path handling
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: './project-tasks'
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, './project-tasks')
      );
    });

    it('should return custom nested relative directory', async () => {
      // Purpose: Verify nested relative path handling
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: 'docs/tasks'
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, 'docs/tasks')
      );
    });

    it('should return absolute paths unchanged', async () => {
      // Purpose: Verify absolute path handling doesn't modify paths
      const absolutePath = '/Users/test/shared-tasks';
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: absolutePath
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(absolutePath);
    });

    it('should handle Windows absolute paths', async () => {
      // Purpose: Verify Windows absolute path handling
      const windowsPath = 'C:\\Users\\test\\tasks';
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: windowsPath
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      // On Windows, path.isAbsolute would return true
      // On Unix, it would be treated as relative
      const expected = path.isAbsolute(windowsPath)
        ? windowsPath
        : path.join(workspace.directory, windowsPath);

      expect(manager.getTasksDir()).toBe(expected);
    });

    it('should use defaults before load is called', () => {
      // Purpose: Verify getTasksDir works before explicit load
      const manager = new ConfigManager(workspace.directory);

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, '.simple-task-master', 'tasks')
      );
    });

    it('should handle empty tasksDir string', async () => {
      // Purpose: Verify empty string is treated as default
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: ''
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      // Empty string should be treated as no custom dir
      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, '.simple-task-master', 'tasks')
      );
    });

    it('should normalize paths with multiple slashes', async () => {
      // Purpose: Verify path normalization
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: './path//to///tasks'
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, './path/to/tasks')
      );
    });

    it('should handle paths with ./ and ../ segments', async () => {
      // Purpose: Verify path resolution with relative segments
      const config: Config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: './docs/../project/./tasks'
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, 'project/tasks')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle config with extra fields', async () => {
      // Purpose: Verify forward compatibility with unknown fields
      const config = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: './tasks',
        futureFeature: true,
        anotherField: 'value'
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      const loaded = await manager.load();

      expect(loaded.schema).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.tasksDir).toBe('./tasks');
    });

    it('should handle missing required fields gracefully', async () => {
      // Purpose: Verify partial configs don't crash
      const config = {
        schema: CURRENT_SCHEMA_VERSION
        // Missing lockTimeoutMs and maxTaskSizeBytes
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      const loaded = await manager.load();

      expect(loaded.schema).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.lockTimeoutMs).toBeUndefined();
      expect(loaded.maxTaskSizeBytes).toBeUndefined();
    });

    it('should handle null tasksDir', async () => {
      // Purpose: Verify null is treated as undefined
      const config: Config & { tasksDir: null } = {
        schema: CURRENT_SCHEMA_VERSION,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
        tasksDir: null
      };

      await workspace.writeFile('.simple-task-master/config.json', JSON.stringify(config, null, 2));
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      expect(manager.getTasksDir()).toBe(
        path.join(workspace.directory, '.simple-task-master', 'tasks')
      );
    });
  });
});
