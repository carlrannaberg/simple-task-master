/**
 * Integration tests for update command section functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner } from '@test/helpers/cli-runner';

describe('Update Command Section Integration Tests', () => {
  let workspace: TestWorkspace;
  let cli: CLITestRunner;

  beforeEach(async () => {
    workspace = await TestWorkspace.create('update-sections-test-');
    cli = new CLITestRunner({ cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it.skip('should exit with code 2 when no changes are specified', async () => {
    // Create a task first
    const addResult = await cli.run(['add', 'Test task']);
    expect(addResult.exitCode).toBe(0);
    const taskId = addResult.stdout.trim();

    // Try to update without changes
    const result = await cli.run(['update', taskId]);
    expect(result.exitCode).toBe(2);
  }, 20000); // Increase timeout for this test

  it('should update description section', async () => {
    // Create a task
    const addResult = await cli.run(['add', 'Test task', '-d', 'Initial description']);
    expect(addResult.exitCode).toBe(0);
    const taskId = addResult.stdout.trim();

    // Update description
    const updateResult = await cli.run([
      'update',
      taskId,
      '--description',
      'Updated description'
    ]);
    expect(updateResult.exitCode).toBe(0);

    // Check the result
    const showResult = await cli.run(['show', taskId]);
    expect(showResult.exitCode).toBe(0);
    expect(showResult.stdout).toContain('Updated description');
    expect(showResult.stdout).not.toContain('Initial description');
  });

  it('should add details and validation sections', async () => {
    // Create a task
    const addResult = await cli.run(['add', 'Test task', '-d', 'Description']);
    expect(addResult.exitCode).toBe(0);
    const taskId = addResult.stdout.trim();

    // Add details and validation
    const updateResult = await cli.run([
      'update',
      taskId,
      '--details',
      'Implementation notes',
      '--validation',
      'Test checklist'
    ]);
    expect(updateResult.exitCode).toBe(0);

    // Check the result
    const showResult = await cli.run(['show', taskId]);
    expect(showResult.exitCode).toBe(0);
    expect(showResult.stdout).toContain('Description');
    expect(showResult.stdout).toContain('## Details');
    expect(showResult.stdout).toContain('Implementation notes');
    expect(showResult.stdout).toContain('## Validation');
    expect(showResult.stdout).toContain('Test checklist');
  });

  it('should update individual sections without affecting others', async () => {
    // Create a task with sections
    const addResult = await cli.run(['add', 'Test task', '-d', 'Description']);
    expect(addResult.exitCode).toBe(0);
    const taskId = addResult.stdout.trim();

    const updateResult1 = await cli.run([
      'update',
      taskId,
      '--details',
      'Original details',
      '--validation',
      'Original validation'
    ]);
    expect(updateResult1.exitCode).toBe(0);

    // Update only validation
    const updateResult2 = await cli.run([
      'update',
      taskId,
      '--validation',
      'Updated validation'
    ]);
    expect(updateResult2.exitCode).toBe(0);

    // Check the result
    const showResult = await cli.run(['show', taskId]);
    expect(showResult.exitCode).toBe(0);
    expect(showResult.stdout).toContain('Description');
    expect(showResult.stdout).toContain('Original details');
    expect(showResult.stdout).toContain('Updated validation');
    expect(showResult.stdout).not.toContain('Original validation');
  });

  it('should handle section updates via assignment syntax', async () => {
    // Create a task
    const addResult = await cli.run(['add', 'Test task']);
    expect(addResult.exitCode).toBe(0);
    const taskId = addResult.stdout.trim();

    // Update sections via assignments
    const updateResult = await cli.run([
      'update',
      taskId,
      'desc=Assignment description',
      'details=Assignment details',
      'validation=Assignment validation'
    ]);
    expect(updateResult.exitCode).toBe(0);

    // Check the result
    const showResult = await cli.run(['show', taskId]);
    expect(showResult.exitCode).toBe(0);
    expect(showResult.stdout).toContain('Assignment description');
    expect(showResult.stdout).toContain('## Details');
    expect(showResult.stdout).toContain('Assignment details');
    expect(showResult.stdout).toContain('## Validation');
    expect(showResult.stdout).toContain('Assignment validation');
  });
});
