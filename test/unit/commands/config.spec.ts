import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configCommand } from '@/commands/config';
import { TestWorkspace, runSTM, runSTMSuccess } from '@test/helpers';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Config Command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('command structure', () => {
    it('should have correct command name and description', () => {
      // Purpose: Ensure the command is properly registered with the correct name
      // This prevents accidental command name changes that would break the CLI
      expect(configCommand.name()).toBe('config');
      expect(configCommand.description()).toBe('Manage Simple Task Master configuration');
    });

    it('should have all required options', () => {
      // Purpose: Verify that all expected command options are available
      // This ensures the command interface remains stable for users
      const options = configCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--get');
      expect(optionNames).toContain('--set');
      expect(optionNames).toContain('--list');
    });
  });

  describe('--get functionality', () => {
    it('should get tasksDir configuration value when explicitly set', async () => {
      // Purpose: Verify that getting a valid configuration key returns the correct value
      // This is a core function to allow users to inspect current configuration

      // First set the tasksDir explicitly
      await runSTMSuccess(['config', '--set', 'tasksDir=custom/tasks'], { cwd: workspace.directory });

      // Then get it
      const result = await runSTMSuccess(['config', '--get', 'tasksDir'], { cwd: workspace.directory });
      expect(result.stdout).toBe('custom/tasks');
      expect(result.exitCode).toBe(0);
    });

    it('should get lockTimeoutMs configuration value', async () => {
      // Purpose: Ensure numeric configuration values are retrieved correctly
      // This tests that numeric values are properly stored and retrieved
      const result = await runSTMSuccess(['config', '--get', 'lockTimeoutMs'], { cwd: workspace.directory });
      expect(result.stdout).toBe('30000');
      expect(result.exitCode).toBe(0);
    });

    it('should get maxTaskSizeBytes configuration value', async () => {
      // Purpose: Test retrieval of the max task size configuration
      // This validates that all config keys are accessible
      const result = await runSTMSuccess(['config', '--get', 'maxTaskSizeBytes'], { cwd: workspace.directory });
      expect(result.stdout).toBe('1048576');
      expect(result.exitCode).toBe(0);
    });

    it('should reject invalid configuration key', async () => {
      // Purpose: Ensure unknown configuration keys are properly rejected
      // This prevents typos and provides clear feedback to users
      const result = await runSTM(['config', '--get', 'invalidKey'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2); // Invalid input
      expect(result.stderr).toContain('Unknown configuration key: invalidKey');
    });

    it('should handle empty key gracefully', async () => {
      // Purpose: Test edge case where key is empty
      // This ensures robust error handling for malformed input
      const result = await runSTM(['config', '--get', ''], { cwd: workspace.directory });
      // Commander.js treats empty string as missing argument, shows the help
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
    });
  });

  describe('--set functionality', () => {
    it('should set tasksDir to relative path', async () => {
      // Purpose: Verify that configuration can be updated with relative paths
      // This is important for project portability
      const result = await runSTMSuccess(['config', '--set', 'tasksDir=custom/tasks'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the change
      const getResult = await runSTMSuccess(['config', '--get', 'tasksDir'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe('custom/tasks');
    });

    it('should allow relative paths for tasksDir', async () => {
      // Purpose: Ensure relative paths within workspace are handled correctly
      // This is the recommended approach for portable task storage
      const relativePath = 'absolute/tasks';
      const result = await runSTMSuccess(['config', '--set', `tasksDir=${relativePath}`], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the change
      const getResult = await runSTMSuccess(['config', '--get', 'tasksDir'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe(relativePath);
    });

    it('should reject absolute paths too far outside workspace', async () => {
      // Purpose: Prevent security issues from storing tasks in system directories
      // This ensures tasks stay within reasonable project boundaries
      const systemPath = '/tmp/outside/tasks';
      const result = await runSTM(['config', '--set', `tasksDir=${systemPath}`], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Invalid absolute path');
    });

    it('should set lockTimeoutMs with valid number', async () => {
      // Purpose: Test that numeric values are properly parsed and stored
      // This ensures timeout configuration works correctly
      const result = await runSTMSuccess(['config', '--set', 'lockTimeoutMs=60000'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the change
      const getResult = await runSTMSuccess(['config', '--get', 'lockTimeoutMs'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe('60000');
    });

    it('should set maxTaskSizeBytes with valid number', async () => {
      // Purpose: Verify that task size limits can be configured
      // This allows users to adjust limits based on their needs
      const result = await runSTMSuccess(['config', '--set', 'maxTaskSizeBytes=2097152'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the change
      const getResult = await runSTMSuccess(['config', '--get', 'maxTaskSizeBytes'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe('2097152');
    });

    it('should reject non-numeric value for lockTimeoutMs', async () => {
      // Purpose: Ensure type validation prevents invalid configuration
      // This protects against configuration corruption
      const result = await runSTM(['config', '--set', 'lockTimeoutMs=not-a-number'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('lockTimeoutMs must be a number');
    });

    it('should reject non-numeric value for maxTaskSizeBytes', async () => {
      // Purpose: Test type validation for size configuration
      // This ensures consistent error handling across numeric fields
      const result = await runSTM(['config', '--set', 'maxTaskSizeBytes=invalid'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('maxTaskSizeBytes must be a number');
    });

    it('should reject negative timeout values', async () => {
      // Purpose: Ensure system stability by preventing invalid timeout values
      // Negative timeouts would break the locking mechanism
      const result = await runSTM(['config', '--set', 'lockTimeoutMs=-1000'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('lockTimeoutMs must be a positive number');
    });

    it('should reject zero timeout value', async () => {
      // Purpose: Prevent configuration that would make locking impossible
      // Zero timeout would cause immediate failures
      const result = await runSTM(['config', '--set', 'lockTimeoutMs=0'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('lockTimeoutMs must be a positive number');
    });

    it('should reject negative maxTaskSizeBytes', async () => {
      // Purpose: Ensure file size limits are reasonable
      // Negative sizes make no logical sense
      const result = await runSTM(['config', '--set', 'maxTaskSizeBytes=-1'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('maxTaskSizeBytes must be a positive number');
    });

    it('should reject unknown configuration key', async () => {
      // Purpose: Prevent typos and invalid configuration entries
      // This maintains configuration file integrity
      const result = await runSTM(['config', '--set', 'unknownKey=value'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Unknown configuration key: unknownKey');
      expect(result.stderr).toContain('Valid keys: tasksDir, lockTimeoutMs, maxTaskSizeBytes');
    });

    it('should reject invalid format without equals sign', async () => {
      // Purpose: Ensure proper command syntax is enforced
      // This provides clear error messages for common mistakes
      const result = await runSTM(['config', '--set', 'tasksDir'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Invalid format. Use: --set key=value');
    });

    it('should reject empty value after equals', async () => {
      // Purpose: Prevent accidental configuration clearing
      // Empty values could lead to undefined behavior
      const result = await runSTM(['config', '--set', 'tasksDir='], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Invalid format. Use: --set key=value');
    });

    it('should handle values containing equals signs', async () => {
      // Purpose: Ensure values with special characters are handled correctly
      // This is important for paths that might contain equals signs
      const pathWithEquals = 'path=with=equals';
      const result = await runSTMSuccess(['config', '--set', `tasksDir=${pathWithEquals}`], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the value was stored correctly
      const getResult = await runSTMSuccess(['config', '--get', 'tasksDir'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe(pathWithEquals);
    });

    it('should warn when changing tasksDir with existing tasks', async () => {
      // Purpose: Prevent accidental data loss by warning about existing tasks
      // This helps users avoid losing track of their tasks

      // Create some tasks first
      await workspace.addTask({ title: 'Test Task 1' });
      await workspace.addTask({ title: 'Test Task 2' });

      const result = await runSTMSuccess(['config', '--set', 'tasksDir=new/location'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');
      expect(result.stderr).toContain('Current tasks directory contains 2 task(s)');
      expect(result.stderr).toContain('Tasks will NOT be automatically migrated');
    });

    it('should not warn when changing tasksDir without existing tasks', async () => {
      // Purpose: Verify no warning is shown when there are no tasks to migrate
      // This avoids unnecessary warnings for new projects
      const result = await runSTMSuccess(['config', '--set', 'tasksDir=new/location'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');
      expect(result.stderr).not.toContain('Current tasks directory contains');
    });

    it('should handle concurrent set operations safely', async () => {
      // Purpose: Ensure file locking prevents race conditions
      // This is critical for data integrity in multi-process scenarios

      // Run two set operations concurrently
      const [result1, result2] = await Promise.all([
        runSTM(['config', '--set', 'lockTimeoutMs=40000'], { cwd: workspace.directory }),
        runSTM(['config', '--set', 'lockTimeoutMs=50000'], { cwd: workspace.directory })
      ]);

      // One should succeed, one should fail or succeed after the other
      const successCount = [result1, result2].filter((r) => r.exitCode === 0).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Verify final value is one of the two
      const finalResult = await runSTMSuccess(['config', '--get', 'lockTimeoutMs'], { cwd: workspace.directory });
      expect(['40000', '50000']).toContain(finalResult.stdout);
    });
  });

  describe('--list functionality', () => {
    it('should list all configuration as JSON', async () => {
      // Purpose: Verify complete configuration can be viewed in machine-readable format
      // This is useful for scripting and debugging
      const result = await runSTMSuccess(['config', '--list'], { cwd: workspace.directory });

      const config = JSON.parse(result.stdout);
      expect(config).toHaveProperty('schema', 1);
      expect(config).toHaveProperty('lockTimeoutMs', 30000);
      expect(config).toHaveProperty('maxTaskSizeBytes', 1048576);
      // tasksDir is optional and only appears when explicitly set
    });

    it('should output valid formatted JSON', async () => {
      // Purpose: Ensure JSON output is properly formatted for readability
      // This makes manual inspection easier
      const result = await runSTMSuccess(['config', '--list'], { cwd: workspace.directory });

      // Should be pretty-printed with 2-space indentation
      expect(result.stdout).toMatch(/{\n\s{2}"/);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('should reflect updated values in list output', async () => {
      // Purpose: Verify that list shows current configuration state
      // This ensures consistency between set and list operations

      // Update some values
      await runSTMSuccess(['config', '--set', 'lockTimeoutMs=45000'], { cwd: workspace.directory });
      await runSTMSuccess(['config', '--set', 'tasksDir=custom/dir'], { cwd: workspace.directory });

      // List should show updated values
      const result = await runSTMSuccess(['config', '--list'], { cwd: workspace.directory });
      const config = JSON.parse(result.stdout);

      expect(config.lockTimeoutMs).toBe(45000);
      expect(config.tasksDir).toBe('custom/dir');
    });
  });

  describe('multiple options handling', () => {
    it('should handle multiple options gracefully', async () => {
      // Purpose: Ensure command behavior when multiple options are provided
      // This tests how the command handles potentially conflicting options

      // First set tasksDir so --get will work
      await runSTMSuccess(['config', '--set', 'tasksDir=test/tasks'], { cwd: workspace.directory });

      const result = await runSTM(['config', '--get', 'tasksDir', '--list'], { cwd: workspace.directory });

      // When multiple options are provided, it executes the first valid one
      expect(result.exitCode).toBe(0);
      // Should get the tasksDir value
      expect(result.stdout).toBe('test/tasks');
    });
  });

  describe('no options handling', () => {
    it('should show usage help when no options provided', async () => {
      // Purpose: Guide users who run the command without options
      // This improves command discoverability
      const result = await runSTMSuccess(['config'], { cwd: workspace.directory });

      expect(result.stdout).toContain('Usage: stm config [options]');
      expect(result.stdout).toContain('Use "stm config --help" for more information');
    });
  });

  describe('workspace context', () => {
    it('should work with config in parent directories', async () => {
      // Purpose: Ensure config command searches parent directories for workspace
      // This is expected behavior - STM searches up the directory tree
      const tempDir = await fs.mkdtemp(path.join(workspace.directory, 'subdirectory-'));

      const result = await runSTM(['config', '--list'], { cwd: tempDir });
      expect(result.exitCode).toBe(0); // Should succeed by finding parent workspace
      const config = JSON.parse(result.stdout);
      expect(config).toHaveProperty('schema');

      await fs.rm(tempDir, { recursive: true });
    });
  });

  describe('error handling', () => {
    it('should handle read-only config file gracefully', async () => {
      // Purpose: Ensure robust error handling for I/O operations
      // This prevents crashes and provides useful error messages

      // Make config file read-only to trigger an error
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.chmod(configPath, 0o444);

      try {
        const result = await runSTM(['config', '--set', 'tasksDir=new'], { cwd: workspace.directory });
        // On some systems, the file might still be writable by owner
        if (result.exitCode === 0) {
          expect(result.stderr).toContain('Configuration updated successfully');
        } else {
          expect(result.exitCode).toBe(1); // File system error
          expect(result.stderr.toLowerCase()).toMatch(/permission denied|access denied|eacces|read-only/);
        }
      } finally {
        // Always restore permissions for cleanup
        await fs.chmod(configPath, 0o644);
      }
    });

    it('should handle corrupted config file', async () => {
      // Purpose: Ensure graceful handling of corrupted configuration
      // This helps users recover from manual config file edits gone wrong

      // Corrupt the config file
      const configPath = path.join(workspace.directory, '.simple-task-master', 'config.json');
      await fs.writeFile(configPath, '{ invalid json }');

      const result = await runSTM(['config', '--list'], { cwd: workspace.directory });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/JSON|parse|Unexpected/i);
    });
  });

  describe('special characters handling', () => {
    it('should handle paths with spaces', async () => {
      // Purpose: Ensure paths with spaces are properly handled
      // This is common in real-world file systems
      const pathWithSpaces = 'path with spaces/tasks';
      const result = await runSTMSuccess(['config', '--set', `tasksDir=${pathWithSpaces}`], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the value
      const getResult = await runSTMSuccess(['config', '--get', 'tasksDir'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe(pathWithSpaces);
    });

    it('should handle paths with unicode characters', async () => {
      // Purpose: Ensure international characters in paths are supported
      // This is important for non-English users
      const unicodePath = 'tasks/日本語/文档';
      const result = await runSTMSuccess(['config', '--set', `tasksDir=${unicodePath}`], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');

      // Verify the value
      const getResult = await runSTMSuccess(['config', '--get', 'tasksDir'], { cwd: workspace.directory });
      expect(getResult.stdout).toBe(unicodePath);
    });
  });

  describe('validation edge cases', () => {
    it('should accept minimum valid timeout', async () => {
      // Purpose: Test boundary condition for minimum timeout
      // This ensures edge cases are properly handled
      const result = await runSTMSuccess(['config', '--set', 'lockTimeoutMs=1'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');
    });

    it('should accept maximum allowed timeout value', async () => {
      // Purpose: Ensure timeout values up to the maximum (5 minutes) are supported
      // Some operations might legitimately need long timeouts
      const result = await runSTMSuccess(['config', '--set', 'lockTimeoutMs=300000'], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');
    });

    it('should reject timeout values exceeding 5 minutes', async () => {
      // Purpose: Enforce reasonable timeout limits for system stability
      // Excessively long timeouts could cause system issues
      const result = await runSTM(['config', '--set', 'lockTimeoutMs=3600000'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('lockTimeoutMs cannot exceed 5 minutes (300000ms)');
    });

    it('should accept very large max task size', async () => {
      // Purpose: Allow configuration for large documentation tasks
      // Some projects might have extensive documentation in tasks
      const largeSizeBytes = 10 * 1024 * 1024; // 10MB
      const result = await runSTMSuccess(['config', '--set', `maxTaskSizeBytes=${largeSizeBytes}`], { cwd: workspace.directory });
      expect(result.stderr).toContain('Configuration updated successfully');
    });

    it('should reject extremely large numeric values', async () => {
      // Purpose: Prevent integer overflow or unreasonable values
      // This protects against configuration mistakes
      const result = await runSTM(['config', '--set', 'lockTimeoutMs=999999999999999999999'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
    });

    it('should handle empty config key in set command', async () => {
      // Purpose: Test edge case of missing key in set command
      // This ensures proper error messages for malformed commands
      const result = await runSTM(['config', '--set', '=value'], { cwd: workspace.directory });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Invalid format');
    });
  });
});
