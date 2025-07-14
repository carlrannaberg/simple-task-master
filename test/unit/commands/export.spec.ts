import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '@/commands/export';
// import { FileSystemError } from '@lib/errors'; // Unused for now
import { TestWorkspace, runSTMSuccess, runSTMFailure } from '@test/helpers';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Export Command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
    await setupTestTasks();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  async function setupTestTasks(): Promise<void> {
    await workspace.addTask({
      title: 'Frontend Development',
      content: 'Build React components for the dashboard',
      status: 'pending',
      tags: ['frontend', 'react', 'dashboard'],
      dependencies: []
    });

    await workspace.addTask({
      title: 'Backend API',
      content: 'Implement REST endpoints for user management',
      status: 'in-progress',
      tags: ['backend', 'api', 'users'],
      dependencies: []
    });

    await workspace.addTask({
      title: 'Database Schema',
      content: 'Design and implement database tables',
      status: 'done',
      tags: ['database', 'schema'],
      dependencies: [1, 2]
    });

    await workspace.addTask({
      title: 'Testing Suite',
      content: 'Write comprehensive unit and integration tests',
      status: 'pending',
      tags: ['testing', 'quality'],
      dependencies: [1, 2, 3]
    });

    await workspace.addTask({
      title: 'Documentation',
      content: 'Create API documentation and user guides',
      status: 'in-progress',
      tags: ['docs', 'api'],
      dependencies: [2]
    });
  }

  describe('basic export functionality', () => {
    it('should export all tasks to stdout by default', async () => {
      const result = await runSTMSuccess(['export'], { cwd: workspace.directory });

      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const tasks = JSON.parse(result.stdout);

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(5);

      // Should include full content
      tasks.forEach((task: Record<string, unknown>) => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('content');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('tags');
        expect(task).toHaveProperty('dependencies');
      });
    });

    it('should export to file when output option is provided', async () => {
      const outputFile = path.join(workspace.directory, 'tasks.json');

      const result = await runSTMSuccess(['export', '--output', outputFile], { cwd: workspace.directory });

      expect(result.stderr).toContain('Exported 5 tasks to');
      expect(result.stderr).toContain('tasks.json');

      const fileExists = await fs
        .access(outputFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      expect(() => JSON.parse(fileContent)).not.toThrow();

      const tasks = JSON.parse(fileContent);
      expect(tasks).toHaveLength(5);
    });

    it('should use JSON format by default', async () => {
      const result = await runSTMSuccess(['export'], { cwd: workspace.directory });

      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const tasks = JSON.parse(result.stdout);
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should handle empty task list', async () => {
      // Create a new workspace with no tasks
      const emptyWorkspace = await TestWorkspace.create();

      try {
        const result = await runSTMSuccess(['export'], { cwd: emptyWorkspace.directory });

        expect(result.stdout).toContain('[]');
        expect(result.stderr).toContain('No tasks found matching the specified filters');
      } finally {
        await emptyWorkspace.cleanup();
      }
    });
  });

  describe('output formats', () => {
    it('should export in JSON format', async () => {
      const result = await runSTMSuccess(['export', '--format', 'json'], { cwd: workspace.directory });

      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const tasks = JSON.parse(result.stdout);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(5);
    });

    it('should export in NDJSON format', async () => {
      const result = await runSTMSuccess(['export', '--format', 'ndjson'], { cwd: workspace.directory });

      const lines = result.stdout.trim().split('\n');
      expect(lines).toHaveLength(5);

      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should export in CSV format', async () => {
      const result = await runSTMSuccess(['export', '--format', 'csv'], { cwd: workspace.directory });

      const lines = result.stdout.trim().split('\n');
      expect(lines[0]).toContain('id,title,status'); // CSV header
      expect(lines.length).toBeGreaterThan(5); // Header + at least 5 tasks

      // Check a data row
      expect(lines[1]).toContain('Frontend Development');
      expect(lines[1]).toContain('pending');
    });

    it('should export in YAML format', async () => {
      const result = await runSTMSuccess(['export', '--format', 'yaml'], { cwd: workspace.directory });

      expect(result.stdout).toContain('- id:');
      expect(result.stdout).toContain('title:');
      expect(result.stdout).toContain('status:');
      expect(result.stdout).toContain('tags:');
    });

    it('should export in table format', async () => {
      const result = await runSTMSuccess(['export', '--format', 'table'], { cwd: workspace.directory });

      expect(result.stdout).toContain('ID');
      expect(result.stdout).toContain('Title');
      expect(result.stdout).toContain('Status');
      expect(result.stdout).toContain('│'); // Table borders
    });

    it('should handle short option -f for format', async () => {
      const result = await runSTMSuccess(['export', '-f', 'csv'], { cwd: workspace.directory });

      expect(result.stdout).toContain('id,title,status');
    });

    it('should reject invalid format', async () => {
      const result = await runSTMFailure(['export', '--format', 'invalid'], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid format: invalid');
      expect(result.stderr).toContain('Valid formats: json, csv, ndjson, yaml, table');
    });
  });

  describe('filtering options', () => {
    it('should filter by status', async () => {
      const result = await runSTMSuccess(['export', '--status', 'pending'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(2); // Tasks 1 and 4 are pending

      tasks.forEach((task: Record<string, unknown>) => {
        expect(task.status).toBe('pending');
      });
    });

    it('should filter by tags', async () => {
      const result = await runSTMSuccess(['export', '--tags', 'api'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(2); // Tasks 2 and 5 have 'api' tag

      tasks.forEach((task: Record<string, unknown>) => {
        expect((task.tags as string[]).includes('api')).toBe(true);
      });
    });

    it('should filter by multiple tags (OR logic)', async () => {
      const result = await runSTMSuccess(['export', '--tags', 'frontend,database'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(2); // Tasks 1 (frontend) and 3 (database)

      const titles = tasks.map((task: Record<string, unknown>) => task.title);
      expect(titles).toContain('Frontend Development');
      expect(titles).toContain('Database Schema');
    });

    it('should filter by search pattern', async () => {
      const result = await runSTMSuccess(['export', '--search', 'API'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(2); // Tasks with "API" in title or content

      const titles = tasks.map((task: Record<string, unknown>) => task.title);
      expect(titles).toContain('Backend API');
      expect(titles).toContain('Documentation');
    });

    it('should handle short option -s for status', async () => {
      const result = await runSTMSuccess(['export', '-s', 'done'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('done');
    });

    it('should handle short option -t for tags', async () => {
      const result = await runSTMSuccess(['export', '-t', 'testing'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Testing Suite');
    });

    it('should combine multiple filters', async () => {
      const result = await runSTMSuccess(['export', '--status', 'in-progress', '--tags', 'api'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks.length).toBeGreaterThan(0); // At least one task matches both filters

      // All returned tasks should match both filters
      tasks.forEach((task: Record<string, unknown>) => {
        expect(task.status).toBe('in-progress');
        expect((task.tags as string[]).includes('api')).toBe(true);
      });
    });

    it('should return empty result when filters match nothing', async () => {
      const result = await runSTMSuccess(['export', '--status', 'done', '--tags', 'frontend'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(0);
      expect(result.stderr).toContain('No tasks found matching');
    });

    it('should reject invalid status', async () => {
      const result = await runSTMFailure(['export', '--status', 'invalid'], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Status must be one of: pending, in-progress, done');
    });
  });

  describe('file output handling', () => {
    it('should create output directory if it does not exist', async () => {
      const outputFile = path.join(workspace.directory, 'exports', 'tasks.json');

      await runSTMSuccess(['export', '--output', outputFile], { cwd: workspace.directory });

      const fileExists = await fs
        .access(outputFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should auto-append file extension based on format', async () => {
      const outputBase = path.join(workspace.directory, 'tasks');

      const result = await runSTMSuccess(['export', '--format', 'csv', '--output', outputBase], { cwd: workspace.directory });

      expect(result.stderr).toContain('Auto-appending .csv extension');
      expect(result.stderr).toContain('tasks.csv');

      const csvFile = `${outputBase}.csv`;
      const fileExists = await fs
        .access(csvFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should not auto-append extension if already present', async () => {
      const outputFile = path.join(workspace.directory, 'tasks.json');

      const result = await runSTMSuccess(['export', '--format', 'json', '--output', outputFile], { cwd: workspace.directory });

      expect(result.stderr).not.toContain('Auto-appending');
      expect(result.stderr).toContain('tasks.json');
    });

    it('should handle different file extensions for different formats', async () => {
      const formats = [
        { format: 'json', ext: '.json' },
        { format: 'csv', ext: '.csv' },
        { format: 'yaml', ext: '.yaml' },
        { format: 'ndjson', ext: '.ndjson' }
      ];

      for (const { format, ext } of formats) {
        const outputBase = path.join(workspace.directory, `test-${format}`);

        await runSTMSuccess(['export', '--format', format, '--output', outputBase], { cwd: workspace.directory });

        const expectedFile = `${outputBase}${ext}`;
        const fileExists = await fs
          .access(expectedFile)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should handle short option -o for output', async () => {
      const outputFile = path.join(workspace.directory, 'short.json');

      const _result = await runSTMSuccess(['export', '-o', outputFile], { cwd: workspace.directory });

      const fileExists = await fs
        .access(outputFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should overwrite existing files', async () => {
      const outputFile = path.join(workspace.directory, 'overwrite.json');

      // Create initial file
      await fs.writeFile(outputFile, 'initial content', 'utf8');

      // Export to same file
      await runSTMSuccess(['export', '--output', outputFile], { cwd: workspace.directory });

      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).not.toBe('initial content');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should handle file write errors', async () => {
      // Try to write to a directory that doesn't exist and can't be created
      const invalidPath = '/root/nonexistent/tasks.json';

      const result = await runSTMFailure(['export', '--output', invalidPath], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      // Error message might vary by system, but should indicate a file system error
    });
  });

  describe('content handling', () => {
    it('should include full task content in export', async () => {
      const result = await runSTMSuccess(['export'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);

      tasks.forEach((task: Record<string, unknown>) => {
        expect(task).toHaveProperty('content');
        expect(typeof task.content).toBe('string');
        expect((task.content as string).length).toBeGreaterThan(0);
      });
    });

    it('should handle tasks with special characters in content', async () => {
      await workspace.addTask({
        title: 'Special Characters Task',
        content: 'Content with "quotes", émojis 🚀, and unicode: 测试',
        status: 'pending',
        tags: ['special'],
        dependencies: []
      });

      const result = await runSTMSuccess(['export', '--format', 'json'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      const specialTask = tasks.find(
        (t: Record<string, unknown>) => t.title === 'Special Characters Task'
      );

      expect(specialTask).toBeDefined();
      expect(specialTask.content).toContain('émojis 🚀');
      expect(specialTask.content).toContain('测试');
    });

    it('should handle tasks with multiline content', async () => {
      await workspace.addTask({
        title: 'Multiline Task',
        content: 'Line 1\nLine 2\nLine 3',
        status: 'pending',
        tags: [],
        dependencies: []
      });

      const result = await runSTMSuccess(['export', '--format', 'json'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      const multilineTask = tasks.find(
        (t: Record<string, unknown>) => t.title === 'Multiline Task'
      );

      expect(multilineTask).toBeDefined();
      expect(multilineTask.content).toContain('\n');
      expect(multilineTask.content).toContain('Line 1');
      expect(multilineTask.content).toContain('Line 3');
    });

    // Note: Task content loading failures are handled by the TaskManager implementation
    // and would be tested in integration tests rather than unit tests
  });

  describe('output format specifics', () => {
    it('should format CSV with proper escaping', async () => {
      await workspace.addTask({
        title: 'Task with quotes and commas',
        content: 'Content with\nnewlines and "quotes"',
        status: 'pending',
        tags: ['csv', 'test'],
        dependencies: []
      });

      const result = await runSTMSuccess(['export', '--format', 'csv'], { cwd: workspace.directory });

      // CSV should properly format titles and content
      expect(result.stdout).toContain('Task with quotes and commas');
      expect(result.stdout).toContain('""quotes""'); // Quote escaping in content
    });

    it('should format YAML with proper structure', async () => {
      const result = await runSTMSuccess(['export', '--format', 'yaml'], { cwd: workspace.directory });

      expect(result.stdout).toContain('- id: 1');
      expect(result.stdout).toContain('title: "Frontend Development"');
      expect(result.stdout).toContain('tags:');
      expect(result.stdout).toContain('- "frontend"');
      expect(result.stdout).toContain('dependencies: []');
    });

    it('should format table with aligned columns', async () => {
      const result = await runSTMSuccess(['export', '--format', 'table'], { cwd: workspace.directory });

      expect(result.stdout).toContain('│');
      expect(result.stdout).toContain('Frontend Development');
      expect(result.stdout).toContain('pending');

      // Should have proper table structure
      const lines = result.stdout.split('\n');
      const headerLine = lines.find((line) => line.includes('ID') && line.includes('Title'));
      expect(headerLine).toBeDefined();
    });

    it('should format NDJSON with one task per line', async () => {
      const result = await runSTMSuccess(['export', '--format', 'ndjson'], { cwd: workspace.directory });

      const lines = result.stdout.trim().split('\n');
      expect(lines).toHaveLength(5);

      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
        const task = JSON.parse(line);
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty tag filters', async () => {
      const result = await runSTMSuccess(['export', '--tags', ''], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks).toHaveLength(5); // Should return all tasks
    });

    it('should handle whitespace in tag filters', async () => {
      const result = await runSTMSuccess(['export', '--tags', ' frontend , api '], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      expect(tasks.length).toBeGreaterThan(0);

      // Should find tasks with either 'frontend' or 'api' tags
      const hasValidTags = tasks.every((task: Record<string, unknown>) => {
        const tags = task.tags as string[];
        return tags.includes('frontend') || tags.includes('api');
      });
      expect(hasValidTags).toBe(true);
    });

    it('should handle tasks with empty arrays', async () => {
      await workspace.addTask({
        title: 'Empty Arrays Task',
        content: 'Task with no tags or dependencies',
        status: 'pending',
        tags: [],
        dependencies: []
      });

      const result = await runSTMSuccess(['export', '--format', 'json'], { cwd: workspace.directory });

      const tasks = JSON.parse(result.stdout);
      const emptyTask = tasks.find((t: Record<string, unknown>) => t.title === 'Empty Arrays Task');

      expect(emptyTask).toBeDefined();
      expect(emptyTask.tags).toEqual([]);
      expect(emptyTask.dependencies).toEqual([]);
    });

    it('should handle very long output paths', async () => {
      const longPath = path.join(
        workspace.directory,
        'very'.repeat(10),
        'long'.repeat(10),
        'path.json'
      );

      const _result = await runSTMSuccess(['export', '--output', longPath], { cwd: workspace.directory });

      const fileExists = await fs
        .access(longPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(exportCommand.name()).toBe('export');
      expect(exportCommand.description()).toContain('Export tasks to a file or stdout');

      // Should not require any arguments
      const args = exportCommand.args;
      expect(args).toHaveLength(0);
    });

    it('should have all expected options', () => {
      const options = exportCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--format');
      expect(optionNames).toContain('--output');
      expect(optionNames).toContain('--status');
      expect(optionNames).toContain('--tags');
      expect(optionNames).toContain('--search');
    });

    it('should have correct option aliases', () => {
      const options = exportCommand.options;

      const formatOption = options.find((opt) => opt.long === '--format');
      expect(formatOption?.short).toBe('-f');
      expect(formatOption?.defaultValue).toBe('json');

      const outputOption = options.find((opt) => opt.long === '--output');
      expect(outputOption?.short).toBe('-o');

      const statusOption = options.find((opt) => opt.long === '--status');
      expect(statusOption?.short).toBe('-s');

      const tagsOption = options.find((opt) => opt.long === '--tags');
      expect(tagsOption?.short).toBe('-t');
    });

    it('should include helpful examples in help text', () => {
      const helpText = exportCommand.helpInformation();

      expect(helpText).toContain('export'); // The command name
      expect(helpText).toContain('format'); // Format option
      expect(helpText).toContain('output'); // Output option
      expect(helpText).toContain('status'); // Status option
      expect(helpText).toContain('tags'); // Tags option
    });
  });

  describe('performance', () => {
    it('should handle exporting large numbers of tasks efficiently', async () => {
      // Create a separate workspace for performance testing
      const perfWorkspace = await TestWorkspace.create();

      try {
        // Create many tasks
        const taskCount = 100; // Reduce for unit tests
        for (let i = 1; i <= taskCount; i++) {
          await perfWorkspace.addTask({
            title: `Task ${i}`,
            content: `Content for task ${i}`,
            status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending',
            tags: [`tag${i % 5}`],
            dependencies: []
          });
        }

        const startTime = Date.now();
        const result = await runSTMSuccess(['export'], { cwd: perfWorkspace.directory });
        const duration = Date.now() - startTime;

        const tasks = JSON.parse(result.stdout);
        expect(tasks).toHaveLength(taskCount);
        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      } finally {
        await perfWorkspace.cleanup();
      }
    });

    it('should efficiently export to file', async () => {
      const outputFile = path.join(workspace.directory, 'performance.json');

      const startTime = Date.now();
      await runSTMSuccess(['export', '--output', outputFile], { cwd: workspace.directory });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Be more lenient for CI

      const fileExists = await fs
        .access(outputFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });
});
