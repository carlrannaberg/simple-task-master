import { describe, it, expect } from 'vitest';
import { FrontmatterParser } from '@lib/frontmatter-parser';
import { ValidationError } from '@lib/types';

describe('FrontmatterParser - Edge Cases from gray-matter', () => {
  describe('empty input variations', () => {
    it('should handle empty string input', () => {
      const result = FrontmatterParser.parse('');
      expect(result.data).toEqual({});
      expect(result.content).toBe('');
      expect(result.matter).toBe('');
      expect(result.orig).toBe('');
    });

    it('should handle only whitespace input', () => {
      const result = FrontmatterParser.parse('   \n\t\n   ');
      expect(result.data).toEqual({});
      expect(result.content).toBe('   \n\t\n   ');
    });

    it('should handle null/undefined input gracefully', () => {
      // @ts-expect-error - testing invalid input
      expect(() => FrontmatterParser.parse(null)).toThrow();
      // @ts-expect-error - testing invalid input
      expect(() => FrontmatterParser.parse(undefined)).toThrow();
    });
  });

  describe('delimiter edge cases', () => {
    it('should handle extra characters after opening delimiter', () => {
      const input = '---whatever\nid: 1\n---\nContent';
      const result = FrontmatterParser.parse(input);
      // Should treat as content since delimiter is invalid
      expect(result.data).toEqual({});
      expect(result.content).toBe(input);
    });

    it('should handle spaces after delimiter', () => {
      const input = '---  \nid: 1\n---   \nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({ id: 1 });
      expect(result.content).toBe('Content');
    });

    it('should handle delimiter-like strings in YAML values', () => {
      const input =
        '---\ntitle: "Contains --- delimiter"\ndescription: "Another --- test"\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data.title).toBe('Contains --- delimiter');
      expect(result.data.description).toBe('Another --- test');
      expect(result.content).toBe('Content');
    });

    it('should handle content immediately after closing delimiter', () => {
      const input = '---\ntitle: Test\n---Content without newline';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({ title: 'Test' });
      expect(result.content).toBe('Content without newline');
    });
  });

  describe('frontmatter with only comments', () => {
    it('should handle frontmatter with only comments', () => {
      const input = '---\n# Just a comment\n# Another comment\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({});
      expect(result.content).toBe('Content');
    });

    it('should handle frontmatter with comments and data', () => {
      const input = '---\n# Comment\nid: 1\n# Another comment\ntitle: Test\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({ id: 1, title: 'Test' });
      expect(result.content).toBe('Content');
    });
  });

  describe('line ending variations', () => {
    it('should handle Windows line endings (CRLF)', () => {
      const input = '---\r\nid: 1\r\ntitle: Test\r\n---\r\nContent\r\nMore content';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({ id: 1, title: 'Test' });
      expect(result.content).toBe('Content\r\nMore content');
    });

    it('should handle mixed line endings', () => {
      const input = '---\r\nid: 1\ntitle: Test\r\n---\nContent\r\nMore content\n';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({ id: 1, title: 'Test' });
      expect(result.content).toBe('Content\r\nMore content\n');
    });

    it('should handle old Mac line endings (CR only)', () => {
      const input = '---\rid: 1\rtitle: Test\r---\rContent';
      const result = FrontmatterParser.parse(input);
      // Since we split on \n, this won't parse as frontmatter
      expect(result.data).toEqual({});
      expect(result.content).toBe(input);
    });
  });

  describe('unicode and special characters', () => {
    it('should preserve unicode characters in frontmatter', () => {
      const input = '---\ntitle: "测试 🎉"\nauthor: "José María"\n---\n内容 with émojis 🚀';
      const result = FrontmatterParser.parse(input);
      expect(result.data.title).toBe('测试 🎉');
      expect(result.data.author).toBe('José María');
      expect(result.content).toBe('内容 with émojis 🚀');
    });

    it('should handle special characters in values', () => {
      const input =
        '---\ntitle: "Title with \'quotes\' and \\"double quotes\\""\npath: "C:\\\\Users\\\\test"\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data.title).toBe('Title with \'quotes\' and "double quotes"');
      expect(result.data.path).toBe('C:\\Users\\test');
    });

    it('should handle zero-width characters', () => {
      const input = '---\ntitle: "Test\u200B\u200CTitle"\n---\nContent\u200D';
      const result = FrontmatterParser.parse(input);
      expect(result.data.title).toBe('Test\u200B\u200CTitle');
      expect(result.content).toBe('Content\u200D');
    });
  });

  describe('complex YAML structures', () => {
    it('should handle nested empty values', () => {
      const input =
        '---\ntitle: ""\ntags: []\nmeta:\n  description: null\n  keywords: []\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data).toEqual({
        title: '',
        tags: [],
        meta: {
          description: null,
          keywords: []
        }
      });
    });

    it('should handle multiline strings', () => {
      const input = '---\ndescription: |\n  Line 1\n  Line 2\n  Line 3\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data.description).toBe('Line 1\nLine 2\nLine 3\n');
    });

    it('should handle quoted multiline strings', () => {
      const input = '---\ndescription: "Line 1\\nLine 2\\nLine 3"\n---\nContent';
      const result = FrontmatterParser.parse(input);
      expect(result.data.description).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('performance edge cases', () => {
    it('should handle extremely long lines in frontmatter', () => {
      const longValue = 'x'.repeat(10000);
      const input = `---\ntitle: "${longValue}"\n---\nContent`;
      const result = FrontmatterParser.parse(input);
      expect(result.data.title).toBe(longValue);
    });

    it('should handle very large frontmatter sections', () => {
      const entries = Array.from({ length: 1000 }, (_, i) => `key${i}: value${i}`).join('\n');
      const input = `---\n${entries}\n---\nContent`;
      const result = FrontmatterParser.parse(input);
      expect(Object.keys(result.data)).toHaveLength(1000);
      expect(result.data.key0).toBe('value0');
      expect(result.data.key999).toBe('value999');
    });
  });

  describe('error handling', () => {
    it('should throw ValidationError for invalid YAML', () => {
      const input = '---\n[invalid: yaml:\n---\nContent';
      expect(() => FrontmatterParser.parse(input)).toThrow(ValidationError);
      expect(() => FrontmatterParser.parse(input)).toThrow('Invalid YAML frontmatter');
    });

    it('should throw ValidationError for YAML with tabs in wrong places', () => {
      const input = '---\nkey:\n\tvalue\n---\nContent';
      expect(() => FrontmatterParser.parse(input)).toThrow(ValidationError);
    });
  });

  describe('stringify edge cases', () => {
    it('should handle data with special YAML characters', () => {
      const data = {
        title: 'Title: with colon',
        description: 'Line 1\nLine 2',
        special: '--- not a delimiter'
      };
      const result = FrontmatterParser.stringify('Content', data);

      // Parse it back to ensure round-trip works
      const parsed = FrontmatterParser.parse(result);
      expect(parsed.data).toEqual(data);
      expect(parsed.content).toBe('Content');
    });

    it('should handle circular references gracefully', () => {
      interface CircularData {
        id: number;
        circular?: CircularData;
      }

      const data: CircularData = { id: 1 };
      data.circular = data; // Create circular reference

      // js-yaml should handle this
      expect(() => FrontmatterParser.stringify('Content', data)).toThrow();
    });
  });

  describe('round-trip edge cases', () => {
    const edgeCases = [
      { name: 'single newline', content: '\n' },
      { name: 'multiple newlines', content: '\n\n\n' },
      { name: 'tabs and spaces', content: '\t  \n\t\t\n  ' },
      { name: 'CRLF endings', content: 'Line 1\r\nLine 2\r\n' },
      { name: 'no final newline', content: 'Content without newline' },
      { name: 'unicode content', content: '🎉 Unicode 测试 content' },
      { name: 'long content', content: 'x'.repeat(100000) }
    ];

    edgeCases.forEach(({ name, content }) => {
      it(`should preserve ${name} in round-trip`, () => {
        const data = { id: 1, title: 'Test', status: 'pending' };
        const stringified = FrontmatterParser.stringify(content, data);
        const parsed = FrontmatterParser.parse(stringified);

        expect(parsed.content).toBe(content);
        expect(parsed.data).toEqual(data);
      });
    });
  });
});
