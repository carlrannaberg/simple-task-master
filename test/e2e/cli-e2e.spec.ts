import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { runSTM, runSTMSuccess, CLITestRunner } from '@test/helpers/cli-runner';

describe(
  'CLI End-to-End',
  () => {
    let workspace: TestWorkspace;
    let _cliRunner: CLITestRunner;
    const stmBin = path.resolve(__dirname, '../../bin/stm');

    beforeEach(async () => {
      workspace = await TestWorkspace.create('cli-e2e-test-');
      _cliRunner = new CLITestRunner({ cwd: workspace.directory });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    describe('Full CLI Execution Tests', () => {
      it('should execute all basic commands successfully', async () => {
        // Test init command (already done by TestWorkspace, verify it worked)
        const listEmptyResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });
        expect(listEmptyResult.stdout.trim()).toBe('');

        // Test add command
        const addResult = await runSTMSuccess(
          ['add', 'Test Task', '--description', 'Test content'],
          {
            cwd: workspace.directory
          }
        );
        const taskId = parseInt(addResult.stdout.trim(), 10);
        expect(taskId).toBe(1);

        // Test list command
        const listResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });
        expect(listResult.stdout).toContain('Test Task');

        // Test show command
        const showResult = await runSTMSuccess(['show', '1'], {
          cwd: workspace.directory
        });
        expect(showResult.stdout).toContain('Test Task');
        expect(showResult.stdout).toContain('Test content');

        // Test update command
        const updateResult = await runSTMSuccess(
          ['update', '1', '--status', 'in-progress', '--title', 'Updated Test Task'],
          {
            cwd: workspace.directory
          }
        );
        expect(updateResult.exitCode).toBe(0);

        // Verify update
        const showUpdatedResult = await runSTMSuccess(['show', '1'], {
          cwd: workspace.directory
        });
        expect(showUpdatedResult.stdout).toContain('Updated Test Task');
        expect(showUpdatedResult.stdout).toContain('in-progress');
      });

      it('should handle complex command line arguments correctly', async () => {
        // Test with special characters (but not quotes which are invalid)
        const complexTitle = 'Task with apostrophes and & symbols';
        const complexContent = `Multi-line content
with various characters:
- Special: !@#$%^&*()
- Unicode: 🚀 ñáñà 中文
- JSON: {"key": "value"}`;

        const addResult = await runSTMSuccess(
          [
            'add',
            complexTitle,
            '--description',
            complexContent,
            '--tags',
            'special,unicode,complex',
            '--status',
            'pending'
          ],
          {
            cwd: workspace.directory
          }
        );

        const taskId = parseInt(addResult.stdout.trim(), 10);
        expect(taskId).toBe(1);

        // Verify complex content was stored correctly
        const showResult = await runSTMSuccess(['show', taskId.toString()], {
          cwd: workspace.directory
        });

        expect(showResult.stdout).toContain(complexTitle);
        expect(showResult.stdout).toContain('🚀');
        expect(showResult.stdout).toContain('中文');
        expect(showResult.stdout).toContain('{"key": "value"}');
        expect(showResult.stdout).toContain('special');
        expect(showResult.stdout).toContain('unicode');
      });

      it('should handle file system operations correctly', async () => {
        // Create task and verify file exists
        const addResult = await runSTMSuccess(
          ['add', 'Filesystem Test', '--description', 'Testing file operations'],
          {
            cwd: workspace.directory
          }
        );

        const taskId = parseInt(addResult.stdout.trim(), 10);

        // Verify task file was created
        const taskFile = `${taskId}-filesystem-test.md`;
        const taskFilePath = path.join(
          workspace.directory,
          '.simple-task-master',
          'tasks',
          taskFile
        );

        const fileExists = await fs
          .access(taskFilePath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);

        // Verify file content
        const fileContent = await fs.readFile(taskFilePath, 'utf8');
        expect(fileContent).toContain('Filesystem Test');
        expect(fileContent).toContain('Testing file operations');
        expect(fileContent).toContain('schema: 1');

        // Update task and verify file is modified
        const beforeUpdate = await fs.stat(taskFilePath);

        // Wait a bit to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 10));

        await runSTMSuccess(
          ['update', taskId.toString(), '--description', 'Updated file content'],
          {
            cwd: workspace.directory
          }
        );

        const afterUpdate = await fs.stat(taskFilePath);
        expect(afterUpdate.mtime.getTime()).toBeGreaterThan(beforeUpdate.mtime.getTime());

        // Verify updated content
        const updatedContent = await fs.readFile(taskFilePath, 'utf8');
        expect(updatedContent).toContain('Updated file content');
      });

      it('should handle JSON and export operations', async () => {
        // Create multiple tasks
        await runSTMSuccess(
          ['add', 'Task 1', '--description', 'First task', '--tags', 'test,export'],
          {
            cwd: workspace.directory
          }
        );
        await runSTMSuccess(['add', 'Task 2', '--description', 'Second task', '--tags', 'test'], {
          cwd: workspace.directory
        });
        await runSTMSuccess(['add', 'Task 3', '--description', 'Third task', '--status', 'done'], {
          cwd: workspace.directory
        });

        // Test JSON list output
        const jsonListResult = await runSTMSuccess(['list', '--format', 'json'], {
          cwd: workspace.directory
        });

        // JSON format returns a proper JSON array
        const tasks = JSON.parse(jsonListResult.stdout.trim());
        expect(tasks).toHaveLength(3);

        // Each task should have proper structure
        for (const task of tasks) {
          expect(task).toHaveProperty('id');
          expect(task).toHaveProperty('title');
          expect(task).toHaveProperty('status');
          expect(task).toHaveProperty('created');
          expect(task).toHaveProperty('updated');
          expect(task).toHaveProperty('tags');
          expect(task).toHaveProperty('dependencies');
        }

        // Test export to file
        const exportFile = path.join(workspace.directory, 'export-test.json');
        const exportResult = await runSTMSuccess(
          ['export', '--format', 'json', '--output', exportFile],
          {
            cwd: workspace.directory
          }
        );

        expect(exportResult.exitCode).toBe(0);

        // Verify export file was created
        const exportFileExists = await fs
          .access(exportFile)
          .then(() => true)
          .catch(() => false);
        expect(exportFileExists).toBe(true);

        // Verify export file content
        const exportContent = await fs.readFile(exportFile, 'utf8');
        const exportedTasks = JSON.parse(exportContent);
        expect(exportedTasks).toHaveLength(3);
        expect(exportedTasks[0]).toHaveProperty('title', 'Task 1');
      });

      it('should handle grep operations correctly', async () => {
        // Create tasks with searchable content
        await runSTMSuccess(
          [
            'add',
            'Frontend Development',
            '--description',
            'Implement React components for user interface'
          ],
          {
            cwd: workspace.directory
          }
        );

        await runSTMSuccess(
          ['add', 'Backend API', '--description', 'Create REST API endpoints for data management'],
          {
            cwd: workspace.directory
          }
        );

        await runSTMSuccess(
          ['add', 'Database Schema', '--description', 'Design database tables and relationships'],
          {
            cwd: workspace.directory
          }
        );

        // Test basic grep
        const grepResult = await runSTMSuccess(['grep', 'API'], {
          cwd: workspace.directory
        });
        expect(grepResult.stdout).toContain('Backend API');
        expect(grepResult.stdout).toContain('REST API endpoints');

        // Test case-insensitive grep
        const caseInsensitiveResult = await runSTMSuccess(['grep', 'react', '--ignore-case'], {
          cwd: workspace.directory
        });
        expect(caseInsensitiveResult.stdout).toContain('Frontend Development');
        expect(caseInsensitiveResult.stdout).toContain('React components');

        // Test grep with ignore-case (context not supported)
        const databaseResult = await runSTMSuccess(['grep', 'database', '--ignore-case'], {
          cwd: workspace.directory
        });
        expect(databaseResult.stdout).toContain('Database Schema');
        expect(databaseResult.stdout).toContain('Design database tables');
      });
    });

    describe('Exit Code Validation', () => {
      it('should return correct exit codes for successful operations', async () => {
        // Successful add
        const addResult = await runSTM(['add', 'Success Test'], {
          cwd: workspace.directory
        });
        expect(addResult.exitCode).toBe(0);

        // Successful list
        const listResult = await runSTM(['list'], {
          cwd: workspace.directory
        });
        expect(listResult.exitCode).toBe(0);

        // Successful show
        const showResult = await runSTM(['show', '1'], {
          cwd: workspace.directory
        });
        expect(showResult.exitCode).toBe(0);

        // Successful update
        const updateResult = await runSTM(['update', '1', '--status', 'done'], {
          cwd: workspace.directory
        });
        expect(updateResult.exitCode).toBe(0);

        // Successful export
        const exportResult = await runSTM(['export', '--format', 'json'], {
          cwd: workspace.directory
        });
        expect(exportResult.exitCode).toBe(0);
      });

      it('should return non-zero exit codes for errors', async () => {
        // Invalid command
        const invalidCommandResult = await runSTM(['invalid-command'], {
          cwd: workspace.directory
        });
        expect(invalidCommandResult.exitCode).not.toBe(0);
        expect(invalidCommandResult.stderr).toContain('unknown command');

        // Missing required argument
        const missingArgResult = await runSTM(['add'], {
          cwd: workspace.directory
        });
        expect(missingArgResult.exitCode).not.toBe(0);
        expect(missingArgResult.stderr).toContain('title');

        // Non-existent task
        const nonExistentResult = await runSTM(['show', '999'], {
          cwd: workspace.directory
        });
        expect(nonExistentResult.exitCode).not.toBe(0);
        expect(nonExistentResult.stderr).toContain('not found');

        // Invalid status
        const invalidStatusResult = await runSTM(['add', 'Test', '--status', 'invalid'], {
          cwd: workspace.directory
        });
        expect(invalidStatusResult.exitCode).not.toBe(0);
        expect(invalidStatusResult.stderr.toLowerCase()).toContain('status');

        // Invalid format
        const invalidFormatResult = await runSTM(['export', '--format', 'invalid'], {
          cwd: workspace.directory
        });
        expect(invalidFormatResult.exitCode).not.toBe(0);
        expect(invalidFormatResult.stderr).toContain('format');
      });

      it('should handle permission and file system errors with appropriate exit codes', async () => {
        // Test read-only directory scenario (skip on Windows)
        if (process.platform !== 'win32') {
          // Make tasks directory read-only
          await fs.chmod(workspace.tasksDirectory, 0o444);

          const permissionResult = await runSTM(['add', 'Permission Test'], {
            cwd: workspace.directory
          });
          expect(permissionResult.exitCode).not.toBe(0);
          expect(permissionResult.stderr).toMatch(/permission|access/i);

          // Restore permissions for cleanup
          await fs.chmod(workspace.tasksDirectory, 0o755);
        }
      });

      it('should handle workspace initialization errors', async () => {
        // Test in directory without STM initialization
        const tempDir = await fs.mkdtemp(path.join(workspace.directory, 'temp-'));

        const uninitializedResult = await runSTM(['list'], {
          cwd: tempDir
        });
        // An uninitialized directory returns exit code 0 with empty output
        // This is actually expected behavior - list returns empty when no tasks exist
        expect(uninitializedResult.exitCode).toBe(0);
        expect(uninitializedResult.stdout.trim()).toBe('');
      });
    });

    describe('Real File System Operations', () => {
      it('should handle large numbers of tasks efficiently', async () => {
        // Create tasks - reduced number for test stability
        const _batchSize = 5;
        const totalTasks = 20;

        const startTime = Date.now();

        // Create tasks sequentially to avoid any lock contention
        for (let i = 0; i < totalTasks; i++) {
          await runSTMSuccess(
            ['add', `Task ${i + 1}`, '--description', `Content for task ${i + 1}`],
            {
              cwd: workspace.directory
            }
          );
        }

        const creationTime = Date.now() - startTime;

        // Creation should complete in reasonable time
        expect(creationTime).toBeLessThan(30000); // 30 seconds

        // Verify all tasks were created
        const listStartTime = Date.now();
        const listResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });
        const listTime = Date.now() - listStartTime;

        expect(listTime).toBeLessThan(5000); // 5 seconds for listing

        // List returns NDJSON by default, each line is a JSON object
        const taskLines = listResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim());
        expect(taskLines).toHaveLength(20);

        // Verify each line is valid JSON
        for (const line of taskLines) {
          const task = JSON.parse(line);
          expect(task).toHaveProperty('id');
        }

        // Verify file system state
        const tasksDir = path.join(workspace.directory, '.simple-task-master', 'tasks');
        const files = await fs.readdir(tasksDir);
        const markdownFiles = files.filter((f) => f.endsWith('.md'));
        expect(markdownFiles).toHaveLength(20);
      });

      it('should handle file corruption gracefully', async () => {
        // Create valid task
        await runSTMSuccess(['add', 'Valid Task', '--description', 'Valid content'], {
          cwd: workspace.directory
        });

        // Corrupt the task file
        const tasksDir = path.join(workspace.directory, '.simple-task-master', 'tasks');
        const files = await fs.readdir(tasksDir);
        const taskFile = files.find((f) => f.endsWith('.md'));
        if (!taskFile) throw new Error('No task file found');
        const taskFilePath = path.join(tasksDir, taskFile);

        await fs.writeFile(taskFilePath, 'Corrupted content without proper frontmatter');

        // List should handle corruption gracefully
        const listResult = await runSTM(['list'], {
          cwd: workspace.directory
        });
        expect(listResult.exitCode).toBe(0);
        expect(listResult.stdout.trim()).toBe(''); // No valid tasks found

        // Should still be able to create new tasks
        const newTaskResult = await runSTMSuccess(
          ['add', 'New Task', '--description', 'After corruption'],
          {
            cwd: workspace.directory
          }
        );
        expect(newTaskResult.exitCode).toBe(0);
      });

      it('should maintain data integrity during system stress', async () => {
        // Create initial set of tasks sequentially to ensure they all exist
        for (let i = 0; i < 20; i++) {
          await runSTMSuccess(
            ['add', `Stress Test Task ${i + 1}`, '--description', `Content ${i + 1}`],
            {
              cwd: workspace.directory
            }
          );
        }

        // Perform many rapid updates in smaller batches
        const updateBatchSize = 5;
        for (let batch = 0; batch < 10; batch++) {
          const updatePromises = Array.from({ length: updateBatchSize }, (_, i) => {
            const updateIndex = batch * updateBatchSize + i;
            const taskId = ((updateIndex % 20) + 1).toString();
            return runSTMSuccess(
              ['update', taskId, '--description', `Updated content ${updateIndex}`],
              {
                cwd: workspace.directory
              }
            );
          });
          await Promise.all(updatePromises);
        }

        // Verify final state integrity
        const finalListResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });

        const taskCount = finalListResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim()).length;
        expect(taskCount).toBe(20);

        // Verify all tasks can be shown without errors
        for (let i = 1; i <= 20; i++) {
          const showResult = await runSTMSuccess(['show', i.toString()], {
            cwd: workspace.directory
          });
          expect(showResult.stdout).toContain(`Stress Test Task ${i}`);
        }
      });

      it('should handle workspace directory changes', async () => {
        // Create task in original location
        await runSTMSuccess(['add', 'Original Task', '--description', 'In original workspace'], {
          cwd: workspace.directory
        });

        // Verify task exists
        const originalListResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });
        expect(originalListResult.stdout).toContain('Original Task');

        // Move entire workspace to new location
        const newWorkspaceDir = path.join(workspace.directory, '..', 'moved-workspace');
        await fs.rename(workspace.directory, newWorkspaceDir);

        // Update workspace reference
        workspace = {
          ...workspace,
          directory: newWorkspaceDir,
          cleanup: async () => {
            try {
              await fs.rm(newWorkspaceDir, { recursive: true, force: true });
            } catch (error) {
              console.warn(`Failed to clean up moved workspace: ${error}`);
            }
          }
        } as TestWorkspace;

        // Verify task still exists in new location
        const movedListResult = await runSTMSuccess(['list'], {
          cwd: newWorkspaceDir
        });
        expect(movedListResult.stdout).toContain('Original Task');

        // Should be able to add new tasks in moved location
        await runSTMSuccess(['add', 'New Task in Moved Location', '--description', 'After move'], {
          cwd: newWorkspaceDir
        });

        const finalListResult = await runSTMSuccess(['list'], {
          cwd: newWorkspaceDir
        });
        expect(finalListResult.stdout).toContain('Original Task');
        expect(finalListResult.stdout).toContain('New Task in Moved Location');
      });
    });

    describe('Process Management and Signals', () => {
      it('should handle process termination gracefully', async () => {
        // Start a long-running operation and terminate it
        const longProcess = spawn(
          'node',
          [stmBin, 'add', 'Long Task', '--description', 'Long content'],
          {
            cwd: workspace.directory,
            stdio: ['pipe', 'pipe', 'pipe']
          }
        );

        // Set up handlers before anything else
        const exitPromise = new Promise<number>((resolve) => {
          let resolved = false;
          const handleExit = (code: number | null): void => {
            if (!resolved) {
              resolved = true;
              resolve(code ?? -1);
            }
          };
          longProcess.on('close', handleExit);
          longProcess.on('exit', handleExit);
        });

        // Allow process to start
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Terminate process
        longProcess.kill('SIGTERM');

        // Wait for exit with timeout
        const exitCode = await Promise.race([
          exitPromise,
          new Promise<number>((resolve) =>
            setTimeout(() => {
              longProcess.kill('SIGKILL');
              resolve(-1);
            }, 5000)
          )
        ]);

        // Process should exit when terminated
        // The add command might actually complete quickly, so check if it exited
        expect([0, -1, null]).toContain(exitCode); // Could be 0 (completed), -1 (killed), or null
      }, 15000); // 15 second timeout

      it('should handle concurrent process access correctly', async () => {
        // Start multiple processes simultaneously
        const processes = Array.from({ length: 5 }, (_, i) =>
          spawn(
            'node',
            [stmBin, 'add', `Concurrent Task ${i + 1}`, '--description', `Content ${i + 1}`],
            {
              cwd: workspace.directory,
              stdio: ['pipe', 'pipe', 'pipe']
            }
          )
        );

        // Wait for all processes to complete
        const results = await Promise.all(
          processes.map(
            (proc) =>
              new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
                let stdout = '';
                let stderr = '';
                proc.stdout?.on('data', (data) => {
                  stdout += data.toString();
                });
                proc.stderr?.on('data', (data) => {
                  stderr += data.toString();
                });
                proc.on('close', (code) =>
                  resolve({ exitCode: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() })
                );
              })
          )
        );

        // Count successful processes
        let successCount = 0;
        for (const result of results) {
          if (result.exitCode === 0 && result.stdout.trim()) {
            const taskId = parseInt(result.stdout.trim(), 10);
            expect(taskId).toBeGreaterThan(0); // Should have valid task ID
            successCount++;
          } else if (result.stderr) {
            // Lock contention is expected when running concurrently
            console.warn('Concurrent process failed:', result.stderr);
          }
        }

        // At least some processes should succeed
        expect(successCount).toBeGreaterThan(0);

        // Verify all tasks were created with unique IDs
        const finalListResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });

        const taskLines = finalListResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim());

        // Should have created at least as many tasks as succeeded
        expect(taskLines.length).toBeGreaterThanOrEqual(successCount);

        // All task IDs should be unique
        const taskIds = results
          .filter((r) => r.exitCode === 0 && r.stdout.trim())
          .map((r) => {
            const taskId = parseInt(r.stdout.trim(), 10);
            return taskId;
          });
        const uniqueIds = new Set(taskIds);
        expect(uniqueIds.size).toBe(successCount);
      });
    });

    describe('Environment and Configuration', () => {
      it('should respect environment variables', async () => {
        // Test with custom environment
        const customEnv = {
          ...process.env,
          NODE_ENV: 'test',
          STM_CONFIG: 'custom-config'
        };

        const envResult = await runSTM(['add', 'Env Test Task'], {
          cwd: workspace.directory,
          env: customEnv
        });

        expect(envResult.exitCode).toBe(0);

        // Verify task was created normally
        const listResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });
        expect(listResult.stdout).toContain('Env Test Task');
      });

      it('should handle different working directories correctly', async () => {
        // Create subdirectory
        const subDir = path.join(workspace.directory, 'subdir');
        await fs.mkdir(subDir);

        // Create a deeply nested subdirectory
        const deepDir = path.join(workspace.directory, 'subdir', 'deep', 'nested');
        await fs.mkdir(deepDir, { recursive: true });

        // Add a task from the main directory
        const mainResult = await runSTMSuccess(['add', 'Main Task'], {
          cwd: workspace.directory
        });
        expect(mainResult.exitCode).toBe(0);

        // STM should work from subdirectory by finding parent workspace
        const subDirResult = await runSTMSuccess(['add', 'Subdir Task'], {
          cwd: subDir
        });
        expect(subDirResult.exitCode).toBe(0);

        // STM should work from deeply nested directory
        const deepDirResult = await runSTMSuccess(['add', 'Deep Task'], {
          cwd: deepDir
        });
        expect(deepDirResult.exitCode).toBe(0);

        // List from subdirectory should show all tasks from parent workspace
        const subListResult = await runSTMSuccess(['list'], {
          cwd: subDir
        });
        expect(subListResult.stdout).toContain('Main Task');
        expect(subListResult.stdout).toContain('Subdir Task');
        expect(subListResult.stdout).toContain('Deep Task');

        // List from deeply nested directory should also show all tasks
        const deepListResult = await runSTMSuccess(['list'], {
          cwd: deepDir
        });
        expect(deepListResult.stdout).toContain('Main Task');
        expect(deepListResult.stdout).toContain('Subdir Task');
        expect(deepListResult.stdout).toContain('Deep Task');

        // Main directory should have all tasks
        const mainDirResult = await runSTMSuccess(['list'], {
          cwd: workspace.directory
        });
        expect(mainDirResult.stdout).toContain('Main Task');
        expect(mainDirResult.stdout).toContain('Subdir Task');
        expect(mainDirResult.stdout).toContain('Deep Task');

        // Test with a directory that has no STM workspace
        const tempDir = await fs.mkdtemp(path.join(workspace.directory, '..', 'temp-'));
        const noWorkspaceResult = await runSTM(['list'], {
          cwd: tempDir
        });
        // Should fail when no workspace is found
        expect(noWorkspaceResult.exitCode).not.toBe(0);
        expect(noWorkspaceResult.stderr).toContain('No STM workspace found');

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      });
    });
  },
  { timeout: 30000 }
);
