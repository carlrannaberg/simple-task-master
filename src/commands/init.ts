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
import type { Config } from '../lib/types';

/**
 * Initialize STM repository in the current directory
 */
async function initializeRepository(): Promise<void> {
  const lockManager = new LockManager(process.cwd());

  try {
    await lockManager.acquire();

    const projectRoot = process.cwd();
    const baseDir = PATHS.getBaseDir(projectRoot);
    const tasksDir = PATHS.getTasksDir(projectRoot);
    const configPath = PATHS.getConfigPath(projectRoot);

    // Check if already initialized
    const isInitialized = await fileExists(configPath);
    if (isInitialized) {
      printWarning('STM repository is already initialized');
      return;
    }

    // Create directories
    await ensureDirectory(baseDir);
    await ensureDirectory(tasksDir);

    // Create default configuration
    const config: Config = {
      schema: DEFAULT_CONFIG.SCHEMA_VERSION,
      lockTimeoutMs: DEFAULT_CONFIG.LOCK_TIMEOUT_MS,
      maxTaskSizeBytes: DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    // Update .gitignore if it exists
    await updateGitignore(projectRoot);

    printSuccess('Initialized STM repository');
    printSuccess(`Created ${path.relative(projectRoot, baseDir)}/`);
    printSuccess(`Created ${path.relative(projectRoot, tasksDir)}/`);
    printSuccess(`Created ${path.relative(projectRoot, configPath)}`);
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
async function updateGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  try {
    // Check if .gitignore exists
    const gitignoreExists = await fileExists(gitignorePath);

    let gitignoreContent = '';
    if (gitignoreExists) {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    }

    // Check if STM entries already exist
    const stmTasksPattern = '.simple-task-master/tasks/';
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
  .action(async () => {
    try {
      await initializeRepository();
    } catch (error) {
      printError(error as Error);
      process.exit(1);
    }
  });
