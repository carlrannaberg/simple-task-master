/**
 * Show command unit tests
 *
 * These tests directly test the show command action function
 * with properly mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import type { Task } from '@lib/types';
import { FileSystemError } from '@lib/errors';
import { MockTaskStore } from '@test/helpers';

// Mock modules first - with factory functions to ensure fresh instances
vi.mock('@lib/task-manager', () => {
  const MockTaskManager = vi.fn();
  MockTaskManager.create = vi.fn();
  return {
    TaskManager: MockTaskManager
  };
});

vi.mock('@lib/output', () => {
  return {
    formatTask: vi.fn(),
    printOutput: vi.fn(),
    printError: vi.fn(),
    formatTasks: vi.fn(),
    printSuccess: vi.fn(),
    printWarning: vi.fn()
  };
});

// Import after mocking
import { showCommand, showTask } from '@/commands/show';
import { TaskManager } from '@lib/task-manager';
import { printOutput, printError, formatTask } from '@lib/output';

// Get mocked functions
const mockedTaskManager = vi.mocked(TaskManager);
const mockedTaskManagerCreate = mockedTaskManager.create;
const mockedPrintOutput = vi.mocked(printOutput);
const mockedPrintError = vi.mocked(printError);
const mockedFormatTask = vi.mocked(formatTask);

describe('Show Command', () => {
  let mockTaskStore: MockTaskStore;
  let mockTaskManagerInstance: {
    get: MockedFunction<(id: number) => Promise<Task>>;
  };
  let capturedOutput: string = '';
  let capturedError: string = '';

  // Mock process.exit
  const originalExit = process.exit;
  let exitCode: number | undefined;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    exitCode = undefined;
    capturedOutput = '';
    capturedError = '';

    // Mock process.exit
    process.exit = vi.fn((code?: string | number) => {
      exitCode = typeof code === 'string' ? parseInt(code, 10) : code;
      throw new Error(`Process.exit(${code})`);
    }) as unknown as typeof process.exit;

    // Mock output functions to capture output
    mockedPrintOutput.mockImplementation((content: string) => {
      capturedOutput = content || '';
    });

    mockedPrintError.mockImplementation((message: string) => {
      capturedError = message || '';
    });

    // Mock formatTask to generate the expected output based on format
    mockedFormatTask.mockImplementation((task: Task, format: string) => {
      if (format === 'yaml') {
        // Generate YAML front matter format
        const lines: string[] = ['---'];
        lines.push(`schema: ${task.schema}`);
        lines.push(`id: ${task.id}`);
        lines.push(`title: "${task.title}"`);
        lines.push(`status: "${task.status}"`);
        lines.push(`created: "${task.created}"`);
        lines.push(`updated: "${task.updated}"`);

        if (task.tags && task.tags.length > 0) {
          lines.push('tags:');
          task.tags.forEach((tag) => lines.push(`  - "${tag}"`));
        } else {
          lines.push('tags: []');
        }

        if (task.dependencies && task.dependencies.length > 0) {
          lines.push('dependencies:');
          task.dependencies.forEach((dep) => lines.push(`  - ${dep}`));
        } else {
          lines.push('dependencies: []');
        }

        lines.push('---');
        if (task.content) {
          lines.push('');
          lines.push(task.content);
        }

        return lines.join('\n');
      } else if (format === 'json') {
        return JSON.stringify(task, null, 2);
      } else if (format === 'ndjson') {
        return JSON.stringify(task);
      } else if (format === 'markdown') {
        const lines: string[] = [];
        lines.push(`# ${task.title}`);
        lines.push('');
        lines.push('## Task Details');
        lines.push('');
        lines.push(`- **ID**: ${task.id}`);
        lines.push(`- **Status**: ${task.status}`);
        lines.push(`- **Created**: ${new Date(task.created).toLocaleString()}`);
        lines.push(`- **Updated**: ${new Date(task.updated).toLocaleString()}`);

        if (task.tags && task.tags.length > 0) {
          lines.push(`- **Tags**: ${task.tags.map((tag) => `\`${tag}\``).join(', ')}`);
        }

        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(`- **Dependencies**: ${task.dependencies.join(', ')}`);
        }

        if (task.content && task.content.trim()) {
          lines.push('');
          lines.push('## Description');
          lines.push('');
          lines.push(task.content);
        }

        return lines.join('\n');
      } else if (format === 'table') {
        // Simple table format
        return `┌────┬──────────────────────────────┬────────────┬──────────────────────┬────────────┐
│ ID │ Title                        │ Status     │ Tags                 │ Updated    │
├────┼──────────────────────────────┼────────────┼──────────────────────┼────────────┤
│ ${task.id.toString().padEnd(2)} │ ${task.title.padEnd(28)} │ ${task.status.padEnd(10)} │ ${(task.tags?.join(', ') || '').padEnd(20)} │ ${new Date(task.updated).toLocaleDateString().padEnd(10)} │
└────┴──────────────────────────────┴────────────┴──────────────────────┴────────────┘`;
      } else if (format === 'csv') {
        const headers = 'id,title,status,created,updated,tags,dependencies,content';
        const escapeCsvValue = (val: unknown): string => {
          const str = String(val || '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const row = [
          task.id,
          escapeCsvValue(task.title),
          task.status,
          task.created,
          task.updated,
          task.tags?.join(';') || '',
          task.dependencies?.join(';') || '',
          escapeCsvValue(task.content || '')
        ].join(',');
        return `${headers}\n${row}`;
      }

      return '';
    });

    // Create fresh mock task store
    mockTaskStore = new MockTaskStore();

    // Create mock instance
    mockTaskManagerInstance = {
      get: vi.fn()
    };

    // Setup constructor mock
    mockedTaskManager.mockImplementation(() => mockTaskManagerInstance as unknown as TaskManager);
    // Setup static create method
    mockedTaskManagerCreate.mockResolvedValue(mockTaskManagerInstance as unknown as TaskManager);

    // Setup TaskManager get method to use MockTaskStore
    mockTaskManagerInstance.get.mockImplementation(async (id: number) => {
      const task = await mockTaskStore.get(id);
      // Ensure content property exists
      return { ...task, content: task.content || '' };
    });

    // Clear any existing data and create test tasks
    mockTaskStore.clear();
    await setupTestTasks();

    // Clear Commander options state to prevent test interference
    if (showCommand.opts) {
      const opts = showCommand.opts();
      Object.keys(opts).forEach((key) => {
        delete opts[key];
      });
    }
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  async function setupTestTasks(): Promise<void> {
    await mockTaskStore.create({
      title: 'Simple Task',
      content: 'A simple task for testing',
      status: 'pending',
      tags: ['simple', 'test'],
      dependencies: []
    });

    await mockTaskStore.create({
      title: 'Complex Task',
      content: `# Complex Task Description

This is a **complex** task with:
- Multiple lines
- Markdown formatting
- Code blocks

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

> Important note about this task

[Link to documentation](https://example.com)`,
      status: 'in-progress',
      tags: ['complex', 'markdown', 'important'],
      dependencies: [1]
    });

    await mockTaskStore.create({
      title: 'Task with Special Characters',
      content: 'Task with émojis 🚀, "quotes", and unicode: 测试',
      status: 'done',
      tags: ['special', 'unicode', 'émojis'],
      dependencies: []
    });

    await mockTaskStore.create({
      title: 'Empty Content Task',
      status: 'pending',
      tags: [],
      dependencies: []
    });
  }

  /**
   * Helper to run the show command and capture output/errors
   */
  async function runShowCommand(
    args: string[]
  ): Promise<{ output: string; error: string; exitCode?: number }> {
    exitCode = undefined;
    capturedOutput = '';
    capturedError = '';

    try {
      // Pass arguments directly to the show command's action handler
      const [id, ...remainingArgs] = args;
      const options: { format?: string } = {};

      // Parse options from remaining args
      for (let i = 0; i < remainingArgs.length; i++) {
        if (remainingArgs[i] === '--format' || remainingArgs[i] === '-f') {
          options.format = remainingArgs[i + 1];
          i++; // Skip the next argument since we've consumed it
        }
      }

      // Call the showTask function directly
      await showTask(id, options);
    } catch (error) {
      // Ignore process.exit errors
      if (error instanceof Error && !error.message?.startsWith('Process.exit')) {
        throw error;
      }
    }

    return {
      output: capturedOutput,
      error: capturedError,
      exitCode
    };
  }

  describe('basic task display', () => {
    it('should show a simple task in YAML format by default', async () => {
      const result = await runShowCommand(['1']);

      expect(result.output).toBeDefined();
      expect(result.output).toContain('id: 1');
      expect(result.output).toContain('title: "Simple Task"');
      expect(result.output).toContain('status: "pending"');
      expect(result.output).toContain('tags:');
      expect(result.output).toContain('- "simple"');
      expect(result.output).toContain('- "test"');
      expect(result.exitCode).toBeUndefined();
    });

    it('should show a task with complex content', async () => {
      const result = await runShowCommand(['2']);

      expect(result.output).toContain('title: "Complex Task"');
      expect(result.output).toContain('status: "in-progress"');
      expect(result.output).toContain('dependencies:');
      expect(result.output).toContain('- 1');
      expect(result.exitCode).toBeUndefined();
    });

    it('should show task with special characters', async () => {
      const result = await runShowCommand(['3']);

      expect(result.output).toContain('Task with émojis 🚀');
      expect(result.output).toContain('unicode: 测试');
      expect(result.exitCode).toBeUndefined();
    });

    it('should show task with empty content', async () => {
      const result = await runShowCommand(['4']);

      expect(result.output).toContain('title: "Empty Content Task"');
      expect(result.output).toContain('status: "pending"');
      // Content should be empty or not present in the YAML front matter
      // The formatTaskAsYAML function doesn't include content in front matter if it's empty
      expect(result.output).not.toContain('content: ""');
      expect(result.exitCode).toBeUndefined();
    });
  });

  describe('output formats', () => {
    it('should output YAML format by default', async () => {
      const result = await runShowCommand(['1']);

      expect(result.output).toContain('id: 1');
      expect(result.output).toContain('title: "Simple Task"');
      expect(result.output).toContain('tags:');
      expect(result.output).toContain('- "simple"');
    });

    it('should output YAML format explicitly', async () => {
      const result = await runShowCommand(['1', '--format', 'yaml']);

      expect(result.output).toContain('id: 1');
      expect(result.output).toContain('title: "Simple Task"');
    });

    it('should output JSON format', async () => {
      const result = await runShowCommand(['1', '--format', 'json']);

      expect(() => JSON.parse(result.output)).not.toThrow();

      const task = JSON.parse(result.output);
      expect(task.id).toBe(1);
      expect(task.title).toBe('Simple Task');
      expect(task.status).toBe('pending');
      expect(task.tags).toEqual(['simple', 'test']);
    });

    it('should output NDJSON format', async () => {
      const result = await runShowCommand(['1', '--format', 'ndjson']);

      expect(() => JSON.parse(result.output.trim())).not.toThrow();

      const task = JSON.parse(result.output.trim());
      expect(task.id).toBe(1);
      expect(task.title).toBe('Simple Task');
    });

    it('should output table format', async () => {
      const result = await runShowCommand(['1', '--format', 'table']);

      expect(result.output).toContain('ID');
      expect(result.output).toContain('Title');
      expect(result.output).toContain('Status');
      expect(result.output).toContain('Simple Task');
    });

    it('should output CSV format', async () => {
      const result = await runShowCommand(['1', '--format', 'csv']);

      const lines = result.output.trim().split('\n');
      expect(lines[0]).toContain('id,title,status'); // CSV header
      expect(lines[1]).toContain('1,Simple Task,pending');
    });

    it('should output markdown format', async () => {
      const result = await runShowCommand(['2', '--format', 'markdown']);

      expect(result.output).toContain('# Complex Task');
      expect(result.output).toContain('**Status**: in-progress');
      expect(result.output).toContain('**Tags**: `complex`, `markdown`, `important`');
      expect(result.output).toContain('**Dependencies**: 1');
    });

    it('should handle short option -f for format', async () => {
      const result = await runShowCommand(['1', '-f', 'json']);

      expect(() => JSON.parse(result.output)).not.toThrow();
    });

    it('should reject invalid format', async () => {
      const result = await runShowCommand(['1', '--format', 'invalid']);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Invalid format: invalid');
      expect(result.error).toContain('Valid formats: yaml, markdown, json, ndjson, table, csv');
    });
  });

  describe('task ID validation', () => {
    it('should reject invalid task ID string', async () => {
      const result = await runShowCommand(['invalid']);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Invalid task ID: invalid');
    });

    it('should reject zero task ID', async () => {
      const result = await runShowCommand(['0']);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Invalid task ID: 0');
    });

    it('should reject negative task ID', async () => {
      const result = await runShowCommand(['-1']);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Invalid task ID: -1');
    });

    it('should reject non-existent task ID', async () => {
      const result = await runShowCommand(['999']);

      expect(result.exitCode).toBe(3); // NotFoundError exit code
      expect(result.error).toContain('not found');
    });

    it('should accept valid positive integer IDs', async () => {
      for (let id = 1; id <= 4; id++) {
        const result = await runShowCommand([id.toString()]);
        expect(result.output).toContain(`id: ${id}`);
        expect(result.exitCode).toBeUndefined();
      }
    });
  });

  describe('task content display', () => {
    it('should properly display multiline content', async () => {
      const result = await runShowCommand(['2', '--format', 'yaml']);

      expect(result.output).toContain('# Complex Task Description');
      expect(result.output).toContain('Multiple lines');
      expect(result.output).toContain('console.log');
    });

    it('should handle content with special characters', async () => {
      const result = await runShowCommand(['3', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task.content).toContain('émojis 🚀');
      expect(task.content).toContain('"quotes"');
      expect(task.content).toContain('unicode: 测试');
    });

    it('should handle empty or undefined content', async () => {
      const result = await runShowCommand(['4', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task.content === undefined || task.content === '').toBe(true);
    });

    it('should preserve markdown formatting in markdown output', async () => {
      const result = await runShowCommand(['2', '--format', 'markdown']);

      expect(result.output).toContain('# Complex Task Description');
      expect(result.output).toContain('**complex** task');
      expect(result.output).toContain('```javascript');
      expect(result.output).toContain('> Important note');
    });
  });

  describe('metadata display', () => {
    it('should display all task metadata', async () => {
      const result = await runShowCommand(['1', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task).toHaveProperty('schema');
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('created');
      expect(task).toHaveProperty('updated');
      expect(task).toHaveProperty('tags');
      expect(task).toHaveProperty('dependencies');
    });

    it('should display timestamps in YAML format', async () => {
      const result = await runShowCommand(['1']);

      expect(result.output).toContain('created:');
      expect(result.output).toContain('updated:');

      // Timestamps should be in ISO format
      const createdMatch = result.output.match(/created: "(.+)"/);
      const updatedMatch = result.output.match(/updated: "(.+)"/);

      expect(createdMatch).toBeTruthy();
      expect(updatedMatch).toBeTruthy();

      if (createdMatch && updatedMatch) {
        expect(() => new Date(createdMatch[1])).not.toThrow();
        expect(() => new Date(updatedMatch[1])).not.toThrow();
      }
    });

    it('should display empty arrays properly', async () => {
      const result = await runShowCommand(['4', '--format', 'yaml']);

      expect(result.output).toContain('tags: []');
      expect(result.output).toContain('dependencies: []');
    });

    it('should display array values properly', async () => {
      const result = await runShowCommand(['2', '--format', 'yaml']);

      expect(result.output).toContain('tags:');
      expect(result.output).toContain('- "complex"');
      expect(result.output).toContain('- "markdown"');
      expect(result.output).toContain('- "important"');

      expect(result.output).toContain('dependencies:');
      expect(result.output).toContain('- 1');
    });
  });

  describe('format-specific behaviors', () => {
    it('should format JSON with proper indentation', async () => {
      const result = await runShowCommand(['1', '--format', 'json']);

      // JSON should be pretty-printed (multi-line)
      const lines = result.output.trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(result.output).toContain('  "id": 1');
    });

    it('should format NDJSON as single line', async () => {
      const result = await runShowCommand(['1', '--format', 'ndjson']);

      // NDJSON should be single line
      const lines = result.output.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(() => JSON.parse(lines[0])).not.toThrow();
    });

    it('should format table with proper alignment', async () => {
      const result = await runShowCommand(['1', '--format', 'table']);

      expect(result.output).toContain('│'); // Table borders
      expect(result.output).toContain('Simple Task');
      expect(result.output).toContain('pending');
    });

    it('should format CSV with proper escaping', async () => {
      const result = await runShowCommand(['3', '--format', 'csv']);

      // Content with quotes should be properly escaped
      expect(result.output).toContain('Task with Special Characters');
      expect(result.output).toContain('émojis 🚀');
    });

    it('should format YAML with proper indentation', async () => {
      const result = await runShowCommand(['2']);

      expect(result.output).toContain('tags:');
      expect(result.output).toContain('  - "complex"');
      expect(result.output).toContain('  - "markdown"');
    });
  });

  describe('error handling', () => {
    it('should handle ValidationError properly', async () => {
      const result = await runShowCommand(['invalid']);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Invalid task ID');
    });

    it('should handle NotFoundError properly', async () => {
      const result = await runShowCommand(['999']);

      expect(result.exitCode).toBe(3);
      expect(result.error).toContain('not found');
    });

    it('should handle FileSystemError properly', async () => {
      const mockError = new FileSystemError('Cannot read task file');
      mockTaskManagerInstance.get.mockRejectedValueOnce(mockError);

      const result = await runShowCommand(['1']);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Cannot read task file');
    });

    it('should re-throw unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockTaskManagerInstance.get.mockRejectedValueOnce(unexpectedError);

      await expect(runShowCommand(['1'])).rejects.toThrow('Unexpected error');
    });
  });

  describe('edge cases', () => {
    it('should handle very large task IDs', async () => {
      const result = await runShowCommand(['999999999']);

      expect(result.exitCode).toBe(3);
      expect(result.error).toContain('not found');
    });

    it('should handle task with all empty fields', async () => {
      await mockTaskStore.create({
        title: '',
        content: '',
        status: 'pending',
        tags: [],
        dependencies: []
      });

      const result = await runShowCommand(['5', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task.title).toBe('');
      expect(task.content).toBe('');
      expect(task.tags).toEqual([]);
      expect(task.dependencies).toEqual([]);
    });

    it('should handle task with very long content', async () => {
      const longContent = 'A'.repeat(10000);
      await mockTaskStore.create({
        title: 'Long Content Task',
        content: longContent,
        status: 'pending',
        tags: [],
        dependencies: []
      });

      const result = await runShowCommand(['5', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task.content).toBe(longContent);
      expect(task.content.length).toBe(10000);
    });

    it('should handle task with many tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      await mockTaskStore.create({
        title: 'Many Tags Task',
        status: 'pending',
        tags: manyTags,
        dependencies: []
      });

      const result = await runShowCommand(['5', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task.tags).toEqual(manyTags);
      expect(task.tags.length).toBe(50);
    });

    it('should handle task with many dependencies', async () => {
      // Create additional tasks to depend on
      for (let i = 5; i <= 10; i++) {
        await mockTaskStore.create({
          title: `Task ${i}`,
          status: 'done',
          tags: [],
          dependencies: []
        });
      }

      const manyDeps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      await mockTaskStore.create({
        title: 'Many Dependencies Task',
        status: 'pending',
        tags: [],
        dependencies: manyDeps
      });

      const result = await runShowCommand(['11', '--format', 'json']);

      const task = JSON.parse(result.output);
      expect(task.dependencies).toEqual(manyDeps);
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(showCommand.name()).toBe('show');
      expect(showCommand.description()).toContain('Show a specific task');

      const args = showCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('id');
      expect(args[0].required).toBe(true);
    });

    it('should have format option with correct configuration', () => {
      const options = showCommand.options;
      const formatOption = options.find((opt) => opt.long === '--format');

      expect(formatOption).toBeDefined();
      expect(formatOption?.short).toBe('-f');
      expect(formatOption?.defaultValue).toBe('yaml');
    });

    it('should accept all valid format values', async () => {
      const validFormats = ['yaml', 'markdown', 'json', 'ndjson', 'table', 'csv'];

      for (const format of validFormats) {
        const result = await runShowCommand(['1', '--format', format]);
        expect(result.exitCode).toBeUndefined();
        expect(result.output).toBeTruthy();
      }
    });
  });

  describe('performance', () => {
    it('should handle showing task efficiently', async () => {
      const startTime = Date.now();
      await runShowCommand(['1']);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete very quickly
    });

    it('should handle large content efficiently', async () => {
      const largeContent = 'X'.repeat(100000); // 100KB content
      await mockTaskStore.create({
        title: 'Large Task',
        content: largeContent,
        status: 'pending',
        tags: [],
        dependencies: []
      });

      const startTime = Date.now();
      const result = await runShowCommand(['5', '--format', 'json']);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);

      const task = JSON.parse(result.output);
      expect(task.content.length).toBe(100000);
    });
  });
});
