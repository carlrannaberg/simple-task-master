import { describe, it, expect } from 'vitest';
import { FrontmatterParser } from '@lib/frontmatter-parser';
import { ValidationError } from '@lib/types';

describe('FrontmatterParser', () => {
  describe('parse', () => {
    it('should parse valid frontmatter with content', () => {
      const input = '---\nid: 1\ntitle: Test\n---\nContent here';
      const result = FrontmatterParser.parse(input);

      expect(result.data).toEqual({ id: 1, title: 'Test' });
      expect(result.content).toBe('Content here');
    });

    it('should preserve empty content', () => {
      const input = '---\nid: 1\ntitle: Test\n---\n';
      const result = FrontmatterParser.parse(input);

      expect(result.content).toBe('');
    });

    it('should preserve content without trailing newline', () => {
      const input = '---\nid: 1\ntitle: Test\n---\nNo newline';
      const result = FrontmatterParser.parse(input);

      expect(result.content).toBe('No newline');
    });

    it('should handle no frontmatter', () => {
      const input = 'Just content';
      const result = FrontmatterParser.parse(input);

      expect(result.data).toEqual({});
      expect(result.content).toBe('Just content');
    });

    it('should handle Windows-style line endings', () => {
      const input = '---\r\nid: 1\r\ntitle: Test\r\n---\r\nContent';
      const result = FrontmatterParser.parse(input);

      expect(result.data).toEqual({ id: 1, title: 'Test' });
      expect(result.content).toBe('Content');
    });

    it('should preserve complex YAML structures', () => {
      const input = `---
id: 1
title: Complex Task
tags:
  - tag1
  - tag2
dependencies: [1, 2, 3]
created: 2024-01-01T00:00:00.000Z
---
Content`;
      const result = FrontmatterParser.parse(input);

      expect(result.data).toEqual({
        id: 1,
        title: 'Complex Task',
        tags: ['tag1', 'tag2'],
        dependencies: [1, 2, 3],
        created: '2024-01-01T00:00:00.000Z'
      });
    });

    it('should throw on invalid YAML', () => {
      const input = '---\n[invalid: yaml:\n---\nContent';

      expect(() => FrontmatterParser.parse(input)).toThrow(ValidationError);
      expect(() => FrontmatterParser.parse(input)).toThrow('Invalid YAML frontmatter');
    });
  });

  describe('stringify', () => {
    it('should create frontmatter with content', () => {
      const result = FrontmatterParser.stringify('Content', { id: 1, title: 'Test' });

      expect(result).toBe('---\nid: 1\ntitle: Test\n---\nContent');
    });

    it('should preserve empty content', () => {
      const result = FrontmatterParser.stringify('', { id: 1, title: 'Test' });

      expect(result).toBe('---\nid: 1\ntitle: Test\n---\n');
    });

    it('should preserve content without trailing newline', () => {
      const result = FrontmatterParser.stringify('No newline', { id: 1, title: 'Test' });

      expect(result).toBe('---\nid: 1\ntitle: Test\n---\nNo newline');
    });

    it('should handle empty data', () => {
      const result = FrontmatterParser.stringify('Content', {});

      expect(result).toBe('Content');
    });

    it('should handle null/undefined data', () => {
      const result = FrontmatterParser.stringify(
        'Content',
        null as unknown as Record<string, unknown>
      );

      expect(result).toBe('Content');
    });

    it('should preserve field order', () => {
      const data = { schema: 1, id: 2, title: 'Test', status: 'pending' };
      const result = FrontmatterParser.stringify('', data);

      const lines = result.split('\n');
      expect(lines[1]).toBe('schema: 1');
      expect(lines[2]).toBe('id: 2');
      expect(lines[3]).toBe('title: Test');
      expect(lines[4]).toBe('status: pending');
    });

    it('should handle complex data structures', () => {
      const data = {
        id: 1,
        title: 'Complex',
        tags: ['tag1', 'tag2'],
        dependencies: [1, 2, 3],
        created: '2024-01-01T00:00:00.000Z'
      };
      const result = FrontmatterParser.stringify('Content', data);

      expect(result).toContain('tags:\n  - tag1\n  - tag2');
      expect(result).toContain('dependencies:\n  - 1\n  - 2\n  - 3');
    });

    it('should quote strings with special characters', () => {
      const data = { title: 'Title: with colon', content: 'Value with "quotes"' };
      const result = FrontmatterParser.stringify('', data);

      expect(result).toContain('title: "Title: with colon"');
      expect(result).toContain('content: "Value with \\"quotes\\""');
    });
  });

  describe('round-trip preservation', () => {
    const testCases = [
      { name: 'empty content', content: '' },
      { name: 'content without trailing newline', content: 'Hello world' },
      { name: 'content with trailing newline', content: 'Hello world\n' },
      { name: 'content with multiple trailing newlines', content: 'Hello world\n\n' },
      { name: 'multiline content', content: 'Line 1\nLine 2\nLine 3' },
      { name: 'content with only newlines', content: '\n\n\n' },
      { name: 'content with tabs and spaces', content: '\t  \n\t\t\n  ' }
    ];

    testCases.forEach(({ name, content }) => {
      it(`should preserve ${name}`, () => {
        const data = { id: 1, title: 'Test', status: 'pending' };
        const stringified = FrontmatterParser.stringify(content, data);
        const parsed = FrontmatterParser.parse(stringified);

        expect(parsed.content).toBe(content);
        expect(parsed.data).toEqual(data);
      });
    });
  });

  describe('validateTaskData', () => {
    it('should validate required fields', () => {
      const validData = { id: 1, title: 'Test', status: 'pending' };

      // Should not throw
      expect(() => FrontmatterParser.validateTaskData(validData)).not.toThrow();
    });

    it('should throw on missing id', () => {
      const data = { title: 'Test', status: 'pending' };

      expect(() => FrontmatterParser.validateTaskData(data)).toThrow(ValidationError);
      expect(() => FrontmatterParser.validateTaskData(data)).toThrow('missing required fields: id');
    });

    it('should throw on missing title', () => {
      const data = { id: 1, status: 'pending' };

      expect(() => FrontmatterParser.validateTaskData(data)).toThrow(
        'missing required fields: title'
      );
    });

    it('should throw on missing status', () => {
      const data = { id: 1, title: 'Test' };

      expect(() => FrontmatterParser.validateTaskData(data)).toThrow(
        'missing required fields: status'
      );
    });

    it('should throw on multiple missing fields', () => {
      const data = { id: 1 };

      expect(() => FrontmatterParser.validateTaskData(data)).toThrow(
        'missing required fields: title, status'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle frontmatter without final newline after closing delimiter', () => {
      const input = '---\nid: 1\ntitle: Test\n---Content';
      const result = FrontmatterParser.parse(input);

      expect(result.data).toEqual({ id: 1, title: 'Test' });
      expect(result.content).toBe('Content');
    });

    it('should handle very large content', () => {
      const largeContent = 'x'.repeat(100000);
      const data = { id: 1, title: 'Large', status: 'pending' };

      const stringified = FrontmatterParser.stringify(largeContent, data);
      const parsed = FrontmatterParser.parse(stringified);

      expect(parsed.content).toBe(largeContent);
      expect(parsed.data).toEqual(data);
    });

    it('should handle content that looks like frontmatter', () => {
      const trickyContent = '---\nThis is not frontmatter\n---\nBut part of content';
      const data = { id: 1, title: 'Tricky', status: 'pending' };

      const stringified = FrontmatterParser.stringify(trickyContent, data);
      const parsed = FrontmatterParser.parse(stringified);

      expect(parsed.content).toBe(trickyContent);
    });
  });
});
