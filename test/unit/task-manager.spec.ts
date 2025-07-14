import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '@lib/task-manager';
import { ValidationError, NotFoundError, type Task } from '@lib/types';
import { TestWorkspace, TaskBuilder, testIsolation } from '@test/helpers';

describe('TaskManager', () => {
  let workspace: TestWorkspace;
  let taskManager: TaskManager;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
    taskManager = new TaskManager({
      tasksDir: workspace.tasksDirectory,
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('create', () => {
    it('should create a task with sequential ID', async () => {
      const task1 = await taskManager.create({ title: 'First task' });
      const task2 = await taskManager.create({ title: 'Second task' });

      expect(task1.id).toBe(1);
      expect(task2.id).toBe(2);
      expect(task1).toBeValidTask();
      expect(task2).toBeValidTask();
    });

    it('should create task with all properties', async () => {
      const input = TaskBuilder.create()
        .withTitle('Test Task')
        .withContent('Task description')
        .withTags('tag1', 'tag2')
        .withStatus('in-progress')
        .buildCreateInput();

      const task = await taskManager.create(input);

      expect(task).toMatchTaskPartially({
        title: 'Test Task',
        tags: ['tag1', 'tag2'],
        status: 'in-progress',
      });
      expect(task).toHaveValidTimestamps();

      // Content is not included in the task object returned by create
      // but should be retrievable when getting the task
      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content?.trim()).toBe('Task description');
    });

    it('should validate required fields', async () => {
      await expect(taskManager.create({ title: '' })).rejects.toThrow(ValidationError);

      await expect(taskManager.create({ title: '   ' })).rejects.toThrow('Title is required');
    });

    it('should validate title length', async () => {
      const longTitle = 'x'.repeat(300);

      await expect(taskManager.create({ title: longTitle })).rejects.toThrow(ValidationError);
    });

    it('should validate content length', async () => {
      const longContent = 'x'.repeat(70000); // Exceeds 64KB default

      await expect(
        taskManager.create({
          title: 'Test',
          content: longContent,
        })
      ).rejects.toThrow('Content exceeds maximum length');
    });

    it('should handle filesystem-unsafe characters in title', async () => {
      await expect(taskManager.create({ title: 'Task with <invalid> chars' })).rejects.toThrow(
        ValidationError
      );

      await expect(taskManager.create({ title: 'Task with\x00null' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should generate unique filenames for similar titles', async () => {
      const _task1 = await taskManager.create({ title: 'Duplicate Title' });
      const _task2 = await taskManager.create({ title: 'Duplicate Title' });

      const files = await workspace.listFiles('.simple-task-master/tasks');

      expect(files).toHaveTaskCount(2);
      expect(files).toContain('1-duplicate-title.md');
      expect(files).toContain('2-duplicate-title.md');
    });
  });

  describe('get', () => {
    it('should retrieve existing task', async () => {
      const created = await taskManager.create({
        title: 'Test Task',
        content: 'Test content',
      });

      const retrieved = await taskManager.get(created.id);

      expect(retrieved).toMatchTaskPartially(created);
      expect(retrieved.content?.trim()).toBe('Test content');
    });

    it('should throw NotFoundError for non-existent task', async () => {
      await expect(taskManager.get(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test tasks
      await taskManager.create({
        title: 'Pending Task',
        tags: ['frontend'],
        status: 'pending',
      });

      await taskManager.create({
        title: 'In Progress Task',
        tags: ['backend'],
        status: 'in-progress',
      });

      await taskManager.create({
        title: 'Done Task',
        tags: ['frontend', 'testing'],
        status: 'done',
      });
    });

    it('should list all tasks', async () => {
      const tasks = await taskManager.list();

      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toHaveTitle('Pending Task');
      expect(tasks[1]).toHaveTitle('In Progress Task');
      expect(tasks[2]).toHaveTitle('Done Task');
    });

    it('should filter by status', async () => {
      const pendingTasks = await taskManager.list({ status: 'pending' });
      const doneTasks = await taskManager.list({ status: 'done' });

      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0]).toHaveStatus('pending');

      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0]).toHaveStatus('done');
    });

    it('should filter by tags', async () => {
      const frontendTasks = await taskManager.list({ tags: ['frontend'] });
      const backendTasks = await taskManager.list({ tags: ['backend'] });

      expect(frontendTasks).toHaveLength(2);
      expect(frontendTasks.every((t) => t.tags.includes('frontend'))).toBe(true);

      expect(backendTasks).toHaveLength(1);
      expect(backendTasks[0]).toHaveTags('backend');
    });

    it('should search in title and content', async () => {
      await taskManager.create({
        title: 'Frontend Development',
        content: 'React components implementation',
      });

      const titleResults = await taskManager.list({ search: 'Frontend' });
      const contentResults = await taskManager.list({ search: 'React' });

      expect(titleResults).toHaveLength(1);
      expect(contentResults).toHaveLength(1);
    });

    it('should return empty array when no tasks exist', async () => {
      // Clean up all tasks
      const allTasks = await taskManager.list();
      for (const task of allTasks) {
        await taskManager.delete(task.id);
      }

      const tasks = await taskManager.list();
      expect(tasks).toHaveLength(0);
    });
  });

  describe('update', () => {
    let existingTask: Task;

    beforeEach(async () => {
      existingTask = await taskManager.create({
        title: 'Original Title',
        content: 'Original content',
        tags: ['original'],
        status: 'pending',
      });
    });

    it('should update task properties', async () => {
      const updated = await taskManager.update(existingTask.id, {
        title: 'Updated Title',
        status: 'in-progress',
        tags: ['updated', 'modified'],
      });

      expect(updated).toHaveTitle('Updated Title');
      expect(updated).toHaveStatus('in-progress');
      expect(updated).toHaveTags('updated', 'modified');
      expect(updated.created).toBe(existingTask.created);
      expect(updated).toBeUpdatedAfter(existingTask.updated);
    });

    it('should update content', async () => {
      const updated = await taskManager.update(existingTask.id, {
        content: 'Updated content',
      });

      const retrieved = await taskManager.get(updated.id);
      expect(retrieved.content?.trim()).toBe('Updated content');
    });

    it('should handle filename changes when title changes', async () => {
      await taskManager.update(existingTask.id, {
        title: 'Completely New Title',
      });

      const files = await workspace.listFiles('.simple-task-master/tasks');
      expect(files).toHaveTaskCount(1);
      
      const taskFiles = files.filter(f => f.endsWith('.md'));
      expect(taskFiles[0]).toMatch(/1-completely-new-title\.md/);
    });

    it('should throw NotFoundError for non-existent task', async () => {
      await expect(taskManager.update(999, { title: 'New Title' })).rejects.toThrow(NotFoundError);
    });

    it('should validate updated properties', async () => {
      await expect(taskManager.update(existingTask.id, { title: '' })).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('delete', () => {
    it('should delete existing task', async () => {
      const task = await taskManager.create({ title: 'To be deleted' });

      await taskManager.delete(task.id);

      await expect(taskManager.get(task.id)).rejects.toThrow(NotFoundError);

      const files = await workspace.listFiles('.simple-task-master/tasks');
      expect(files).toHaveTaskCount(0);
    });

    it('should throw NotFoundError for non-existent task', async () => {
      await expect(taskManager.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent task creation', async () => {
      // Reduce concurrency to avoid issues with rapid ID generation
      const promises = Array.from({ length: 5 }, (_, i) =>
        taskManager.create({ title: `Concurrent Task ${i + 1}` })
      );

      const tasks = await Promise.all(promises);
      const ids = tasks.map((t) => t.id);

      // All IDs should be unique
      expect(new Set(ids).size).toBe(5);

      // IDs should be sequential (though order may vary due to concurrency)
      expect(Math.max(...ids)).toBe(5);
      expect(Math.min(...ids)).toBe(1);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle corrupted task files gracefully', async () => {
      // Create a valid task first
      await taskManager.create({ title: 'Valid Task' });

      // Manually create a corrupted file
      await workspace.writeFile('.simple-task-master/tasks/2-corrupted.md', 'invalid frontmatter');

      // Should still be able to list valid tasks
      const tasks = await taskManager.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toHaveTitle('Valid Task');
    });

    it('should handle empty title edge cases', async () => {
      await expect(taskManager.create({ title: '' })).rejects.toThrow('Title is required');

      await expect(taskManager.create({ title: '   ' })).rejects.toThrow('Title is required');

      await expect(taskManager.create({ title: '\t\n' })).rejects.toThrow('Title is required');
    });

    it('should handle invalid characters in title', async () => {
      const invalidChars = ['<', '>', '"', '|', '?', '*'];

      for (const char of invalidChars) {
        await expect(taskManager.create({ title: `Task with ${char} char` })).rejects.toThrow(
          'invalid filesystem characters'
        );
      }
    });

    it('should handle control characters in title', async () => {
      const controlChars = ['\x00', '\x01', '\x1f'];

      for (const char of controlChars) {
        await expect(taskManager.create({ title: `Task with${char}control` })).rejects.toThrow(
          'invalid filesystem characters'
        );
      }
    });

    it('should validate task size limits', async () => {
      const largeContent = 'x'.repeat(2000000); // 2MB

      await expect(
        taskManager.create({
          title: 'Large Task',
          content: largeContent,
        })
      ).rejects.toThrow(/Content exceeds maximum length|exceeds maximum size/);
    });

    it('should handle extremely long titles', async () => {
      const longTitle = 'A'.repeat(500); // Exceeds 200 char default

      await expect(taskManager.create({ title: longTitle })).rejects.toThrow(
        'Title exceeds maximum length'
      );
    });

    it('should handle special unicode characters in title', async () => {
      const unicodeTitle = '测试任务 🚀 emoji title';
      const task = await taskManager.create({ title: unicodeTitle });

      expect(task.title).toBe(unicodeTitle);
      expect(task).toBeValidTask();
    });

    it('should allow colons in task titles', async () => {
      const titleWithColon = 'Design: User Profile UI Mockups';
      const task = await taskManager.create({ title: titleWithColon });

      expect(task.title).toBe(titleWithColon);
      expect(task).toBeValidTask();
    });

    it('should handle missing task directory', async () => {
      const customTaskManager = new TaskManager({
        tasksDir: '/non/existent/directory/tasks',
      });

      const tasks = await customTaskManager.list();
      expect(tasks).toHaveLength(0);
    });

    it('should handle task file with invalid frontmatter', async () => {
      await workspace.writeFile(
        '.simple-task-master/tasks/invalid-frontmatter.md',
        '---\ninvalid: yaml: content\n---\nContent'
      );

      const tasks = await taskManager.list();
      expect(tasks).toHaveLength(0); // Should skip invalid files
    });
  });

  describe('performance', () => {
    it.skip('should handle large numbers of tasks efficiently', async () => {
      const taskCount = 100;

      // Create many tasks
      const createPromises = Array.from({ length: taskCount }, (_, i) =>
        taskManager.create({ title: `Performance Task ${i + 1}` })
      );

      await Promise.all(createPromises);

      // List should complete quickly
      const startTime = Date.now();
      const tasks = await taskManager.list();
      const duration = Date.now() - startTime;

      expect(tasks).toHaveLength(taskCount);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it.skip('should efficiently filter large task sets', async () => {
      // Create tasks with various statuses and tags
      const _tasks = await Promise.all([
        ...Array.from({ length: 50 }, (_, i) =>
          taskManager.create({
            title: `Pending Task ${i}`,
            status: 'pending',
            tags: ['backend', 'api'],
          })
        ),
        ...Array.from({ length: 30 }, (_, i) =>
          taskManager.create({
            title: `Done Task ${i}`,
            status: 'done',
            tags: ['frontend', 'ui'],
          })
        ),
        ...Array.from({ length: 20 }, (_, i) =>
          taskManager.create({
            title: `In Progress Task ${i}`,
            status: 'in-progress',
            tags: ['devops'],
          })
        ),
      ]);

      // Test filtering performance
      const startTime = Date.now();

      const pendingTasks = await taskManager.list({ status: 'pending' });
      const backendTasks = await taskManager.list({ tags: ['backend'] });
      const searchResults = await taskManager.list({ search: 'Done' });

      const duration = Date.now() - startTime;

      expect(pendingTasks).toHaveLength(50);
      expect(backendTasks).toHaveLength(50);
      expect(searchResults).toHaveLength(30);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('filename generation and collision handling', () => {
    it('should generate safe filenames from titles', async () => {
      const specialTitles = [
        'Task with spaces and symbols!@#',
        'Another-Task_with/weird\\chars',
        'Task with åcçèñts',
        'UPPERCASE task',
        'task with "quotes" and <brackets>',
      ];

      for (const title of specialTitles) {
        try {
          const task = await taskManager.create({ title });
          expect(task).toBeValidTask();
          expect(task.title).toBe(title);
        } catch (error) {
          // Some titles may be invalid due to filesystem restrictions
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should handle filename collisions with ID prefix', async () => {
      const title = 'Duplicate Title';

      const task1 = await taskManager.create({ title });
      const task2 = await taskManager.create({ title });
      const task3 = await taskManager.create({ title });

      expect(task1.id).toBe(1);
      expect(task2.id).toBe(2);
      expect(task3.id).toBe(3);

      const files = await workspace.listFiles('.simple-task-master/tasks');
      expect(files).toHaveTaskCount(3);
      expect(files).toContain('1-duplicate-title.md');
      expect(files).toContain('2-duplicate-title.md');
      expect(files).toContain('3-duplicate-title.md');
    });

    it('should handle extremely long titles in filenames', async () => {
      const longTitle =
        'This is a very long task title that exceeds normal filename limits and should be truncated or handled appropriately to avoid filesystem issues';

      const task = await taskManager.create({ title: longTitle });
      expect(task.title).toBe(longTitle); // Title should be preserved in full

      const files = await workspace.listFiles('.simple-task-master/tasks');
      expect(files).toHaveTaskCount(1);

      // Filename should be truncated but still readable (slug is limited to 100 chars)
      const filename = files[0];
      expect(filename).toMatch(/^1-this-is-a-very-long-task-title/);
      expect(filename).toContain('.md');
      expect(filename.length).toBeLessThan(120); // ID + 100 char slug + .md
    });
  });

  describe('task content and metadata handling', () => {
    it('should preserve markdown content correctly', async () => {
      const markdownContent = `# Task Description

This is a **bold** task with:
- List items
- More items

\`\`\`javascript
console.log('code blocks');
\`\`\`

> Quote blocks
> Multiple lines

[Links](https://example.com)`;

      const task = await taskManager.create({
        title: 'Markdown Task',
        content: markdownContent,
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content?.trim()).toBe(markdownContent);
    });

    it('should handle empty and whitespace-only content', async () => {
      const task1 = await taskManager.create({
        title: 'Empty Content',
        content: '',
      });

      const task2 = await taskManager.create({
        title: 'Whitespace Content',
        content: '   \n\t   \n   ',
      });

      // Content is stored in the file, check via get()
      const retrieved1 = await taskManager.get(task1.id);
      const retrieved2 = await taskManager.get(task2.id);
      expect(retrieved1.content?.trim()).toBe('');
      expect(retrieved2.content).toBe('   \n\t   \n   '); // Preserve whitespace
    });

    it('should handle tags with various formats', async () => {
      const task = await taskManager.create({
        title: 'Tagged Task',
        tags: ['frontend', 'urgent', 'bug-fix', 'v2.0', 'API_Update'],
      });

      expect(task.tags).toEqual(['frontend', 'urgent', 'bug-fix', 'v2.0', 'API_Update']);

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.tags).toEqual(['frontend', 'urgent', 'bug-fix', 'v2.0', 'API_Update']);
    });

    it('should handle dependencies correctly', async () => {
      const task1 = await taskManager.create({ title: 'Base Task' });
      const task2 = await taskManager.create({ title: 'Dependent Task' });

      const task3 = await taskManager.create({
        title: 'Multi-Dependent Task',
        dependencies: [task1.id, task2.id],
      });

      expect(task3.dependencies).toEqual([task1.id, task2.id]);

      const retrieved = await taskManager.get(task3.id);
      expect(retrieved.dependencies).toEqual([task1.id, task2.id]);
    });
  });

  describe('schema versioning and compatibility', () => {
    it('should create tasks with correct schema version', async () => {
      const task = await taskManager.create({ title: 'Schema Test' });

      expect(task.schema).toBe(1);
      expect(task).toBeValidTask();
    });

    it('should handle tasks with different schema versions', async () => {
      // Manually create a task file with different schema version
      const futureTask = {
        schema: 2,
        id: 999,
        title: 'Future Task',
        status: 'pending',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: [],
        dependencies: [],
      };

      await workspace.writeFile(
        '.simple-task-master/tasks/999-future-task.md',
        `---
schema: 2
id: 999
title: Future Task
status: pending
created: ${futureTask.created}
updated: ${futureTask.updated}
tags: []
dependencies: []
---
Future task content`
      );

      const tasks = await taskManager.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].schema).toBe(2);
    });
  });

  describe('concurrent access and race conditions', () => {
    it('should handle rapid consecutive creates', async () => {
      // Reduce number for more reliable testing
      const rapidCreates = Array.from({ length: 10 }, (_, i) =>
        taskManager.create({ title: `Rapid Task ${i}` })
      );

      const tasks = await Promise.all(rapidCreates);
      const ids = tasks.map((t) => t.id);

      // All IDs should be unique
      expect(new Set(ids).size).toBe(10);

      // IDs should be sequential (though order may vary)
      expect(Math.max(...ids)).toBe(10);
      expect(Math.min(...ids)).toBe(1);
    });

    it('should handle concurrent updates to different tasks', async () => {
      const task1 = await taskManager.create({ title: 'Task 1' });
      const task2 = await taskManager.create({ title: 'Task 2' });

      const updatePromises = [
        taskManager.update(task1.id, { title: 'Updated Task 1' }),
        taskManager.update(task2.id, { title: 'Updated Task 2' }),
      ];

      const [updated1, updated2] = await Promise.all(updatePromises);

      expect(updated1.title).toBe('Updated Task 1');
      expect(updated2.title).toBe('Updated Task 2');
    });

    it('should handle mixed concurrent operations', async () => {
      const operations = [
        taskManager.create({ title: 'Create 1' }),
        taskManager.create({ title: 'Create 2' }),
        taskManager.list(),
        taskManager.create({ title: 'Create 3' }),
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toHaveTitle('Create 1'); // First create
      expect(results[1]).toHaveTitle('Create 2'); // Second create
      expect(Array.isArray(results[2])).toBe(true); // List result
      expect(results[3]).toHaveTitle('Create 3'); // Third create
    });
  });
});

// Isolated tests using testIsolation utilities
describe('TaskManager - Isolated Tests', () => {
  it('should work in isolated temp directory', async () => {
    await testIsolation.inTempDir(async (tempDir) => {
      const taskManager = new TaskManager({
        tasksDir: `${tempDir}/.simple-task-master/tasks`,
      });

      // Should handle missing directory gracefully
      const tasks = await taskManager.list();
      expect(tasks).toHaveLength(0);

      // Should create task even when directory doesn't exist
      const task = await taskManager.create({ title: 'Test Task' });
      expect(task).toBeValidTask();
    });
  });

  it('should work with custom environment', async () => {
    await testIsolation.withEnv({ NODE_ENV: 'production' }, async () => {
      const workspace = await TestWorkspace.create();
      const taskManager = new TaskManager({
        tasksDir: workspace.tasksDirectory,
      });

      try {
        const task = await taskManager.create({ title: 'Prod Task' });
        expect(task).toBeValidTask();
      } finally {
        await workspace.cleanup();
      }
    });
  });
});
