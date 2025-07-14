import * as fs from 'fs/promises';
import * as path from 'path';
import { constants } from 'fs';

interface LockFile {
  pid: number;
  command: string;
  timestamp: number;
}

interface NodeError extends Error {
  code?: string;
}

export class LockManager {
  private readonly lockPath: string;
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 seconds default
  private readonly LOCK_CHECK_INTERVAL_MS = 100; // Retry interval
  private readonly MAX_LOCK_RETRIES = 100; // 10 seconds total wait
  
  // Global registry of all LockManager instances to clean up on exit
  private static instances = new Set<LockManager>();
  private static globalCleanupHandlersSetup = false;

  constructor(projectRoot: string) {
    this.lockPath = path.join(projectRoot, '.simple-task-master', 'lock');
    
    // Register this instance for cleanup
    LockManager.instances.add(this);
    
    // Set up global cleanup handlers once
    if (!LockManager.globalCleanupHandlersSetup) {
      this.setupGlobalCleanupHandlers();
      LockManager.globalCleanupHandlersSetup = true;
    }
  }

  /**
   * Acquire a lock for exclusive operations.
   * Uses atomic file creation with O_EXCL flag.
   * Retries with 100ms intervals up to 50 times (5 seconds total).
   * Automatically cleans up stale locks.
   */
  async acquire(): Promise<void> {
    const lockData: LockFile = {
      pid: process.pid,
      command: process.argv.join(' '),
      timestamp: Date.now(),
    };

    let retries = 0;
    while (retries < this.MAX_LOCK_RETRIES) {
      try {
        // Check for stale locks before attempting to create
        if (await this.exists()) {
          const existingLock = await this.read();
          const age = Date.now() - existingLock.timestamp;

          if (age > this.LOCK_TIMEOUT_MS) {
            console.warn(`Removing stale lock (age: ${age}ms, pid: ${existingLock.pid})`);
            await this.forceRelease();
          } else if (!this.isProcessAlive(existingLock.pid)) {
            // Process is dead, but lock is recent - give it a moment to clean up
            if (age > 500) {
              console.warn(
                `Removing stale lock from dead process (age: ${age}ms, pid: ${existingLock.pid})`
              );
              await this.forceRelease();
            } else {
              // Lock is fresh but process is dead - wait a bit for cleanup
              retries++;
              await this.sleep(this.LOCK_CHECK_INTERVAL_MS);
              continue;
            }
          } else {
            // Lock is still valid, wait and retry
            retries++;
            await this.sleep(this.LOCK_CHECK_INTERVAL_MS);
            continue;
          }
        }

        // Attempt to create lock file atomically with O_EXCL flag
        const lockContent = JSON.stringify(lockData, null, 2);
        const fileHandle = await fs.open(
          this.lockPath,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
        );
        await fileHandle.write(lockContent);
        await fileHandle.close();

        // Lock acquired successfully
        return;
      } catch (error) {
        const nodeError = error as NodeError;
        if (nodeError.code === 'EEXIST') {
          // Lock file exists, retry after checking if it's stale
          retries++;
          if (retries >= this.MAX_LOCK_RETRIES) {
            const error = new Error(
              `Failed to acquire lock after ${this.MAX_LOCK_RETRIES} retries (${this.MAX_LOCK_RETRIES * this.LOCK_CHECK_INTERVAL_MS}ms). ` +
                'Another process is holding the lock.'
            );
            throw error;
          }
          await this.sleep(this.LOCK_CHECK_INTERVAL_MS);
        } else if (nodeError.code === 'ENOENT') {
          // Directory doesn't exist, create it and retry
          await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
          // Don't increment retries for directory creation
        } else {
          // Other errors should be thrown
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to acquire lock after ${this.MAX_LOCK_RETRIES} retries (${this.MAX_LOCK_RETRIES * this.LOCK_CHECK_INTERVAL_MS}ms). ` +
        'Another process is holding the lock.'
    );
  }

  /**
   * Release the lock by removing the lock file.
   * Only releases if the current process owns the lock.
   */
  async release(): Promise<void> {
    try {
      const lockData = await this.read();

      // Only release if we own the lock
      if (lockData.pid === process.pid) {
        await fs.unlink(this.lockPath);
      }
    } catch (error) {
      const nodeError = error as NodeError;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
      // Lock file doesn't exist, nothing to release
    }
  }

  /**
   * Check if a lock file exists
   */
  private async exists(): Promise<boolean> {
    try {
      await fs.access(this.lockPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read and parse the lock file
   */
  private async read(): Promise<LockFile> {
    try {
      const content = await fs.readFile(this.lockPath, 'utf8');
      const parsed = JSON.parse(content);
      
      // Validate required fields and provide defaults
      const lockFile: LockFile = {
        pid: parsed.pid || 0,
        command: parsed.command || 'unknown',
        timestamp: parsed.timestamp || 0
      };
      
      // If any critical field is missing or invalid, treat as stale
      if (!lockFile.pid || !lockFile.timestamp) {
        return {
          pid: 99999, // Non-existent PID
          command: 'stale-corrupted',
          timestamp: 0 // Very old timestamp
        };
      }
      
      return lockFile;
    } catch (error) {
      // If we can't parse the file, treat it as stale
      return {
        pid: 99999, // Non-existent PID  
        command: 'stale-corrupted',
        timestamp: 0 // Very old timestamp
      };
    }
  }

  /**
   * Force release a lock without checking ownership
   */
  private async forceRelease(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch (error) {
      const nodeError = error as NodeError;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if a process with the given PID is still alive
   */
  private isProcessAlive(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const nodeError = error as NodeError;
      // ESRCH means "No such process"
      if (nodeError.code === 'ESRCH') {
        return false;
      }
      // EPERM means "Operation not permitted" - process exists but we can't signal it
      if (nodeError.code === 'EPERM') {
        return true;
      }
      // Other errors indicate the process might exist
      return true;
    }
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeoutId = global.setTimeout(resolve, ms);
      // Node.js will keep the event loop alive until the timeout fires
      if (timeoutId && typeof timeoutId === 'object' && 'unref' in timeoutId) {
        // Don't prevent process exit if this is the only thing keeping it alive
        timeoutId.unref();
      }
    });
  }

  /**
   * Setup global cleanup handlers to release all locks on process exit
   */
  private setupGlobalCleanupHandlers(): void {
    const cleanup = async (): Promise<void> => {
      // Clean up all registered lock managers
      const cleanupPromises = Array.from(LockManager.instances).map(async (instance) => {
        try {
          await instance.release();
        } catch {
          // Ignore errors during cleanup
        }
      });
      await Promise.all(cleanupPromises);
    };

    // Handle various exit scenarios
    process.once('exit', () => cleanup());
    process.once('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    process.once('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });
    process.once('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await cleanup();
      process.exit(1);
    });
    process.once('unhandledRejection', async (reason) => {
      console.error('Unhandled rejection:', reason);
      await cleanup();
      process.exit(1);
    });
  }
  
  /**
   * Remove this instance from cleanup registry (for testing)
   */
  dispose(): void {
    LockManager.instances.delete(this);
  }
}
