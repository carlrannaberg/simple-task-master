/**
 * Export tasks command
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskManager } from '../lib/task-manager';
import { formatTasks, printError, printSuccess, printWarning } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError } from '../lib/errors';
import type { OutputFormat, TaskListFilters, Task } from '../lib/types';

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
 * Get file extension from format
 */
function getFileExtension(format: OutputFormat): string {
  switch (format) {
    case 'json':
      return '.json';
    case 'csv':
      return '.csv';
    case 'yaml':
      return '.yaml';
    case 'ndjson':
      return '.ndjson';
    default:
      return '.txt';
  }
}

/**
 * Export tasks to a file or stdout
 */
async function exportTasks(options: {
  format?: string;
  output?: string;
  status?: string;
  tags?: string;
  search?: string;
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

    // Get tasks with full content
    const allTasks = await taskManager.list(filters);
    const tasks: Task[] = [];

    // Load full content for each task
    for (const task of allTasks) {
      try {
        const fullTask = await taskManager.get(task.id);
        tasks.push(fullTask);
      } catch (error) {
        printWarning(
          `Could not load content for task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        tasks.push(task); // Include without content
      }
    }

    // Determine output format
    let format: OutputFormat = 'json'; // default for export

    if (options.format) {
      const validFormats = ['json', 'csv', 'ndjson', 'yaml', 'table'];
      if (!validFormats.includes(options.format)) {
        throw new ValidationError(
          `Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`
        );
      }
      format = options.format as OutputFormat;
    }

    // Warn if no tasks found
    if (tasks.length === 0) {
      printWarning('No tasks found matching the specified filters');
    }

    // Format data
    const output = formatTasks(tasks, format);

    // Output to file or stdout
    if (options.output) {
      // Ensure output directory exists
      const outputDir = path.dirname(options.output);
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch {
        // Ignore if directory already exists
      }

      // Auto-append file extension if not present
      let outputPath = options.output;
      const expectedExt = getFileExtension(format);
      if (!outputPath.endsWith(expectedExt)) {
        outputPath += expectedExt;
        printWarning(`Auto-appending ${expectedExt} extension to output file`);
      }

      await fs.writeFile(outputPath, output, 'utf8');
      printSuccess(
        `Exported ${tasks.length} task${tasks.length === 1 ? '' : 's'} to ${outputPath}`
      );
    } else {
      // Output to stdout
      process.stdout.write(output);
      if (format !== 'csv') {
        process.stdout.write('\n');
      }
    }
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
 * Create the export command
 */
export const exportCommand = new Command('export')
  .description('Export tasks to a file or stdout')
  .option('-f, --format <format>', 'Export format (json, csv, ndjson, yaml, table)', 'json')
  .option('-o, --output <file>', 'Output file (default: stdout, auto-appends extension)')
  .option('-s, --status <status>', 'Filter by status (pending, in-progress, done)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('--search <pattern>', 'Filter by search pattern (title and content)')
  .addHelpText(
    'after',
    `
Examples:
  stm export                           # Export all tasks as JSON to stdout
  stm export -f csv -o tasks           # Export as CSV to tasks.csv
  stm export -s done -f yaml           # Export completed tasks as YAML
  stm export -t urgent,bug -f json     # Export urgent and bug tasks as JSON
  stm export --search "API" -f csv     # Export tasks containing "API" as CSV`
  )
  .action(async (options) => {
    await exportTasks(options);
  });
