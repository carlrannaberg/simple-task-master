import * as fs from 'fs/promises';
import * as path from 'path';
import { PATHS } from './constants';

/**
 * Find the STM workspace directory by searching up the directory tree
 * @param startDir - Directory to start searching from (defaults to current working directory)
 * @returns The path to the project root containing .simple-task-master, or null if not found
 */
export async function findWorkspaceRoot(startDir?: string): Promise<string | null> {
  let currentDir = path.resolve(startDir || process.cwd());
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const stmDir = path.join(currentDir, PATHS.BASE_DIR);
    try {
      const stats = await fs.stat(stmDir);
      if (stats.isDirectory()) {
        // Found the .simple-task-master directory
        return currentDir;
      }
    } catch {
      // Directory doesn't exist, continue searching
    }

    // Move up one directory
    currentDir = path.dirname(currentDir);
  }

  // Check the root directory as well
  const rootStmDir = path.join(root, PATHS.BASE_DIR);
  try {
    const stats = await fs.stat(rootStmDir);
    if (stats.isDirectory()) {
      return root;
    }
  } catch {
    // Not found
  }

  return null;
}

/**
 * Get the tasks directory path, searching up the directory tree if needed
 * @param startDir - Directory to start searching from
 * @returns The path to the tasks directory
 * @throws Error if no STM workspace is found
 */
export async function getTasksDirectory(startDir?: string): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(startDir);
  if (!workspaceRoot) {
    throw new Error('No STM workspace found. Run "stm init" to initialize a workspace.');
  }
  return PATHS.getTasksDir(workspaceRoot);
}

/**
 * Get the workspace root directory, searching up the directory tree if needed
 * @param startDir - Directory to start searching from
 * @returns The workspace root directory
 * @throws Error if no STM workspace is found
 */
export async function getWorkspaceRoot(startDir?: string): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(startDir);
  if (!workspaceRoot) {
    throw new Error('No STM workspace found. Run "stm init" to initialize a workspace.');
  }
  return workspaceRoot;
}
