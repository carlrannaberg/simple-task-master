/**
 * Update task command
 */

import { Command } from 'commander';
import { TaskManager } from '../lib/task-manager';
import { printError, printSuccess } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError, NotFoundError } from '../lib/errors';
import { updateBodySection } from '../lib/markdown-sections';
import { readInput, launchEditor } from '../lib/utils';
import type { TaskUpdateInput, TaskStatus } from '../lib/types';

/**
 * Parse a key=value assignment
 */
function parseAssignment(assignment: string): {
  key: string;
  value: string;
  operation: 'set' | 'add' | 'remove';
} {
  // Check for += operation (add to array)
  if (assignment.includes('+=')) {
    const index = assignment.indexOf('+=');
    const key = assignment.substring(0, index);
    const value = assignment.substring(index + 2);
    if (!key) {
      throw new ValidationError(`Invalid += assignment format: ${assignment}`);
    }
    return { key: key.trim(), value: value.trim(), operation: 'add' };
  }

  // Check for -= operation (remove from array)
  if (assignment.includes('-=')) {
    const index = assignment.indexOf('-=');
    const key = assignment.substring(0, index);
    const value = assignment.substring(index + 2);
    if (!key) {
      throw new ValidationError(`Invalid -= assignment format: ${assignment}`);
    }
    return { key: key.trim(), value: value.trim(), operation: 'remove' };
  }

  // Default = operation (set value)
  if (assignment.includes('=')) {
    const index = assignment.indexOf('=');
    const key = assignment.substring(0, index);
    const value = assignment.substring(index + 1);
    if (!key) {
      throw new ValidationError(`Invalid = assignment format: ${assignment}`);
    }
    return { key: key.trim(), value: value.trim(), operation: 'set' };
  }

  throw new ValidationError(
    `Invalid assignment format: ${assignment}. Expected key=value, key+=value, or key-=value`
  );
}

/**
 * Validate field name
 */
function validateFieldName(key: string): void {
  const validFields = [
    'title',
    'content',
    'status',
    'tags',
    'dependencies',
    'description',
    'details',
    'validation'
  ];
  if (!validFields.includes(key)) {
    throw new ValidationError(`Unknown field: ${key}. Valid fields: ${validFields.join(', ')}`);
  }
}

/**
 * Parse value based on field type
 */
function parseValue(key: string, value: string): unknown {
  validateFieldName(key);

  switch (key) {
    case 'title':
    case 'content':
    case 'description':
    case 'details':
    case 'validation':
      if (value.length === 0) {
        throw new ValidationError(`${key} cannot be empty`);
      }
      return value;

    case 'status': {
      const validStatuses: TaskStatus[] = ['pending', 'in-progress', 'done'];
      if (!validStatuses.includes(value as TaskStatus)) {
        throw new ValidationError(
          `Invalid status: ${value}. Must be one of: ${validStatuses.join(', ')}`
        );
      }
      return value;
    }

    case 'tags':
      return value
        .split(',')
        .map((tag) => {
          const trimmed = tag.trim();
          if (trimmed.length === 0) {
            throw new ValidationError('Tag cannot be empty');
          }
          if (trimmed.length > 50) {
            throw new ValidationError(`Tag "${trimmed}" exceeds maximum length of 50 characters`);
          }
          return trimmed;
        })
        .filter((tag) => tag.length > 0);

    case 'dependencies':
      return value.split(',').map((dep) => {
        const id = parseInt(dep.trim(), 10);
        if (isNaN(id) || id <= 0) {
          throw new ValidationError(`Invalid dependency ID: ${dep.trim()}`);
        }
        return id;
      });

    default:
      throw new ValidationError(`Unknown field: ${key}`);
  }
}

/**
 * Update a task
 */
