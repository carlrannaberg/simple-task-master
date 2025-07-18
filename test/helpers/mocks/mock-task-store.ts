import type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListFilters,
  TaskStatus
} from '@lib/types';
import { NotFoundError } from '@lib/errors';

/**
 * In-memory task store for testing without file system operations
 */
export class MockTaskStore {
  private tasks = new Map<number, Task>();
  private nextId = 1;

  /**
   * Create a new task
   */
  async create(input: TaskCreateInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      schema: 1,
      id: this.nextId++,
      title: input.title,
      status: input.status ?? 'pending',
      created: now,
      updated: now,
      tags: input.tags ?? [],
      dependencies: input.dependencies ?? [],
      content: input.content
    };

    this.tasks.set(task.id, task);
    return { ...task };
  }

  /**
   * Get a task by ID
   */
  async get(id: number): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new NotFoundError(`Task with ID ${id} not found`);
    }
    return { ...task };
  }

  /**
   * Update a task
   */
  async update(id: number, updates: TaskUpdateInput): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new NotFoundError(`Task with ID ${id} not found`);
    }

    const updated: Task = {
      ...existing,
      title: updates.title ?? existing.title,
      status: updates.status ?? existing.status,
      tags: updates.tags ?? existing.tags,
      dependencies: updates.dependencies ?? existing.dependencies,
      content: updates.content ?? existing.content,
      updated: new Date().toISOString()
    };

    this.tasks.set(id, updated);
    return { ...updated };
  }

  /**
   * Delete a task
   */
  async delete(id: number): Promise<boolean> {
    return this.tasks.delete(id);
  }

  /**
   * List tasks with optional filtering
   */
  async list(filters?: TaskListFilters): Promise<Task[]> {
    let results = Array.from(this.tasks.values());

    if (filters?.status) {
      results = results.filter((task) => task.status === filters.status);
    }

    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(
        (task) => filters.tags?.some((tag) => task.tags.includes(tag)) ?? false
      );
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter((task) => {
        const titleMatch = task.title.toLowerCase().includes(searchLower);
        const contentMatch = (task.content || '').toLowerCase().includes(searchLower);
        return titleMatch || contentMatch;
      });
    }

    // Return sorted by ID
    return results.sort((a, b) => a.id - b.id).map((task) => ({ ...task }));
  }

  /**
   * Get all tasks (for testing)
   */
  async getAll(): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .sort((a, b) => a.id - b.id)
      .map((task) => ({ ...task }));
  }

  /**
   * Clear all tasks (for testing)
   */
  clear(): void {
    this.tasks.clear();
    this.nextId = 1;
  }

  /**
   * Get task count
   */
  size(): number {
    return this.tasks.size;
  }

  /**
   * Check if task exists
   */
  has(id: number): boolean {
    return this.tasks.has(id);
  }

  /**
   * Get next ID that would be assigned
   */
  getNextId(): number {
    return this.nextId;
  }

  /**
   * Set next ID (for testing)
   */
  setNextId(id: number): void {
    this.nextId = id;
  }

  /**
   * Add a task directly (for testing setup)
   */
  addTask(task: Task): void {
    this.tasks.set(task.id, { ...task });
    if (task.id >= this.nextId) {
      this.nextId = task.id + 1;
    }
  }

  /**
   * Create multiple test tasks
   */
  async createTestTasks(count: number, prefix = 'Test Task'): Promise<Task[]> {
    const tasks: Task[] = [];

    for (let i = 1; i <= count; i++) {
      const task = await this.create({
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
   * Get statistics
   */
  getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    withTags: number;
    withContent: number;
    } {
    const tasks = Array.from(this.tasks.values());

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in-progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
      withTags: tasks.filter((t) => t.tags.length > 0).length,
      withContent: tasks.filter((t) => t.content && t.content.length > 0).length
    };
  }

  /**
   * Simulate concurrent operations (for testing race conditions)
   */
  async simulateConcurrentCreates(count: number): Promise<Task[]> {
    const promises = Array.from({ length: count }, (_, i) =>
      this.create({
        title: `Concurrent Task ${i + 1}`,
        content: `Created concurrently: ${i + 1}`
      })
    );

    return Promise.all(promises);
  }

  /**
   * Filter tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.status === status)
      .sort((a, b) => a.id - b.id)
      .map((task) => ({ ...task }));
  }

  /**
   * Filter tasks by tag
   */
  getTasksByTag(tag: string): Task[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.tags.includes(tag))
      .sort((a, b) => a.id - b.id)
      .map((task) => ({ ...task }));
  }
}
