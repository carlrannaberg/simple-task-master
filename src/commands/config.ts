/**
 * Config command for managing Simple Task Master configuration
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager, CONFIG_DEFAULTS } from '../lib/config';
import { LockManager } from '../lib/lock-manager';
import { getWorkspaceRoot } from '../lib/workspace';
import { printOutput, printError, printWarning, printSuccess } from '../lib/output';
import { ValidationError, NotFoundError, FileSystemError, ConfigurationError } from '../lib/errors';
import type { Config } from '../lib/types';

interface ConfigOptions {
  get?: string;
  set?: string;
  list?: boolean;
  reset?: string;
  resetAll?: boolean;
}

/**
 * Parse and validate configuration values from string input
 */
function parseValue(key: string, value: string): string | number {
  if (key === 'lockTimeoutMs' || key === 'maxTaskSizeBytes') {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new ValidationError(`${key} must be a number`);
    }
    return num;
  }
  // tasksDir remains as string
  return value;
}

/**
 * Handle command errors with appropriate exit codes
 */
function handleCommandError(error: unknown): never {
  if (error instanceof ValidationError) {
    printError(error.message);
    process.exit(2); // Invalid input
  }
  if (error instanceof NotFoundError) {
    printError(error.message);
    process.exit(3); // Resource not found
  }
  if (error instanceof FileSystemError) {
    printError(error.message);
    process.exit(1); // File system error
  }
  if (error instanceof ConfigurationError) {
    printError(error.message);
    process.exit(1); // Configuration error
  }

  // Unknown error
  const message = error instanceof Error ? error.message : String(error);
  printError(`Unexpected error: ${message}`);
  process.exit(1);
}

