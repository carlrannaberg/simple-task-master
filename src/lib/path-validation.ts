/**
 * Path validation utilities for STM
 */

import * as path from 'path';
import * as fs from 'fs';
import { ValidationError } from './errors';

/**
 * Validates the custom tasks directory path
 * @param tasksDir - The proposed tasks directory path
 * @returns The normalized tasks directory path
 * @throws ValidationError if the path is invalid
 */
export function validateTasksDir(tasksDir: string): string {
  // Prevent directory traversal attacks - check before normalization
  if (tasksDir.includes('..')) {
    throw new ValidationError(
      'Tasks directory path cannot contain directory traversal sequences (..)'
    );
  }

  // Normalize the path and remove trailing slashes
  const normalized = path.normalize(tasksDir).replace(/\/+$/, '');

  // Prevent absolute paths outside the project
  if (path.isAbsolute(normalized)) {
    // Allow absolute paths only if they're not system directories
    // For shared directories, we'll be more permissive and allow sibling directories

    // First, check if it's a system directory (but allow temp directories for testing)
    const isTempDir = normalized.includes('/tmp/') ||
                      normalized.includes('\\Temp\\') ||
                      normalized.includes('\\TEMP\\') ||
                      normalized.includes('/var/folders/') || // macOS temp directories
                      normalized.includes('/private/var/folders/'); // macOS private temp

    const systemPaths = ['/', '/etc', '/usr', '/bin', '/sbin', '/dev', '/proc', '/sys'];
    const isSystemPath = systemPaths.some((sysPath) =>
      normalized === sysPath || normalized.startsWith(sysPath + path.sep)
    );

    if (isSystemPath && !isTempDir) {
      throw new ValidationError('Cannot use system directories for task storage');
    }

    // For non-system paths, allow more flexibility for shared directories
    // Only reject if the path is clearly outside any reasonable project structure
    const cwd = fs.realpathSync(process.cwd());

    try {
      // Try to find a common root between cwd and the target path
      const normalizedDir = path.dirname(normalized);
      let resolvedDir: string;
      try {
        resolvedDir = fs.realpathSync(normalizedDir);
      } catch {
        resolvedDir = path.resolve(normalizedDir);
      }
      const resolvedPath = path.join(resolvedDir, path.basename(normalized));

      // Calculate relative path from cwd to target
      const relative = path.relative(cwd, resolvedPath);

      // Allow paths that go up but not too far (max 5 levels up for shared directories)
      const upLevels = relative.split(path.sep).filter((part) => part === '..').length;
      if (upLevels > 5) {
        throw new ValidationError('Absolute paths too far outside the project directory');
      }
    } catch {
      // If we can't resolve paths, be conservative and reject
      throw new ValidationError('Invalid absolute path for task storage');
    }
  }

  // Ensure the path doesn't point to a file
  // We'll check this during actual creation, but validate obvious cases
  if (
    normalized.includes('.') &&
    (normalized.endsWith('.json') || normalized.endsWith('.md') || normalized.endsWith('.txt'))
  ) {
    throw new ValidationError('Tasks directory path appears to be a file, not a directory');
  }

  return normalized;
}
