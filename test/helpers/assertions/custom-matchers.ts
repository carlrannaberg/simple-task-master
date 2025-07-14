import { expect } from 'vitest';
import { isTask, type Task, type TaskStatus } from '@lib/types';

/**
 * Custom matchers for vitest to make task testing more expressive
 */

interface CustomMatchers<R = unknown> {
  toBeValidTask(): R;
  toHaveTaskCount(expected: number): R;
  toHaveStatus(expectedStatus: TaskStatus): R;
  toHaveTitle(expectedTitle: string): R;
  toHaveTags(...expectedTags: string[]): R;
  toHaveDependencies(...expectedDeps: number[]): R;
  toBeCreatedAfter(afterDate: Date | string): R;
  toBeUpdatedAfter(afterDate: Date | string): R;
  toHaveValidTimestamps(): R;
  toMatchTaskPartially(partialTask: Partial<Task>): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  /**
   * Check if an object is a valid Task
   */
  toBeValidTask(received: unknown) {
    const pass = isTask(received);

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid task`,
        pass: true,
      };
    } else {
      // Provide detailed error information
      const issues: string[] = [];

      if (typeof received !== 'object' || received === null) {
        issues.push('must be an object');
      } else {
        const task = received as Record<string, unknown>;

        if (typeof task.schema !== 'number') issues.push('schema must be a number');
        if (typeof task.id !== 'number') issues.push('id must be a number');
        if (typeof task.title !== 'string') issues.push('title must be a string');
        if (
          typeof task.status !== 'string' ||
          !['pending', 'in-progress', 'done'].includes(task.status)
        ) {
          issues.push('status must be "pending", "in-progress", or "done"');
        }
        if (typeof task.created !== 'string') issues.push('created must be a string');
        if (typeof task.updated !== 'string') issues.push('updated must be a string');
        if (!Array.isArray(task.tags)) issues.push('tags must be an array');
        if (!Array.isArray(task.dependencies)) issues.push('dependencies must be an array');

        if (task.tags && !task.tags.every((tag: unknown) => typeof tag === 'string')) {
          issues.push('all tags must be strings');
        }
        if (
          task.dependencies &&
          !task.dependencies.every((dep: unknown) => typeof dep === 'number')
        ) {
          issues.push('all dependencies must be numbers');
        }
      }

      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be a valid task, but:\n  - ${issues.join('\n  - ')}`,
        pass: false,
      };
    }
  },

  /**
   * Check if an array has the expected number of tasks
   */
  toHaveTaskCount(received: unknown, expected: number) {
    if (!Array.isArray(received)) {
      return {
        message: () => `expected an array, but received ${typeof received}`,
        pass: false,
      };
    }

    const taskFiles = received.filter((item: unknown) => {
      if (typeof item === 'string') {
        return item.endsWith('.md');
      }
      return isTask(item);
    });

    const actualCount = taskFiles.length;
    const pass = actualCount === expected;

    return {
      message: () => `expected ${actualCount} tasks, but got ${expected}`,
      pass,
    };
  },

  /**
   * Check if a task has the expected status
   */
  toHaveStatus(received: unknown, expectedStatus: TaskStatus) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const pass = received.status === expectedStatus;

    return {
      message: () =>
        `expected task to have status "${expectedStatus}", but got "${received.status}"`,
      pass,
    };
  },

  /**
   * Check if a task has the expected title
   */
  toHaveTitle(received: unknown, expectedTitle: string) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const pass = received.title === expectedTitle;

    return {
      message: () => `expected task to have title "${expectedTitle}", but got "${received.title}"`,
      pass,
    };
  },

  /**
   * Check if a task has the expected tags
   */
  toHaveTags(received: unknown, ...expectedTags: string[]) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const hasAllTags = expectedTags.every((tag) => received.tags.includes(tag));

    return {
      message: () =>
        `expected task to have tags [${expectedTags.join(', ')}], but got [${received.tags.join(', ')}]`,
      pass: hasAllTags,
    };
  },

  /**
   * Check if a task has the expected dependencies
   */
  toHaveDependencies(received: unknown, ...expectedDeps: number[]) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const hasAllDeps = expectedDeps.every((dep) => received.dependencies.includes(dep));

    return {
      message: () =>
        `expected task to have dependencies [${expectedDeps.join(', ')}], but got [${received.dependencies.join(', ')}]`,
      pass: hasAllDeps,
    };
  },

  /**
   * Check if a task was created after a certain date
   */
  toBeCreatedAfter(received: unknown, afterDate: Date | string) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const taskCreated = new Date(received.created);
    const compareDate = typeof afterDate === 'string' ? new Date(afterDate) : afterDate;
    const pass = taskCreated > compareDate;

    return {
      message: () =>
        `expected task to be created after ${compareDate.toISOString()}, but was created at ${received.created}`,
      pass,
    };
  },

  /**
   * Check if a task was updated after a certain date
   */
  toBeUpdatedAfter(received: unknown, afterDate: Date | string) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const taskUpdated = new Date(received.updated);
    const compareDate = typeof afterDate === 'string' ? new Date(afterDate) : afterDate;
    const pass = taskUpdated > compareDate;

    return {
      message: () =>
        `expected task to be updated after ${compareDate.toISOString()}, but was updated at ${received.updated}`,
      pass,
    };
  },

  /**
   * Check if a task has valid timestamps (created <= updated)
   */
  toHaveValidTimestamps(received: unknown) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const created = new Date(received.created);
    const updated = new Date(received.updated);
    const validDates = !isNaN(created.getTime()) && !isNaN(updated.getTime());
    const validOrder = created <= updated;

    const pass = validDates && validOrder;

    if (!validDates) {
      return {
        message: () =>
          `expected task to have valid ISO date strings for created (${received.created}) and updated (${received.updated})`,
        pass: false,
      };
    }

    if (!validOrder) {
      return {
        message: () =>
          `expected task created date (${received.created}) to be before or equal to updated date (${received.updated})`,
        pass: false,
      };
    }

    return {
      message: () => 'expected task to have invalid timestamps',
      pass,
    };
  },

  /**
   * Check if a task matches a partial task object
   */
  toMatchTaskPartially(received: unknown, partialTask: Partial<Task>) {
    if (!isTask(received)) {
      return {
        message: () => `expected a valid task, but received ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const mismatches: string[] = [];

    for (const [key, expectedValue] of Object.entries(partialTask)) {
      const actualValue = (received as Record<string, unknown>)[key];

      if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
        // For arrays, check if they contain the same elements
        const expectedSet = new Set(expectedValue);
        const actualSet = new Set(actualValue);

        if (
          expectedSet.size !== actualSet.size ||
          !Array.from(expectedSet).every((item) => actualSet.has(item))
        ) {
          mismatches.push(
            `${key}: expected [${expectedValue.join(', ')}], got [${actualValue.join(', ')}]`
          );
        }
      } else if (actualValue !== expectedValue) {
        mismatches.push(
          `${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        );
      }
    }

    const pass = mismatches.length === 0;

    return {
      message: () =>
        pass
          ? `expected task not to match partial task ${JSON.stringify(partialTask)}`
          : `expected task to match partial task, but found mismatches:\n  - ${mismatches.join('\n  - ')}`,
      pass,
    };
  },
});

/**
 * Helper functions for creating common test assertions
 */
export const taskMatchers = {
  /**
   * Expect a task to be valid
   */
  expectValidTask: (task: unknown) => expect(task).toBeValidTask(),

  /**
   * Expect an array to have a specific number of tasks
   */
  expectTaskCount: (items: unknown, count: number) => expect(items).toHaveTaskCount(count),

  /**
   * Expect a task to have specific properties
   */
  expectTaskWith: (task: unknown, properties: Partial<Task>) =>
    expect(task).toMatchTaskPartially(properties),

  /**
   * Expect a task to be pending
   */
  expectPendingTask: (task: unknown) => expect(task).toHaveStatus('pending'),

  /**
   * Expect a task to be in progress
   */
  expectInProgressTask: (task: unknown) => expect(task).toHaveStatus('in-progress'),

  /**
   * Expect a task to be done
   */
  expectDoneTask: (task: unknown) => expect(task).toHaveStatus('done'),
};
