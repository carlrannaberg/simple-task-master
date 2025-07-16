import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * Enhanced temporary directory management utilities for testing
 */

/**
 * Temporary directory manager with automatic cleanup
 */
export class TempDirManager {
  private directories = new Set<string>();
  private cleanupOnExit = true;
  private cleanupListeners: {
    exit: () => void;
    sigint: () => Promise<void>;
    sigterm: () => Promise<void>;
    uncaughtException: () => Promise<void>;
    unhandledRejection: () => Promise<void>;
  } | null = null;

  constructor(options: { cleanupOnExit?: boolean } = {}) {
    this.cleanupOnExit = options.cleanupOnExit ?? true;

    if (this.cleanupOnExit) {
      this.setupCleanupHandlers();
    }
  }

  /**
   * Create a new temporary directory
   */
  async create(prefix = 'stm-test-'): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), prefix));
    this.directories.add(tempDir);
    return tempDir;
  }

  /**
   * Create a temporary directory with a specific structure
   */
  async createWithStructure(structure: DirectoryStructure, prefix = 'stm-test-'): Promise<string> {
    const tempDir = await this.create(prefix);
    await this.createStructure(tempDir, structure);
    return tempDir;
  }

  /**
   * Remove a specific temporary directory
   */
  async remove(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      this.directories.delete(tempDir);
    } catch (error) {
      console.warn(`Failed to remove temp directory ${tempDir}: ${error}`);
    }
  }

  /**
   * Remove all managed temporary directories
   */
  async removeAll(): Promise<void> {
    const cleanupPromises = Array.from(this.directories).map((dir) => this.remove(dir));
    await Promise.allSettled(cleanupPromises);
    this.directories.clear();
  }

  /**
   * Get all managed directories
   */
  getAll(): string[] {
    return Array.from(this.directories);
  }

  /**
   * Check if a directory is managed by this instance
   */
  isManaged(dir: string): boolean {
    return this.directories.has(dir);
  }

  /**
   * Get the count of managed directories
   */
  count(): number {
    return this.directories.size;
  }

  /**
   * Dispose of event listeners and cleanup resources
   */
  dispose(): void {
    if (this.cleanupListeners) {
      process.removeListener('exit', this.cleanupListeners.exit);
      process.removeListener('SIGINT', this.cleanupListeners.sigint);
      process.removeListener('SIGTERM', this.cleanupListeners.sigterm);
      process.removeListener('uncaughtException', this.cleanupListeners.uncaughtException);
      process.removeListener('unhandledRejection', this.cleanupListeners.unhandledRejection);
      this.cleanupListeners = null;
    }
  }

  private setupCleanupHandlers(): void {
    const cleanup = async (): Promise<void> => {
      await this.removeAll();
    };

    // Create listener functions to store references for cleanup
    const exitListener = (): void => {
      // Synchronous cleanup for exit
      for (const dir of this.directories) {
        try {
          require('fs').rmSync(dir, { recursive: true, force: true });
        } catch {
          // Ignore errors during exit cleanup
        }
      }
    };

    const sigintListener = async (): Promise<void> => {
      await cleanup();
    };

    const sigtermListener = async (): Promise<void> => {
      await cleanup();
    };

    const uncaughtExceptionListener = async (): Promise<void> => {
      await cleanup();
    };

    const unhandledRejectionListener = async (): Promise<void> => {
      await cleanup();
    };

    // Store references for cleanup
    this.cleanupListeners = {
      exit: exitListener,
      sigint: sigintListener,
      sigterm: sigtermListener,
      uncaughtException: uncaughtExceptionListener,
      unhandledRejection: unhandledRejectionListener
    };

    process.on('exit', exitListener);
    process.on('SIGINT', sigintListener);
    process.on('SIGTERM', sigtermListener);
    process.on('uncaughtException', uncaughtExceptionListener);
    process.on('unhandledRejection', unhandledRejectionListener);
  }

  private async createStructure(baseDir: string, structure: DirectoryStructure): Promise<void> {
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(baseDir, name);

      if (typeof content === 'string') {
        // It's a file
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf8');
      } else if (content === null) {
        // It's a directory
        await fs.mkdir(fullPath, { recursive: true });
      } else {
        // It's a nested structure
        await fs.mkdir(fullPath, { recursive: true });
        await this.createStructure(fullPath, content);
      }
    }
  }
}

/**
 * Directory structure type for creating test environments
 */
export type DirectoryStructure = {
  [name: string]: string | DirectoryStructure | null;
};

/**
 * Utility functions for temporary directory operations
 */
