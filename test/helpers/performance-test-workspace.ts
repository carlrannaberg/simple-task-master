import { TestWorkspace } from './test-workspace';
import { TaskManager } from '@lib/task-manager';
import { LockManager } from '@lib/lock-manager';
import type { TaskManagerConfig, TaskCreateInput } from '@lib/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * Extended test workspace optimized for performance testing
 */
export class PerformanceTestWorkspace extends TestWorkspace {
  private perfTaskManager: TaskManager | null = null;
  private perfLockManager: LockManager | null = null;

  /**
   * Create a new performance test workspace
   */
  static async create(prefix = 'perf-test-'): Promise<PerformanceTestWorkspace> {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), prefix));
    const workspace = new PerformanceTestWorkspace(tempDir);
    await workspace.init();
    return workspace;
  }

  /**
   * Performance-optimized LockManager with extended timeouts
   */
  private createPerformanceLockManager(): LockManager {
    // Create a custom lock manager with extended timeouts
    class PerformanceLockManager extends LockManager {
      protected readonly LOCK_TIMEOUT_MS = 60000; // 60 seconds
      protected readonly LOCK_CHECK_INTERVAL_MS = 50; // Faster checks
      protected readonly MAX_LOCK_RETRIES = 1200; // 60 seconds total
    }

    return new PerformanceLockManager(this.directory);
  }

  /**
   * Get or create the performance-optimized TaskManager instance
   */
  async getPerformanceTaskManager(): Promise<TaskManager> {
    if (!this.perfTaskManager) {
      // Create lock manager if not exists
      if (!this.perfLockManager) {
        this.perfLockManager = this.createPerformanceLockManager();
      }

      const config: Required<TaskManagerConfig> = {
        tasksDir: this.tasksDirectory,
        maxTaskSizeBytes: 10485760, // 10MB
        maxTitleLength: 500,
        maxDescriptionLength: 131072 // 128KB
      };

      // Use the constructor directly to inject our custom lock manager
      this.perfTaskManager = new TaskManager(config, this.perfLockManager);
    }

    return this.perfTaskManager;
  }

  /**
   * Batch create tasks with progress logging
   */
  async batchCreateTasks(tasks: TaskCreateInput[], batchSize = 25): Promise<void> {
    const taskManager = await this.getPerformanceTaskManager();
    const totalBatches = Math.ceil(tasks.length / batchSize);

    console.warn(`Creating ${tasks.length} tasks in ${totalBatches} batches...`);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, tasks.length);
      const batch = tasks.slice(start, end);

      // Create batch concurrently
      await Promise.all(batch.map((task) => taskManager.create(task)));

      // Log progress every 10 batches
      if ((i + 1) % 10 === 0 || i === totalBatches - 1) {
        console.warn(`Progress: ${end}/${tasks.length} tasks created`);
      }

      // Small delay between batches to prevent contention
      if (i < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
  }

  /**
   * Clean up the workspace including lock manager
   */
  async cleanup(): Promise<void> {
    // Clean up lock manager first
    if (this.perfLockManager) {
      try {
        await this.perfLockManager.release();
        this.perfLockManager.dispose();
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Call parent cleanup
    await super.cleanup();
  }
}
