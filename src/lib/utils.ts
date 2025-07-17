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

/**
 * Reads input from stdin with optional timeout
 */
export async function readStdin(timeoutMs: number = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = '';
    let timeoutId: NodeJS.Timeout | null = null;
    let finished = false;

    const finish = (result?: string | Error): void => {
      if (finished) return;
      finished = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Remove all listeners to clean up
      try {
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('error');

        // Try to pause stdin to stop any pending reads
        if (process.stdin.readable) {
          process.stdin.pause();
        }
      } catch {
        // Ignore cleanup errors - they might occur if stdin is already closed
        // This prevents EPIPE errors during cleanup
      }

      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result || input.trim());
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      finish(new Error(`Stdin input timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    // Handle stdin data
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });

    process.stdin.on('end', () => {
      finish();
    });

    process.stdin.on('error', (error) => {
      // Handle EPIPE errors gracefully - this occurs when the writing process
      // has already closed the pipe but we're trying to read from it
      if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
        // EPIPE on stdin read side is less common, but handle it gracefully
        finish(new Error('Input stream was closed prematurely'));
      } else {
        finish(new Error(`Failed to read from stdin: ${error.message}`));
      }
    });

    // Start reading
    process.stdin.resume();
  });
}

/**
 * Launches an external editor to get user input
 */
export async function launchEditor(initialContent: string = ''): Promise<string> {
  const { spawn } = await import('child_process');
  const { writeFile, readFile, unlink } = await import('fs/promises');
  const { join } = await import('path');
  const { tmpdir } = await import('os');

  // Create a temporary file
  const tempFile = join(tmpdir(), `stm-edit-${Date.now()}.md`);

  try {
    // Write initial content to temp file
    await writeFile(tempFile, initialContent, 'utf8');

    // Determine editor to use
    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';

    // Launch editor
    await new Promise<void>((resolve, reject) => {
      const editorProcess = spawn(editor, [tempFile], {
        stdio: 'inherit',
        shell: true
      });

      editorProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Editor exited with code ${code}`));
        }
      });

      editorProcess.on('error', (error) => {
        reject(new Error(`Failed to launch editor: ${error.message}`));
      });
    });

    // Read the edited content
    const content = await readFile(tempFile, 'utf8');
    return content.trim();
  } finally {
    // Clean up temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Reads input from either a direct value, stdin (if value is "-"), or editor fallback
 */
export async function readInput(
  value: string | undefined,
  fallbackToEditor: boolean = false,
  editorPrompt: string = '',
  stdinTimeoutMs: number = 30000
): Promise<string | undefined> {
  // If no value provided and fallback to editor is disabled, return undefined
  if (value === undefined && !fallbackToEditor) {
    return undefined;
  }

  // If value is "-", read from stdin
  if (value === '-') {
    try {
      return await readStdin(stdinTimeoutMs);
    } catch (error) {
      if (fallbackToEditor) {
        // Fallback to editor if stdin fails
        return await launchEditor(editorPrompt);
      }
      throw error;
    }
  }

  // If value is provided and not "-", return it directly
  if (value !== undefined) {
    return value;
  }

  // If no value provided but fallback is enabled, launch editor
  if (fallbackToEditor) {
    return await launchEditor(editorPrompt);
  }

  return undefined;
}
