import { TaskManager } from '@lib/task-manager';
import { LockManager } from '@lib/lock-manager';
import type { TaskManagerConfig } from '@lib/types';
import { getWorkspaceRoot } from '@lib/workspace';
import * as path from 'path';

/**
 * Performance-optimized LockManager with extended timeouts for large operations
 */
export class PerformanceLockManager extends LockManager {
  protected readonly LOCK_TIMEOUT_MS = 60000; // 60 seconds for performance tests
  protected readonly LOCK_CHECK_INTERVAL_MS = 100;
  protected readonly MAX_LOCK_RETRIES = 600; // 60 seconds total wait time
}

/**
 * Create a TaskManager instance optimized for performance testing
 */
export async function createPerformanceTaskManager(
  config: Partial<TaskManagerConfig> & { tasksDir: string }
): Promise<{ taskManager: TaskManager; lockManager: PerformanceLockManager }> {
  // Get the workspace root by searching from the tasks directory's parent
  const workspaceRoot = await getWorkspaceRoot(path.dirname(config.tasksDir));
  
  // Create performance-optimized lock manager
  const lockManager = new PerformanceLockManager(workspaceRoot);
  
  // Create full config with performance defaults
  const fullConfig: Required<TaskManagerConfig> = {
    tasksDir: config.tasksDir,
    maxTaskSizeBytes: config.maxTaskSizeBytes ?? 10485760, // 10MB
    maxTitleLength: config.maxTitleLength ?? 500,
    maxDescriptionLength: config.maxDescriptionLength ?? 131072 // 128KB
  };
  
  // Create TaskManager with our custom lock manager using the constructor directly
  // We need to use the constructor directly since the static create method creates its own lock manager
  const taskManager = new TaskManager(fullConfig, lockManager);
  
  return { taskManager, lockManager };
}

/**
 * Batch create tasks with optimized concurrency for performance tests
 */
export async function batchCreateTasks(
  taskManager: TaskManager,
  tasks: Array<{
    title: string;
    content?: string;
    tags?: string[];
    status?: 'pending' | 'in-progress' | 'done';
  }>,
  batchSize = 25
): Promise<void> {
  const numBatches = Math.ceil(tasks.length / batchSize);
  
  for (let batch = 0; batch < numBatches; batch++) {
    const startIdx = batch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, tasks.length);
    const batchTasks = tasks.slice(startIdx, endIdx);
    
    // Create tasks in this batch concurrently
    await Promise.all(batchTasks.map(task => taskManager.create(task)));
    
    // Small delay between batches to prevent lock contention
    if (batch < numBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

/**
 * Fast bulk create tasks for performance test setup
 * Uses a single lock acquisition for all tasks
 */
export async function fastBulkCreateTasks(
  taskManager: TaskManager,
  lockManager: PerformanceLockManager,
  tasks: Array<{
    title: string;
    content?: string;
    tags?: string[];
    status?: 'pending' | 'in-progress' | 'done';
  }>
): Promise<void> {
  // Acquire lock once for the entire operation
  await lockManager.acquire();
  
  try {
    // Access private properties for test setup
    // We need to access the internal config which is not exposed in the public API
    // Using a type assertion to access the private property
    interface TaskManagerInternal {
      config: {
        tasksDir: string;
        maxTaskSizeBytes: number;
        maxTitleLength: number;
        maxDescriptionLength: number;
      };
    }
    const taskManagerInternal = taskManager as unknown as TaskManagerInternal;
    const tasksDir = taskManagerInternal.config.tasksDir;
    
    // Ensure tasks directory exists
    const fs = await import('fs/promises');
    await fs.mkdir(tasksDir, { recursive: true });
    
    // Get current max ID
    const files = await fs.readdir(tasksDir);
    let maxId = 0;
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const match = file.match(/^(\d+)-/);
        if (match) {
          const id = parseInt(match[1], 10);
          if (id > maxId) maxId = id;
        }
      }
    }
    
    // Create all tasks with sequential IDs
    const createPromises = tasks.map(async (taskInput, index) => {
      const id = maxId + index + 1;
      const now = new Date().toISOString();
      
      const task = {
        schema: 1,
        id,
        title: taskInput.title,
        status: taskInput.status ?? 'pending',
        created: now,
        updated: now,
        tags: taskInput.tags ?? [],
        dependencies: []
      };
      
      // Generate filename
      const slug = taskInput.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
      const filename = `${id}-${slug || 'task'}.md`;
      const filepath = path.join(tasksDir, filename);
      
      // Serialize to markdown
      const { FrontmatterParser } = await import('@lib/frontmatter-parser');
      const content = taskInput.content || '';
      const fileContent = FrontmatterParser.stringify(content, task);
      
      // Write file
      await fs.writeFile(filepath, fileContent, 'utf8');
    });
    
    await Promise.all(createPromises);
  } finally {
    await lockManager.release();
  }
}