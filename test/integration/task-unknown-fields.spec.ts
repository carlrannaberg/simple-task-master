import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { TaskManager } from '@lib/task-manager';
import { FrontmatterParser } from '@lib/frontmatter-parser';
// import type { Task } from '@lib/types';

describe('Task Unknown Fields Integration', () => {
  let workspace: TestWorkspace;
  let taskManager: TaskManager;

  beforeEach(async () => {
    workspace = await TestWorkspace.create('task-unknown-fields-test-');
    taskManager = await TaskManager.create({
      tasksDir: workspace.tasksDirectory
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('Task Lifecycle with Unknown Fields', () => {
    it('should preserve unknown fields through create → update → load cycle', async () => {
      // Create task with unknown fields
      const task = await taskManager.create({
        title: 'Task with Unknown Fields',
        content: 'This task has custom metadata',
        // @ts-expect-error - Testing unknown fields
        customField: 'custom value',
        // @ts-expect-error - Testing unknown fields
        priority: 'high',
        // @ts-expect-error - Testing unknown fields
        metadata: {
          author: 'test-user',
          version: '1.0.0'
        }
      });

      // Verify unknown fields are preserved after creation
      expect(task).toMatchObject({
        title: 'Task with Unknown Fields',
        content: 'This task has custom metadata',
        customField: 'custom value',
        priority: 'high',
        metadata: {
          author: 'test-user',
          version: '1.0.0'
        }
      });

      // Update the task with changes to unknown fields
      const updatedTask = await taskManager.update(task.id, {
        // @ts-expect-error - Testing unknown fields
        customField: 'updated custom value',
        // @ts-expect-error - Testing unknown fields
        priority: 'medium',
        // @ts-expect-error - Testing unknown fields
        metadata: {
          author: 'test-user',
          version: '2.0.0',
          updatedAt: '2025-01-19'
        },
        // @ts-expect-error - Testing unknown fields
        newField: 'newly added field'
      });

      // Verify unknown fields are updated correctly
      expect(updatedTask).toMatchObject({
        title: 'Task with Unknown Fields',
        content: 'This task has custom metadata',
        customField: 'updated custom value',
        priority: 'medium',
        metadata: {
          author: 'test-user',
          version: '2.0.0',
          updatedAt: '2025-01-19'
        },
        newField: 'newly added field'
      });

      // Load the task again to verify persistence
      const loadedTask = await taskManager.get(task.id);

      // Verify all unknown fields persist after loading
      expect(loadedTask).toMatchObject({
        title: 'Task with Unknown Fields',
        content: 'This task has custom metadata',
        customField: 'updated custom value',
        priority: 'medium',
        metadata: {
          author: 'test-user',
          version: '2.0.0',
          updatedAt: '2025-01-19'
        },
        newField: 'newly added field'
      });
    });

    it('should preserve complex unknown field types', async () => {
      // Create task with various unknown field types
      const task = await taskManager.create({
        title: 'Complex Unknown Fields',
        // @ts-expect-error - Testing unknown fields
        numberField: 42,
        // @ts-expect-error - Testing unknown fields
        booleanField: true,
        // @ts-expect-error - Testing unknown fields
        arrayField: ['item1', 'item2', 'item3'],
        // @ts-expect-error - Testing unknown fields
        objectField: {
          nested: {
            deeply: {
              value: 'deep value'
            }
          }
        },
        // @ts-expect-error - Testing unknown fields
        nullField: null,
        // @ts-expect-error - Testing unknown fields
        mixedArray: [1, 'two', { three: 3 }, true]
      });

      // Verify types are preserved after creation
      expect(task.numberField).toBe(42);
      expect(task.booleanField).toBe(true);
      expect(task.arrayField).toEqual(['item1', 'item2', 'item3']);
      expect(task.objectField).toEqual({
        nested: {
          deeply: {
            value: 'deep value'
          }
        }
      });
      expect(task.nullField).toBe(null);
      expect(task.mixedArray).toEqual([1, 'two', { three: 3 }, true]);

      // Load the task to verify type preservation
      const loadedTask = await taskManager.get(task.id);

      expect(loadedTask.numberField).toBe(42);
      expect(loadedTask.booleanField).toBe(true);
      expect(loadedTask.arrayField).toEqual(['item1', 'item2', 'item3']);
      expect(loadedTask.objectField).toEqual({
        nested: {
          deeply: {
            value: 'deep value'
          }
        }
      });
      expect(loadedTask.nullField).toBe(null);
      expect(loadedTask.mixedArray).toEqual([1, 'two', { three: 3 }, true]);
    });

    it('should handle unknown fields during task listing', async () => {
      // Create multiple tasks with unknown fields
      await taskManager.create({
        title: 'Task 1',
        // @ts-expect-error - Testing unknown fields
        category: 'work',
        // @ts-expect-error - Testing unknown fields
        priority: 1
      });

      await taskManager.create({
        title: 'Task 2',
        // @ts-expect-error - Testing unknown fields
        category: 'personal',
        // @ts-expect-error - Testing unknown fields
        priority: 2
      });

      // List all tasks
      const tasks = await taskManager.list();

      // Sort by ID for consistent comparison
      const sortedTasks = tasks.sort((a, b) => a.id - b.id);

      expect(sortedTasks).toHaveLength(2);
      expect(sortedTasks[0]).toMatchObject({
        title: 'Task 1',
        category: 'work',
        priority: 1
      });
      expect(sortedTasks[1]).toMatchObject({
        title: 'Task 2',
        category: 'personal',
        priority: 2
      });
    });
  });

  describe('File-based Task Loading', () => {
    it('should preserve unknown fields from manually created YAML files', async () => {
      // Manually create a task file with unknown fields
      const taskId = 100;
      const filename = `${taskId}-manual-task.md`;
      const filepath = path.join(workspace.tasksDirectory, filename);

      const yamlContent = `---
id: 100
title: Manual Task with Unknown Fields
status: pending
schema: 1
created: "2025-01-19T10:00:00.000Z"
updated: "2025-01-19T10:00:00.000Z"
tags: []
dependencies: []
customField: "custom value from file"
priority: high
metadata:
  author: file-creator
  source: manual
  flags:
    - important
    - urgent
complexData:
  numbers: [1, 2, 3, 4, 5]
  settings:
    enabled: true
    threshold: 0.95
    mode: advanced
---
This is the content of the manually created task.

It has multiple lines and unknown fields in the frontmatter.`;

      await fs.writeFile(filepath, yamlContent, 'utf8');

      // Load the task using TaskManager
      const loadedTask = await taskManager.get(taskId);

      // Verify all unknown fields are preserved
      expect(loadedTask).toMatchObject({
        id: 100,
        title: 'Manual Task with Unknown Fields',
        status: 'pending',
        content: 'This is the content of the manually created task.\n\nIt has multiple lines and unknown fields in the frontmatter.',
        customField: 'custom value from file',
        priority: 'high',
        metadata: {
          author: 'file-creator',
          source: 'manual',
          flags: ['important', 'urgent']
        },
        complexData: {
          numbers: [1, 2, 3, 4, 5],
          settings: {
            enabled: true,
            threshold: 0.95,
            mode: 'advanced'
          }
        }
      });
    });

    it('should handle malformed or unconventional unknown fields', async () => {
      // Create a task file with edge-case field names and values
      const taskId = 200;
      const filename = `${taskId}-edge-case-task.md`;
      const filepath = path.join(workspace.tasksDirectory, filename);

      const yamlContent = `---
id: 200
title: "Task with Edge Cases"
status: done
schema: 1
created: "2025-01-19T11:00:00.000Z"
updated: "2025-01-19T11:00:00.000Z"
tags: []
dependencies: []
"field with spaces": "value with spaces"
field-with-dashes: "kebab-case-field"
field_with_underscores: "snake_case_field"
123numeric: "field starting with number"
special@char: "field with special char"
emptyString: ""
emptyArray: []
emptyObject: {}
quotedValue: 'This has "quotes" inside'
multilineString: |
  This is a multiline
  string value that
  spans multiple lines
---
Content with edge cases.`;

      await fs.writeFile(filepath, yamlContent, 'utf8');

      // Load the task
      const loadedTask = await taskManager.get(taskId);

      // Verify edge-case fields are preserved
      expect(loadedTask['field with spaces']).toBe('value with spaces');
      expect(loadedTask['field-with-dashes']).toBe('kebab-case-field');
      expect(loadedTask['field_with_underscores']).toBe('snake_case_field');
      expect(loadedTask['123numeric']).toBe('field starting with number');
      expect(loadedTask['special@char']).toBe('field with special char');
      expect(loadedTask['emptyString']).toBe('');
      expect(loadedTask['emptyArray']).toEqual([]);
      expect(loadedTask['emptyObject']).toEqual({});
      expect(loadedTask['quotedValue']).toBe('This has "quotes" inside');
      expect(loadedTask['multilineString']).toBe('This is a multiline\nstring value that\nspans multiple lines\n');
    });
  });

  describe('YAML Serialization/Deserialization', () => {
    it('should maintain unknown field types through YAML round-trip', async () => {
      // Test data with various types
      const testData = {
        id: 300,
        title: 'YAML Round-trip Test',
        status: 'pending' as const,
        schema: 1,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['test'],
        dependencies: [],
        // Unknown fields with various types
        stringField: 'string value',
        numberField: 42.5,
        booleanTrue: true,
        booleanFalse: false,
        nullValue: null,
        arrayOfNumbers: [1, 2, 3, 4, 5],
        arrayOfStrings: ['a', 'b', 'c'],
        nestedObject: {
          level1: {
            level2: {
              value: 'deep'
            }
          }
        },
        mixedArray: [1, 'two', true, null, { key: 'value' }]
      };

      const content = 'Test content for YAML round-trip';

      // Serialize to YAML
      const yamlString = FrontmatterParser.stringify(content, testData);

      // Parse back from YAML
      const parsed = FrontmatterParser.parse(yamlString);

      // Verify all types are preserved
      expect(parsed.data.stringField).toBe('string value');
      expect(parsed.data.numberField).toBe(42.5);
      expect(parsed.data.booleanTrue).toBe(true);
      expect(parsed.data.booleanFalse).toBe(false);
      expect(parsed.data.nullValue).toBe(null);
      expect(parsed.data.arrayOfNumbers).toEqual([1, 2, 3, 4, 5]);
      expect(parsed.data.arrayOfStrings).toEqual(['a', 'b', 'c']);
      expect(parsed.data.nestedObject).toEqual({
        level1: {
          level2: {
            value: 'deep'
          }
        }
      });
      expect(parsed.data.mixedArray).toEqual([1, 'two', true, null, { key: 'value' }]);
      expect(parsed.content).toBe(content);
    });

    it('should handle special characters in unknown field values', async () => {
      const task = await taskManager.create({
        title: 'Special Characters Test',
        // @ts-expect-error - Testing unknown fields
        fieldWithQuotes: 'This has "double quotes" and \'single quotes\'',
        // @ts-expect-error - Testing unknown fields
        fieldWithNewlines: 'Line 1\nLine 2\nLine 3',
        // @ts-expect-error - Testing unknown fields
        fieldWithTabs: 'Tab\there\tand\there',
        // @ts-expect-error - Testing unknown fields
        fieldWithUnicode: '🚀 Emoji and special chars: ñ, ü, ß, 中文',
        // @ts-expect-error - Testing unknown fields
        fieldWithEscapes: 'Backslash \\ and other escapes: \n \t \r'
      });

      // Load the task to verify persistence
      const loadedTask = await taskManager.get(task.id);

      expect(loadedTask.fieldWithQuotes).toBe('This has "double quotes" and \'single quotes\'');
      expect(loadedTask.fieldWithNewlines).toBe('Line 1\nLine 2\nLine 3');
      expect(loadedTask.fieldWithTabs).toBe('Tab\there\tand\there');
      expect(loadedTask.fieldWithUnicode).toBe('🚀 Emoji and special chars: ñ, ü, ß, 中文');
      expect(loadedTask.fieldWithEscapes).toBe('Backslash \\ and other escapes: \n \t \r');
    });
  });

  describe('Integration with External Tools', () => {
    it('should support external tool metadata patterns', async () => {
      // Create task with common external tool metadata patterns
      const task = await taskManager.create({
        title: 'External Tool Integration',
        // @ts-expect-error - Testing unknown fields
        // GitHub integration metadata
        github: {
          issue: 123,
          pr: 456,
          labels: ['bug', 'enhancement'],
          milestone: 'v2.0.0'
        },
        // @ts-expect-error - Testing unknown fields
        // Jira-style metadata
        jira: {
          key: 'PROJ-123',
          type: 'Story',
          points: 5,
          sprint: 'Sprint 23'
        },
        // @ts-expect-error - Testing unknown fields
        // Time tracking metadata
        timeTracking: {
          estimated: '4h',
          spent: '2h 30m',
          remaining: '1h 30m'
        },
        // @ts-expect-error - Testing unknown fields
        // Custom workflow metadata
        workflow: {
          stage: 'in-review',
          assignee: 'john.doe',
          reviewers: ['jane.smith', 'bob.jones'],
          blockedBy: []
        }
      });

      // Update with external tool changes
      const updated = await taskManager.update(task.id, {
        // @ts-expect-error - Testing unknown fields
        github: {
          issue: 123,
          pr: 456,
          labels: ['bug', 'enhancement', 'reviewed'],
          milestone: 'v2.0.0',
          merged: true
        },
        // @ts-expect-error - Testing unknown fields
        timeTracking: {
          estimated: '4h',
          spent: '4h',
          remaining: '0h'
        },
        // @ts-expect-error - Testing unknown fields
        workflow: {
          stage: 'completed',
          assignee: 'john.doe',
          reviewers: ['jane.smith', 'bob.jones'],
          blockedBy: [],
          completedAt: '2025-01-19T15:00:00.000Z'
        }
      });

      // Verify all external tool metadata is preserved
      expect(updated.github).toEqual({
        issue: 123,
        pr: 456,
        labels: ['bug', 'enhancement', 'reviewed'],
        milestone: 'v2.0.0',
        merged: true
      });

      expect(updated.jira).toEqual({
        key: 'PROJ-123',
        type: 'Story',
        points: 5,
        sprint: 'Sprint 23'
      });

      expect(updated.timeTracking).toEqual({
        estimated: '4h',
        spent: '4h',
        remaining: '0h'
      });

      expect(updated.workflow).toEqual({
        stage: 'completed',
        assignee: 'john.doe',
        reviewers: ['jane.smith', 'bob.jones'],
        blockedBy: [],
        completedAt: '2025-01-19T15:00:00.000Z'
      });
    });

    it('should handle plugin-style extension fields', async () => {
      // Create task with plugin extension fields
      const task = await taskManager.create({
        title: 'Plugin Extensions Test',
        // @ts-expect-error - Testing unknown fields
        _extensions: {
          'com.example.myplugin': {
            version: '1.0.0',
            settings: {
              enabled: true,
              autoSync: false
            }
          },
          'io.otherplugin': {
            data: 'custom plugin data',
            config: {
              mode: 'advanced'
            }
          }
        },
        // @ts-expect-error - Testing unknown fields
        _metadata: {
          source: 'api',
          apiVersion: '2.0',
          client: 'external-tool-v3.1.0'
        }
      });

      // Verify extension fields are preserved
      const loaded = await taskManager.get(task.id);

      expect(loaded._extensions).toEqual({
        'com.example.myplugin': {
          version: '1.0.0',
          settings: {
            enabled: true,
            autoSync: false
          }
        },
        'io.otherplugin': {
          data: 'custom plugin data',
          config: {
            mode: 'advanced'
          }
        }
      });

      expect(loaded._metadata).toEqual({
        source: 'api',
        apiVersion: '2.0',
        client: 'external-tool-v3.1.0'
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large unknown field structures', async () => {
      // Create a large nested structure
      const largeData: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        largeData[`field_${i}`] = {
          id: i,
          value: `Value ${i}`,
          nested: {
            data: Array(10).fill(null).map((_, j) => ({
              index: j,
              text: `Item ${i}-${j}`
            }))
          }
        };
      }

      const task = await taskManager.create({
        title: 'Large Data Structure',
        // @ts-expect-error - Testing unknown fields
        largeData
      });

      // Verify large structure is preserved
      const loaded = await taskManager.get(task.id);
      expect(loaded.largeData).toEqual(largeData);
    });

    it('should preserve field order in YAML output', async () => {
      // Create task with specific field order
      const task = await taskManager.create({
        title: 'Field Order Test',
        // @ts-expect-error - Testing unknown fields
        zField: 'should not be first',
        // @ts-expect-error - Testing unknown fields
        aField: 'should not necessarily be first either',
        // @ts-expect-error - Testing unknown fields
        customField: 'middle field'
      });

      // Read the actual file to check YAML field order
      const files = await fs.readdir(workspace.tasksDirectory);
      const taskFile = files.find((f) => f.startsWith(`${task.id}-`));
      expect(taskFile).toBeDefined();

      const filePath = path.join(workspace.tasksDirectory, taskFile || '');
      const fileContent = await fs.readFile(filePath, 'utf8');

      // Verify that core fields come first, then unknown fields
      const lines = fileContent.split('\n');
      const yamlSection = lines.slice(1, lines.indexOf('---', 1));
      const fieldOrder = yamlSection
        .filter((line) => line.includes(':'))
        .map((line) => line.split(':')[0].trim());

      // Core fields should come first
      expect(fieldOrder.indexOf('id')).toBeLessThan(fieldOrder.indexOf('zField'));
      expect(fieldOrder.indexOf('title')).toBeLessThan(fieldOrder.indexOf('aField'));
      expect(fieldOrder.indexOf('status')).toBeLessThan(fieldOrder.indexOf('customField'));
    });
  });
});
