/**
 * Custom error classes for Simple Task Master
 */

/**
 * Base error class for STM-specific errors
 */
export abstract class STMError extends Error {
  abstract readonly code: string;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;

    if (cause) {
      this.cause = cause;
    }

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends STMError {
  readonly code = 'VALIDATION_ERROR';
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends STMError {
  readonly code = 'FILESYSTEM_ERROR';
}

/**
 * Error thrown when a task is not found
 */
export class NotFoundError extends STMError {
  readonly code = 'NOT_FOUND';
}

/**
 * Error thrown when lock operations fail
 */
export class LockError extends STMError {
  readonly code = 'LOCK_ERROR';
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends STMError {
  readonly code = 'CONFIGURATION_ERROR';
}

/**
 * Global error handler for unhandled errors
 */
export function handleGlobalError(error: Error): never {
  console.error('Fatal error:', error.message);

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.error('Stack trace:', error.stack);
  }

  process.exit(1);
}

/**
 * Type guard to check if an error is an STM error
 */
export function isSTMError(error: unknown): error is STMError {
  return error instanceof STMError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode<T extends string>(
  error: unknown,
  code: T
): error is STMError & { code: T } {
  return isSTMError(error) && error.code === code;
}
