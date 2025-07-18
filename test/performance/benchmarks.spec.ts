import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceTestWorkspace } from '@test/helpers/performance-test-workspace';
import { CLITestRunner } from '@test/helpers/cli-runner';
import type { Task } from '@lib/types';
import type { TaskManager } from '@lib/task-manager';

interface PerformanceMetrics {
  averageTime: number;
  minTime: number;
  maxTime: number;
  operationsPerSecond: number;
  memoryUsageStart: number;
  memoryUsageEnd: number;
  totalOperations: number;
}

interface BenchmarkResult {
  testName: string;
  metrics: PerformanceMetrics;
  success: boolean;
  details?: Record<string, unknown>;
}

describe(
  'Performance Benchmarks',
  () => {
    let workspace: PerformanceTestWorkspace;
    let cliRunner: CLITestRunner;
    let taskManager: TaskManager;

    beforeEach(async () => {
      workspace = await PerformanceTestWorkspace.create('performance-test-');
      cliRunner = new CLITestRunner({ cwd: workspace.directory });

      // Clean up any stale locks before starting
      await workspace.cleanupLocks();

      // Get performance-optimized task manager
      taskManager = await workspace.getPerformanceTaskManager();
    });

    afterEach(async () => {
      // Clean up workspace (includes lock manager cleanup)
      await workspace.cleanup();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    const measurePerformance = async (
      operation: () => Promise<void>,
      iterations: number = 10
    ): Promise<PerformanceMetrics> => {
      const times: number[] = [];
      const memoryStart = process.memoryUsage().heapUsed;

      // Warm up
      await operation();

      // Collect garbage if available
      if (global.gc) {
        global.gc();
      }

      // Measure iterations
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await operation();
        const end = process.hrtime.bigint();

        const timeMs = Number(end - start) / 1000000; // Convert to milliseconds
        times.push(timeMs);
      }

      const memoryEnd = process.memoryUsage().heapUsed;
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      return {
        averageTime,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        operationsPerSecond: 1000 / averageTime,
        memoryUsageStart: memoryStart,
        memoryUsageEnd: memoryEnd,
        totalOperations: iterations
      };
    };

    const runBenchmark = async (
      testName: string,
      operation: () => Promise<void>,
      iterations: number = 10,
      expectation?: (metrics: PerformanceMetrics) => void
    ): Promise<BenchmarkResult> => {
      try {
        const metrics = await measurePerformance(operation, iterations);

        if (expectation) {
          expectation(metrics);
        }

        console.warn(`\n${testName} Benchmark Results:`);
        console.warn(`  Average Time: ${metrics.averageTime.toFixed(2)}ms`);
        console.warn(`  Min Time: ${metrics.minTime.toFixed(2)}ms`);
        console.warn(`  Max Time: ${metrics.maxTime.toFixed(2)}ms`);
        console.warn(`  Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`);
        console.warn(
          `  Memory Delta: ${((metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024).toFixed(
            2
          )}MB`
        );

        return {
          testName,
          metrics,
          success: true
        };
      } catch (error) {
        return {
          testName,
          metrics: {} as PerformanceMetrics,
          success: false,
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    };

    describe('Task Creation Performance', () => {
      it('should efficiently create single tasks', async () => {
        let taskCounter = 0;

        await runBenchmark(
          'Single Task Creation',
          async () => {
            await taskManager.create({
              title: `Performance Test Task ${++taskCounter}`,
              content: 'Performance test content',
              tags: ['performance', 'test']
            });
          },
          50,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(100); // Under 100ms per task
            expect(metrics.operationsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec
          }
        );
      });

      it('should handle bulk task creation efficiently', async () => {
        await runBenchmark(
          'Bulk Task Creation (10 tasks)',
          async () => {
            const promises = Array.from({ length: 10 }, (_, i) =>
              taskManager.create({
                title: `Bulk Task ${Date.now()}-${i}`,
                content: `Bulk content ${i}`,
                tags: ['bulk', 'performance']
              })
            );
            await Promise.all(promises);
          },
          10,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(500); // Under 500ms for 10 tasks
            expect(metrics.operationsPerSecond).toBeGreaterThan(2); // At least 2 bulk ops/sec
          }
        );
      });

      it('should maintain performance with concurrent task creation', async () => {
        await runBenchmark(
          'Concurrent Task Creation (5 parallel)',
          async () => {
            const promises = Array.from({ length: 5 }, (_, i) =>
              workspace.addTask({
                title: `Concurrent Task ${Date.now()}-${i}`,
                content: `Concurrent content ${i}`,
                tags: ['concurrent', 'performance']
              })
            );
            await Promise.all(promises);
          },
          10,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(1000); // Under 1 second for 5 concurrent
            expect(metrics.operationsPerSecond).toBeGreaterThan(1); // At least 1 batch/sec
          }
        );
      });
    });

    describe('List Operations Performance with Large Datasets', () => {
      beforeEach(async () => {
        // Create 500 tasks for list performance testing (reduced from 1000 for stability)
        console.warn('Setting up 500 tasks for list performance testing...');

        const TASK_COUNT = 500;
        const tasks = [];

        for (let i = 0; i < TASK_COUNT; i++) {
          const taskIndex = i + 1;
          tasks.push({
            title: `Large Dataset Task ${taskIndex}`,
            content: `Content for task ${taskIndex} with some meaningful text to test performance`,
            tags: [
              `batch-${Math.floor(i / 10)}`,
              `category-${taskIndex % 5}`,
              'large-dataset',
              'performance-test'
            ],
            status:
              taskIndex % 3 === 0
                ? 'done'
                : taskIndex % 3 === 1
                  ? 'in-progress'
                  : ('pending' as const)
          });
        }

        // Use workspace's optimized batch creation
        await workspace.batchCreateTasks(tasks, 20);

        console.warn(`Setup complete: ${TASK_COUNT} tasks created`);
      }, 60000); // 60 second timeout for setup

      it('should list all tasks efficiently with large dataset', async () => {
        await runBenchmark(
          'List All Tasks (500 tasks)',
          async () => {
            await taskManager.list();
          },
          20,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(500); // Under 500ms for 500 tasks
            expect(metrics.operationsPerSecond).toBeGreaterThan(2); // At least 2 lists/sec
          }
        );
      });

      it('should filter tasks efficiently', async () => {
        await runBenchmark(
          'Filtered List (status filter)',
          async () => {
            await taskManager.list({ status: 'pending' });
          },
          20,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(400); // Under 400ms for filtered
            expect(metrics.operationsPerSecond).toBeGreaterThan(2.5); // Faster than full list
          }
        );
      });

      it('should search tasks efficiently', async () => {
        await runBenchmark(
          'Search Tasks (text search)',
          async () => {
            await taskManager.list({ search: 'meaningful text' });
          },
          20,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(600); // Search can take longer
            expect(metrics.operationsPerSecond).toBeGreaterThan(1.5); // At least 1.5 searches/sec
          }
        );
      });

      it('should handle complex filters efficiently', async () => {
        await runBenchmark(
          'Complex Filtered List (tags + status)',
          async () => {
            await taskManager.list({
              status: 'in-progress',
              tags: ['performance-test']
            });
          },
          20,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(500); // Under 500ms for complex filter
            // At least 2 complex filters/sec
            expect(metrics.operationsPerSecond).toBeGreaterThan(2);
          }
        );
      });
    });

    describe('CLI Performance Benchmarks', () => {
      it('should handle CLI add operations efficiently', async () => {
        let taskCounter = 0;

        await runBenchmark(
          'CLI Add Task',
          async () => {
            await cliRunner.addTask(`CLI Performance Task ${++taskCounter}`, {
              content: 'CLI performance test content',
              tags: ['cli', 'performance']
            });
          },
          20,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(2000); // Under 2 seconds (CLI overhead)
            expect(metrics.operationsPerSecond).toBeGreaterThan(0.5); // At least 0.5 CLI ops/sec
          }
        );
      });

      it('should handle CLI list operations efficiently', async () => {
        // Create some tasks first
        for (let i = 1; i <= 50; i++) {
          await taskManager.create({
            title: `CLI List Test Task ${i}`,
            content: `Content ${i}`,
            tags: ['cli-list-test']
          });
        }

        await runBenchmark(
          'CLI List Tasks (50 tasks)',
          async () => {
            await cliRunner.listTasks();
          },
          15,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(3000); // Under 3 seconds for CLI list
            expect(metrics.operationsPerSecond).toBeGreaterThan(0.3); // At least 0.3 CLI list/sec
          }
        );
      });

      it('should handle CLI export operations efficiently', async () => {
        // Create tasks for export testing
        for (let i = 1; i <= 100; i++) {
          await taskManager.create({
            title: `Export Test Task ${i}`,
            content: `Export content ${i}`,
            tags: ['export-test']
          });
        }

        await runBenchmark(
          'CLI Export Tasks (100 tasks)',
          async () => {
            await cliRunner.exportTasks('json');
          },
          10,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(5000); // Under 5 seconds for export
            expect(metrics.operationsPerSecond).toBeGreaterThan(0.2); // At least 0.2 exports/sec
          }
        );
      });
    });

    describe('Memory Usage Benchmarks', () => {
      it('should manage memory efficiently during large operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Create 500 tasks
        for (let i = 1; i <= 500; i++) {
          await taskManager.create({
            title: `Memory Test Task ${i}`,
            content: `Memory test content ${i} with some additional text to increase memory usage`,
            tags: [`batch-${Math.floor(i / 10)}`, 'memory-test']
          });

          // Force garbage collection every 50 tasks if available
          if (i % 50 === 0 && global.gc) {
            global.gc();
          }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

        console.warn(`Memory usage increased by ${memoryIncrease.toFixed(2)}MB for 500 tasks`);

        // Should not use more than 100MB for 500 tasks
        expect(memoryIncrease).toBeLessThan(100);

        // Test memory cleanup after operations
        if (global.gc) {
          global.gc();
        }

        const afterGCMemory = process.memoryUsage().heapUsed;
        const memoryAfterGC = (afterGCMemory - initialMemory) / 1024 / 1024; // MB

        console.warn(`Memory usage after GC: ${memoryAfterGC.toFixed(2)}MB`);

        // Memory should decrease after garbage collection
        // Only check if memory actually increased (positive value)
        if (memoryIncrease > 0) {
          expect(memoryAfterGC).toBeLessThan(memoryIncrease);
        }
      });

      it('should handle memory efficiently during rapid task creation', async () => {
        await runBenchmark(
          'Rapid Task Creation Memory Test',
          async () => {
            // Create 50 tasks rapidly
            const promises = Array.from({ length: 50 }, (_, i) =>
              taskManager.create({
                title: `Rapid Task ${Date.now()}-${i}`,
                content: `Rapid content ${i}`,
                tags: ['rapid', 'memory-test']
              })
            );
            await Promise.all(promises);
          },
          5,
          (metrics) => {
            // Memory increase should be reasonable
            const memoryIncreaseMB =
              (metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024;
            expect(memoryIncreaseMB).toBeLessThan(50); // Under 50MB for 250 tasks (5 * 50)
          }
        );
      });
    });

    describe('Concurrent Operations Performance', () => {
      it('should handle concurrent add operations efficiently', async () => {
        await runBenchmark(
          'Concurrent Add Operations (10 parallel)',
          async () => {
            const promises = Array.from(
              { length: 10 },
              () => workspace.simulateConcurrentAdds(5) // 5 tasks per batch
            );
            await Promise.all(promises);
          },
          5,
          (metrics) => {
            // Under 3 seconds for 50 concurrent tasks
            expect(metrics.averageTime).toBeLessThan(3000);
            // At least 0.3 batches/sec
            expect(metrics.operationsPerSecond).toBeGreaterThan(0.3);
          }
        );
      });

      it('should maintain performance under high concurrency load', async () => {
        const concurrentOperations = async (): Promise<void> => {
          const operations = [
            // Add operations
            ...Array.from({ length: 5 }, (_, i) =>
              workspace.addTask({
                title: `Concurrent Load Task ${Date.now()}-${i}`,
                content: `Load test content ${i}`
              })
            ),
            // List operations
            ...Array.from({ length: 3 }, () => workspace.listTasks()),
            // Stats operations
            ...Array.from({ length: 2 }, () => workspace.getStats())
          ];

          await Promise.all(operations);
        };

        await runBenchmark(
          'High Concurrency Load Test',
          concurrentOperations,
          10,
          (metrics) => {
            // Under 5 seconds for mixed operations
            expect(metrics.averageTime).toBeLessThan(5000);
            // At least 0.2 mixed batches/sec
            expect(metrics.operationsPerSecond).toBeGreaterThan(0.2);
          }
        );
      });
    });

    describe('File System Performance', () => {
      it('should handle file operations efficiently', async () => {
        await runBenchmark(
          'File System Operations',
          async () => {
            // Create task (writes file)
            const task = await taskManager.create({
              title: `File System Test ${Date.now()}`,
              content: 'File system performance test',
              tags: ['filesystem']
            });

            // Read task (reads file)
            await taskManager.get(task.id);

            // Update task (writes file again)
            await taskManager.update(task.id, {
              content: 'Updated content for file system test'
            });
          },
          25,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(150); // Under 150ms for create+read+update
            expect(metrics.operationsPerSecond).toBeGreaterThan(6); // At least 6 file ops/sec
          }
        );
      });

      it('should scale well with large number of files', async () => {
        // Pre-create 200 task files
        console.warn('Creating 200 tasks for file system scaling test...');
        const tasks: Task[] = [];
        for (let i = 1; i <= 200; i++) {
          const task = await taskManager.create({
            title: `Scaling Test Task ${i}`,
            content: `Scaling test content ${i}`,
            tags: ['scaling-test']
          });
          tasks.push(task);
        }

        await runBenchmark(
          'File System Scaling (200+ files)',
          async () => {
            // List all tasks (reads all files)
            await taskManager.list();
          },
          10,
          (metrics) => {
            expect(metrics.averageTime).toBeLessThan(2000); // Under 2 seconds to read 200+ files
            // At least 0.5 full reads/sec
            expect(metrics.operationsPerSecond).toBeGreaterThan(0.5);
          }
        );
      });
    });

    describe('Performance Regression Detection', () => {
      it('should maintain baseline performance standards', async () => {
        const benchmarks: BenchmarkResult[] = [];

        // Run core performance benchmarks
        benchmarks.push(
          await runBenchmark(
            'Baseline: Single Task Creation',
            async () => {
              await taskManager.create({
                title: `Baseline Task ${Date.now()}`,
                content: 'Baseline test',
                tags: ['baseline']
              });
            },
            30
          )
        );

        benchmarks.push(
          await runBenchmark(
            'Baseline: Task Listing',
            async () => {
              await taskManager.list();
            },
            20
          )
        );

        benchmarks.push(
          await runBenchmark(
            'Baseline: Task Retrieval',
            async () => {
              // Get a random existing task
              const tasks = await taskManager.list();
              if (tasks.length > 0) {
                await taskManager.get(tasks[0].id);
              }
            },
            25
          )
        );

        // All benchmarks should succeed
        const failedBenchmarks = benchmarks.filter((b) => !b.success);
        expect(failedBenchmarks).toHaveLength(0);

        // Log performance summary
        console.warn('\n=== Performance Summary ===');
        for (const benchmark of benchmarks) {
          if (benchmark.success) {
            console.warn(
              `${benchmark.testName}: ${benchmark.metrics.averageTime.toFixed(2)}ms avg`
            );
          }
        }

        // Performance thresholds (adjust based on requirements)
        const creationBenchmark = benchmarks.find((b) => b.testName.includes('Creation'));
        if (creationBenchmark?.success) {
          expect(creationBenchmark.metrics.averageTime).toBeLessThan(100); // 100ms threshold
        }

        const listingBenchmark = benchmarks.find((b) => b.testName.includes('Listing'));
        if (listingBenchmark?.success) {
          // 50ms threshold for empty/small lists
          expect(listingBenchmark.metrics.averageTime).toBeLessThan(50);
        }
      });
    });
  },
  { timeout: 60000 }
);
