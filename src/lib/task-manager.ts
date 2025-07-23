import * as fs from 'fs/promises';
import * as path from 'path';
import { FrontmatterParser } from './frontmatter-parser';
import writeFileAtomic from 'write-file-atomic';
import slugify from 'slugify';
import { LockManager } from './lock-manager';
import { getWorkspaceRoot } from './workspace';
import { ValidationError, FileSystemError, NotFoundError } from './errors';
import * as schema from './schema';
import { ConfigManager } from './config';
import type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListFilters,
  TaskManagerConfig
} from './types';

// Default configuration values
const DEFAULT_MAX_TASK_SIZE_BYTES = 1048576; // 1MB
const DEFAULT_MAX_TITLE_LENGTH = 200;
const DEFAULT_MAX_DESCRIPTION_LENGTH = 65536; // 64KB

// Internal config type that excludes workspaceRoot
type TaskManagerInternalConfig = {
  tasksDir: string;
  maxTaskSizeBytes: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
};

export class TaskManager {
  private readonly config: TaskManagerInternalConfig;
  private readonly lockManager: LockManager;

  constructor(config: TaskManagerInternalConfig, lockManager: LockManager) {
    this.config = config;
    this.lockManager = lockManager;
  }

  /**
   * Create a new TaskManager instance with workspace discovery
   */
  static async create(config?: Partial<TaskManagerConfig>): Promise<TaskManager> {
    const workspaceRoot = config?.workspaceRoot ?? await getWorkspaceRoot();

    // Create ConfigManager and load configuration
    const configManager = new ConfigManager(workspaceRoot);
    const loadedConfig = await configManager.load();

    // Use ConfigManager to get the tasks directory
    const tasksDir = config?.tasksDir ?? configManager.getTasksDir();

    const fullConfig: TaskManagerInternalConfig = {
      tasksDir,
      maxTaskSizeBytes: config?.maxTaskSizeBytes ??
        loadedConfig.maxTaskSizeBytes ?? DEFAULT_MAX_TASK_SIZE_BYTES,
      maxTitleLength: config?.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH,
      maxDescriptionLength: config?.maxDescriptionLength ?? DEFAULT_MAX_DESCRIPTION_LENGTH
    };

    const lockManager = new LockManager(workspaceRoot);

    return new TaskManager(fullConfig, lockManager);
  }

