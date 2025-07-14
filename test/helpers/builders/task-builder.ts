import type { Task, TaskStatus, TaskCreateInput } from '@lib/types';

/**
 * Builder pattern for creating test Task objects with sensible defaults
 */
export class TaskBuilder {
  private task: Partial<Task> = {
    schema: 1,
    status: 'pending',
    tags: [],
    dependencies: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  /**
   * Set the task ID
   */
  withId(id: number): this {
    this.task.id = id;
    return this;
  }

  /**
   * Set the task title
   */
  withTitle(title: string): this {
    this.task.title = title;
    return this;
  }

  /**
   * Set the task status
   */
  withStatus(status: TaskStatus): this {
    this.task.status = status;
    return this;
  }

  /**
   * Set the task content/description
   */
  withContent(content: string): this {
    this.task.content = content;
    return this;
  }

  /**
   * Add tags to the task
   */
  withTags(...tags: string[]): this {
    this.task.tags = [...(this.task.tags || []), ...tags];
    return this;
  }

  /**
   * Set all tags (replacing any existing)
   */
  withTagsOnly(...tags: string[]): this {
    this.task.tags = tags;
    return this;
  }

  /**
   * Add dependencies to the task
   */
  withDependencies(...dependencies: number[]): this {
    this.task.dependencies = [...(this.task.dependencies || []), ...dependencies];
    return this;
  }

  /**
   * Set all dependencies (replacing any existing)
   */
  withDependenciesOnly(...dependencies: number[]): this {
    this.task.dependencies = dependencies;
    return this;
  }

  /**
   * Set the creation timestamp
   */
  withCreated(created: string | Date): this {
    this.task.created = created instanceof Date ? created.toISOString() : created;
    return this;
  }

  /**
   * Set the update timestamp
   */
  withUpdated(updated: string | Date): this {
    this.task.updated = updated instanceof Date ? updated.toISOString() : updated;
    return this;
  }

  /**
   * Set both created and updated to the same time
   */
  withTimestamp(timestamp: string | Date): this {
    const iso = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    this.task.created = iso;
    this.task.updated = iso;
    return this;
  }

  /**
   * Set the schema version
   */
  withSchema(schema: number): this {
    this.task.schema = schema;
    return this;
  }

  /**
   * Create a pending task
   */
  pending(): this {
    return this.withStatus('pending');
  }

  /**
   * Create an in-progress task
   */
  inProgress(): this {
    return this.withStatus('in-progress');
  }

  /**
   * Create a done task
   */
  done(): this {
    return this.withStatus('done');
  }

  /**
   * Build the complete Task object
   */
  build(): Task {
    return {
      schema: 1,
      id: 1,
      title: 'Default Task',
      status: 'pending',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tags: [],
      dependencies: [],
      ...this.task
    } as Task;
  }

  /**
   * Build a TaskCreateInput object (for testing creation)
   */
  buildCreateInput(): TaskCreateInput {
    return {
      title: this.task.title || 'Default Task',
      content: this.task.content,
      tags: this.task.tags,
      dependencies: this.task.dependencies,
      status: this.task.status
    };
  }

  /**
   * Create a new builder instance (for method chaining)
   */
  static create(): TaskBuilder {
    return new TaskBuilder();
  }
}

/**
 * Convenience factory functions for common task patterns
 */
export class TaskFactory {
  /**
   * Create a simple task with just a title
   */
  static simple(title: string): Task {
    return TaskBuilder.create().withTitle(title).build();
  }

  /**
   * Create a task with title and content
   */
  static withContent(title: string, content: string): Task {
    return TaskBuilder.create().withTitle(title).withContent(content).build();
  }

  /**
   * Create a pending task
   */
  static pending(title: string): Task {
    return TaskBuilder.create().withTitle(title).pending().build();
  }

  /**
   * Create an in-progress task
   */
  static inProgress(title: string): Task {
    return TaskBuilder.create().withTitle(title).inProgress().build();
  }

  /**
   * Create a done task
   */
  static done(title: string): Task {
    return TaskBuilder.create().withTitle(title).done().build();
  }

  /**
   * Create a task with tags
   */
  static withTags(title: string, ...tags: string[]): Task {
    return TaskBuilder.create()
      .withTitle(title)
      .withTags(...tags)
      .build();
  }

  /**
   * Create a task with dependencies
   */
  static withDependencies(title: string, ...dependencies: number[]): Task {
    return TaskBuilder.create()
      .withTitle(title)
      .withDependencies(...dependencies)
      .build();
  }

  /**
   * Create a complex task with all properties
   */
  static complex(options: {
    id?: number;
    title: string;
    content?: string;
    status?: TaskStatus;
    tags?: string[];
    dependencies?: number[];
    created?: string | Date;
    updated?: string | Date;
  }): Task {
    const builder = TaskBuilder.create().withTitle(options.title);

    if (options.id !== undefined) builder.withId(options.id);
    if (options.content !== undefined) builder.withContent(options.content);
    if (options.status !== undefined) builder.withStatus(options.status);
    if (options.tags !== undefined) builder.withTagsOnly(...options.tags);
    if (options.dependencies !== undefined) builder.withDependenciesOnly(...options.dependencies);
    if (options.created !== undefined) builder.withCreated(options.created);
    if (options.updated !== undefined) builder.withUpdated(options.updated);

    return builder.build();
  }

  /**
   * Create multiple tasks with sequential IDs
   */
  static createMultiple(count: number, titlePrefix = 'Task'): Task[] {
    const tasks: Task[] = [];

    for (let i = 1; i <= count; i++) {
      tasks.push(
        TaskBuilder.create()
          .withId(i)
          .withTitle(`${titlePrefix} ${i}`)
          .withContent(`Content for ${titlePrefix} ${i}`)
          .withTags('test', `tag${i % 3}`)
          .withStatus(i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending')
          .build()
      );
    }

    return tasks;
  }

  /**
   * Create tasks with various statuses for testing
   */
  static createWithStatuses(): Task[] {
    return [
      TaskFactory.pending('Pending Task'),
      TaskFactory.inProgress('In Progress Task'),
      TaskFactory.done('Done Task')
    ];
  }

  /**
   * Create tasks with various tag combinations
   */
  static createWithTags(): Task[] {
    return [
      TaskFactory.withTags('Frontend Task', 'frontend', 'ui'),
      TaskFactory.withTags('Backend Task', 'backend', 'api'),
      TaskFactory.withTags('DevOps Task', 'devops', 'deployment'),
      TaskFactory.withTags('Mixed Task', 'frontend', 'backend', 'urgent')
    ];
  }

  /**
   * Create tasks with dependencies for testing
   */
  static createWithDependencies(): Task[] {
    return [
      TaskBuilder.create().withId(1).withTitle('Base Task').build(),
      TaskBuilder.create().withId(2).withTitle('Dependent Task 1').withDependencies(1).build(),
      TaskBuilder.create().withId(3).withTitle('Dependent Task 2').withDependencies(1, 2).build(),
      TaskBuilder.create().withId(4).withTitle('Independent Task').build()
    ];
  }

  /**
   * Create tasks with timestamps for testing date operations
   */
  static createWithTimestamps(): Task[] {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return [
      TaskBuilder.create().withTitle('Recent Task').withTimestamp(now).build(),
      TaskBuilder.create().withTitle('Yesterday Task').withTimestamp(yesterday).build(),
      TaskBuilder.create().withTitle('Old Task').withTimestamp(lastWeek).build()
    ];
  }
}
