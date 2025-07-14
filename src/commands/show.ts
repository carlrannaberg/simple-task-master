/**
 * Show task command
 */

import { Command } from 'commander';
import { TaskManager } from '../lib/task-manager';
import { formatTask, printError, printOutput } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError, NotFoundError } from '../lib/errors';
import type { OutputFormat } from '../lib/types';

/**
 * Show a specific task
 */
export async function showTask(idStr: string, options: { format?: string }): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Parse task ID
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError(`Invalid task ID: ${idStr}`);
    }

    // Get the task
    const task = await taskManager.get(id);

    // Determine output format
    let format: OutputFormat = 'yaml'; // default for single task

    if (options.format) {
      const validFormats = ['yaml', 'markdown', 'json', 'ndjson', 'table', 'csv'];
      if (!validFormats.includes(options.format)) {
        throw new ValidationError(
          `Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`
        );
      }
      format = options.format as OutputFormat;
    }

    // Format and output
    const output = formatTask(task, format);
    printOutput(output);
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof FileSystemError ||
      error instanceof ConfigurationError ||
      error instanceof NotFoundError ||
      error instanceof Error
    ) {
      printError(error.message);
      process.exit(error instanceof NotFoundError ? 3 : 1);
    }
    throw error;
  }
}

/**
 * Create the show command
 */
export const showCommand = new Command('show')
  .description('Show a specific task')
  .argument('<id>', 'Task ID')
  .option(
    '-f, --format <format>',
    'Output format (yaml, markdown, json, ndjson, table, csv)',
    'yaml'
  )
  .action(async (id: string, options) => {
    await showTask(id, options);
  });
