/**
 * Delete task command
 */

import { Command } from 'commander';
import { TaskManager } from '../lib/task-manager';
import { printError, printSuccess } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError, NotFoundError } from '../lib/errors';

interface DeleteOptions {
  force?: boolean;
}

/**
 * Validate that no other tasks depend on the target task
 */
async function validateNoDependents(taskManager: TaskManager, taskId: string): Promise<void> {
  const allTasks = await taskManager.list();
  const dependents = allTasks.filter((task) =>
    task.dependencies?.includes(parseInt(taskId)) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (task as any).depends_on?.includes(taskId) // Handle unknown fields
  );

  if (dependents.length > 0) {
    const dependentTitles = dependents.map((t) => `${t.id}: ${t.title}`).join(', ');
    throw new ValidationError(
      `Cannot delete task: ${dependents.length} task(s) depend on it (${dependentTitles}). Use --force to delete anyway.`
    );
  }
}

/**
 * Delete a task
 */
async function deleteTask(idStr: string, options: DeleteOptions): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Parse task ID
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError(`Invalid task ID: ${idStr}`);
    }

    // Get the task first to verify it exists and show what will be deleted
    const task = await taskManager.get(id);

    // Check for dependencies unless --force is used
    if (!options.force) {
      await validateNoDependents(taskManager, idStr);
    }

    // Perform the deletion
    await taskManager.delete(id);

    printSuccess(`Deleted task ${id}: "${task.title}"`);
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
 * Create the delete command
 */
export const deleteCommand = new Command('delete')
  .description('Delete a task permanently')
  .argument('<id>', 'Task ID to delete')
  .option('-f, --force', 'Force deletion even if other tasks depend on it')
  .action(async (id: string, options: DeleteOptions) => {
    await deleteTask(id, options);
  });
