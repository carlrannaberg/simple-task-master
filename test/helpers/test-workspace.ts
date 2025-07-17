import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import type { Task, TaskCreateInput, TaskUpdateInput } from '@lib/types';
import { TaskManager } from '@lib/task-manager';
import { runSTM } from './cli-runner';

/**
 * TestWorkspace provides an isolated environment for testing task operations.
 * Each workspace gets its own temporary directory and STM configuration.
 */
export class TestWorkspace {
  private tempDir: string;
  private taskManager: TaskManager | null = null;
  private originalCwd: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
    this.originalCwd = process.cwd();
  }

  /**
   * Create a new isolated test workspace
   */
  static async create(prefix = 'stm-test-'): Promise<TestWorkspace> {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), prefix));
    const workspace = new TestWorkspace(tempDir);

    // Initialize STM in the workspace (don't change working directory)
    await workspace.initializeSTM();

    return workspace;
  }

  /**
   * Initialize the workspace (for backward compatibility)
   */
  async init(): Promise<void> {
    await this.initializeSTM();
  }

  /**
   * Initialize STM configuration in the workspace
   */
  private async initializeSTM(): Promise<void> {
    const stmDir = path.join(this.tempDir, '.simple-task-master');
    await fs.mkdir(stmDir, { recursive: true });

    // Create default config with extended timeout for tests
    const config = {
      schema: 1,
      lockTimeoutMs: 30000, // 30 seconds for test environments
      maxTaskSizeBytes: 1048576
    };

    await fs.writeFile(path.join(stmDir, 'config.json'), JSON.stringify(config, null, 2), 'utf8');

    // Create tasks directory
    await fs.mkdir(path.join(stmDir, 'tasks'), { recursive: true });
  }

  /**
   * Clean up the workspace
   */
  async cleanup(): Promise<void> {
    // Clean up any locks first
    await this.cleanupLocks();
    
    // Remove temporary directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up test workspace: ${error}`);
    }
  }
  
  /**
   * Clean up any stale locks in the workspace
   */
  async cleanupLocks(): Promise<void> {
    const lockPath = path.join(this.tempDir, '.simple-task-master', 'lock');
    try {
      await fs.unlink(lockPath);
    } catch {
      // Ignore if lock doesn't exist
    }
  }

  /**
   * Get the workspace directory path
   */
  get directory(): string {
    return this.tempDir;
  }

  /**
   * Get the STM directory path
   */
  get stmDirectory(): string {
    return path.join(this.tempDir, '.simple-task-master');
  }

  /**
   * Get the tasks directory path
   */
  get tasksDirectory(): string {
    return path.join(this.tempDir, '.simple-task-master', 'tasks');
  }

  /**
   * Get or create the TaskManager instance
   */
  private async getTaskManager(): Promise<TaskManager> {
    if (!this.taskManager) {
      this.taskManager = await TaskManager.create({
        tasksDir: path.join(this.tempDir, '.simple-task-master', 'tasks')
      });
    }
    return this.taskManager;
  }

  /**
   * Add a task using the TaskManager
   */
  async addTask(input: TaskCreateInput): Promise<Task> {
    const taskManager = await this.getTaskManager();
    return taskManager.create(input);
  }

  /**
   * Get a task by ID using the TaskManager
   */
  async getTask(id: number): Promise<Task> {
    const taskManager = await this.getTaskManager();
    return taskManager.get(id);
  }

  /**
   * Update a task using the TaskManager
   */
  async updateTask(id: number, updates: TaskUpdateInput): Promise<Task> {
    const taskManager = await this.getTaskManager();
    return taskManager.update(id, updates);
  }

  /**
   * List tasks using the TaskManager
   */
  async listTasks(): Promise<Task[]> {
    const taskManager = await this.getTaskManager();
    return taskManager.list();
  }

  /**
   * Delete a task using the TaskManager
   */
  async deleteTask(id: number): Promise<void> {
    const taskManager = await this.getTaskManager();
    return taskManager.delete(id);
  }

  /**
   * Add a task using the CLI
   */
  async addTaskCLI(
    title: string,
    options: {
      content?: string;
      description?: string;
      tags?: string[];
      status?: string;
    } = {}
  ): Promise<number> {
    const args = ['add', title];

    // Use content or description (content takes precedence)
    const desc = options.content || options.description;
    if (desc) {
      args.push('--description', desc);
    }

    if (options.tags && options.tags.length > 0) {
      args.push('--tags', options.tags.join(','));
    }

    if (options.status) {
      args.push('--status', options.status);
    }

    const result = await runSTM(args, { cwd: this.tempDir });

    // Parse task ID from output
    return parseInt(result.stdout.trim(), 10);
  }

  /**
   * Run STM CLI command in this workspace
   */
  async runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return runSTM(args, { cwd: this.tempDir });
  }

  /**
   * Check if a file exists in the workspace
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.tempDir, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a file from the workspace
   */
  async readFile(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.tempDir, relativePath), 'utf8');
  }

  /**
   * Write a file to the workspace
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.tempDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  /**
   * List files in the workspace directory
   */
  async listFiles(relativePath = ''): Promise<string[]> {
    try {
      return await fs.readdir(path.join(this.tempDir, relativePath));
    } catch {
      return [];
    }
  }

  /**
   * Get the count of task files
   */
  async getTaskFileCount(): Promise<number> {
    const files = await this.listFiles('.simple-task-master/tasks');
    return files.filter((f) => f.endsWith('.md')).length;
  }

  /**
   * Create multiple tasks for testing
   */
  async createTestTasks(count: number, prefix = 'Test Task'): Promise<Task[]> {
    const tasks: Task[] = [];

    for (let i = 1; i <= count; i++) {
      const task = await this.addTask({
        title: `${prefix} ${i}`,
        content: `This is test task number ${i}`,
        tags: [`tag${i % 3}`, 'test'],
        status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending'
      });
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Simulate concurrent operations
   */
  async simulateConcurrentAdds(count: number): Promise<Task[]> {
    const promises = Array.from({ length: count }, (_, i) =>
      this.addTask({
        title: `Concurrent Task ${i + 1}`,
        content: `Created concurrently: ${i + 1}`
      })
    );

    return Promise.all(promises);
  }

  /**
   * Get workspace statistics for testing
   */
  async getStats(): Promise<{
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    doneTasks: number;
    totalFiles: number;
  }> {
    const tasks = await this.listTasks();
    const files = await this.listFiles('.simple-task-master/tasks');

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === 'pending').length,
      inProgressTasks: tasks.filter((t) => t.status === 'in-progress').length,
      doneTasks: tasks.filter((t) => t.status === 'done').length,
      totalFiles: files.filter((f) => f.endsWith('.md')).length
    };
  }
}