export const tempUtils = {
  /**
   * Create a temporary directory with automatic cleanup
   */
  async withTempDir<T>(fn: (tempDir: string) => Promise<T>, prefix = 'stm-test-'): Promise<T> {
    const manager = new TempDirManager({ cleanupOnExit: false });
    const tempDir = await manager.create(prefix);

    try {
      return await fn(tempDir);
    } finally {
      await manager.remove(tempDir);
    }
  },

  /**
   * Create a temporary directory with a specific structure
   */
  async withTempDirAndStructure<T>(
    structure: DirectoryStructure,
    fn: (tempDir: string) => Promise<T>,
    prefix = 'stm-test-'
  ): Promise<T> {
    const manager = new TempDirManager({ cleanupOnExit: false });
    const tempDir = await manager.createWithStructure(structure, prefix);

    try {
      return await fn(tempDir);
    } finally {
      await manager.remove(tempDir);
    }
  },

  /**
   * Create a temporary STM workspace
   */
  async withSTMWorkspace<T>(
    fn: (workspaceDir: string) => Promise<T>,
    config?: Record<string, unknown>
  ): Promise<T> {
    const structure: DirectoryStructure = {
      '.simple-task-master': {
        'config.json': JSON.stringify(
          config || {
            schema: 1,
            lockTimeoutMs: 5000,
            maxTaskSizeBytes: 1048576
          },
          null,
          2
        ),
        tasks: null
      }
    };

    return this.withTempDirAndStructure(structure, fn);
  },

  /**
   * Create a temporary directory with sample tasks
   */
  async withSampleTasks<T>(fn: (workspaceDir: string) => Promise<T>, taskCount = 5): Promise<T> {
    const structure: DirectoryStructure = {
      '.simple-task-master': {
        'config.json': JSON.stringify(
          {
            schema: 1,
            lockTimeoutMs: 5000,
            maxTaskSizeBytes: 1048576
          },
          null,
          2
        ),
        tasks: null
      }
    };

    // Add sample task files
    for (let i = 1; i <= taskCount; i++) {
      const taskFile = `${i}-sample-task-${i}.md`;
      const taskContent = `---
schema: 1
id: ${i}
title: Sample Task ${i}
status: ${i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending'}
created: ${new Date().toISOString()}
updated: ${new Date().toISOString()}
tags:
  - sample
  - test
dependencies: []
---

# Sample Task ${i}

This is a sample task created for testing purposes.

## Description
Task ${i} demonstrates the task file format and structure.

## Notes
- This is a test task
- Generated automatically
- Used for testing purposes`;

      (structure['.simple-task-master'] as DirectoryStructure)['tasks/' + taskFile] = taskContent;
    }

    return this.withTempDirAndStructure(structure, fn);
  },

  /**
   * Copy a directory structure to a temporary location
   */
  async copyToTemp(sourcePath: string, prefix = 'stm-copy-'): Promise<string> {
    const manager = new TempDirManager({ cleanupOnExit: false });
    const tempDir = await manager.create(prefix);

    await this.copyDirectory(sourcePath, tempDir);
    return tempDir;
  },

  /**
   * Recursively copy a directory
   */
  async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  },

  /**
   * Get the size of a directory in bytes
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  },

  /**
   * List all files in a directory recursively
   */
  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (currentPath: string): Promise<void> => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const relativePath = path.relative(dirPath, fullPath);
          if (!extension || fullPath.endsWith(extension)) {
            files.push(relativePath);
          }
        }
      }
    };

    await walk(dirPath);
    return files.sort();
  },

  /**
   * Check if a directory is empty
   */
  async isEmpty(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.length === 0;
    } catch {
      return true; // Directory doesn't exist, so it's "empty"
    }
  },

  /**
   * Ensure a directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  },

  /**
   * Remove a directory and all its contents
   */
  async removeDir(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true });
  }
};

/**
 * Global temporary directory manager instance
 */
export const globalTempManager = new TempDirManager();

/**
 * Dispose of the global temporary directory manager
 */
export function disposeGlobalTempManager(): void {
  globalTempManager.dispose();
}

/**
 * Convenience functions using the global manager
 */
export const temp = {
  /**
   * Create a temporary directory using the global manager
   */
  create: (prefix?: string) => globalTempManager.create(prefix),

  /**
   * Create a temporary directory with structure using the global manager
   */
  createWithStructure: (structure: DirectoryStructure, prefix?: string) =>
    globalTempManager.createWithStructure(structure, prefix),

  /**
   * Remove a directory from the global manager
   */
  remove: (tempDir: string) => globalTempManager.remove(tempDir),

  /**
   * Remove all directories from the global manager
   */
  removeAll: () => globalTempManager.removeAll(),

  /**
   * Get all managed directories
   */
  getAll: () => globalTempManager.getAll(),

  /**
   * Get count of managed directories
   */
  count: () => globalTempManager.count(),

  /**
   * Create a directory (alias for create for backward compatibility)
   */
  createDirectory: (prefix?: string) => globalTempManager.create(prefix),

  /**
   * Clean up a directory (alias for remove for backward compatibility)
   */
  cleanup: (tempDir: string) => globalTempManager.remove(tempDir)
};
