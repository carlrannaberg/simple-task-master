/**
 * Utility functions for Simple Task Master
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ValidationError, FileSystemError } from './errors';

/**
 * Validates that a path is safe and within allowed directories
 */
export function validatePath(filePath: string): string {
  const normalized = path.normalize(filePath);

  // Prevent path traversal attacks
  if (normalized.includes('..')) {
    throw new ValidationError('Path contains directory traversal sequences');
  }

  // Ensure path is absolute or relative to current directory
  if (path.isAbsolute(normalized)) {
    throw new ValidationError('Absolute paths are not allowed');
  }

  return normalized;
}

/**
 * Ensures a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (mkdirError) {
        throw new FileSystemError(`Failed to create directory: ${dirPath}`, mkdirError as Error);
      }
    } else {
      throw new FileSystemError(`Failed to access directory: ${dirPath}`, error as Error);
    }
  }
}

/**
 * Safely reads a file with error handling
 */
export async function safeReadFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      throw new FileSystemError(`File not found: ${filePath}`);
    }
    throw new FileSystemError(`Failed to read file: ${filePath}`, error as Error);
  }
}

/**
 * Checks if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the size of a file in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new FileSystemError(`Failed to get file size: ${filePath}`, error as Error);
  }
}

/**
 * Formats a timestamp to ISO string
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Parses an ISO timestamp string
 */
export function parseTimestamp(timestamp: string): Date {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid timestamp format: ${timestamp}`);
  }
  return date;
}

/**
 * Sanitizes a string for use as a filename
 */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[<>:"|?*]/g, '-')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Truncates a string to a maximum length
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>): void => {
    const later = (): void => {
      timeout = undefined;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error = new Error('Retry failed');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