  /**
   * Create a new task with auto-generated ID
   */
  async create(input: TaskCreateInput): Promise<Task> {
    // Validate input before acquiring lock to avoid unnecessary locking
    this.validateCreateInput(input);

    // Acquire lock for atomic ID generation and task creation
    await this.lockManager.acquire();

    try {
      // Use provided content or empty string
      const content = input.content || '';

      // Create task with retry logic for ID conflicts
      const maxRetries = 10;
      let retries = 0;

      while (retries < maxRetries) {
        // Generate ID atomically under lock
        const id = await this.generateNextIdLocked();

        // Debug: ensure ID is valid
        if (typeof id !== 'number' || isNaN(id) || id <= 0) {
          throw new Error(`Invalid ID generated: ${id}`);
        }

        // Create task object
        const now = new Date().toISOString();
        // Extract known fields and preserve unknown fields
        const { title, status, tags, dependencies, content: _content, ...unknownFields } = input;
        const task: Task = {
          schema: 1,
          id,
          title,
          status: status ?? 'pending',
          created: now,
          updated: now,
          tags: tags ?? [],
          dependencies: dependencies ?? [],
          ...unknownFields // Preserve any unknown fields from input
        };

        // Validate the task object (including field count limit)
        try {
          schema.validateTask(task);
        } catch (error) {
          if (error instanceof schema.SchemaValidationError) {
            throw new ValidationError(error.message);
          }
          throw error;
        }

        // Create filename
        const filename = this.generateFilename(id, task.title);
        const filepath = path.join(this.config.tasksDir, filename);

        // Serialize to markdown with front-matter
        const fileContent = FrontmatterParser.stringify(content, task);

        // Validate file size
        await this.validateTaskSize(fileContent);

        // Ensure tasks directory exists, create if needed
        try {
          await fs.access(this.config.tasksDir);
        } catch {
          await fs.mkdir(this.config.tasksDir, { recursive: true });
        }

        // Before writing, check if ANY file with this ID already exists
        // This is critical because different titles produce different filenames
        const existingFiles = await this.findTaskFiles();
        const idAlreadyExists = existingFiles.some((f) => {
          const existingId = this.extractIdFromFilename(f);
          return existingId === id;
        });

        if (idAlreadyExists) {
          // ID collision detected - retry with a new ID
          retries++;
          if (retries >= maxRetries) {
            throw new Error(
              `Failed to create task after ${maxRetries} retries due to ID conflicts`
            );
          }
          continue;
        }

        // Write file atomically - use exclusive creation as an additional safety
        try {
          // Try to create the file exclusively
          const fd = await fs.open(filepath, 'wx'); // 'wx' fails if file exists
          await fd.write(fileContent, 0, 'utf8');
          await fd.sync(); // Force filesystem sync
          await fd.close();

          // Ensure the file is visible to other processes before we release the lock
          // This prevents race conditions where the next process might not see this file
          // Wait up to 100ms for the file to be visible in directory listing
          let fileVisible = false;
          for (let i = 0; i < 10; i++) {
            const files = await fs.readdir(this.config.tasksDir);
            if (files.includes(filename)) {
              fileVisible = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          if (!fileVisible) {
            throw new Error(`File ${filename} not visible in directory after creation`);
          }

          // Success! Return the task with content
          return {
            ...task,
            content
          };
        } catch (error) {
          if ((error as { code?: string }).code === 'EEXIST') {
            // File already exists - this shouldn't happen after our check above
            // but handle it just in case
            retries++;
            if (retries >= maxRetries) {
              throw new Error(
                `Failed to create task after ${maxRetries} retries due to file conflicts`
              );
            }
            continue;
          }
          throw error;
        }
      }

      throw new Error('Failed to create task: maximum retries exceeded');
    } catch (error) {
      // Re-throw with appropriate error type
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new FileSystemError(
        `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Always release lock, even on error
      await this.lockManager.release();
    }
  }

  /**
   * Get a single task by ID
   */
  async get(id: number): Promise<Task> {
    const files = await this.findTaskFiles();
    const file = files.find((f) => this.extractIdFromFilename(f) === id);

    if (!file) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    const filepath = path.join(this.config.tasksDir, file);
    return this.readTaskFile(filepath);
  }

  /**
   * List all tasks with optional filtering
   */
  async list(filters?: TaskListFilters): Promise<Task[]> {
    const files = await this.findTaskFiles();
    const tasks: Task[] = [];

    for (const file of files) {
      try {
        const filepath = path.join(this.config.tasksDir, file);
        const task = await this.readTaskFile(filepath);

        // Apply filters
        if (filters?.status && task.status !== filters.status) continue;
        if (filters?.tags && !filters.tags.some((tag) => task.tags.includes(tag))) continue;
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const titleMatch = task.title.toLowerCase().includes(searchLower);
          const contentMatch = (task.content || '').toLowerCase().includes(searchLower);
          if (!titleMatch && !contentMatch) continue;
        }

        tasks.push(task);
      } catch (error) {
        // Skip invalid files but log warning
        console.warn(
          `Failed to read task file ${file}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // Sort by ID
    return tasks.sort((a, b) => a.id - b.id);
  }

  /**
   * Update an existing task
   */
  async update(id: number, updates: TaskUpdateInput): Promise<Task> {
    // Acquire lock for atomic update operation
    await this.lockManager.acquire();

    try {
      // Get current task
      const currentTask = await this.get(id);

      // Find current file
      const files = await this.findTaskFiles();
      const currentFile = files.find((f) => this.extractIdFromFilename(f) === id);
      if (!currentFile) {
        throw new NotFoundError(`Task not found: ${id}`);
      }

      // Apply updates (preserve unknown fields from currentTask and add new ones from updates)
      const updatedTask: Task = {
        ...currentTask, // Preserve all existing fields, including unknown ones
        ...updates, // Apply all updates, including arbitrary fields
        // Override specific core fields to handle undefined values correctly
        title: updates.title ?? currentTask.title,
        status: updates.status ?? currentTask.status,
        updated: new Date().toISOString(),
        tags: updates.tags ?? currentTask.tags,
        dependencies: updates.dependencies ?? currentTask.dependencies
      };

      // Validate updated task
      this.validateTitle(updatedTask.title);

      // Validate the updated task object (including field count limit)
      try {
        schema.validateTask(updatedTask);
      } catch (error) {
        if (error instanceof schema.SchemaValidationError) {
          throw new ValidationError(error.message);
        }
        throw error;
      }

      // Build updated content
      const updatedContent = updates.content ?? currentTask.content ?? '';

      // Check if filename needs to change
      const newFilename = this.generateFilename(id, updatedTask.title);
      const oldFilepath = path.join(this.config.tasksDir, currentFile);
      const newFilepath = path.join(this.config.tasksDir, newFilename);

      // Serialize to markdown
      const fileContent = FrontmatterParser.stringify(updatedContent, updatedTask);

      // Validate file size
      await this.validateTaskSize(fileContent);

      try {
        // Write new file
        await writeFileAtomic(newFilepath, fileContent, { encoding: 'utf8', mode: 0o644 });

        // If filename changed, delete old file
        if (oldFilepath !== newFilepath) {
          await fs.unlink(oldFilepath);
        }
      } catch (error) {
        throw new FileSystemError(
          `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      return updatedTask;
    } finally {
      // Always release lock, even on error
      await this.lockManager.release();
    }
  }

  /**
   * Delete a task (optional method)
   */
  async delete(id: number): Promise<void> {
    const files = await this.findTaskFiles();
    const file = files.find((f) => this.extractIdFromFilename(f) === id);

    if (!file) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    const filepath = path.join(this.config.tasksDir, file);

    try {
      await fs.unlink(filepath);
    } catch (error) {
      throw new FileSystemError(
        `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Private helper methods

  private async generateNextIdLocked(): Promise<number> {
    // Per specification: "Implements ID generation (highest + 1)"
    // Always scan filesystem to find the highest ID
    return this.generateNextIdFromFilesystem();
  }

  private async generateNextIdFromFilesystem(): Promise<number> {
    try {
      const files = await fs.readdir(this.config.tasksDir);

      let maxId = 0;
      let maxIdFile: string | null = null;

      // First pass: find the highest ID from filenames
      for (const file of files) {
        // Only process .md files
        if (!file.endsWith('.md')) continue;

        // Extract ID from filename
        const match = file.match(/^(\d+)-/);
        if (match && match[1]) {
          const id = parseInt(match[1], 10);
          if (!isNaN(id) && id > maxId) {
            maxId = id;
            maxIdFile = file;
          }
        }
      }

      // If we found files, verify the highest ID file has matching frontmatter
      if (maxIdFile && maxId > 0) {
        try {
          const filepath = path.join(this.config.tasksDir, maxIdFile);
          const task = await this.readTaskFile(filepath);

          if (task.id !== maxId) {
            // Frontmatter doesn't match filename - this is a data integrity issue
            console.warn(
              `Data integrity warning: File ${maxIdFile} has ID ${task.id} ` +
              `in frontmatter but ${maxId} in filename`
            );

            // Fall back to scanning all files to find the true maximum ID
            return this.generateNextIdByFullScan();
          }
        } catch (error) {
          // If we can't read the file, still use the ID from the filename
          // This prevents infinite loops when files are corrupted
          console.warn(`Warning: Could not read file ${maxIdFile} for ID verification: ${error}`);
          // Important: Return the next ID based on filename, not a full scan
          // This ensures we don't get stuck trying to use the same ID
          return maxId + 1;
        }
      }

      return maxId + 1;
    } catch (error) {
      // If directory doesn't exist, start with ID 1
      if ((error as { code?: string }).code === 'ENOENT') {
        return 1;
      }
      throw new FileSystemError(
        `Failed to generate ID: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async generateNextIdByFullScan(): Promise<number> {
    // Fallback method that reads all files to find the true maximum ID
    const files = await this.findTaskFiles();

    let maxId = 0;
    for (const file of files) {
      // First try to extract ID from filename
      const filenameMatch = file.match(/^(\d+)-/);
      if (filenameMatch && filenameMatch[1]) {
        const filenameId = parseInt(filenameMatch[1], 10);
        if (!isNaN(filenameId) && filenameId > maxId) {
          maxId = filenameId;
        }
      }

      // Then try to read the file for verification
      try {
        const filepath = path.join(this.config.tasksDir, file);
        const task = await this.readTaskFile(filepath);
        if (task.id > maxId) {
          maxId = task.id;
        }
      } catch (error) {
        // Skip files that can't be read but we already have the ID from filename
        console.warn(`Warning: Could not read file ${file}: ${error}`);
      }
    }

    return maxId + 1;
  }

  private generateFilename(id: number, title: string): string {
    const slug = this.sanitizeForFilename(title);
    return `${id}-${slug}.md`;
  }

  private sanitizeForFilename(title: string): string {
    const slug = slugify(title, {
      lower: true,
      strict: true,
      trim: true
    }).substring(0, 100); // Limit slug length

    return slug;
  }

  private extractIdFromFilename(filename: string): number | null {
    const match = filename.match(/^(\d+)-/);
    return match && match[1] ? parseInt(match[1], 10) : null;
  }

  private async findTaskFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.tasksDir);
      return files.filter((f) => f.endsWith('.md'));
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        return [];
      }
      throw new FileSystemError(
        `Failed to list tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async readTaskFile(filepath: string): Promise<Task> {
    try {
      const fileContent = await fs.readFile(filepath, 'utf8');
      const { data, content } = FrontmatterParser.parse(fileContent);

      // Validate required fields
      FrontmatterParser.validateTaskData(data);

      // Content is already preserved exactly as it was in the file
      // After validation, we know data is a valid Task
      const task = data as unknown as Task;
      return {
        ...task,
        content: content
      };
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new FileSystemError(
        `Failed to read task file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private validateCreateInput(input: TaskCreateInput): void {
    this.validateTitle(input.title);

    if (input.content && input.content.length > this.config.maxDescriptionLength) {
      throw new ValidationError(
        `Content exceeds maximum length of ${this.config.maxDescriptionLength} characters`
      );
    }
  }

  private validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }

    if (title.length > this.config.maxTitleLength) {
      throw new ValidationError(
        `Title exceeds maximum length of ${this.config.maxTitleLength} characters`
      );
    }

    // Only check for truly dangerous characters - control characters and null bytes
    // Allow quotes, apostrophes, and other symbols in titles
    // The filename sanitization will handle filesystem-specific restrictions
    const dangerousChars = /[\x00-\x1f]/g;
    if (dangerousChars.test(title)) {
      throw new ValidationError('Title contains invalid control characters');
    }
  }

  private async validateTaskSize(content: string): Promise<void> {
    const sizeInBytes = Buffer.byteLength(content, 'utf8');

    if (sizeInBytes > this.config.maxTaskSizeBytes) {
      throw new ValidationError(
        `Task file exceeds maximum size of ${this.config.maxTaskSizeBytes} bytes. ` +
          `Current size: ${sizeInBytes} bytes. Consider breaking into subtasks.`
      );
    }
  }
}
