/**
 * Integration tests for update command section functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = path.join(__dirname, '../../bin/stm');
const TEST_DIR = path.join(__dirname, '../../temp-test/update-sections-test');

describe('Update Command Section Integration Tests', () => {
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);

    // Initialize STM
    execSync(`echo "y" | ${CLI_PATH} init`, { encoding: 'utf8' });
  });

  afterEach(async () => {
    // Clean up
    process.chdir(__dirname);
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should exit with code 2 when no changes are specified', () => {
    // Create a task first
    const taskId = execSync(`${CLI_PATH} add "Test task"`, { encoding: 'utf8' }).trim();

    // Try to update without changes
    let exitCode = 0;
    try {
      execSync(`${CLI_PATH} update ${taskId}`, { encoding: 'utf8' });
    } catch (error: unknown) {
      exitCode =
        error && typeof error === 'object' && 'status' in error
          ? (error as { status: number }).status
          : 1;
    }

    expect(exitCode).toBe(2);
  });

  it('should update description section', () => {
    // Create a task
    const taskId = execSync(`${CLI_PATH} add "Test task" -d "Initial description"`, {
      encoding: 'utf8'
    }).trim();

    // Update description
    execSync(`${CLI_PATH} update ${taskId} --description "Updated description"`, {
      encoding: 'utf8'
    });

    // Check the result
    const content = execSync(`${CLI_PATH} show ${taskId}`, { encoding: 'utf8' });
    expect(content).toContain('Updated description');
    expect(content).not.toContain('Initial description');
  });

  it('should add details and validation sections', () => {
    // Create a task
    const taskId = execSync(`${CLI_PATH} add "Test task" -d "Description"`, {
      encoding: 'utf8'
    }).trim();

    // Add details and validation
    execSync(
      `${CLI_PATH} update ${taskId} --details "Implementation notes" --validation "Test checklist"`,
      { encoding: 'utf8' }
    );

    // Check the result
    const content = execSync(`${CLI_PATH} show ${taskId}`, { encoding: 'utf8' });
    expect(content).toContain('Description');
    expect(content).toContain('## Details');
    expect(content).toContain('Implementation notes');
    expect(content).toContain('## Validation');
    expect(content).toContain('Test checklist');
  });

  it('should update individual sections without affecting others', () => {
    // Create a task with sections
    const taskId = execSync(`${CLI_PATH} add "Test task" -d "Description"`, {
      encoding: 'utf8'
    }).trim();
    execSync(
      `${CLI_PATH} update ${taskId} --details "Original details" --validation "Original validation"`,
      { encoding: 'utf8' }
    );

    // Update only validation
    execSync(`${CLI_PATH} update ${taskId} --validation "Updated validation"`, {
      encoding: 'utf8'
    });

    // Check the result
    const content = execSync(`${CLI_PATH} show ${taskId}`, { encoding: 'utf8' });
    expect(content).toContain('Description');
    expect(content).toContain('Original details');
    expect(content).toContain('Updated validation');
    expect(content).not.toContain('Original validation');
  });

  it('should handle section updates via assignment syntax', () => {
    // Create a task
    const taskId = execSync(`${CLI_PATH} add "Test task"`, { encoding: 'utf8' }).trim();

    // Update sections via assignments
    execSync(
      `${CLI_PATH} update ${taskId} desc="Assignment description" details="Assignment details" validation="Assignment validation"`,
      { encoding: 'utf8' }
    );

    // Check the result
    const content = execSync(`${CLI_PATH} show ${taskId}`, { encoding: 'utf8' });
    expect(content).toContain('Assignment description');
    expect(content).toContain('## Details');
    expect(content).toContain('Assignment details');
    expect(content).toContain('## Validation');
    expect(content).toContain('Assignment validation');
  });
});
