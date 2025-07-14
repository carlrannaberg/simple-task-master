import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listCommand } from '@/commands/list';
import { FileSystemError, ValidationError } from '@lib/errors';
import { TestWorkspace, runSTM, runSTMSuccess, runSTMFailure } from '@test/helpers';

describe('List Command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
    await setupTestTasks();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  async function setupTestTasks(): Promise<void> {
    // Create a variety of test tasks
    await workspace.addTask({
      title: 'Frontend Development',
      content: 'Build React components',
      status: 'pending',
      tags: ['frontend', 'react', 'ui']
    });

    await workspace.addTask({
      title: 'Backend API',
      content: 'Implement REST endpoints',
      status: 'in-progress',
      tags: ['backend', 'api', 'nodejs']
    });

    await workspace.addTask({
      title: 'Database Schema',
      content: 'Design database tables',
      status: 'done',
      tags: ['database', 'sql']
    });

    await workspace.addTask({
      title: 'DevOps Pipeline',
      content: 'Set up CI/CD pipeline',
      status: 'pending',
      tags: ['devops', 'ci-cd']
    });

    await workspace.addTask({
      title: 'Testing Suite',
      content: 'Write unit and integration tests',
      status: 'in-progress',
      tags: ['testing', 'quality']
    });
  }

  describe('basic listing', () => {
    it('should list all tasks by default', async () => {
      const result = await runSTMSuccess(['list'], { cwd: workspace.directory });

      // Should return NDJSON format by default
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      expect(lines).toHaveLength(5);

      // Each line should be valid JSON
      const tasks = lines.map((line) => JSON.parse(line));
      expect(tasks).toHaveLength(5);

      // Tasks should be sorted by ID
      for (let i = 0; i < tasks.length - 1; i++) {
        expect(tasks[i].id).toBeLessThan(tasks[i + 1].id);
      }
    });

    it('should handle empty task list', async () => {
      // Create a new workspace with no tasks
      const emptyWorkspace = await TestWorkspace.create();

      try {
        const result = await runSTMSuccess(['list'], { cwd: emptyWorkspace.directory });
        expect(result.stdout.trim()).toBe('');
      } finally {
        await emptyWorkspace.cleanup();
      }
    });

    it('should list tasks in correct order', async () => {
      const result = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const lines = result.stdout.trim().split('\n');
      const tasks = lines.map((line) => JSON.parse(line));

      const expectedTitles = [
        'Frontend Development',
        'Backend API',
        'Database Schema',
        'DevOps Pipeline',
        'Testing Suite'
      ];

      tasks.forEach((task, index) => {
        expect(task.title).toBe(expectedTitles[index]);
        expect(task.id).toBe(index + 1);
      });
    });
  });

  describe('status filtering', () => {
    it('should filter by pending status', async () => {
      const result = await runSTMSuccess(['list', '--status', 'pending'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Frontend Development');
      expect(tasks[1].title).toBe('DevOps Pipeline');
      tasks.forEach((task) => expect(task.status).toBe('pending'));
    });

    it('should filter by in-progress status', async () => {
      const result = await runSTMSuccess(['list', '--status', 'in-progress'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Backend API');
      expect(tasks[1].title).toBe('Testing Suite');
      tasks.forEach((task) => expect(task.status).toBe('in-progress'));
    });

    it('should filter by done status', async () => {
      const result = await runSTMSuccess(['list', '--status', 'done'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Database Schema');
      expect(tasks[0].status).toBe('done');
    });

    it('should handle short option -s for status', async () => {
      const result = await runSTMSuccess(['list', '-s', 'done'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('done');
    });

    it('should reject invalid status', async () => {
      const result = await runSTMFailure(['list', '--status', 'invalid'], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Status must be one of: pending, in-progress, done');
    });
  });

  describe('tag filtering', () => {
    it('should filter by single tag', async () => {
      const result = await runSTMSuccess(['list', '--tags', 'frontend'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Frontend Development');
      expect(tasks[0].tags).toContain('frontend');
    });

    it('should filter by multiple tags (OR logic)', async () => {
      const result = await runSTMSuccess(['list', '--tags', 'backend,devops'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Backend API');
      expect(tasks[1].title).toBe('DevOps Pipeline');
    });

    it('should handle short option -t for tags', async () => {
      const result = await runSTMSuccess(['list', '-t', 'testing'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Testing Suite');
    });

    it('should handle whitespace in tag filter', async () => {
      const result = await runSTMSuccess(['list', '--tags', ' frontend , backend '], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(2);
    });

    it('should return empty for non-existent tag', async () => {
      const result = await runSTMSuccess(['list', '--tags', 'nonexistent'], { cwd: workspace.directory });

      expect(result.stdout.trim()).toBe('');
    });
  });

  describe('search functionality', () => {
    it('should search in task titles', async () => {
      const result = await runSTMSuccess(['list', '--search', 'API'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Backend API');
    });

    it('should search in task content', async () => {
      const result = await runSTMSuccess(['list', '--search', 'components'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Frontend Development');
    });

    it('should search case-insensitively', async () => {
      const result = await runSTMSuccess(['list', '--search', 'database'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Database Schema');
    });

    it('should search partial matches', async () => {
      const result = await runSTMSuccess(['list', '--search', 'Dev'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.title)).toContain('Frontend Development');
      expect(tasks.map((t) => t.title)).toContain('DevOps Pipeline');
    });

    it('should return empty for no matches', async () => {
      const result = await runSTMSuccess(['list', '--search', 'nomatch'], { cwd: workspace.directory });

      expect(result.stdout.trim()).toBe('');
    });
  });

  describe('combined filters', () => {
    it('should combine status and tag filters', async () => {
      const result = await runSTMSuccess(['list', '--status', 'pending', '--tags', 'frontend'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Frontend Development');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].tags).toContain('frontend');
    });

    it('should combine status and search filters', async () => {
      const result = await runSTMSuccess(['list', '--status', 'in-progress', '--search', 'API'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Backend API');
    });

    it('should combine all filters', async () => {
      const result = await runSTMSuccess([
        'list',
        '--status',
        'in-progress',
        '--tags',
        'backend',
        '--search',
        'REST'
      ], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const tasks = lines.map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Backend API');
    });

    it('should return empty when filters have no intersection', async () => {
      const result = await runSTMSuccess(['list', '--status', 'done', '--tags', 'frontend'], { cwd: workspace.directory });

      expect(result.stdout.trim()).toBe('');
    });
  });

  describe('output formats', () => {
    it('should output NDJSON by default', async () => {
      const result = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const lines = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      expect(lines.length).toBeGreaterThan(0);

      // Each line should be valid JSON
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should output pretty table format', async () => {
      const result = await runSTMSuccess(['list', '--pretty'], { cwd: workspace.directory });

      // Table format should contain headers and borders
      expect(result.stdout).toContain('ID');
      expect(result.stdout).toContain('Title');
      expect(result.stdout).toContain('Status');
      expect(result.stdout).toContain('Tags');
    });

    it('should output JSON format', async () => {
      const result = await runSTMSuccess(['list', '--format', 'json'], { cwd: workspace.directory });

      // Should be valid JSON array
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const tasks = JSON.parse(result.stdout);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(5);
    });

    it('should output table format', async () => {
      const result = await runSTMSuccess(['list', '--format', 'table'], { cwd: workspace.directory });

      expect(result.stdout).toContain('ID');
      expect(result.stdout).toContain('Title');
      expect(result.stdout).toContain('Status');
    });

    it('should output CSV format', async () => {
      const result = await runSTMSuccess(['list', '--format', 'csv'], { cwd: workspace.directory });

      const lines = result.stdout.trim().split('\n');
      expect(lines[0]).toContain('id,title,status'); // CSV header
      expect(lines.length).toBeGreaterThan(1);
    });

    it('should output YAML format', async () => {
      const result = await runSTMSuccess(['list', '--format', 'yaml'], { cwd: workspace.directory });

      expect(result.stdout).toContain('- id:');
      expect(result.stdout).toContain('title:');
      expect(result.stdout).toContain('status:');
    });

    it('should handle short option -f for format', async () => {
      const result = await runSTMSuccess(['list', '-f', 'json'], { cwd: workspace.directory });

      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('should handle short option -p for pretty', async () => {
      const result = await runSTMSuccess(['list', '-p'], { cwd: workspace.directory });

      expect(result.stdout).toContain('ID');
      expect(result.stdout).toContain('Title');
    });

    it('should reject invalid format', async () => {
      const result = await runSTMFailure(['list', '--format', 'invalid'], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid format: invalid');
      expect(result.stderr).toContain('Valid formats: ndjson, json, table, csv, yaml');
    });

    it('should prioritize pretty flag over explicit format', async () => {
      const result = await runSTMSuccess(['list', '--format', 'json', '--pretty'], { cwd: workspace.directory });

      // Should output table format because pretty takes precedence
      expect(result.stdout).toContain('ID');
      expect(result.stdout).toContain('Title');
      expect(result.stdout).toContain('Status');
    });
  });

  describe('edge cases', () => {
    it('should handle tasks with no content', async () => {
      const edgeCaseWorkspace = await TestWorkspace.create();

      try {
        await edgeCaseWorkspace.addTask({
          title: 'No Content Task',
          status: 'pending',
          tags: []
        });

        const result = await runSTMSuccess(['list'], { cwd: edgeCaseWorkspace.directory });
        const task = JSON.parse(result.stdout.trim());

        expect(task.title).toBe('No Content Task');
        expect(task.content?.trim() || undefined).toBeUndefined();
      } finally {
        await edgeCaseWorkspace.cleanup();
      }
    });

    it('should handle tasks with no tags', async () => {
      const edgeCaseWorkspace = await TestWorkspace.create();

      try {
        await edgeCaseWorkspace.addTask({
          title: 'No Tags Task',
          status: 'pending'
        });

        const result = await runSTMSuccess(['list'], { cwd: edgeCaseWorkspace.directory });
        const task = JSON.parse(result.stdout.trim());

        expect(task.title).toBe('No Tags Task');
        expect(task.tags).toEqual([]);
      } finally {
        await edgeCaseWorkspace.cleanup();
      }
    });

    it('should handle special characters in task data', async () => {
      const edgeCaseWorkspace = await TestWorkspace.create();

      try {
        await edgeCaseWorkspace.addTask({
          title: 'Task with newlines and tabs',
          content: 'Content with\nnewlines\tand\ttabs',
          status: 'pending',
          tags: ['tag-with-dashes', 'tag_with_underscores']
        });

        const result = await runSTMSuccess(['list'], { cwd: edgeCaseWorkspace.directory });
        const task = JSON.parse(result.stdout.trim());

        expect(task.title).toBe('Task with newlines and tabs');
        expect(task.content?.trim()).toBe('Content with\nnewlines\tand\ttabs');
        expect(task.tags).toEqual(['tag-with-dashes', 'tag_with_underscores']);
      } finally {
        await edgeCaseWorkspace.cleanup();
      }
    });
  });

  describe('error handling', () => {
    it('should handle ValidationError', async () => {
      const result = await runSTMFailure(['list', '--status', 'invalid-status'], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Status must be one of: pending, in-progress, done');
    });

    it('should handle FileSystemError', async () => {
      // Test with a directory that doesn't have STM initialized
      const uninitialized = await TestWorkspace.create();

      try {
        // Remove the .simple-task-master directory to simulate uninitialized state
        await require('fs/promises').rm(uninitialized.stmDirectory, { recursive: true, force: true });

        const result = await runSTM(['list'], { cwd: uninitialized.directory });

        // Should either fail with exit code 1 or succeed with empty output
        if (result.exitCode === 0) {
          expect(result.stdout.trim()).toBe('');
        } else {
          expect(result.exitCode).toBe(1);
          expect(result.stderr.length).toBeGreaterThan(0);
        }
      } finally {
        await uninitialized.cleanup();
      }
    });

    it('should handle format validation errors', async () => {
      const result = await runSTMFailure(['list', '--format', 'invalid-format'], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid format: invalid-format');
    });
  });

  describe('performance', () => {
    it('should handle large numbers of tasks efficiently', async () => {
      const perfWorkspace = await TestWorkspace.create();

      try {
        // Create many tasks
        const taskCount = 100; // Reduced for file system operations
        for (let i = 1; i <= taskCount; i++) {
          await perfWorkspace.addTask({
            title: `Task ${i}`,
            status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending',
            tags: [`tag${i % 5}`, 'bulk']
          });
        }

        const startTime = Date.now();
        const result = await runSTMSuccess(['list'], { cwd: perfWorkspace.directory });
        const duration = Date.now() - startTime;

        const lines = result.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim());
        expect(lines).toHaveLength(taskCount);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      } finally {
        await perfWorkspace.cleanup();
      }
    });

    it('should efficiently filter large datasets', async () => {
      const perfWorkspace = await TestWorkspace.create();

      try {
        // Create many tasks with specific patterns
        const taskCount = 50; // Reduced for file system operations
        for (let i = 1; i <= taskCount; i++) {
          await perfWorkspace.addTask({
            title: `Backend Task ${i}`,
            status: 'pending',
            tags: ['backend', 'api']
          });

          await perfWorkspace.addTask({
            title: `Frontend Task ${i}`,
            status: 'done',
            tags: ['frontend', 'ui']
          });
        }

        const startTime = Date.now();
        const result = await runSTMSuccess(['list', '--status', 'pending', '--tags', 'backend'], { cwd: perfWorkspace.directory });
        const duration = Date.now() - startTime;

        const lines = result.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim());
        expect(lines).toHaveLength(taskCount);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      } finally {
        await perfWorkspace.cleanup();
      }
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(listCommand.name()).toBe('list');
      expect(listCommand.description()).toContain('List tasks with optional filtering');
    });

    it('should have all expected options', () => {
      const options = listCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--status');
      expect(optionNames).toContain('--tags');
      expect(optionNames).toContain('--search');
      expect(optionNames).toContain('--pretty');
      expect(optionNames).toContain('--format');
    });

    it('should have correct option aliases', () => {
      const options = listCommand.options;

      const statusOption = options.find((opt) => opt.long === '--status');
      expect(statusOption?.short).toBe('-s');

      const tagsOption = options.find((opt) => opt.long === '--tags');
      expect(tagsOption?.short).toBe('-t');

      const prettyOption = options.find((opt) => opt.long === '--pretty');
      expect(prettyOption?.short).toBe('-p');

      const formatOption = options.find((opt) => opt.long === '--format');
      expect(formatOption?.short).toBe('-f');
    });
  });
});
