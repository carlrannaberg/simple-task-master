/**
 * Initialize STM repository command
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LockManager } from '../lib/lock-manager';
import { ensureDirectory, fileExists } from '../lib/utils';
import { printSuccess, printError, printWarning } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError } from '../lib/errors';
import { PATHS, DEFAULT_CONFIG } from '../lib/constants';
import { validateTasksDir } from '../lib/path-validation';
import type { Config } from '../lib/types';

/**
 * Options for the init command
 */
interface InitOptions {
  tasksDir?: string;
}

/**
 * Initialize STM repository in the current directory
 */
async function initializeRepository(options: InitOptions): Promise<void> {
  const lockManager = new LockManager(process.cwd());

  try {
    await lockManager.acquire();

    const projectRoot = process.cwd();
    const baseDir = PATHS.getBaseDir(projectRoot);
    const configPath = PATHS.getConfigPath(projectRoot);

    // Validate the custom tasks directory BEFORE checking if initialized
    // This ensures validation errors are caught even on already-initialized workspaces
    let validatedPath: string | undefined;
    if (options.tasksDir) {
      validatedPath = validateTasksDir(options.tasksDir);
    }

    // Check if already initialized
    const isInitialized = await fileExists(configPath);
    if (isInitialized) {
      printWarning('STM repository is already initialized');
      return;
    }

    // Determine tasks directory
    let tasksDir: string;
    let customTasksDir: string | undefined;

    if (options.tasksDir && validatedPath) {
      // Use the already validated path

      // Convert to absolute path if relative
      if (!path.isAbsolute(validatedPath)) {
        tasksDir = path.join(projectRoot, validatedPath);
        // Store relative path in config, preserving ./ prefix if it was provided
        customTasksDir = options.tasksDir.startsWith('./') && !validatedPath.startsWith('./')
          ? './' + validatedPath
          : validatedPath;
      } else {
        tasksDir = validatedPath;
        // Store as relative path in config for portability
        // Use resolved real paths to handle symlinks properly
        const fs = require('fs');
        const realProjectRoot = fs.realpathSync(projectRoot);

        // For the target path, resolve the parent directory since the path might not exist yet
        const validatedDir = path.dirname(validatedPath);
        let realValidatedDir: string;
        try {
          realValidatedDir = fs.realpathSync(validatedDir);
        } catch {
          // If parent doesn't exist, just use path.resolve
          realValidatedDir = path.resolve(validatedDir);
        }
        const realValidatedPath = path.join(realValidatedDir, path.basename(validatedPath));

        customTasksDir = path.relative(realProjectRoot, realValidatedPath);
      }

      // Additional validation - ensure it's not inside .simple-task-master
      const relativeToBase = path.relative(baseDir, tasksDir);
      if (!relativeToBase.startsWith('..') && relativeToBase !== '') {
        throw new ValidationError(
          'Custom tasks directory cannot be inside .simple-task-master directory'
        );
      }

      // Check if the directory already exists and has files
      try {
        const stats = await fs.stat(tasksDir);
        if (stats.isDirectory()) {
          const files = await fs.readdir(tasksDir);
          if (files.length > 0) {
            printWarning(`Directory ${options.tasksDir} already exists and contains files`);
          }
        }
      } catch {
        // Directory doesn't exist, which is fine
      }
    } else {
      // Use default tasks directory
      tasksDir = PATHS.getTasksDir(projectRoot);
    }

    // Create directories
    await ensureDirectory(baseDir);
    await ensureDirectory(tasksDir);

    // Create configuration with optional custom tasks directory
    const config: Config = {
      schema: DEFAULT_CONFIG.SCHEMA_VERSION,
      lockTimeoutMs: DEFAULT_CONFIG.LOCK_TIMEOUT_MS,
      maxTaskSizeBytes: DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES
    };

    // Only add tasksDir to config if it's custom
    if (customTasksDir) {
      config.tasksDir = customTasksDir;
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    // Update .gitignore if it exists
    const isAbsolutePath = options.tasksDir
      ? path.isAbsolute(validateTasksDir(options.tasksDir))
      : false;
    await updateGitignore(projectRoot, customTasksDir, isAbsolutePath);

    printSuccess('Initialized STM repository');
    printSuccess(`Created ${path.relative(projectRoot, baseDir)}/`);
    printSuccess(`Created ${path.relative(projectRoot, tasksDir)}/`);
    printSuccess(`Created ${path.relative(projectRoot, configPath)}`);

    if (customTasksDir) {
      printSuccess(`Using custom tasks directory: ${customTasksDir}`);
    }
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof FileSystemError ||
      error instanceof ConfigurationError
    ) {
      printError(error.message);
      process.exit(1);
    }
    throw error;
  } finally {
    await lockManager.release();
  }
}

/**
 * Updates .gitignore to ignore task files but track config
 */
async function updateGitignore(
  projectRoot: string,
  customTasksDir?: string,
  isAbsolutePath?: boolean
): Promise<void> {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  try {
    // Check if .gitignore exists
    const gitignoreExists = await fileExists(gitignorePath);

    let gitignoreContent = '';
    if (gitignoreExists) {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    }

    // Determine patterns to check/add
    let stmTasksPattern: string;

    if (customTasksDir) {
      // Warn if user provided an absolute path
      if (isAbsolutePath) {
        printWarning(
          'Absolute paths in .gitignore may not work as expected across different systems'
        );
      }

      // Use the relative path (customTasksDir is always relative at this point)
      stmTasksPattern = customTasksDir.endsWith('/') ? customTasksDir : customTasksDir + '/';
    } else {
      // Default pattern
      stmTasksPattern = '.simple-task-master/tasks/';
    }

    const stmLockPattern = '.simple-task-master/lock';

    const hasTasksIgnore = gitignoreContent.includes(stmTasksPattern);
    const hasLockIgnore = gitignoreContent.includes(stmLockPattern);

    if (!hasTasksIgnore || !hasLockIgnore) {
      const linesToAdd: string[] = [];

      if (!hasTasksIgnore || !hasLockIgnore) {
        linesToAdd.push('');
        linesToAdd.push('# Simple Task Master - User tasks are git-ignored');
      }

      if (!hasTasksIgnore) {
        linesToAdd.push(stmTasksPattern);
      }

      if (!hasLockIgnore) {
        linesToAdd.push(stmLockPattern);
      }

      const updatedContent = gitignoreContent + linesToAdd.join('\n') + '\n';
      await fs.writeFile(gitignorePath, updatedContent, 'utf8');

      if (gitignoreExists) {
        printSuccess('Updated .gitignore');
      } else {
        printSuccess('Created .gitignore');
      }
    }
  } catch (error) {
    // Non-fatal error
    printWarning(`Could not update .gitignore: ${(error as Error).message}`);
  }
}

/**
 * Create the init command
 */
export const initCommand = new Command('init')
  .description('Initialize STM repository in the current directory')
  .option('--tasks-dir <path>', 'Custom directory for storing task files')
  .action(async (options: InitOptions) => {
    try {
      await initializeRepository(options);
    } catch (error) {
      printError(error as Error);
      process.exit(1);
    }
  });
