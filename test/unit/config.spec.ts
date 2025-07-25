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

  describe('update', () => {
    it('should update configuration and save atomically', async () => {
      // Purpose: Verify update merges changes and saves to disk
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      await manager.update({
        lockTimeoutMs: 60000,
        maxTaskSizeBytes: 2097152
      });

      // Verify in-memory config updated
      const config = await manager.load();
      expect(config.lockTimeoutMs).toBe(60000);
      expect(config.maxTaskSizeBytes).toBe(2097152);
      expect(config.schema).toBe(CURRENT_SCHEMA_VERSION); // Preserved

      // Verify saved to disk
      const fs = await import('fs/promises');
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      const savedContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);
      expect(savedConfig.lockTimeoutMs).toBe(60000);
      expect(savedConfig.maxTaskSizeBytes).toBe(2097152);
    });

    it('should create config file if missing', async () => {
      // Purpose: Verify backward compatibility - creates config when missing
      const fs = await import('fs/promises');
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.unlink(configPath);

      const manager = new ConfigManager(workspace.directory);
      await manager.update({
        tasksDir: './my-tasks'
      });

      // Should create config with defaults + update
      const savedContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);
      expect(savedConfig.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(savedConfig.lockTimeoutMs).toBe(DEFAULT_CONFIG.LOCK_TIMEOUT_MS);
      expect(savedConfig.maxTaskSizeBytes).toBe(DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES);
      expect(savedConfig.tasksDir).toBe('./my-tasks');
    });

    it('should validate before saving', async () => {
      // Purpose: Verify validation prevents invalid configs
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      // Invalid lockTimeoutMs
      await expect(manager.update({ lockTimeoutMs: 0 })).rejects.toThrow(ValidationError);
      await expect(manager.update({ lockTimeoutMs: -100 })).rejects.toThrow(
        'lockTimeoutMs must be a positive number'
      );
      await expect(manager.update({ lockTimeoutMs: 400000 })).rejects.toThrow(
        'lockTimeoutMs cannot exceed 5 minutes (300000ms)'
      );

      // Invalid maxTaskSizeBytes
      await expect(manager.update({ maxTaskSizeBytes: 0 })).rejects.toThrow(ValidationError);
      await expect(manager.update({ maxTaskSizeBytes: -1000 })).rejects.toThrow(
        'maxTaskSizeBytes must be a positive number'
      );
      await expect(manager.update({ maxTaskSizeBytes: 20000000 })).rejects.toThrow(
        'maxTaskSizeBytes cannot exceed 10MB (10485760 bytes)'
      );

      // Invalid tasksDir
      await expect(manager.update({ tasksDir: '../../../etc/passwd' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should preserve schema version by default', async () => {
      // Purpose: Verify schema version is not accidentally changed
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      await manager.update({
        lockTimeoutMs: 45000,
        tasksDir: './custom'
      });

      const config = await manager.load();
      expect(config.schema).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should allow explicit schema update if valid', async () => {
      // Purpose: Verify schema can be updated when needed
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      // Valid schema update (to same version)
      await manager.update({ schema: CURRENT_SCHEMA_VERSION });

      // Invalid schema update
      await expect(manager.update({ schema: 2 })).rejects.toThrow(
        'Invalid schema version: 2. Expected: 1'
      );
    });

    it('should handle partial updates correctly', async () => {
      // Purpose: Verify partial updates only change specified fields
      const manager = new ConfigManager(workspace.directory);

      // Set initial config
      await manager.update({
        lockTimeoutMs: 40000,
        maxTaskSizeBytes: 2000000,
        tasksDir: './initial-tasks'
      });

      // Partial update
      await manager.update({
        tasksDir: './updated-tasks'
      });

      const config = await manager.load();
      expect(config.lockTimeoutMs).toBe(40000); // Unchanged
      expect(config.maxTaskSizeBytes).toBe(2000000); // Unchanged
      expect(config.tasksDir).toBe('./updated-tasks'); // Updated
    });

    it('should handle file system errors during save', async () => {
      // Purpose: Verify proper error handling for filesystem issues
      const fs = await import('fs/promises');
      const configDir = path.join(workspace.directory, '.simple-task-master');
      const configPath = path.join(configDir, 'config.json');

      // Load config first while we can
      const manager = new ConfigManager(workspace.directory);
      await manager.load();

      // Replace config.json with a directory to force write error
      await fs.unlink(configPath);
      await fs.mkdir(configPath);

      try {
        await expect(manager.update({ lockTimeoutMs: 50000 })).rejects.toThrow(FileSystemError);
        await expect(manager.update({ lockTimeoutMs: 50000 })).rejects.toThrow(
          /Failed to save config/
        );
      } finally {
        // Clean up - remove directory and restore file
        await fs.rmdir(configPath);
        await fs.writeFile(configPath, JSON.stringify({
          schema: CURRENT_SCHEMA_VERSION,
          lockTimeoutMs: DEFAULT_CONFIG.LOCK_TIMEOUT_MS,
          maxTaskSizeBytes: DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES
        }, null, 2));
      }
    });

    it('should format JSON with pretty printing', async () => {
      // Purpose: Verify config files are human-readable
      const manager = new ConfigManager(workspace.directory);
      await manager.update({
        lockTimeoutMs: 35000,
        tasksDir: './formatted-tasks'
      });

      const fs = await import('fs/promises');
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');

      // Check for pretty formatting
      expect(content).toContain('\n');
      expect(content).toContain('  '); // Indentation
      expect(content).toMatch(/{\s+/); // Opening brace with newline
      expect(content).toMatch(/\s+}/); // Closing brace with newline
    });

    it('should create directory if missing', async () => {
      // Purpose: Verify directory creation during save
      const fs = await import('fs/promises');
      const baseDir = path.join(workspace.directory, '.simple-task-master');

      // Remove the entire .simple-task-master directory
      await fs.rm(baseDir, { recursive: true, force: true });

      const manager = new ConfigManager(workspace.directory);
      await manager.update({
        tasksDir: './new-tasks'
      });

      // Verify directory was created
      const dirStats = await fs.stat(baseDir);
      expect(dirStats.isDirectory()).toBe(true);

      // Verify config was saved
      const configPath = path.join(baseDir, 'config.json');
      const configStats = await fs.stat(configPath);
      expect(configStats.isFile()).toBe(true);
    });

    it('should validate tasksDir path security', async () => {
      // Purpose: Verify path validation integration
      const manager = new ConfigManager(workspace.directory);

      // Directory traversal attempts
      await expect(manager.update({ tasksDir: '../../../sensitive' })).rejects.toThrow(
        'Tasks directory path cannot contain directory traversal sequences (..)'
      );

      // File paths
      await expect(manager.update({ tasksDir: './config.json' })).rejects.toThrow(
        'Tasks directory path appears to be a file, not a directory'
      );

      // System paths (depending on platform)
      if (process.platform !== 'win32') {
        await expect(manager.update({ tasksDir: '/etc/passwd' })).rejects.toThrow(
          ValidationError
        );
      }
    });

    it('should handle concurrent updates safely', async () => {
      // Purpose: Verify atomic writes prevent corruption
      const manager = new ConfigManager(workspace.directory);

      // Perform multiple concurrent updates
      const updates = Promise.all([
        manager.update({ lockTimeoutMs: 31000 }),
        manager.update({ lockTimeoutMs: 32000 }),
        manager.update({ lockTimeoutMs: 33000 }),
        manager.update({ lockTimeoutMs: 34000 }),
        manager.update({ lockTimeoutMs: 35000 })
      ]);

      await expect(updates).resolves.not.toThrow();

      // Config should be valid and have one of the values
      const config = await manager.load();
      expect([31000, 32000, 33000, 34000, 35000]).toContain(config.lockTimeoutMs);
    });

    it('should handle type validation for updates', async () => {
      // Purpose: Verify type checking for config values
      const manager = new ConfigManager(workspace.directory);

      // Invalid types
      await expect(manager.update({ lockTimeoutMs: '30000' as unknown as number })).rejects.toThrow(
        'lockTimeoutMs must be a positive number'
      );
      await expect(manager.update({ maxTaskSizeBytes: true as unknown as number })).rejects.toThrow(
        'maxTaskSizeBytes must be a positive number'
      );
      await expect(manager.update({ tasksDir: 123 as unknown as string })).rejects.toThrow(
        'tasksDir must be a string'
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