async function configAction(options: ConfigOptions): Promise<void> {
  try {
    const workspaceRoot = await getWorkspaceRoot();
    const configManager = new ConfigManager(workspaceRoot);
    const lockManager = new LockManager(workspaceRoot);

    // Handle --get
    if (options.get) {
      const config = await configManager.load();
      const value = config[options.get as keyof Config];
      if (value === undefined) {
        throw new ValidationError(`Unknown configuration key: ${options.get}`);
      }
      printOutput(String(value));
      return;
    }

    // Handle --list
    if (options.list) {
      const config = await configManager.load();
      printOutput(JSON.stringify(config, null, 2));
      return;
    }

    // Handle --set (requires lock)
    if (options.set) {
      await lockManager.acquire();
      try {
        const [key, ...valueParts] = options.set.split('=');
        const value = valueParts.join('='); // Rejoin in case value contains '='

        if (!key || value === '') {
          throw new ValidationError('Invalid format. Use: --set key=value');
        }

        // Validate the key is a known configuration option
        const validKeys = ['tasksDir', 'lockTimeoutMs', 'maxTaskSizeBytes'];
        if (!validKeys.includes(key)) {
          throw new ValidationError(
            `Unknown configuration key: ${key}. Valid keys: ${validKeys.join(', ')}`
          );
        }

        // Check if we're changing tasksDir with existing tasks
        if (key === 'tasksDir') {
          const currentTasksDir = configManager.getTasksDir();
          const newTasksDir = path.isAbsolute(value)
            ? value
            : path.join(workspaceRoot, value);

          if (currentTasksDir !== newTasksDir) {
            try {
              const files = await fs.readdir(currentTasksDir);
              const taskFiles = files.filter((f) => f.endsWith('.md'));
              if (taskFiles.length > 0) {
                printWarning(
                  `Current tasks directory contains ${taskFiles.length} task(s). ` +
                  'Tasks will NOT be automatically migrated to the new location.'
                );
              }
            } catch {
              // Current tasks dir doesn't exist, no warning needed
            }
          }
        }

        const updates = { [key]: parseValue(key, value) };
        await configManager.update(updates as Partial<Config>);
        printSuccess('Configuration updated successfully');
      } finally {
        await lockManager.release();
      }
      return;
    }

    // Handle --reset (requires lock)
    if (options.reset) {
      await lockManager.acquire();
      try {
        const key = options.reset;
        const validKeys = ['tasksDir', 'lockTimeoutMs', 'maxTaskSizeBytes'];

        if (!validKeys.includes(key)) {
          throw new ValidationError(
            `Unknown configuration key: ${key}. Valid keys: ${validKeys.join(', ')}`
          );
        }

        // Reset the specific key
        await configManager.reset([key]);

        // Get the default value for the success message
        let defaultValue: string;
        if (key === 'tasksDir') {
          defaultValue = '.simple-task-master/tasks (default location)';
        } else if (key === 'lockTimeoutMs') {
          defaultValue = `${CONFIG_DEFAULTS.lockTimeoutMs} (${CONFIG_DEFAULTS.lockTimeoutMs / 1000} seconds)`;
        } else if (key === 'maxTaskSizeBytes') {
          const mb = CONFIG_DEFAULTS.maxTaskSizeBytes / 1048576;
          defaultValue = `${CONFIG_DEFAULTS.maxTaskSizeBytes} (${mb} MB)`;
        } else {
          // This case should never happen due to validation above
          defaultValue = 'unknown';
        }

        printSuccess(`Configuration key '${key}' reset to default value: ${defaultValue}`);
      } finally {
        await lockManager.release();
      }
      return;
    }

    // Handle --reset-all (requires lock)
    if (options.resetAll) {
      await lockManager.acquire();
      try {
        // Reset all resettable keys
        const resettableKeys = ['tasksDir', 'lockTimeoutMs', 'maxTaskSizeBytes'];
        await configManager.reset(resettableKeys);

        printSuccess('All configuration values reset to defaults:');
        printOutput('  tasksDir: .simple-task-master/tasks (default location)');
        printOutput(`  lockTimeoutMs: ${CONFIG_DEFAULTS.lockTimeoutMs} (${CONFIG_DEFAULTS.lockTimeoutMs / 1000} seconds)`);
        const mb = CONFIG_DEFAULTS.maxTaskSizeBytes / 1048576;
        printOutput(`  maxTaskSizeBytes: ${CONFIG_DEFAULTS.maxTaskSizeBytes} (${mb} MB)`);
      } finally {
        await lockManager.release();
      }
      return;
    }

    // No options provided - show help
    printOutput('Usage: stm config [options]');
    printOutput('Use "stm config --help" for more information');

  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Create the config command
 */
export const configCommand = new Command('config')
  .description('Manage Simple Task Master configuration')
  .option('--get <key>', 'Get a configuration value (tasksDir, lockTimeoutMs, maxTaskSizeBytes)')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--list', 'List all configuration values as JSON')
  .option('--reset <key>', 'Reset a configuration value to its default')
  .option('--reset-all', 'Reset all configuration values to defaults')
  .addHelpText('after', `
Configuration Keys:
  tasksDir         - Directory where task files are stored
                     Default: .simple-task-master/tasks
                     Valid: Any valid directory path (relative or absolute)
                     Note: Tasks won't be migrated when changing this value
  
  lockTimeoutMs    - Lock acquisition timeout in milliseconds  
                     Default: 30000 (30 seconds)
                     Valid: 1 - 300000 (max 5 minutes)
                     Usage: Prevents concurrent task modifications
  
  maxTaskSizeBytes - Maximum allowed task file size in bytes
                     Default: 1048576 (1 MB)
                     Valid: 1 - 10485760 (max 10 MB)
                     Usage: Prevents oversized task files

Examples:
  # View all configuration
  stm config --list
  
  # Get specific value
  stm config --get tasksDir
  stm config --get lockTimeoutMs
  
  # Change tasks directory (relative path)
  stm config --set tasksDir=docs/tasks
  stm config --set tasksDir=.stm/tasks
  
  # Change tasks directory (absolute path)  
  stm config --set tasksDir=/home/user/project/tasks
  
  # Adjust lock timeout for slower systems
  stm config --set lockTimeoutMs=60000    # 1 minute
  stm config --set lockTimeoutMs=120000   # 2 minutes
  
  # Increase max task size for large documentation
  stm config --set maxTaskSizeBytes=2097152   # 2 MB
  stm config --set maxTaskSizeBytes=5242880   # 5 MB

Restoring Defaults:
  # Reset individual configuration values to defaults
  stm config --reset tasksDir       # Reset to .simple-task-master/tasks
  stm config --reset lockTimeoutMs  # Reset to 30000 (30 seconds)
  stm config --reset maxTaskSizeBytes # Reset to 1048576 (1 MB)
  
  # Reset all configuration values at once
  stm config --reset-all
  
  # Alternative: Delete config.json to use all defaults
  rm .simple-task-master/config.json

Configuration Storage:
  Settings are stored in: .simple-task-master/config.json
  Format: JSON with schema version for future compatibility`)
  .action(configAction);
