/**
 * Add task command
 */

import { Command } from 'commander';
import { TaskManager } from '../lib/task-manager';
import { printError, printOutput } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError } from '../lib/errors';
import { readInput } from '../lib/utils';
import { buildMarkdownContent } from '../lib/markdown-sections';
import type { TaskCreateInput } from '../lib/types';

/**
 * Parse tags from a comma-separated string
 */
function parseTags(tagsStr: string): string[] {
  if (!tagsStr.trim()) {
    return [];
  }
  return tagsStr
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Parse dependencies from a comma-separated string
 */
function parseDependencies(depsStr: string): number[] {
  if (!depsStr.trim()) {
    return [];
  }
  return depsStr.split(',').map((dep) => {
    const id = parseInt(dep.trim(), 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError(`Invalid dependency ID: ${dep.trim()}`);
    }
    return id;
  });
}

/**
 * Add a new task
 */
async function addTask(
  title: string,
  options: {
    description?: string;
    details?: string;
    validation?: string;
    tags?: string;
    deps?: string;
    status?: string;
  }
): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Parse options
    const tags = options.tags ? parseTags(options.tags) : [];
    const dependencies = options.deps ? parseDependencies(options.deps) : [];

    // Validate status if provided
    const status = options.status || 'pending';
    if (!['pending', 'in-progress', 'done'].includes(status)) {
      throw new ValidationError(
        `Invalid status: ${status}. Status must be one of: pending, in-progress, done`
      );
    }

    // Process description, details, and validation sections with stdin support
    let content = '';
    let hasAnySections = false;

    // Process description
    let description = '';
    if (options.description !== undefined) {
      try {
        const descContent = await readInput(options.description, false, '', 30000);
        description = descContent || '';
        hasAnySections = true;
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(`Failed to read description input: ${error.message}`);
        }
        throw new ValidationError('Failed to read description input');
      }
    }

    // Process details
    let details: string | undefined;
    if (options.details !== undefined) {
      try {
        const detailsContent = await readInput(options.details, false, '', 30000);
        details = detailsContent || undefined;
        hasAnySections = true;
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(`Failed to read details input: ${error.message}`);
        }
        throw new ValidationError('Failed to read details input');
      }
    }

    // Process validation
    let validation: string | undefined;
    if (options.validation !== undefined) {
      try {
        const validationContent = await readInput(options.validation, false, '', 30000);
        validation = validationContent || undefined;
        hasAnySections = true;
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(`Failed to read validation input: ${error.message}`);
        }
        throw new ValidationError('Failed to read validation input');
      }
    }

    // Build the content from sections
    if (hasAnySections) {
      content = buildMarkdownContent({
        description,
        details,
        validation
      });
    }

    // Create task input
    const taskInput: TaskCreateInput = {
      title,
      content,
      status: status as 'pending' | 'in-progress' | 'done',
      tags,
      dependencies
    };

    // Create the task (TaskManager handles locking internally)
    const task = await taskManager.create(taskInput);

    // Output the task ID
    printOutput(task.id.toString());
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
 * Create the add command
 */
export const addCommand = new Command('add')
  .description('Add a new task')
  .argument('<title>', 'Task title')
  .option('-d, --description <desc>', 'Task description (use - for stdin)')
  .option('--details <text>', 'Task details section (use - for stdin)')
  .option('--validation <text>', 'Task validation section (use - for stdin)')
  .option('-t, --tags <tags>', 'Comma-separated list of tags')
  .option('--deps <dependencies>', 'Comma-separated list of dependency task IDs')
  .option('-s, --status <status>', 'Task status (pending, in-progress, done)', 'pending')
  .action(async (title: string, options) => {
    await addTask(title, options);
  });
