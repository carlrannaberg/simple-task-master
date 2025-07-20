/**
 * Unknown Fields Performance Tests
 *
 * These tests validate that unknown field support doesn't significantly
 * impact performance when handling many fields.
 * 
 * Run these tests with: `npm run test:performance`
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceTestWorkspace } from '@test/helpers/performance-test-workspace';
import { CLITestRunner } from '@test/helpers/cli-runner';
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

describe('Unknown Fields Performance Tests', () => {
  let workspace: PerformanceTestWorkspace;
  let cliRunner: CLITestRunner;
  let taskManager: TaskManager;

  beforeEach(async () => {
    workspace = await PerformanceTestWorkspace.create('unknown-fields-perf-');
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
    iterations: number = 5
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

  describe('Task Creation with Many Unknown Fields', () => {
    it('should efficiently create tasks with 50+ unknown fields', async () => {
      /**
       * Tests task creation performance with a large number of unknown fields.
       * Requirement: Should complete in under 100ms.
       * 
       * Purpose: Validate that unknown field support doesn't significantly
       * impact task creation performance
       */
      
      let taskCounter = 0;

      const createTaskWith50Fields = async (): Promise<void> => {
        const unknownFields: Record<string, string> = {};
        
        // Create 50 unknown fields
        for (let i = 0; i < 50; i++) {
          unknownFields[`field_${i}`] = `value_${i}_for_task_${taskCounter}`;
        }

        await taskManager.create({
          title: `Performance Test Task ${++taskCounter}`,
          content: 'Performance test task with many unknown fields',
          status: 'pending',
          tags: ['performance', 'test'],
          dependencies: [],
          ...unknownFields
        });
      };

      const metrics = await measurePerformance(createTaskWith50Fields, 5);

      // Performance requirement: Should complete in under 100ms
      expect(metrics.averageTime).toBeLessThan(100);
      
      // Should maintain reasonable operations per second
      expect(metrics.operationsPerSecond).toBeGreaterThan(10);

      console.warn(`\nTask Creation with 50 Unknown Fields Performance:`);
      console.warn(`  Average Time: ${metrics.averageTime.toFixed(2)}ms`);
      console.warn(`  Min Time: ${metrics.minTime.toFixed(2)}ms`);
      console.warn(`  Max Time: ${metrics.maxTime.toFixed(2)}ms`);
      console.warn(`  Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`);
      console.warn(`  Memory Delta: ${((metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024).toFixed(2)}MB`);

      // Verify that tasks were actually created with unknown fields
      const lastTask = await taskManager.get(taskCounter);
      expect((lastTask as any).field_0).toBeDefined();
      expect((lastTask as any).field_49).toBeDefined();
    });

    it('should efficiently update tasks with many unknown fields', async () => {
      /**
       * Tests task update performance with a large number of unknown fields.
       * Requirement: Should complete in under 100ms.
       * 
       * Purpose: Validate that unknown field updates don't significantly
       * impact performance
       */

      // Create a base task first
      const baseTask = await taskManager.create({
        title: 'Base Task for Update Performance Test',
        content: 'Base task content',
        status: 'pending',
        tags: ['performance'],
        dependencies: []
      });

      let updateCounter = 0;

      const updateTaskWith50Fields = async (): Promise<void> => {
        const unknownFields: Record<string, string> = {};
        
        // Create 50 unknown fields
        for (let i = 0; i < 50; i++) {
          unknownFields[`update_field_${i}`] = `update_value_${i}_${++updateCounter}`;
        }

        await taskManager.update(baseTask.id, unknownFields);
      };

      const metrics = await measurePerformance(updateTaskWith50Fields, 5);

      // Performance requirement: Should complete in under 100ms
      expect(metrics.averageTime).toBeLessThan(100);
      
      // Should maintain reasonable operations per second
      expect(metrics.operationsPerSecond).toBeGreaterThan(10);

      console.warn(`\nTask Update with 50 Unknown Fields Performance:`);
      console.warn(`  Average Time: ${metrics.averageTime.toFixed(2)}ms`);
      console.warn(`  Min Time: ${metrics.minTime.toFixed(2)}ms`);
      console.warn(`  Max Time: ${metrics.maxTime.toFixed(2)}ms`);
      console.warn(`  Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`);
      console.warn(`  Memory Delta: ${((metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024).toFixed(2)}MB`);

      // Verify that task was actually updated with unknown fields
      const updatedTask = await taskManager.get(baseTask.id);
      expect((updatedTask as any).update_field_0).toBeDefined();
      expect((updatedTask as any).update_field_49).toBeDefined();
    });
  });

  describe('Schema Validation Performance with Unknown Fields', () => {
    it('should efficiently validate tasks with many unknown fields', async () => {
      /**
       * Tests schema validation performance with unknown fields.
       * Requirement: Should complete validation in under 50ms.
       * 
       * Purpose: Validate that schema validation doesn't become a bottleneck
       * when dealing with many unknown fields
       */

      let validationCounter = 0;

      const validateTaskWith50Fields = async (): Promise<void> => {
        const unknownFields: Record<string, string> = {};
        
        // Create 50 unknown fields
        for (let i = 0; i < 50; i++) {
          unknownFields[`validation_field_${i}`] = `validation_value_${i}_${validationCounter}`;
        }

        // Create a task with many unknown fields (this will trigger validation)
        await taskManager.create({
          title: `Validation Test Task ${++validationCounter}`,
          content: 'Validation performance test',
          status: 'pending',
          tags: ['validation', 'performance'],
          dependencies: [],
          ...unknownFields
        });
      };

      const metrics = await measurePerformance(validateTaskWith50Fields, 10);

      // Performance requirement: Should complete validation in under 50ms
      expect(metrics.averageTime).toBeLessThan(50);
      
      // Should maintain high operations per second for validation
      expect(metrics.operationsPerSecond).toBeGreaterThan(20);

      console.warn(`\nSchema Validation with 50 Unknown Fields Performance:`);
      console.warn(`  Average Time: ${metrics.averageTime.toFixed(2)}ms`);
      console.warn(`  Min Time: ${metrics.minTime.toFixed(2)}ms`);
      console.warn(`  Max Time: ${metrics.maxTime.toFixed(2)}ms`);
      console.warn(`  Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`);
      console.warn(`  Memory Delta: ${((metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Field Count Limits', () => {
    it('should enforce maximum field count limit', async () => {
      /**
       * Tests that STM enforces the 100 field limit for performance.
       * 
       * Purpose: Validate field count limit enforcement
       */

      // Create task with many fields but under the limit (should succeed)
      const manyFields: Record<string, any> = {
        title: 'Many Fields Test Task',
        content: 'Testing with many fields',
        status: 'pending',
        tags: ['test'],
        dependencies: []
      };
      
      // Add fields to reach 90 total input fields
      for (let i = 0; i < 85; i++) {
        manyFields[`field_${i}`] = `value_${i}`;
      }

      // This should succeed (90 input fields)
      const task = await taskManager.create(manyFields);
      expect(task).toBeDefined();
      
      // The returned task will have additional fields added by STM
      // (id, created, updated, schema, etc.) but input was under limit

      // Try to create task with too many fields (should fail)
      const tooManyFields: Record<string, any> = {
        title: 'Too Many Fields Test Task',
        status: 'pending',
        tags: ['test'],
        dependencies: []
      };
      
      // Add fields to exceed limit
      // The task object will have these fields:
      // - Input fields: title, status, tags, dependencies (4)
      // - STM adds: id, created, updated, schema (4)
      // - Total so far: 8 fields
      // We need 93 more to exceed 100 (8 + 93 = 101)
      for (let i = 0; i < 93; i++) {
        tooManyFields[`excess_field_${i}`] = `value_${i}`;
      }

      // This should fail with validation error
      await expect(taskManager.create(tooManyFields)).rejects.toThrow(
        'Task cannot have more than 100 total fields'
      );
    });

    it('should handle near-limit field counts efficiently', async () => {
      /**
       * Tests performance with 90-100 fields (near the limit).
       * Requirement: Should still complete in reasonable time.
       * 
       * Purpose: Validate performance doesn't degrade near limits
       */
      
      let taskCounter = 0;

      const createTaskWithNearLimitFields = async (): Promise<void> => {
        const unknownFields: Record<string, string> = {};
        
        // Create 90 unknown fields (95 total with core fields)
        for (let i = 0; i < 90; i++) {
          unknownFields[`near_limit_field_${i}`] = `value_${i}_for_task_${taskCounter}`;
        }

        await taskManager.create({
          title: `Near Limit Test Task ${++taskCounter}`,
          content: 'Performance test task near field limit',
          status: 'pending',
          tags: ['performance', 'near-limit'],
          dependencies: [],
          ...unknownFields
        });
      };

      const metrics = await measurePerformance(createTaskWithNearLimitFields, 3);

      // Performance requirement: Should complete in under 200ms even near limit
      expect(metrics.averageTime).toBeLessThan(200);
      
      // Should maintain reasonable operations per second
      expect(metrics.operationsPerSecond).toBeGreaterThan(5);

      console.warn(`\nTask Creation with 90 Unknown Fields (Near Limit) Performance:`);
      console.warn(`  Average Time: ${metrics.averageTime.toFixed(2)}ms`);
      console.warn(`  Min Time: ${metrics.minTime.toFixed(2)}ms`);
      console.warn(`  Max Time: ${metrics.maxTime.toFixed(2)}ms`);
      console.warn(`  Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`);
      console.warn(`  Memory Delta: ${((metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Large Values in Unknown Fields', () => {
    it('should efficiently handle large values in unknown fields', async () => {
      /**
       * Tests performance with large string values in unknown fields.
       * Requirement: Should complete in under 200ms.
       * 
       * Purpose: Validate that large unknown field values don't cause
       * performance degradation
       */

      let largeValueCounter = 0;

      const createTaskWithLargeUnknownFields = async (): Promise<void> => {
        // Create 5 fields with 1KB values each (5KB total)
        const largeValue1 = 'A'.repeat(1024);
        const largeValue2 = 'B'.repeat(1024);
        const largeValue3 = 'C'.repeat(1024);
        const largeValue4 = 'D'.repeat(1024);
        const largeValue5 = 'E'.repeat(1024);

        await taskManager.create({
          title: `Large Values Test Task ${++largeValueCounter}`,
          content: 'Task with large unknown field values',
          status: 'pending',
          tags: ['large-values', 'performance'],
          dependencies: [],
          large_field_1: largeValue1,
          large_field_2: largeValue2,
          large_field_3: largeValue3,
          large_field_4: largeValue4,
          large_field_5: largeValue5
        });
      };

      const metrics = await measurePerformance(createTaskWithLargeUnknownFields, 5);

      // Performance requirement: Should complete in under 200ms even with large values
      expect(metrics.averageTime).toBeLessThan(200);
      
      // Should maintain reasonable operations per second
      expect(metrics.operationsPerSecond).toBeGreaterThan(5);

      console.warn(`\nLarge Unknown Field Values Performance (5KB total):`);
      console.warn(`  Average Time: ${metrics.averageTime.toFixed(2)}ms`);
      console.warn(`  Min Time: ${metrics.minTime.toFixed(2)}ms`);
      console.warn(`  Max Time: ${metrics.maxTime.toFixed(2)}ms`);
      console.warn(`  Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`);
      console.warn(`  Memory Delta: ${((metrics.memoryUsageEnd - metrics.memoryUsageStart) / 1024 / 1024).toFixed(2)}MB`);

      // Verify that task was created with large values
      const task = await taskManager.get(largeValueCounter);
      expect((task as any).large_field_1).toHaveLength(1024);
      expect((task as any).large_field_5).toHaveLength(1024);
    });
  });
});