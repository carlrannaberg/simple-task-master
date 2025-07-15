/**
 * Grep command unit tests
 *
 * These tests directly test the grep command action function
 * with properly mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import type { Task } from '@lib/types';
// import { ValidationError, FileSystemError, ConfigurationError } from '@lib/errors'; // Unused for now
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
    formatTasks: vi.fn(),
    printOutput: vi.fn(),
    printError: vi.fn(),
    printSuccess: vi.fn(),
    printWarning: vi.fn()
  };
});

// Import after mocking
import { grepCommand, grepTasks } from '@/commands/grep';
import { TaskManager } from '@lib/task-manager';
import { printOutput, printError, formatTasks } from '@lib/output';

// Get mocked functions
const mockedTaskManager = vi.mocked(TaskManager);
const mockedTaskManagerCreate = mockedTaskManager.create;
const mockedPrintOutput = vi.mocked(printOutput);
const mockedPrintError = vi.mocked(printError);
const mockedFormatTasks = vi.mocked(formatTasks);

describe('Grep Command', () => {
  let mockTaskStore: MockTaskStore;
  let mockTaskManagerInstance: {
    list: MockedFunction<() => Promise<Task[]>>;
    get: MockedFunction<(id: number) => Promise<Task>>;
  };
  let _capturedOutput: string = '';
  let capturedError: string = '';

  // Mock process.exit
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Process exit called');
  });

  // Mock process.stderr.write
  const _mockStderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation((str) => {
    capturedError += str;
    return true;
  });

  // Mock process.stdout.isTTY to enable summary output
  const _originalIsTTY = process.stdout.isTTY;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Clear command options state
    grepCommand.options.forEach((option) => {
      delete (grepCommand as Record<string, unknown>)[option.long.replace('--', '')];
    });

    // Reset captured output
    _capturedOutput = '';
    capturedError = '';

    // Mock process.stdout.isTTY to enable summary output
    // We need to mock it properly to handle both highlighting and summary logic
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: false,
      configurable: true
    });

    // Create mock task store
    mockTaskStore = new MockTaskStore();

    // Create mock task manager instance
    mockTaskManagerInstance = {
      list: vi.fn(),
      get: vi.fn()
    };

    // Setup TaskManager constructor mock
    mockedTaskManager.mockImplementation(() => mockTaskManagerInstance as TaskManager);
    // Setup TaskManager.create static method mock
    mockedTaskManagerCreate.mockResolvedValue(mockTaskManagerInstance as TaskManager);

    // Setup output mocks
    mockedPrintOutput.mockImplementation((output: string) => {
      _capturedOutput += output;
    });

    mockedPrintError.mockImplementation((error: string) => {
      capturedError += error;
    });

    // Setup formatTasks mock with comprehensive formatting
    mockedFormatTasks.mockImplementation((tasks: Task[], format = 'ndjson') => {
      if (format === 'ndjson') {
        return tasks.map((task) => JSON.stringify(task)).join('\n');
      }
      if (format === 'json') {
        return JSON.stringify(tasks, null, 2);
      }
      if (format === 'table') {
        const header = 'ID | Title | Status | Tags';
        const separator = '---|-------|--------|-----';
        const rows = tasks.map(
          (task) => `${task.id} | ${task.title} | ${task.status} | ${task.tags?.join(', ') || ''}`
        );
        return [header, separator, ...rows].join('\n');
      }
      if (format === 'csv') {
        const header = 'id,title,status,tags';
        const rows = tasks.map(
          (task) => `${task.id},"${task.title}","${task.status}","${task.tags?.join(';') || ''}"`
        );
        return [header, ...rows].join('\n');
      }
      if (format === 'yaml') {
        return tasks
          .map((task) => {
            const tags =
              task.tags && task.tags.length > 0
                ? `\n  tags:\n${task.tags.map((tag) => `    - ${tag}`).join('\n')}`
                : '';
            return `- id: ${task.id}\n  title: ${task.title}\n  status: ${task.status}${tags}`;
          })
          .join('\n');
      }
      return tasks.map((task) => JSON.stringify(task)).join('\n');
    });

    // Setup test tasks
    await setupTestTasks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stdout, 'isTTY', {
      value: _originalIsTTY,
      writable: false,
      configurable: true
    });
  });

  async function setupTestTasks(): Promise<void> {
    // Task 1: Fix urgent bug in API
    mockTaskStore.addTask({
      id: 1,
      title: 'Fix urgent bug in API',
      content:
        'There is a critical bug in the user authentication API that needs immediate attention.',
      status: 'pending',
      tags: ['bug', 'urgent', 'api'],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      dependencies: []
    });

    // Task 2: Implement new feature
    mockTaskStore.addTask({
      id: 2,
      title: 'Implement new feature',
      content:
        'Add support for user profile management. This feature should include photo upload and basic info editing.',
      status: 'in-progress',
      tags: ['feature', 'user'],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      dependencies: []
    });

    // Task 3: Update documentation
    mockTaskStore.addTask({
      id: 3,
      title: 'Update documentation',
      content:
        'The API documentation needs to be updated to reflect recent changes. Include examples for all endpoints.',
      status: 'pending',
      tags: ['docs', 'api'],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      dependencies: []
    });

    // Task 4: Setup CI/CD pipeline
    mockTaskStore.addTask({
      id: 4,
      title: 'Setup CI/CD pipeline',
      content: 'Configure automated testing and deployment. Use GitHub Actions for the workflow.',
      status: 'done',
      tags: ['devops', 'automation'],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      dependencies: []
    });

    // Task 5: Code review process
    mockTaskStore.addTask({
      id: 5,
      title: 'Code review process',
      content: 'Establish a formal code review process. All PRs must be reviewed before merging.',
      status: 'pending',
      tags: ['process', 'quality'],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      dependencies: []
    });

    // Task 6: Database optimization
    mockTaskStore.addTask({
      id: 6,
      title: 'Database optimization',
      content: 'Optimize database queries for better performance. Focus on the user table indexes.',
      status: 'in-progress',
      tags: ['database', 'performance'],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      dependencies: []
    });

    // Setup mock implementations
    mockTaskManagerInstance.list.mockResolvedValue(await mockTaskStore.getAll());
    mockTaskManagerInstance.get.mockImplementation(async (id: number) => {
      const task = await mockTaskStore.get(id);
      return task;
    });
  }

  describe('basic search functionality', () => {
    it('should find tasks by simple text match', async () => {
      await grepTasks('API', {});

      expect(mockTaskManagerInstance.list).toHaveBeenCalledOnce();
      expect(mockTaskManagerInstance.get).toHaveBeenCalledTimes(6); // All tasks to get content
      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Fix urgent bug in API' }),
          expect.objectContaining({ title: 'Update documentation' })
        ]),
        'ndjson'
      );
      expect(mockedPrintOutput).toHaveBeenCalledOnce();
      expect(capturedError).toContain('Found 2 matching tasks');
    });

    it('should search in both title and content by default', async () => {
      await grepTasks('user', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Fix urgent bug in API' }),
          expect.objectContaining({ title: 'Implement new feature' }),
          expect.objectContaining({ title: 'Database optimization' })
        ]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 3 matching tasks');
    });

    it('should handle case-sensitive search by default', async () => {
      await grepTasks('Use', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Setup CI/CD pipeline' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should return exit code 1 when no matches found', async () => {
      await expect(grepTasks('nonexistent', {})).rejects.toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('No tasks found matching pattern: nonexistent');
    });

    it('should display match count summary', async () => {
      await grepTasks('API', {});

      expect(capturedError).toContain('Found 2 matching tasks');
    });
  });

  describe('case insensitive search', () => {
    it('should perform case-insensitive search with ignoreCase option', async () => {
      await grepTasks('API', { ignoreCase: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Fix urgent bug in API' }),
          expect.objectContaining({ title: 'Update documentation' })
        ]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 2 matching tasks');
    });

    it('should perform case-insensitive search with documentation', async () => {
      await grepTasks('documentation', { ignoreCase: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Update documentation' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should find more matches with case-insensitive search', async () => {
      // Test case-sensitive first
      await grepTasks('Use', {});
      const caseSensitiveCall = mockedFormatTasks.mock.calls[0][0];

      // Clear mocks and test case-insensitive
      vi.clearAllMocks();
      capturedError = '';
      mockedFormatTasks.mockImplementation((tasks: Task[], _format = 'ndjson') => {
        return tasks.map((task) => JSON.stringify(task)).join('\n');
      });

      await grepTasks('use', { ignoreCase: true });
      const caseInsensitiveCall = mockedFormatTasks.mock.calls[0][0];

      expect(caseInsensitiveCall.length).toBeGreaterThan(caseSensitiveCall.length);
    });
  });

  describe('scoped search options', () => {
    it('should search only in titles with titleOnly option', async () => {
      await grepTasks('bug', { titleOnly: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Fix urgent bug in API' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should search only in content with contentOnly option', async () => {
      await grepTasks('critical', { contentOnly: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Fix urgent bug in API' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should not find title matches when using contentOnly', async () => {
      await expect(grepTasks('Fix', { contentOnly: true })).rejects.toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('No tasks found matching pattern: Fix');
    });

    it('should not find content matches when using titleOnly', async () => {
      await expect(grepTasks('critical', { titleOnly: true })).rejects.toThrow(
        'Process exit called'
      );

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('No tasks found matching pattern: critical');
    });
  });

  describe('regular expression support', () => {
    it('should support basic regex patterns', async () => {
      await grepTasks('bug|feature', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Fix urgent bug in API' }),
          expect.objectContaining({ title: 'Implement new feature' })
        ]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 2 matching tasks');
    });

    it('should support anchored regex patterns', async () => {
      await grepTasks('^Fix', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Fix urgent bug in API' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should support character classes', async () => {
      await grepTasks('[Ff]ix', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Fix urgent bug in API' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should support quantifiers', async () => {
      await grepTasks('user.*management', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Implement new feature' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should handle invalid regex patterns', async () => {
      await expect(grepTasks('[invalid', {})).rejects.toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('Invalid regular expression: [invalid');
    });
  });

  describe('output formats', () => {
    it('should output NDJSON by default', async () => {
      await grepTasks('API', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'ndjson'
      );
    });

    it('should output pretty table format with pretty option', async () => {
      await grepTasks('API', { pretty: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'table'
      );
    });

    it('should support JSON format', async () => {
      await grepTasks('API', { format: 'json' });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'json'
      );
    });

    it('should support CSV format', async () => {
      await grepTasks('API', { format: 'csv' });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'csv'
      );
    });

    it('should support YAML format', async () => {
      await grepTasks('API', { format: 'yaml' });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'yaml'
      );
    });

    it('should reject invalid format', async () => {
      await expect(grepTasks('API', { format: 'invalid' })).rejects.toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith(
        'Invalid format: invalid. Valid formats: ndjson, json, table, csv, yaml'
      );
    });

    it('should prioritize explicit format over pretty flag', async () => {
      await grepTasks('API', { pretty: true, format: 'json' });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'json'
      );
    });
  });

  describe('edge cases and special patterns', () => {
    it('should handle empty pattern', async () => {
      await expect(grepTasks('', {})).rejects.toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('No tasks found matching pattern: ');
    });

    it('should handle whitespace patterns', async () => {
      await grepTasks('\\s+', {});

      // Should find tasks with multiple whitespace characters
      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'ndjson'
      );
      expect(capturedError).toMatch(/Found \d+ matching task/);
    });

    it('should handle special regex characters', async () => {
      await grepTasks('\\.', {});

      // Should find tasks with periods
      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
        'ndjson'
      );
    });

    it('should handle unicode characters', async () => {
      // Add task with unicode content
      mockTaskStore.addTask({
        id: 7,
        title: 'Unicode task émojis 🚀',
        content: 'Content with unicode: 测试',
        status: 'pending',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        dependencies: []
      });

      // Update the list mock to include the new task
      mockTaskManagerInstance.list.mockResolvedValue(await mockTaskStore.getAll());

      await grepTasks('émojis', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Unicode task émojis 🚀' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should handle tasks with no content', async () => {
      // Add task with no content
      mockTaskStore.addTask({
        id: 8,
        title: 'Empty content task',
        status: 'pending',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        dependencies: []
      });

      // Update the list mock to include the new task
      mockTaskManagerInstance.list.mockResolvedValue(await mockTaskStore.getAll());

      await grepTasks('Empty', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Empty content task' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should handle multiline content patterns', async () => {
      // Add task with multiline content
      mockTaskStore.addTask({
        id: 9,
        title: 'Multiline task',
        content: 'First line\nSecond line\nThird line',
        status: 'pending',
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        dependencies: []
      });

      // Update the list mock to include the new task
      mockTaskManagerInstance.list.mockResolvedValue(await mockTaskStore.getAll());

      await grepTasks('Second', {});

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Multiline task' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });
  });

  describe('combined options', () => {
    it('should combine case-insensitive and title-only search', async () => {
      await grepTasks('FIX', { ignoreCase: true, titleOnly: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Fix urgent bug in API' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should combine case-insensitive and content-only search', async () => {
      await grepTasks('CRITICAL', { ignoreCase: true, contentOnly: true });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Fix urgent bug in API' })]),
        'ndjson'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });

    it('should combine search scope and output format', async () => {
      await grepTasks('documentation', { titleOnly: true, format: 'json' });

      expect(mockedFormatTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Update documentation' })]),
        'json'
      );
      expect(capturedError).toContain('Found 1 matching task');
    });
  });

  describe('error handling', () => {
    it('should handle task manager errors', async () => {
      mockTaskManagerInstance.list.mockRejectedValue(new Error('Database error'));

      await expect(grepTasks('test', {})).rejects.toThrow('Process exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('Database error');
    });

    it('should handle regex errors gracefully', async () => {
      await expect(grepTasks('[unclosed', {})).rejects.toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockedPrintError).toHaveBeenCalledWith('Invalid regular expression: [unclosed');
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(grepCommand.name()).toBe('grep');
      expect(grepCommand.description()).toContain('Search tasks by pattern');
      expect(grepCommand.description()).toContain('regular expressions');
      expect(grepCommand.usage()).toContain('<pattern>');
    });

    it('should have all expected options', () => {
      const options = grepCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--ignore-case');
      expect(optionNames).toContain('--title-only');
      expect(optionNames).toContain('--content-only');
      expect(optionNames).toContain('--pretty');
      expect(optionNames).toContain('--format');
    });

    it('should have correct option aliases', () => {
      const options = grepCommand.options;

      const ignoreCaseOption = options.find((opt) => opt.long === '--ignore-case');
      expect(ignoreCaseOption?.short).toBe('-i');

      const prettyOption = options.find((opt) => opt.long === '--pretty');
      expect(prettyOption?.short).toBe('-p');

      const formatOption = options.find((opt) => opt.long === '--format');
      expect(formatOption?.short).toBe('-f');
    });

    it('should include helpful examples in help text', () => {
      expect(grepCommand.description()).toContain('Search tasks by pattern');
      expect(grepCommand.description()).toContain('regular expressions');
    });
  });
});