async function updateTask(
  idStr: string,
  assignments: string[],
  options: {
    title?: string;
    description?: string;
    details?: string;
    validation?: string;
    status?: string;
    tags?: string;
    deps?: string;
    editor?: boolean;
  }
): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Parse task ID
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError(`Invalid task ID: ${idStr}`);
    }

    // Check if no changes are specified and handle editor fallback
    const hasChanges =
      assignments.length > 0 ||
      options.title ||
      options.description ||
      options.details ||
      options.validation ||
      options.status ||
      options.tags ||
      options.deps;

    if (!hasChanges) {
      // Check if editor is enabled (default true, disabled with --no-editor)
      if (options.editor !== false) {
        try {
          // Launch editor with current task content as initial content
          const currentTask = await taskManager.get(id);
          const editorPrompt = `# Edit Task ${id}: ${currentTask.title}\n\n${currentTask.content || ''}`;
          const editedContent = await launchEditor(editorPrompt);

          // If user didn't change anything, exit without error
          if (editedContent === editorPrompt) {
            printError('No changes made');
            process.exit(2);
          }

          // Extract the content (remove the title comment)
          const lines = editedContent.split('\n');
          const contentStartIndex = lines.findIndex(
            (line) => line.trim() !== '' && !line.startsWith('#')
          );
          const newContent =
            contentStartIndex >= 0 ? lines.slice(contentStartIndex).join('\n').trim() : '';

          // Update the task with the new content
          await taskManager.update(id, { content: newContent });
          printSuccess(`Updated task ${id}`);
          return;
        } catch (error) {
          if (error instanceof Error) {
            printError(`Editor failed: ${error.message}`);
          } else {
            printError('Failed to launch editor');
          }
          process.exit(2);
        }
      } else {
        // Editor is disabled, exit with error
        printError('No changes specified');
        process.exit(2);
        return; // Ensure we don't continue execution
      }
    }

    // Get current task
    const currentTask = await taskManager.get(id);

    // Build update input
    const updates: TaskUpdateInput = {};

    // Process option-based updates
    if (options.title !== undefined) {
      updates.title = options.title;
    }

    // Handle body section updates with stdin support
    let updatedContent = currentTask.content || '';
    let contentModified = false;

    // Process description option (supports stdin with "-")
    if (options.description !== undefined) {
      try {
        const descContent = await readInput(options.description, false, '', 30000);
        if (descContent !== undefined) {
          // Validate that description is not empty after trimming
          if (descContent.trim().length === 0) {
            throw new ValidationError('description cannot be empty');
          }
          updatedContent = updateBodySection(updatedContent, 'description', descContent);
          contentModified = true;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(`Failed to read description input: ${error.message}`);
        }
        throw new ValidationError('Failed to read description input');
      }
    }

    // Process details option (supports stdin with "-")
    if (options.details !== undefined) {
      try {
        const detailsContent = await readInput(options.details, false, '', 30000);
        if (detailsContent !== undefined) {
          updatedContent = updateBodySection(updatedContent, 'details', detailsContent);
          contentModified = true;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(`Failed to read details input: ${error.message}`);
        }
        throw new ValidationError('Failed to read details input');
      }
    }

    // Process validation option (supports stdin with "-")
    if (options.validation !== undefined) {
      try {
        const validationContent = await readInput(options.validation, false, '', 30000);
        if (validationContent !== undefined) {
          updatedContent = updateBodySection(updatedContent, 'validation', validationContent);
          contentModified = true;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(`Failed to read validation input: ${error.message}`);
        }
        throw new ValidationError('Failed to read validation input');
      }
    }

    if (contentModified) {
      updates.content = updatedContent;
    }
    if (options.status !== undefined) {
      if (!['pending', 'in-progress', 'done'].includes(options.status)) {
        throw new ValidationError('Status must be one of: pending, in-progress, done');
      }
      updates.status = options.status as 'pending' | 'in-progress' | 'done';
    }
    if (options.tags !== undefined) {
      updates.tags = options.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
    if (options.deps !== undefined) {
      updates.dependencies = options.deps.split(',').map((dep) => {
        const depId = parseInt(dep.trim(), 10);
        if (isNaN(depId) || depId <= 0) {
          throw new ValidationError(`Invalid dependency ID: ${dep.trim()}`);
        }
        return depId;
      });
    }

    // Process assignment-based updates
    for (const assignment of assignments) {
      const { key, value, operation } = parseAssignment(assignment);

      if (operation === 'set') {
        const parsedValue = parseValue(key, value);

        // Handle body section fields
        if (key === 'description' || key === 'details' || key === 'validation') {
          if (!contentModified) {
            updatedContent = currentTask.content || '';
            contentModified = true;
          }
          updatedContent = updateBodySection(
            updatedContent,
            key,
            parsedValue as string
          );
          updates.content = updatedContent;
        } else {
          // Map field aliases to actual field names
          let fieldName = key;
          if (key === 'content') {
            fieldName = 'content';
          }
          (updates as Record<string, unknown>)[fieldName] = parsedValue;
        }
      } else if (operation === 'add') {
        // Add to array fields
        if (key === 'tags') {
          const newTags = value
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
          const existingTags = updates.tags || currentTask.tags || [];
          updates.tags = [...new Set([...existingTags, ...newTags])]; // Remove duplicates
        } else if (key === 'dependencies') {
          const newDeps = value.split(',').map((dep) => {
            const depId = parseInt(dep.trim(), 10);
            if (isNaN(depId) || depId <= 0) {
              throw new ValidationError(`Invalid dependency ID: ${dep.trim()}`);
            }
            return depId;
          });
          const existingDeps = updates.dependencies || currentTask.dependencies || [];
          updates.dependencies = [...new Set([...existingDeps, ...newDeps])]; // Remove duplicates
        } else {
          throw new ValidationError(
            `Cannot add to field: ${key}. Only tags and dependencies support += operation`
          );
        }
      } else if (operation === 'remove') {
        // Remove from array fields
        if (key === 'tags') {
          const tagsToRemove = value.split(',').map((tag) => tag.trim());
          const existingTags = updates.tags || currentTask.tags || [];
          updates.tags = existingTags.filter((tag: string) => !tagsToRemove.includes(tag));
        } else if (key === 'dependencies') {
          const depsToRemove = value.split(',').map((dep) => {
            const depId = parseInt(dep.trim(), 10);
            if (isNaN(depId) || depId <= 0) {
              throw new ValidationError(`Invalid dependency ID: ${dep.trim()}`);
            }
            return depId;
          });
          const existingDeps = updates.dependencies || currentTask.dependencies || [];
          updates.dependencies = existingDeps.filter((dep: number) => !depsToRemove.includes(dep));
        } else {
          throw new ValidationError(
            `Cannot remove from field: ${key}. Only tags and dependencies support -= operation`
          );
        }
      }
    }

    // Validate dependency cycles
    if (updates.dependencies) {
      await validateDependencies(taskManager, id, updates.dependencies);
    }

    // Apply updates
    await taskManager.update(id, updates);

    printSuccess(`Updated task ${id}`);
  } catch (error) {
    // Don't handle errors that come from process.exit calls (for testing)
    if (error instanceof Error && error.message.startsWith('Process.exit(')) {
      throw error;
    }

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
 * Validate dependencies to prevent cycles
 */
async function validateDependencies(
  taskManager: TaskManager,
  taskId: number,
  dependencies: number[]
): Promise<void> {
  // Check for self-dependency
  if (dependencies.includes(taskId)) {
    throw new ValidationError(`Task cannot depend on itself (ID: ${taskId})`);
  }

  // Check if all dependency tasks exist
  for (const depId of dependencies) {
    try {
      await taskManager.get(depId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new ValidationError(`Dependency task ${depId} does not exist`);
      }
      throw error;
    }
  }

  // TODO: Implement cycle detection for complex dependency chains
  // This would require traversing the dependency graph to detect cycles
}

/**
 * Create the update command
 */
export const updateCommand = new Command('update')
  .description(
    'Update a task with flexible options for metadata, content sections, and editor integration'
  )
  .argument('<id>', 'Task ID')
  .argument('[assignments...]', 'Field assignments (key=value, key+=value, key-=value)')
  .option('-t, --title <title>', 'Update task title')
  .option('-d, --description <text>', 'Update description: why & what - problem context, solution overview, and acceptance criteria (use - for stdin)')
  .option('--details <text>', 'Update details: how - implementation approach, technical design, and architecture notes (use - for stdin)')
  .option('--validation <text>', 'Update validation: testing strategy, verification steps, and quality checks (use - for stdin)')
  .option('-s, --status <status>', 'Update task status (pending, in-progress, done)')
  .option('--tags <tags>', 'Set task tags (comma-separated)')
  .option('--deps <dependencies>', 'Set task dependencies (comma-separated IDs)')
  .option('--no-editor', 'Disable editor fallback when no changes are specified')
  .action(async (id: string, assignments: string[], options) => {
    await updateTask(id, assignments, options);
  });
