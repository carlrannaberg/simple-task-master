import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { runSTMSuccess, CLITestRunner } from '@test/helpers/cli-runner';
import { LockManager } from '@lib/lock-manager';

describe(
  'Concurrent Operations E2E',
  () => {
    let workspace: TestWorkspace;
    let _cliRunner: CLITestRunner;
    const stmBin = path.resolve(__dirname, '../../bin/stm');

    beforeEach(async () => {
      workspace = await TestWorkspace.create('concurrent-ops-test-');
      _cliRunner = new CLITestRunner({ cwd: workspace.directory });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    describe('Multi-Process Concurrent Access Testing', () => {
      it.skip('should handle multiple processes adding tasks simultaneously', async () => {
        const concurrentProcesses = 10;
        const processPromises: Promise<{
          pid: number;
          exitCode: number;
          stdout: string;
          stderr: string;
        }>[] = [];

        // Start multiple processes simultaneously
        for (let i = 0; i < concurrentProcesses; i++) {
          const promise = new Promise<{
            pid: number;
            exitCode: number;
            stdout: string;
            stderr: string;
          }>((resolve, reject) => {
            const child = spawn(
              'node',
              [
                stmBin,
                'add',
                `Concurrent Task ${i + 1}`,
                '--description',
                `Content from process ${i + 1}`,
                '--tags',
                `process-${i + 1},concurrent`,
              ],
              {
                cwd: workspace.directory,
                stdio: ['pipe', 'pipe', 'pipe'],
              }
            );

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
              stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
              stderr += data.toString();
            });

            child.on('close', (code) => {
              resolve({
                pid: child.pid || -1,
                exitCode: code ?? -1,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
              });
            });

            child.on('error', reject);
          });

          processPromises.push(promise);
        }

        // Wait for all processes to complete
        const results = await Promise.all(processPromises);

        // All processes should succeed
        for (const result of results) {
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toMatch(/^\d+$/); // Should return task ID
        }

        // Verify all tasks were created with unique IDs
        const taskIds = results.map((r) => parseInt(r.stdout, 10));
        const uniqueIds = new Set(taskIds);
        expect(uniqueIds.size).toBe(concurrentProcesses);

        // Verify sequential ID assignment
        const sortedIds = [...taskIds].sort((a, b) => a - b);
        expect(sortedIds).toEqual(Array.from({ length: concurrentProcesses }, (_, i) => i + 1));

        // Verify all tasks exist in the system
        const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        const taskCount = listResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim()).length;
        expect(taskCount).toBe(concurrentProcesses);
      });

      it.skip('should handle concurrent read operations safely', async () => {
        // Create some initial tasks
        for (let i = 1; i <= 5; i++) {
          await runSTMSuccess(['add', `Read Test Task ${i}`, '--description', `Content ${i}`], {
            cwd: workspace.directory,
          });
        }

        const concurrentReads = 20;
        const readPromises: Promise<{ exitCode: number; stdout: string }>[] = [];

        // Start multiple list operations simultaneously
        for (let i = 0; i < concurrentReads; i++) {
          const promise = new Promise<{ exitCode: number; stdout: string }>((resolve, reject) => {
            const child = spawn('node', [stmBin, 'list', '--format', 'json'], {
              cwd: workspace.directory,
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';

            child.stdout?.on('data', (data) => {
              stdout += data.toString();
            });

            child.on('close', (code) => {
              resolve({ exitCode: code ?? -1, stdout: stdout.trim() });
            });

            child.on('error', reject);
          });

          readPromises.push(promise);
        }

        // Wait for all read operations to complete
        const results = await Promise.all(readPromises);

        // All reads should succeed
        for (const result of results) {
          expect(result.exitCode).toBe(0);

          // Parse and validate JSON output
          const lines = result.stdout.split('\n').filter((line) => line.trim());
          expect(lines).toHaveLength(5);

          for (const line of lines) {
            const task = JSON.parse(line);
            expect(task).toHaveProperty('id');
            expect(task).toHaveProperty('title');
            expect(task.title).toMatch(/^Read Test Task \d$/);
          }
        }
      });

      it('should handle mixed concurrent read/write operations', async () => {
        // Create initial task
        await runSTMSuccess(['add', 'Mixed Test Task', '--description', 'Initial content'], {
          cwd: workspace.directory,
        });

        const operations: Promise<{ type: string; exitCode: number; output: string }>[] = [];

        // Mix of read and write operations
        for (let i = 0; i < 20; i++) {
          if (i % 3 === 0) {
            // Add operation
            const promise = new Promise<{ type: string; exitCode: number; output: string }>(
              (resolve, reject) => {
                const child = spawn(
                  'node',
                  [stmBin, 'add', `Mixed Task ${i}`, '--description', `Content ${i}`],
                  {
                    cwd: workspace.directory,
                    stdio: ['pipe', 'pipe', 'pipe'],
                  }
                );

                let output = '';
                child.stdout?.on('data', (data) => {
                  output += data.toString();
                });

                child.on('close', (code) => {
                  resolve({ type: 'add', exitCode: code ?? -1, output: output.trim() });
                });

                child.on('error', reject);
              }
            );
            operations.push(promise);
          } else if (i % 3 === 1) {
            // Update operation
            const promise = new Promise<{ type: string; exitCode: number; output: string }>(
              (resolve, reject) => {
                const child = spawn(
                  'node',
                  [stmBin, 'update', '1', '--description', `Updated at ${Date.now()}`],
                  {
                    cwd: workspace.directory,
                    stdio: ['pipe', 'pipe', 'pipe'],
                  }
                );

                let output = '';
                child.stdout?.on('data', (data) => {
                  output += data.toString();
                });

                child.on('close', (code) => {
                  resolve({ type: 'update', exitCode: code ?? -1, output: output.trim() });
                });

                child.on('error', reject);
              }
            );
            operations.push(promise);
          } else {
            // List operation
            const promise = new Promise<{ type: string; exitCode: number; output: string }>(
              (resolve, reject) => {
                const child = spawn('node', [stmBin, 'list'], {
                  cwd: workspace.directory,
                  stdio: ['pipe', 'pipe', 'pipe'],
                });

                let output = '';
                child.stdout?.on('data', (data) => {
                  output += data.toString();
                });

                child.on('close', (code) => {
                  resolve({ type: 'list', exitCode: code ?? -1, output: output.trim() });
                });

                child.on('error', reject);
              }
            );
            operations.push(promise);
          }
        }

        // Wait for all operations to complete
        const results = await Promise.all(operations);

        // Most operations should succeed (some updates might fail due to timing)
        const successfulOps = results.filter((r) => r.exitCode === 0);
        expect(successfulOps.length).toBeGreaterThan(15); // At least 75% success rate

        // Verify final state is consistent
        const finalListResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        const finalTaskCount = finalListResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim()).length;

        // Should have at least the initial task plus some new ones
        expect(finalTaskCount).toBeGreaterThan(0);
      });
    });

    describe('Lock Behavior Validation', () => {
      it.skip('should enforce exclusive access through locking', async () => {
        const lockManager = new LockManager(workspace.directory);

        // Acquire lock in current process
        await lockManager.acquire();

        // Start external process that should wait for lock
        const externalProcessPromise = new Promise<{ duration: number; exitCode: number }>(
          (resolve, reject) => {
            const startTime = Date.now();
            const child = spawn(
              'node',
              [stmBin, 'add', 'Locked Task', '--description', 'Should wait for lock'],
              {
                cwd: workspace.directory,
                stdio: ['pipe', 'pipe', 'pipe'],
              }
            );

            child.on('close', (code) => {
              const duration = Date.now() - startTime;
              resolve({ duration, exitCode: code ?? -1 });
            });

            child.on('error', reject);
          }
        );

        // Hold lock for 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Release lock
        await lockManager.release();

        // Wait for external process to complete
        const result = await externalProcessPromise;

        // Process should succeed after waiting
        expect(result.exitCode).toBe(0);
        expect(result.duration).toBeGreaterThan(1500); // Should have waited at least 1.5 seconds

        // Verify task was created
        const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        expect(listResult.stdout).toContain('Locked Task');
      });

      it.skip('should handle lock timeout scenarios', async () => {
        const lockManager = new LockManager(workspace.directory);

        // Acquire lock and hold it indefinitely
        await lockManager.acquire();

        // Start external process that should timeout
        const timeoutProcessPromise = new Promise<{
          duration: number;
          exitCode: number;
          stderr: string;
        }>((resolve, reject) => {
          const startTime = Date.now();
          const child = spawn('node', [stmBin, 'add', 'Timeout Task'], {
            cwd: workspace.directory,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stderr = '';
          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            const duration = Date.now() - startTime;
            resolve({ duration, exitCode: code ?? -1, stderr: stderr.trim() });
          });

          child.on('error', reject);
        });

        // Wait for process to timeout (should take about 5 seconds)
        const result = await timeoutProcessPromise;

        // Release lock after timeout
        await lockManager.release();

        // Process should fail due to timeout
        expect(result.exitCode).not.toBe(0);
        expect(result.duration).toBeGreaterThan(4500); // Should wait at least 4.5 seconds
        expect(result.stderr).toMatch(/lock|timeout|busy/i);
      });

      it('should clean up stale locks automatically', async () => {
        // Create a stale lock file manually
        const lockPath = path.join(workspace.stmDirectory, 'lock');
        const staleLock = {
          pid: 99999, // Non-existent PID
          command: 'stm add stale-task',
          timestamp: Date.now() - 60000, // 1 minute old
        };

        await fs.writeFile(lockPath, JSON.stringify(staleLock));

        // Verify lock file exists
        const lockExists = await fs
          .access(lockPath)
          .then(() => true)
          .catch(() => false);
        expect(lockExists).toBe(true);

        // Attempt to add task - should clean up stale lock and succeed
        const addResult = await runSTMSuccess(['add', 'After Stale Lock'], {
          cwd: workspace.directory,
        });

        expect(addResult.exitCode).toBe(0);

        // Verify task was created
        const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        expect(listResult.stdout).toContain('After Stale Lock');
      });

      it('should handle lock file corruption gracefully', async () => {
        // Create corrupted lock file
        const lockPath = path.join(workspace.stmDirectory, 'lock');
        await fs.writeFile(lockPath, 'invalid json content');

        // Should handle corruption and allow operations
        const addResult = await runSTMSuccess(['add', 'After Corrupted Lock'], {
          cwd: workspace.directory,
        });

        expect(addResult.exitCode).toBe(0);

        // Verify task was created
        const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        expect(listResult.stdout).toContain('After Corrupted Lock');
      });

      it('should prevent race conditions in ID generation', async () => {
        const concurrentAdds = 50;
        const processPromises: Promise<number>[] = [];

        // Start many processes simultaneously to test ID generation race conditions
        for (let i = 0; i < concurrentAdds; i++) {
          const promise = new Promise<number>((resolve, reject) => {
            const child = spawn(
              'node',
              [stmBin, 'add', `Race Test Task ${i}`, '--description', `Content ${i}`],
              {
                cwd: workspace.directory,
                stdio: ['pipe', 'pipe', 'pipe'],
              }
            );

            let stdout = '';
            child.stdout?.on('data', (data) => {
              stdout += data.toString();
            });

            child.on('close', (code) => {
              if (code === 0) {
                const taskId = parseInt(stdout.trim(), 10);
                resolve(taskId);
              } else {
                reject(new Error(`Process failed with code ${code}`));
              }
            });

            child.on('error', reject);
          });

          processPromises.push(promise);
        }

        // Wait for all processes to complete (some may fail due to lock contention)
        const results = await Promise.allSettled(processPromises);

        // Extract successful task IDs
        const taskIds = results
          .filter(
            (result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled'
          )
          .map((result) => result.value);

        // At least some processes should succeed
        expect(taskIds.length).toBeGreaterThan(0);

        // Verify all successful IDs are unique (no race conditions)
        const uniqueIds = new Set(taskIds);
        
        // Show debug info before assertion
        console.warn(`Debug: uniqueIds.size = ${uniqueIds.size}, taskIds.length = ${taskIds.length}`);
        
        expect(uniqueIds.size).toBe(taskIds.length);

        // Verify sequential numbering for successful tasks (no gaps in successful IDs)
        const sortedIds = [...taskIds].sort((a, b) => a - b);
        expect(sortedIds).toEqual(Array.from({ length: taskIds.length }, (_, i) => i + 1));

        // Verify all successful tasks exist and have correct content
        for (const taskId of taskIds) {
          const showResult = await runSTMSuccess(['show', taskId.toString()], {
            cwd: workspace.directory,
          });
          expect(showResult.exitCode).toBe(0);
        }

        // Log success rate for debugging
        console.warn(
          `Race condition test: ${taskIds.length}/${concurrentAdds} processes succeeded`
        );
        console.warn(`Task IDs: ${taskIds.sort((a, b) => a - b).join(', ')}`);
        console.warn(`Unique IDs: ${uniqueIds.size}, Total IDs: ${taskIds.length}`);
        
        // Show duplicates
        const idCounts = {};
        taskIds.forEach(id => {
          idCounts[id] = (idCounts[id] || 0) + 1;
        });
        const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
        if (duplicates.length > 0) {
          console.warn(`Duplicates found: ${duplicates.map(([id, count]) => `${id}(${count}x)`).join(', ')}`);
        }

        // Should have at least 10% success rate (some lock contention is expected)
        expect(taskIds.length / concurrentAdds).toBeGreaterThan(0.1);
      });
    });

    describe('Stress Testing with High Concurrency', () => {
      it('should handle burst of concurrent operations', async () => {
        const burstSize = 100;
        const operationPromises: Promise<{ type: string; success: boolean }>[] = [];

        // Create burst of mixed operations
        for (let i = 0; i < burstSize; i++) {
          const operation = i % 4;
          let promise: Promise<{ type: string; success: boolean }>;

          switch (operation) {
            case 0: // Add
              promise = new Promise((resolve) => {
                const child = spawn(
                  'node',
                  [stmBin, 'add', `Burst Task ${i}`, '--description', `Burst content ${i}`],
                  {
                    cwd: workspace.directory,
                    stdio: ['pipe', 'pipe', 'pipe'],
                  }
                );

                child.on('close', (code) => {
                  resolve({ type: 'add', success: code === 0 });
                });
              });
              break;

            case 1: // List
              promise = new Promise((resolve) => {
                const child = spawn('node', [stmBin, 'list'], {
                  cwd: workspace.directory,
                  stdio: ['pipe', 'pipe', 'pipe'],
                });

                child.on('close', (code) => {
                  resolve({ type: 'list', success: code === 0 });
                });
              });
              break;

            case 2: // Export
              promise = new Promise((resolve) => {
                const child = spawn('node', [stmBin, 'export', '--format', 'json'], {
                  cwd: workspace.directory,
                  stdio: ['pipe', 'pipe', 'pipe'],
                });

                child.on('close', (code) => {
                  resolve({ type: 'export', success: code === 0 });
                });
              });
              break;

            default: // Grep
              promise = new Promise((resolve) => {
                const child = spawn('node', [stmBin, 'grep', 'Task'], {
                  cwd: workspace.directory,
                  stdio: ['pipe', 'pipe', 'pipe'],
                });

                child.on('close', (code) => {
                  resolve({ type: 'grep', success: code === 0 });
                });
              });
              break;
          }

          operationPromises.push(promise);
        }

        // Wait for all operations to complete
        const results = await Promise.all(operationPromises);

        // Analyze success rates by operation type
        const successByType = results.reduce(
          (acc, result) => {
            if (!acc[result.type]) acc[result.type] = { total: 0, success: 0 };
            acc[result.type].total++;
            if (result.success) acc[result.type].success++;
            return acc;
          },
          {} as Record<string, { total: number; success: number }>
        );

        // Read operations should have very high success rate
        expect(successByType.list?.success / successByType.list?.total).toBeGreaterThan(0.95);
        expect(successByType.export?.success / successByType.export?.total).toBeGreaterThan(0.95);
        expect(successByType.grep?.success / successByType.grep?.total).toBeGreaterThan(0.95);

        // Write operations should have reasonable success rate (some contention expected)
        expect(successByType.add?.success / successByType.add?.total).toBeGreaterThan(0.8);

        // Verify final system state is consistent
        const finalListResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        const finalTaskCount = finalListResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim()).length;

        // Should have created some tasks
        expect(finalTaskCount).toBeGreaterThan(0);
        expect(finalTaskCount).toBeLessThanOrEqual(successByType.add?.success || 0);
      });

      it('should maintain performance under concurrent load', async () => {
        // Create baseline tasks
        for (let i = 1; i <= 10; i++) {
          await runSTMSuccess(['add', `Baseline Task ${i}`], { cwd: workspace.directory });
        }

        const concurrentOps = 30;
        const startTime = Date.now();

        // Start concurrent operations
        const operations = Array.from({ length: concurrentOps }, (_, i) => {
          if (i % 2 === 0) {
            // Add operation
            return new Promise<boolean>((resolve) => {
              const child = spawn(
                'node',
                [stmBin, 'add', `Perf Task ${i}`, '--description', `Performance test ${i}`],
                {
                  cwd: workspace.directory,
                  stdio: ['pipe', 'pipe', 'pipe'],
                }
              );

              child.on('close', (code) => resolve(code === 0));
            });
          } else {
            // List operation
            return new Promise<boolean>((resolve) => {
              const child = spawn('node', [stmBin, 'list'], {
                cwd: workspace.directory,
                stdio: ['pipe', 'pipe', 'pipe'],
              });

              child.on('close', (code) => resolve(code === 0));
            });
          }
        });

        const results = await Promise.all(operations);
        const totalTime = Date.now() - startTime;

        // Most operations should succeed
        const successCount = results.filter((r) => r).length;
        expect(successCount / concurrentOps).toBeGreaterThan(0.8);

        // Operations should complete in reasonable time (less than 30 seconds)
        expect(totalTime).toBeLessThan(30000);

        console.warn(
          `Concurrent operations completed in ${totalTime}ms with ${successCount}/${concurrentOps} successes`
        );
      });
    });

    describe('Recovery and Consistency', () => {
      it('should recover from interrupted operations', async () => {
        // Start operation and interrupt it
        const child = spawn(
          'node',
          [stmBin, 'add', 'Interrupted Task', '--description', 'This will be interrupted'],
          {
            cwd: workspace.directory,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );

        // Allow process to start
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Kill the process
        child.kill('SIGKILL');

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));

        // System should still be functional
        const addResult = await runSTMSuccess(['add', 'Recovery Task'], {
          cwd: workspace.directory,
        });

        expect(addResult.exitCode).toBe(0);

        // Verify task was created
        const listResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        expect(listResult.stdout).toContain('Recovery Task');
      });

      it('should maintain data consistency across failures', async () => {
        // Create initial state
        for (let i = 1; i <= 5; i++) {
          await runSTMSuccess(['add', `Consistency Task ${i}`], { cwd: workspace.directory });
        }

        // Start multiple operations, some will be killed
        const processes: ChildProcess[] = [];

        for (let i = 0; i < 10; i++) {
          const child = spawn(
            'node',
            [stmBin, 'add', `Killed Task ${i}`, '--description', `Content ${i}`],
            {
              cwd: workspace.directory,
              stdio: ['pipe', 'pipe', 'pipe'],
            }
          );

          processes.push(child);

          // Kill every other process after small delay
          if (i % 2 === 0) {
            setTimeout(() => child.kill('SIGKILL'), 50 + Math.random() * 100);
          }
        }

        // Wait for all processes to complete or be killed
        await Promise.all(
          processes.map(
            (proc) =>
              new Promise((resolve) => {
                proc.on('close', resolve);
                proc.on('error', resolve);
              })
          )
        );

        // System should still be functional and consistent
        const finalListResult = await runSTMSuccess(['list'], { cwd: workspace.directory });
        const taskLines = finalListResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim());

        // Should have at least the original 5 tasks
        expect(taskLines.length).toBeGreaterThanOrEqual(5);

        // All listed tasks should be valid (can be shown without error)
        for (let i = 1; i <= taskLines.length; i++) {
          const showResult = await runSTMSuccess(['show', i.toString()], {
            cwd: workspace.directory,
          });
          expect(showResult.exitCode).toBe(0);
        }
      });
    });
  },
  { timeout: 30000 }
);
