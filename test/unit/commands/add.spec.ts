import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { addCommand } from '@/commands/add';
import { TestWorkspace, runSTMSuccess, runSTMFailure } from '@test/helpers';

describe('Add Command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
    // Initialize STM in the workspace
    await runSTMSuccess(['init'], { cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('basic task creation', () => {
    it('should create a simple task with just a title', async () => {
      const title = 'Simple Task';

      const result = await runSTMSuccess(['add', title], { cwd: workspace.directory });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe(title);
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].tags).toEqual([]);
      expect(tasks[0].dependencies).toEqual([]);
    });

    it('should create a task with description', async () => {
      const title = 'Task with Description';
      const description = 'This is a detailed task description';

      const result = await runSTMSuccess(['add', title, '--description', description], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe(title);
      expect(tasks[0].content?.trim()).toBe(description);
    });

    it('should create a task with status', async () => {
      const title = 'In Progress Task';

      const result = await runSTMSuccess(['add', title, '--status', 'in-progress'], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe(title);
      expect(tasks[0].status).toBe('in-progress');
    });

    it('should create a task with tags', async () => {
      const title = 'Tagged Task';
      const tags = 'frontend,urgent,bug-fix';

      const result = await runSTMSuccess(['add', title, '--tags', tags], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe(title);
      expect(tasks[0].tags).toEqual(['frontend', 'urgent', 'bug-fix']);
    });

    it('should create a task with dependencies', async () => {
      // Create prerequisite tasks
      await runSTMSuccess(['add', 'Base Task 1'], { cwd: workspace.directory });
      await runSTMSuccess(['add', 'Base Task 2'], { cwd: workspace.directory });

      const title = 'Dependent Task';

      const result = await runSTMSuccess(['add', title, '--deps', '1,2'], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBeGreaterThan(0);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(3);

      const dependentTask = tasks.find((t) => t.title === title);
      expect(dependentTask?.dependencies).toEqual([1, 2]);
    });

    it('should create a task with all options', async () => {
      const title = 'Complete Task';
      const description = 'Full task with all options';
      const tags = 'feature,backend,api';
      const status = 'done';

      const result = await runSTMSuccess(
        ['add', title, '--description', description, '--tags', tags, '--status', status],
        { cwd: workspace.directory }
      );

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        title,
        content: description, // When only description is provided, no trailing newline
        tags: ['feature', 'backend', 'api'],
        status: 'done'
      });
    });
  });

  describe('input validation', () => {
    it('should reject empty title', async () => {
      const result = await runSTMFailure(['add', ''], { cwd: workspace.directory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Title is required');
    });

    it('should reject invalid status', async () => {
      const result = await runSTMFailure(['add', 'Test Task', '--status', 'invalid'], {
        cwd: workspace.directory
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Status must be one of: pending, in-progress, done');
    });

    it('should handle empty tags gracefully', async () => {
      const result = await runSTMSuccess(['add', 'Test Task', '--tags', ''], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].tags).toEqual([]);
    });

    it('should handle whitespace in tags', async () => {
      const result = await runSTMSuccess(['add', 'Test Task', '--tags', ' tag1 , tag2 , tag3 '], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should reject invalid dependency IDs', async () => {
      const result = await runSTMFailure(['add', 'Test Task', '--deps', 'invalid,123'], {
        cwd: workspace.directory
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid dependency ID: invalid');
    });

    it('should reject zero or negative dependency IDs', async () => {
      const result1 = await runSTMFailure(['add', 'Test Task', '--deps', '0'], {
        cwd: workspace.directory
      });
      const result2 = await runSTMFailure(['add', 'Test Task', '--deps', '-1'], {
        cwd: workspace.directory
      });

      expect(result1.exitCode).toBe(1);
      expect(result2.exitCode).toBe(1);
      expect(result1.stderr).toContain('Invalid dependency ID: 0');
      expect(result2.stderr).toContain('Invalid dependency ID: -1');
    });

    it('should handle empty dependencies gracefully', async () => {
      const result = await runSTMSuccess(['add', 'Test Task', '--deps', ''], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].dependencies).toEqual([]);
    });

    it('should handle whitespace in dependencies', async () => {
      // Create prerequisite tasks
      await runSTMSuccess(['add', 'Task 1'], { cwd: workspace.directory });
      await runSTMSuccess(['add', 'Task 2'], { cwd: workspace.directory });

      const result = await runSTMSuccess(['add', 'Test Task', '--deps', ' 1 , 2 '], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBeGreaterThan(0);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      const testTask = tasks.find((t) => t.title === 'Test Task');
      expect(testTask?.dependencies).toEqual([1, 2]);
    });
  });

  describe('short option flags', () => {
    it('should accept -d for description', async () => {
      const result = await runSTMSuccess(['add', 'Test Task', '-d', 'Short description'], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].content?.trim()).toBe('Short description');
    });

    it('should accept -t for tags', async () => {
      const result = await runSTMSuccess(['add', 'Test Task', '-t', 'tag1,tag2'], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].tags).toEqual(['tag1', 'tag2']);
    });

    it('should accept -s for status', async () => {
      const result = await runSTMSuccess(['add', 'Test Task', '-s', 'in-progress'], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].status).toBe('in-progress');
    });
  });

  describe('body sections', () => {
    it('should create a task with details section', async () => {
      const title = 'Task with Details';
      const details = 'Implementation details go here';

      const result = await runSTMSuccess(['add', title, '--details', details], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by showing task
      const showResult = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(showResult.stdout).toContain('## Details');
      expect(showResult.stdout).toContain(details);
    });

    it('should create a task with validation section', async () => {
      const title = 'Task with Validation';
      const validation = '- [ ] Unit tests\n- [ ] Integration tests';

      const result = await runSTMSuccess(['add', title, '--validation', validation], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by showing task
      const showResult = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(showResult.stdout).toContain('## Validation');
      expect(showResult.stdout).toContain('- [ ] Unit tests');
      expect(showResult.stdout).toContain('- [ ] Integration tests');
    });

    it('should create a task with all sections', async () => {
      const title = 'Complete Task';
      const description = 'Main task description';
      const details = 'Technical implementation details';
      const validation = 'Test checklist';

      const result = await runSTMSuccess(
        [
          'add',
          title,
          '--description',
          description,
          '--details',
          details,
          '--validation',
          validation
        ],
        { cwd: workspace.directory }
      );

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by showing task
      const showResult = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(showResult.stdout).toContain(description);
      expect(showResult.stdout).toContain('## Details');
      expect(showResult.stdout).toContain(details);
      expect(showResult.stdout).toContain('## Validation');
      expect(showResult.stdout).toContain(validation);
    });

    it('should support stdin for description', async () => {
      const title = 'Task with stdin description';
      const description = 'Description from stdin';

      const result = await runSTMSuccess(['add', title, '--description', '-'], {
        cwd: workspace.directory,
        input: description
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].content).toContain(description);
    });

    it('should support stdin for details', async () => {
      const title = 'Task with stdin details';
      const details = 'Details from stdin';

      const result = await runSTMSuccess(['add', title, '--details', '-'], {
        cwd: workspace.directory,
        input: details
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by showing task
      const showResult = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(showResult.stdout).toContain('## Details');
      expect(showResult.stdout).toContain(details);
    });

    it('should support stdin for validation', async () => {
      const title = 'Task with stdin validation';
      const validation = 'Validation from stdin';

      const result = await runSTMSuccess(['add', title, '--validation', '-'], {
        cwd: workspace.directory,
        input: validation
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by showing task
      const showResult = await runSTMSuccess(['show', '1'], { cwd: workspace.directory });
      expect(showResult.stdout).toContain('## Validation');
      expect(showResult.stdout).toContain(validation);
    });
  });

  describe('special characters and edge cases', () => {
    it('should handle titles with special characters', async () => {
      const specialTitles = [
        'Task with émojis 🚀',
        'Task with unicode: 测试',
        'Task with symbols: @#$%'
      ];

      for (const title of specialTitles) {
        await runSTMSuccess(['add', title], { cwd: workspace.directory });
      }

      // Verify tasks were created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks).toHaveLength(specialTitles.length);

      for (let i = 0; i < specialTitles.length; i++) {
        expect(tasks[i].title).toBe(specialTitles[i]);
      }
    });

    it('should handle multiline descriptions', async () => {
      const multilineDesc = 'Line 1\nLine 2\nLine 3';

      const result = await runSTMSuccess(
        ['add', 'Multiline Task', '--description', multilineDesc],
        { cwd: workspace.directory }
      );

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].content?.trim()).toBe(multilineDesc);
    });

    it('should handle very long titles', async () => {
      const longTitle = 'A'.repeat(200);

      const result = await runSTMSuccess(['add', longTitle], { cwd: workspace.directory });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].title).toBe(longTitle);
    });

    it('should handle very long descriptions', async () => {
      const longDesc = 'A'.repeat(1000);

      const result = await runSTMSuccess(['add', 'Long Desc Task', '--description', longDesc], {
        cwd: workspace.directory
      });

      // Should output task ID
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);

      // Verify task was created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const tasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(tasks[0].content?.trim()).toBe(longDesc);
    });
  });

  describe('output format', () => {
    it('should output task ID', async () => {
      const result = await runSTMSuccess(['add', 'Test Task'], { cwd: workspace.directory });

      // Should output task ID as a number
      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);
      expect(taskId).toBeGreaterThan(0);
    });

    it('should output task ID for complex tasks', async () => {
      const result = await runSTMSuccess(
        [
          'add',
          'Complete Task',
          '--description',
          'Test description',
          '--tags',
          'tag1,tag2',
          '--status',
          'in-progress'
        ],
        { cwd: workspace.directory }
      );

      const taskId = parseInt(result.stdout.trim(), 10);
      expect(taskId).toBe(1);
      expect(taskId).toBeGreaterThan(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple add commands sequentially', async () => {
      const tasks = ['Task 1', 'Task 2', 'Task 3'];

      for (const title of tasks) {
        await runSTMSuccess(['add', title], { cwd: workspace.directory });
      }

      // Verify tasks were created by listing tasks
      const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
      const allTasks = listResult.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      expect(allTasks).toHaveLength(3);

      for (let i = 0; i < tasks.length; i++) {
        expect(allTasks[i].title).toBe(tasks[i]);
        expect(allTasks[i].id).toBeGreaterThan(0);
      }
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(addCommand.name()).toBe('add');
      expect(addCommand.description()).toContain('Add a new task');

      // Check that arguments are properly configured
      const usage = addCommand.usage();
      expect(usage).toContain('<title>');
    });

    it('should have all expected options', () => {
      const options = addCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--description');
      expect(optionNames).toContain('--details');
      expect(optionNames).toContain('--validation');
      expect(optionNames).toContain('--tags');
      expect(optionNames).toContain('--deps');
      expect(optionNames).toContain('--status');
    });

    it('should have correct option aliases', () => {
      const options = addCommand.options;

      const descOption = options.find((opt) => opt.long === '--description');
      expect(descOption?.short).toBe('-d');

      const tagsOption = options.find((opt) => opt.long === '--tags');
      expect(tagsOption?.short).toBe('-t');

      const statusOption = options.find((opt) => opt.long === '--status');
      expect(statusOption?.short).toBe('-s');
    });
  });
});
