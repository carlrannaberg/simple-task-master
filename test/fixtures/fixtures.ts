import * as fs from 'fs/promises';
import * as path from 'path';
import type { Task } from '@lib/types';
import { TaskBuilder } from '../helpers/builders';

/**
 * Fixture management utilities for tests
 */
export class TestFixtures {
  private static readonly FIXTURES_DIR = path.join(__dirname);

  /**
   * Load sample tasks from JSON fixture
   */
  static async loadSampleTasks(): Promise<Task[]> {
    const filePath = path.join(this.FIXTURES_DIR, 'sample-tasks.json');
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as Task[];
  }

  /**
   * Load a specific task file fixture
   */
  static async loadTaskFile(filename: string): Promise<string> {
    const filePath = path.join(this.FIXTURES_DIR, 'task-files', filename);
    return fs.readFile(filePath, 'utf8');
  }

  /**
   * Load configuration fixture
   */
  static async loadConfig(configName: string): Promise<Record<string, unknown>> {
    const filePath = path.join(this.FIXTURES_DIR, 'configurations', `${configName}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Load invalid/corrupted fixture for error testing
   */
  static async loadInvalidFixture(filename: string): Promise<string> {
    const filePath = path.join(this.FIXTURES_DIR, 'invalid', filename);
    return fs.readFile(filePath, 'utf8');
  }

  /**
   * Load scenario configuration
   */
  static async loadScenario(scenarioName: string): Promise<Record<string, unknown>> {
    const filePath = path.join(this.FIXTURES_DIR, 'scenarios', `${scenarioName}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Get all available task file fixtures
   */
  static async getTaskFileFixtures(): Promise<string[]> {
    const taskFilesDir = path.join(this.FIXTURES_DIR, 'task-files');
    try {
      const files = await fs.readdir(taskFilesDir);
      return files.filter((f) => f.endsWith('.md'));
    } catch {
      return [];
    }
  }

  /**
   * Create tasks for performance testing
   */
  static createPerformanceTestTasks(count: number): Task[] {
    const tasks: Task[] = [];

    for (let i = 1; i <= count; i++) {
      const task = TaskBuilder.create()
        .withId(i)
        .withTitle(`Performance Test Task ${i}`)
        .withContent(
          `# Performance Test Task ${i}\n\nThis is a test task created for performance testing purposes.\n\n## Details\n- Task ID: ${i}\n- Created for testing performance with large datasets\n- Contains standard markdown content\n\n## Checklist\n- [ ] First item\n- [ ] Second item\n- [ ] Third item`
        )
        .withTags('performance', 'test', `batch-${Math.floor((i - 1) / 10)}`)
        .withStatus(i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in-progress' : 'pending')
        .build();

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Create tasks with complex dependencies for testing
   */
  static createDependencyTestTasks(): Task[] {
    return [
      // Base tasks (no dependencies)
      TaskBuilder.create().withId(1).withTitle('Foundation Task').withTags('foundation').build(),

      TaskBuilder.create()
        .withId(2)
        .withTitle('Another Foundation Task')
        .withTags('foundation')
        .build(),

      // Level 1 dependencies
      TaskBuilder.create()
        .withId(3)
        .withTitle('Depends on Task 1')
        .withDependencies(1)
        .withTags('level1')
        .build(),

      TaskBuilder.create()
        .withId(4)
        .withTitle('Depends on Task 2')
        .withDependencies(2)
        .withTags('level1')
        .build(),

      // Level 2 dependencies
      TaskBuilder.create()
        .withId(5)
        .withTitle('Depends on Tasks 3 and 4')
        .withDependencies(3, 4)
        .withTags('level2')
        .build(),

      // Complex dependencies
      TaskBuilder.create()
        .withId(6)
        .withTitle('Complex Dependencies')
        .withDependencies(1, 3, 5)
        .withTags('complex')
        .build(),
    ];
  }

  /**
   * Create tasks with various tag combinations for filtering tests
   */
  static createTagTestTasks(): Task[] {
    return [
      TaskBuilder.create()
        .withId(1)
        .withTitle('Frontend Task')
        .withTags('frontend', 'ui', 'react')
        .build(),

      TaskBuilder.create()
        .withId(2)
        .withTitle('Backend Task')
        .withTags('backend', 'api', 'nodejs')
        .build(),

      TaskBuilder.create()
        .withId(3)
        .withTitle('Database Task')
        .withTags('backend', 'database', 'postgresql')
        .build(),

      TaskBuilder.create()
        .withId(4)
        .withTitle('DevOps Task')
        .withTags('devops', 'deployment', 'ci-cd')
        .build(),

      TaskBuilder.create()
        .withId(5)
        .withTitle('Full Stack Task')
        .withTags('frontend', 'backend', 'fullstack')
        .build(),

      TaskBuilder.create()
        .withId(6)
        .withTitle('Urgent Bug Fix')
        .withTags('bug', 'urgent', 'hotfix')
        .build(),
    ];
  }

  /**
   * Create tasks with various content lengths for size testing
   */
  static createSizeTestTasks(): Task[] {
    const shortContent = 'Short task description.';
    const mediumContent =
      'Medium length task description.\n\n' +
      'This task has a moderate amount of content to test handling of different content sizes.\n\n' +
      '## Details\n- Point 1\n- Point 2\n- Point 3';
    const longContent =
      'Very long task description.\n\n' +
      'This task has extensive content to test the limits of content handling.\n\n' +
      '## Background\n' +
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50) +
      '\n\n## Requirements\n' +
      'Detailed requirement description. '.repeat(30) +
      '\n\n## Implementation Notes\n' +
      'Technical implementation details. '.repeat(40);

    return [
      TaskBuilder.create()
        .withId(1)
        .withTitle('Short Content Task')
        .withContent(shortContent)
        .withTags('size-test', 'short')
        .build(),

      TaskBuilder.create()
        .withId(2)
        .withTitle('Medium Content Task')
        .withContent(mediumContent)
        .withTags('size-test', 'medium')
        .build(),

      TaskBuilder.create()
        .withId(3)
        .withTitle('Long Content Task')
        .withContent(longContent)
        .withTags('size-test', 'long')
        .build(),
    ];
  }

  /**
   * Create tasks with edge case titles for filename testing
   */
  static createEdgeCaseTasks(): Task[] {
    return [
      TaskBuilder.create().withId(1).withTitle('Normal Task Title').build(),

      TaskBuilder.create().withId(2).withTitle('Task with "quotes" and symbols!').build(),

      TaskBuilder.create().withId(3).withTitle('Task with émojis 🚀 and ünicode').build(),

      TaskBuilder.create()
        .withId(4)
        .withTitle(
          'Very Long Task Title That Exceeds Normal Length Expectations And Should Be Truncated Properly'
        )
        .build(),

      TaskBuilder.create().withId(5).withTitle('Task/with\\slashes').build(),
    ];
  }
}
