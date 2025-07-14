/**
 * List tasks command
 */

import { Command } from 'commander';
import { TaskManager } from '../lib/task-manager';
import { formatTasks, printError, printOutput } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError } from '../lib/errors';
import type { TaskListFilters, OutputFormat } from '../lib/types';

/**
 * Parse tags filter from string
 */
function parseTagsFilter(tagsStr: string): string[] {
  return tagsStr
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * List tasks with optional filtering
 */
async function listTasks(options: {
  status?: string;
  tags?: string;
  search?: string;
  pretty?: boolean;
  format?: string;
}): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Build filters
    const filters: TaskListFilters = {};

    if (options.status) {
      if (!['pending', 'in-progress', 'done'].includes(options.status)) {
        throw new ValidationError('Status must be one of: pending, in-progress, done');
      }
      filters.status = options.status as 'pending' | 'in-progress' | 'done';
    }

    if (options.tags) {
      filters.tags = parseTagsFilter(options.tags);
    }

    if (options.search) {
      filters.search = options.search;
    }

    // Get tasks
    const tasks = await taskManager.list(filters);

    // Determine output format
    let format: OutputFormat = 'ndjson'; // default

    if (options.pretty) {
      format = 'table';
    } else if (options.format) {
      const validFormats = ['ndjson', 'json', 'table', 'csv', 'yaml'];
      if (!validFormats.includes(options.format)) {
        throw new ValidationError(
          `Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`
        );
      }
      format = options.format as OutputFormat;
    }

    // Format and output
    const output = formatTasks(tasks, format);
    printOutput(output);
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof FileSystemError ||
      error instanceof ConfigurationError ||
      error instanceof Error
    ) {
      printError(error.message);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Create the list command
 */
export const listCommand = new Command('list')
  .description('List tasks with optional filtering')
  .option('-s, --status <status>', 'Filter by status (pending, in-progress, done)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('--search <query>', 'Search in task titles and content')
  .option('-p, --pretty', 'Pretty table output format')
  .option('-f, --format <format>', 'Output format (ndjson, json, table, csv, yaml)')
  .action(async (options) => {
    await listTasks(options);
  });
