import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '@lib/task-manager';
import { TestWorkspace } from '@test/helpers';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('TaskManager - Content Preservation', () => {
  let workspace: TestWorkspace;
  let taskManager: TaskManager;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
    taskManager = await TaskManager.create({
      tasksDir: workspace.tasksDirectory
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('content preservation with new FrontmatterParser', () => {
    it('should preserve empty content exactly', async () => {
      const task = await taskManager.create({
        title: 'Empty Content Task',
        content: ''
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe('');

      // Verify file content doesn't have _contentMetadata
      const filepath = path.join(workspace.tasksDirectory, `${task.id}-empty-content-task.md`);
      const fileContent = await fs.readFile(filepath, 'utf8');
      expect(fileContent).not.toContain('_contentMetadata');
    });

    it('should preserve content without trailing newline', async () => {
      const contentWithoutNewline = 'This content has no trailing newline';
      const task = await taskManager.create({
        title: 'No Newline Task',
        content: contentWithoutNewline
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(contentWithoutNewline);

      // Verify file content
      const filepath = path.join(workspace.tasksDirectory, `${task.id}-no-newline-task.md`);
      const fileContent = await fs.readFile(filepath, 'utf8');
      expect(fileContent).toMatch(new RegExp(contentWithoutNewline + '$'));
      expect(fileContent).not.toContain('_contentMetadata');
    });

    it('should preserve content with trailing newline', async () => {
      const contentWithNewline = 'This content has a trailing newline\n';
      const task = await taskManager.create({
        title: 'Newline Task',
        content: contentWithNewline
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(contentWithNewline);
    });

    it('should preserve multiple trailing newlines', async () => {
      const contentWithMultipleNewlines = 'Content with multiple trailing newlines\n\n\n';
      const task = await taskManager.create({
        title: 'Multiple Newlines Task',
        content: contentWithMultipleNewlines
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(contentWithMultipleNewlines);
    });

    it('should preserve whitespace-only content', async () => {
      const whitespaceContent = '   \n\t   \n   ';
      const task = await taskManager.create({
        title: 'Whitespace Task',
        content: whitespaceContent
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(whitespaceContent);
    });

    it('should handle round-trip content preservation on update', async () => {
      // Create task with specific content format
      const originalContent = 'Original content without newline';
      const task = await taskManager.create({
        title: 'Update Test Task',
        content: originalContent
      });

      // Update only the title, content should be preserved exactly
      await taskManager.update(task.id, {
        title: 'Updated Title'
      });

      const afterTitleUpdate = await taskManager.get(task.id);
      expect(afterTitleUpdate.content).toBe(originalContent);

      // Update the content to empty
      await taskManager.update(task.id, {
        content: ''
      });

      const afterEmptyUpdate = await taskManager.get(task.id);
      expect(afterEmptyUpdate.content).toBe('');

      // Update content to have trailing newlines
      const newContent = 'New content with newlines\n\n';
      await taskManager.update(task.id, {
        content: newContent
      });

      const afterNewlineUpdate = await taskManager.get(task.id);
      expect(afterNewlineUpdate.content).toBe(newContent);
    });

    it('should not add _contentMetadata to files', async () => {
      const testCases = [
        { title: 'Empty', content: '' },
        { title: 'No Newline', content: 'no newline' },
        { title: 'With Newline', content: 'with newline\n' },
        { title: 'Multiple Newlines', content: 'multiple\n\n' }
      ];

      for (const testCase of testCases) {
        const task = await taskManager.create(testCase);

        const filepath = path.join(
          workspace.tasksDirectory,
          `${task.id}-${testCase.title.toLowerCase().replace(' ', '-')}.md`
        );
        const fileContent = await fs.readFile(filepath, 'utf8');

        expect(fileContent).not.toContain('_contentMetadata');
        expect(fileContent).not.toContain('wasEmpty');
        expect(fileContent).not.toContain('hadNoTrailingNewline');
      }
    });
  });

  describe('compatibility with various content formats', () => {
    it('should handle content that looks like frontmatter', async () => {
      const trickyContent = `---
This looks like frontmatter
but it's actually content
---
More content here`;

      const task = await taskManager.create({
        title: 'Tricky Content',
        content: trickyContent
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(trickyContent);
    });

    it('should handle very long content', async () => {
      const longContent = 'x'.repeat(50000); // 50KB of content
      const task = await taskManager.create({
        title: 'Long Content',
        content: longContent
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(longContent);
    });

    it('should handle content with special characters', async () => {
      const specialContent = 'Content with special chars: \x00\x01\x02\r\n\t';
      const task = await taskManager.create({
        title: 'Special Chars',
        content: specialContent
      });

      const retrieved = await taskManager.get(task.id);
      expect(retrieved.content).toBe(specialContent);
    });
  });
});
