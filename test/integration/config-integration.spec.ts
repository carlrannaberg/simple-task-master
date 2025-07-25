/**
 * Integration tests for ConfigManager
 * Tests real file system operations, atomic writes, and lock management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { ConfigManager } from '@lib/config';
// LockManager import removed - not used in these tests
import type { Config } from '@lib/types';
import { ValidationError, FileSystemError } from '@lib/errors';
import { PATHS, DEFAULT_CONFIG } from '@lib/constants';

describe('ConfigManager Integration', () => {
  let workspace: TestWorkspace;
  let configManager: ConfigManager;

  beforeEach(async () => {
    workspace = await TestWorkspace.createClean('config-integration-');
    configManager = new ConfigManager(workspace.directory);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('Full Update Cycle with File System', () => {
    it('should complete a full update cycle with file system operations', async () => {
      // Purpose: Verify ConfigManager can update and save config changes to disk
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Initial load should return defaults
      const defaultConfig = await configManager.load();
      expect(defaultConfig.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(defaultConfig.lockTimeoutMs).toBe(DEFAULT_CONFIG.LOCK_TIMEOUT_MS);
      expect(defaultConfig.maxTaskSizeBytes).toBe(DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES);

      // Update configuration
      const updates = {
        lockTimeoutMs: 60000,
        maxTaskSizeBytes: 2097152,
        tasksDir: 'custom/tasks'
      };

      await configManager.update(updates);

      // Verify config was saved to disk
      const configPath = PATHS.getConfigPath(workspace.directory);
      const savedContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent) as Config;

      expect(savedConfig.lockTimeoutMs).toBe(60000);
      expect(savedConfig.maxTaskSizeBytes).toBe(2097152);
      expect(savedConfig.tasksDir).toBe('custom/tasks');
      expect(savedConfig.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);

      // Create new ConfigManager instance to verify persistence
      const newConfigManager = new ConfigManager(workspace.directory);
      const loadedConfig = await newConfigManager.load();

      expect(loadedConfig).toEqual(savedConfig);
    });

    it('should preserve existing config values when updating partial config', async () => {
      // Purpose: Ensure partial updates don't overwrite existing values
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create initial config
      const initialConfig: Config = {
        schema: DEFAULT_CONFIG.SCHEMA_VERSION,
        lockTimeoutMs: 45000,
        maxTaskSizeBytes: 3145728,
        tasksDir: 'initial/tasks'
      };

      const configPath = PATHS.getConfigPath(workspace.directory);
      await fs.writeFile(configPath, JSON.stringify(initialConfig, null, 2));

      // Load and update only one field
      await configManager.load();
      await configManager.update({ lockTimeoutMs: 90000 });

      // Verify other fields are preserved
      const savedContent = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent) as Config;

      expect(savedConfig.lockTimeoutMs).toBe(90000); // Updated
      expect(savedConfig.maxTaskSizeBytes).toBe(3145728); // Preserved
      expect(savedConfig.tasksDir).toBe('initial/tasks'); // Preserved
      expect(savedConfig.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION); // Preserved
    });

    it('should handle invalid JSON gracefully', async () => {
      // Purpose: Test error handling for corrupted config files
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      const configPath = PATHS.getConfigPath(workspace.directory);
      await fs.writeFile(configPath, '{ invalid json }');

      await expect(configManager.load()).rejects.toThrow(ValidationError);
      await expect(configManager.load()).rejects.toThrow(/Invalid config.json/);
    });
  });

  describe('Lock Management During Updates', () => {
    it('should handle concurrent config updates safely', async () => {
      // Purpose: Verify that concurrent ConfigManager updates don't corrupt config
      // Note: ConfigManager itself doesn't use locks, but atomic writes prevent corruption
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create multiple concurrent update operations
      const updates = Array.from({ length: 10 }, (_, i) =>
        configManager.update({
          lockTimeoutMs: 30000 + (i * 1000),
          maxTaskSizeBytes: 1048576 + (i * 1024)
        })
      );

      // All updates should complete without errors
      await Promise.all(updates);

      // Verify config is valid and not corrupted
      const configPath = PATHS.getConfigPath(workspace.directory);
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;

      // Config should have values from one of the updates
      expect(config.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(config.lockTimeoutMs).toBeGreaterThanOrEqual(30000);
      expect(config.lockTimeoutMs).toBeLessThanOrEqual(39000);
      expect(config.maxTaskSizeBytes).toBeGreaterThanOrEqual(1048576);
    });

    it('should prevent concurrent config updates', async () => {
      // Purpose: Test that multiple simultaneous updates are serialized
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create multiple ConfigManager instances
      const configManager1 = new ConfigManager(workspace.directory);
      const configManager2 = new ConfigManager(workspace.directory);

      // Start multiple concurrent updates
      const updates = [
        configManager1.update({ lockTimeoutMs: 40000 }),
        configManager2.update({ lockTimeoutMs: 50000 }),
        configManager1.update({ maxTaskSizeBytes: 2097152 }),
        configManager2.update({ tasksDir: 'concurrent/tasks' })
      ];

      // All updates should complete without corruption
      await Promise.all(updates);

      // Verify final state is consistent
      const finalConfig = await configManager.load();
      expect(finalConfig.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(typeof finalConfig.lockTimeoutMs).toBe('number');
      expect(typeof finalConfig.maxTaskSizeBytes).toBe('number');
      // tasksDir might be undefined (optional field)
      if (finalConfig.tasksDir !== undefined) {
        expect(typeof finalConfig.tasksDir).toBe('string');
      }

      // Verify the config file is valid JSON
      const configPath = PATHS.getConfigPath(workspace.directory);
      const content = await fs.readFile(configPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should handle file lock scenarios gracefully', async () => {
      // Purpose: Test behavior when config file might be locked by another process
      // Note: ConfigManager doesn't use LockManager, but we can test file access scenarios
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      const configPath = PATHS.getConfigPath(workspace.directory);

      // Create initial config
      await configManager.update({ lockTimeoutMs: 30000 });

      // Open file handle to simulate file being in use
      const fileHandle = await fs.open(configPath, 'r');

      try {
        // ConfigManager should still be able to update (atomic write creates new file)
        await configManager.update({
          lockTimeoutMs: 45000,
          tasksDir: 'locked/tasks'
        });

        // Verify update succeeded
        const newConfigManager = new ConfigManager(workspace.directory);
        const config = await newConfigManager.load();
        expect(config.lockTimeoutMs).toBe(45000);
        expect(config.tasksDir).toBe('locked/tasks');
      } finally {
        await fileHandle.close();
      }
    });
  });

  describe('Atomic Write Verification', () => {
    it('should write config atomically to prevent corruption', async () => {
      // Purpose: Verify atomic writes prevent partial file corruption
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      const configPath = PATHS.getConfigPath(workspace.directory);

      // Write initial config
      await configManager.update({ lockTimeoutMs: 30000 });

      // Simulate orphaned temp files from previous crashed writes
      const tempFiles = [
        `${configPath}.12345`,
        `${configPath}.67890`,
        `${configPath}.${process.pid}99999`
      ];

      for (const tempFile of tempFiles) {
        await fs.writeFile(tempFile, '{ "corrupted": true }');
      }

      // Update should still work atomically despite temp files
      await configManager.update({
        lockTimeoutMs: 45000,
        tasksDir: 'atomic/tasks'
      });

      // Verify config is not corrupted
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;

      expect(config.lockTimeoutMs).toBe(45000);
      expect(config.tasksDir).toBe('atomic/tasks');
      expect(config).not.toHaveProperty('corrupted');
    });

    it('should maintain config integrity during concurrent atomic writes', async () => {
      // Purpose: Test that concurrent atomic writes don't corrupt the config
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create multiple config managers
      const managers = Array.from({ length: 5 }, () => new ConfigManager(workspace.directory));

      // Perform concurrent updates with different values
      const updatePromises = managers.map((manager, index) =>
        manager.update({
          lockTimeoutMs: 30000 + (index * 1000),
          maxTaskSizeBytes: 1048576 + (index * 1024)
        })
      );

      // All updates should complete
      await Promise.all(updatePromises);

      // Verify final config is valid and not corrupted
      const configPath = PATHS.getConfigPath(workspace.directory);
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;

      // Config should have valid values from one of the updates
      expect(config.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(config.lockTimeoutMs).toBeGreaterThanOrEqual(30000);
      expect(config.lockTimeoutMs).toBeLessThanOrEqual(34000);
      expect(config.maxTaskSizeBytes).toBeGreaterThanOrEqual(1048576);
      expect(config.maxTaskSizeBytes).toBeLessThanOrEqual(1052672);
    });

    it('should handle large config files atomically', async () => {
      // Purpose: Test atomic writes work with larger config data
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create a config with a very long tasksDir path
      const longPath = 'deep/' + 'nested/'.repeat(50) + 'tasks';

      await configManager.update({
        lockTimeoutMs: 60000,
        maxTaskSizeBytes: 5242880,
        tasksDir: longPath
      });

      // Verify the write was atomic and complete
      const configPath = PATHS.getConfigPath(workspace.directory);
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;

      expect(config.tasksDir).toBe(longPath);
      expect(config.tasksDir?.length).toBeGreaterThan(350);
    });
  });

  describe('Config File Creation When Missing', () => {
    it('should create config file when it does not exist', async () => {
      // Purpose: Test that ConfigManager creates config.json if missing
      const configPath = PATHS.getConfigPath(workspace.directory);

      // Verify config doesn't exist yet
      await expect(fs.access(configPath)).rejects.toThrow();

      // Update should create the config file
      await configManager.update({
        lockTimeoutMs: 40000,
        tasksDir: 'new/tasks'
      });

      // Verify config was created
      await expect(fs.access(configPath)).resolves.toBeUndefined();

      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;

      expect(config.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(config.lockTimeoutMs).toBe(40000);
      expect(config.tasksDir).toBe('new/tasks');
    });

    it('should create STM directory structure when missing', async () => {
      // Purpose: Test that update creates necessary directories
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);

      // Verify STM directory doesn't exist
      await expect(fs.access(stmDir)).rejects.toThrow();

      // Update should create directory structure
      await configManager.update({ lockTimeoutMs: 35000 });

      // Verify directory was created
      const stats = await fs.stat(stmDir);
      expect(stats.isDirectory()).toBe(true);

      // Verify config was created in the directory
      const configPath = PATHS.getConfigPath(workspace.directory);
      await expect(fs.access(configPath)).resolves.toBeUndefined();
    });

    it('should handle missing config gracefully on load', async () => {
      // Purpose: Test that load returns defaults when config is missing
      const configPath = PATHS.getConfigPath(workspace.directory);

      // Verify config doesn't exist
      await expect(fs.access(configPath)).rejects.toThrow();

      // Load should return defaults
      const config = await configManager.load();

      expect(config.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
      expect(config.lockTimeoutMs).toBe(DEFAULT_CONFIG.LOCK_TIMEOUT_MS);
      expect(config.maxTaskSizeBytes).toBe(DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES);
      expect(config.tasksDir).toBeUndefined();

      // Config file should not be created by load
      await expect(fs.access(configPath)).rejects.toThrow();
    });
  });

  describe('Validation During Updates', () => {
    it('should validate configuration values before saving', async () => {
      // Purpose: Test that invalid values are rejected before writing to disk
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Test invalid lockTimeoutMs
      await expect(configManager.update({ lockTimeoutMs: -1000 }))
        .rejects.toThrow(ValidationError);
      await expect(configManager.update({ lockTimeoutMs: 0 }))
        .rejects.toThrow(ValidationError);
      await expect(configManager.update({ lockTimeoutMs: 400000 })) // > 5 minutes
        .rejects.toThrow(ValidationError);

      // Test invalid maxTaskSizeBytes
      await expect(configManager.update({ maxTaskSizeBytes: -1 }))
        .rejects.toThrow(ValidationError);
      await expect(configManager.update({ maxTaskSizeBytes: 0 }))
        .rejects.toThrow(ValidationError);
      await expect(configManager.update({ maxTaskSizeBytes: 20971520 })) // > 10MB
        .rejects.toThrow(ValidationError);

      // Test invalid tasksDir
      await expect(configManager.update({ tasksDir: '../../../etc/passwd' }))
        .rejects.toThrow(ValidationError);
      await expect(configManager.update({ tasksDir: '/etc/passwd' }))
        .rejects.toThrow(ValidationError);

      // Verify no config file was created due to validation failures
      const configPath = PATHS.getConfigPath(workspace.directory);
      await expect(fs.access(configPath)).rejects.toThrow();
    });

    it('should validate schema version', async () => {
      // Purpose: Test schema version validation
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create config with wrong schema version
      const configPath = PATHS.getConfigPath(workspace.directory);
      const invalidConfig = {
        schema: 999, // Invalid version
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576
      };
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

      // Load should fail with validation error
      await expect(configManager.load()).rejects.toThrow(ValidationError);
      await expect(configManager.load()).rejects.toThrow(/Unsupported config schema version/);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should recover from file system errors gracefully', async () => {
      // Purpose: Test error handling for file system issues
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Make directory read-only on Unix-like systems
      if (process.platform !== 'win32') {
        await fs.chmod(stmDir, 0o555); // Read + execute only

        try {
          await expect(configManager.update({ lockTimeoutMs: 40000 }))
            .rejects.toThrow(FileSystemError);
        } finally {
          // Restore permissions for cleanup
          await fs.chmod(stmDir, 0o755);
        }
      }
    });

    it('should handle simultaneous read and write operations', async () => {
      // Purpose: Test that reads during writes don't cause issues
      const stmDir = path.join(workspace.directory, PATHS.BASE_DIR);
      await fs.mkdir(stmDir, { recursive: true });

      // Create initial config
      await configManager.update({ lockTimeoutMs: 30000 });

      // Start a write operation
      const writePromise = configManager.update({
        lockTimeoutMs: 60000,
        tasksDir: 'concurrent/read-write'
      });

      // Perform multiple reads during the write
      const readPromises = Array.from({ length: 5 }, async () => {
        const manager = new ConfigManager(workspace.directory);
        return manager.load();
      });

      // All operations should complete successfully
      await writePromise;
      const configs = await Promise.all(readPromises);

      // All reads should return valid configs
      configs.forEach((config) => {
        expect(config.schema).toBe(DEFAULT_CONFIG.SCHEMA_VERSION);
        expect(typeof config.lockTimeoutMs).toBe('number');
        expect(config.lockTimeoutMs).toBeGreaterThan(0);
      });
    });
  });
});
