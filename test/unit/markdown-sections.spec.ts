/**
 * Markdown sections unit tests
 *
 * Tests for parsing, building, and updating markdown sections
 * in task content.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMarkdownSections,
  buildMarkdownContent,
  updateBodySection,
  type MarkdownSections
} from '@/lib/markdown-sections';

describe('Markdown Sections', () => {
  describe('parseMarkdownSections', () => {
    it('should parse empty content', () => {
      const result = parseMarkdownSections('');
      expect(result).toEqual({ description: '' });
    });

    it('should parse content with only description', () => {
      const content = 'This is a simple description\nwith multiple lines.';
      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'This is a simple description\nwith multiple lines.'
      });
    });

    it('should parse content with all sections', () => {
      const content = `This is the description part.

## Details

This is the implementation details.
- Step 1
- Step 2

## Validation

- [ ] Test case 1
- [ ] Test case 2
- [x] Completed test`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'This is the description part.',
        details: `This is the implementation details.
- Step 1
- Step 2`,
        validation: `- [ ] Test case 1
- [ ] Test case 2
- [x] Completed test`
      });
    });

    it('should handle sections in different order', () => {
      const content = `Initial description.

## Validation

Test validation content.

## Details

Some implementation details.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Initial description.',
        validation: 'Test validation content.',
        details: 'Some implementation details.'
      });
    });

    it('should handle custom sections', () => {
      const content = `Description here.

## Custom section

Custom content here.

## Another Custom

More custom content.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Description here.',
        'custom section': 'Custom content here.',
        'another custom': 'More custom content.'
      });
    });

    it('should handle empty sections', () => {
      const content = `Description content.

## Details

## Validation

Some validation content.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Description content.',
        details: '',
        validation: 'Some validation content.'
      });
    });

    it('should handle sections with only whitespace', () => {
      const content = `Description content.

## Details
   
   
## Validation

Some validation content.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Description content.',
        details: '',
        validation: 'Some validation content.'
      });
    });

    it('should handle malformed headings', () => {
      const content = `Description content.

# Wrong level heading
This should be part of description.

## Correct Heading

Correct section content.

### Sub-heading
This should be part of the correct section.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: `Description content.

# Wrong level heading
This should be part of description.`,
        'correct heading': `Correct section content.

### Sub-heading
This should be part of the correct section.`
      });
    });

    it('should preserve formatting and whitespace within sections', () => {
      const content = `Description with   spaces.

## Details

   Indented content
     More indentation
Normal line

    Code block indentation

## Validation

- Item 1  
- Item 2

  Sub-paragraph with spacing.`;

      const result = parseMarkdownSections(content);

      expect(result.description).toBe('Description with   spaces.');
      expect(result.details).toBe(`Indented content
     More indentation
Normal line

    Code block indentation`);
      expect(result.validation).toBe(`- Item 1  
- Item 2

  Sub-paragraph with spacing.`);
    });

    it('should handle content with no newlines', () => {
      const content = 'Single line description ## Details Single line details';
      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Single line description ## Details Single line details'
      });
    });

    it('should handle heading-like text within content', () => {
      const content = `Description with ## fake heading in text.

## Real Details

Content mentioning ## not a heading.
And more content.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Description with ## fake heading in text.',
        'real details': `Content mentioning ## not a heading.
And more content.`
      });
    });

    it('should handle Unicode and special characters', () => {
      const content = `Description with émojis 🚀 and üñíçödé.

## Détails

Implementation with spëcial characters.
And some émojis: 📝 ✅ ❌

## Validation ✓

- [x] Test with émoji ✅
- [ ] Test ñew feature 🔥`;

      const result = parseMarkdownSections(content);

      expect(result.description).toBe('Description with émojis 🚀 and üñíçödé.');
      expect(result['détails']).toBe(`Implementation with spëcial characters.
And some émojis: 📝 ✅ ❌`);
      expect(result['validation ✓']).toBe(`- [x] Test with émoji ✅
- [ ] Test ñew feature 🔥`);
    });

    it('should handle multiple consecutive headings', () => {
      const content = `Description.

## Details
## Validation

Validation content.

## Notes

Notes content.`;

      const result = parseMarkdownSections(content);

      expect(result).toEqual({
        description: 'Description.',
        validation: 'Validation content.',
        notes: 'Notes content.'
      });
    });
  });

  describe('buildMarkdownContent', () => {
    it('should build content from description only', () => {
      const sections: MarkdownSections = {
        description: 'Simple description content.'
      };

      const result = buildMarkdownContent(sections);
      expect(result).toBe('Simple description content.');
    });

    it('should build content with all sections', () => {
      const sections: MarkdownSections = {
        description: 'Task description.',
        details: 'Implementation details.',
        validation: 'Test validation steps.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Task description.

## Details
Implementation details.

## Validation
Test validation steps.`;

      expect(result).toBe(expected);
    });

    it('should build content with only some sections', () => {
      const sections: MarkdownSections = {
        description: 'Task description.',
        validation: 'Test validation steps.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Task description.

## Validation
Test validation steps.`;

      expect(result).toBe(expected);
    });

    it('should handle custom sections', () => {
      const sections: MarkdownSections = {
        description: 'Task description.',
        'custom section': 'Custom content.',
        notes: 'Additional notes.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Task description.

## Custom section
Custom content.

## Notes
Additional notes.`;

      expect(result).toBe(expected);
    });

    it('should preserve section order (known sections first)', () => {
      const sections: MarkdownSections = {
        'custom section': 'Custom content.',
        validation: 'Validation content.',
        description: 'Description content.',
        details: 'Details content.',
        notes: 'Notes content.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Description content.

## Details
Details content.

## Validation
Validation content.

## Custom section
Custom content.

## Notes
Notes content.`;

      expect(result).toBe(expected);
    });

    it('should handle empty sections gracefully', () => {
      const sections: MarkdownSections = {
        description: 'Description content.',
        details: '',
        validation: 'Validation content.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Description content.

## Validation
Validation content.`;

      expect(result).toBe(expected);
    });

    it('should handle description without heading when no other sections', () => {
      const sections: MarkdownSections = {
        description: 'Simple description.'
      };

      const result = buildMarkdownContent(sections);
      expect(result).toBe('Simple description.');
    });

    it('should capitalize section names properly', () => {
      const sections: MarkdownSections = {
        description: 'Description content.',
        'implementation details': 'Details content.',
        'test validation': 'Validation content.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Description content.

## Implementation details
Details content.

## Test validation
Validation content.`;

      expect(result).toBe(expected);
    });

    it('should handle sections with undefined content', () => {
      const sections: MarkdownSections = {
        description: 'Description content.',
        details: undefined,
        validation: 'Validation content.'
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Description content.

## Validation
Validation content.`;

      expect(result).toBe(expected);
    });

    it('should preserve whitespace and formatting within sections', () => {
      const sections: MarkdownSections = {
        description: 'Description with   spaces.',
        details: `   Indented content
     More indentation

    Code block formatting`,
        validation: `- Item 1  
- Item 2

  Sub-paragraph.`
      };

      const result = buildMarkdownContent(sections);
      const expected = `## Description
Description with   spaces.

## Details
   Indented content
     More indentation

    Code block formatting

## Validation
- Item 1  
- Item 2

  Sub-paragraph.`;

      expect(result).toBe(expected);
    });
  });

  describe('updateBodySection', () => {
    it('should add section to empty content', () => {
      const result = updateBodySection('', 'details', 'New details content.');
      expect(result).toBe('## Details\nNew details content.');
    });

    it('should add section to description-only content', () => {
      const content = 'Existing description.';
      const result = updateBodySection(content, 'details', 'New details content.');

      const expected = `## Description
Existing description.

## Details
New details content.`;

      expect(result).toBe(expected);
    });

    it('should update existing section', () => {
      const content = `Description content.

## Details

Old details content.

## Validation

Validation content.`;

      const result = updateBodySection(content, 'details', 'Updated details content.');

      const expected = `## Description
Description content.

## Details
Updated details content.

## Validation
Validation content.`;

      expect(result).toBe(expected);
    });

    it('should add new section between existing sections', () => {
      const content = `Description content.

## Validation

Validation content.`;

      const result = updateBodySection(content, 'details', 'New details content.');

      const expected = `## Description
Description content.

## Details
New details content.

## Validation
Validation content.`;

      expect(result).toBe(expected);
    });

    it('should handle case-insensitive section names', () => {
      const content = `Description content.

## Details

Old details.`;

      const result = updateBodySection(content, 'DETAILS', 'Updated details.');

      const expected = `## Description
Description content.

## Details
Updated details.`;

      expect(result).toBe(expected);
    });

    it('should handle description section updates', () => {
      const content = `Old description.

## Details

Details content.`;

      const result = updateBodySection(content, 'description', 'New description.');

      const expected = `## Description
New description.

## Details
Details content.`;

      expect(result).toBe(expected);
    });

    it('should handle validation section updates', () => {
      const content = `Description content.

## Details

Details content.

## Validation

Old validation.`;

      const result = updateBodySection(content, 'validation', 'New validation checklist.');

      const expected = `## Description
Description content.

## Details
Details content.

## Validation
New validation checklist.`;

      expect(result).toBe(expected);
    });

    it('should preserve other sections when updating one section', () => {
      const content = `Description content.

## Details

Details content.

## Custom section

Custom content.

## Validation

Validation content.

## Notes

Notes content.`;

      const result = updateBodySection(content, 'details', 'Updated details.');

      const expected = `## Description
Description content.

## Details
Updated details.

## Validation
Validation content.

## Custom section
Custom content.

## Notes
Notes content.`;

      expect(result).toBe(expected);
    });

    it('should handle empty section updates', () => {
      const content = `Description content.

## Details

Old details.`;

      const result = updateBodySection(content, 'details', '');

      const expected = 'Description content.';

      expect(result).toBe(expected);
    });

    it('should handle multiline section content', () => {
      const content = 'Description content.';
      const newContent = `Implementation steps:
1. First step
2. Second step

Code example:
\`\`\`javascript
function example() {
  return 'hello';
}
\`\`\`

Notes:
- Important note
- Another note`;

      const result = updateBodySection(content, 'details', newContent);

      const expected = `## Description
Description content.

## Details
Implementation steps:
1. First step
2. Second step

Code example:
\`\`\`javascript
function example() {
  return 'hello';
}
\`\`\`

Notes:
- Important note
- Another note`;

      expect(result).toBe(expected);
    });

    it('should handle special characters in section content', () => {
      const content = 'Description content.';
      const newContent = 'Content with émojis 🚀 and spëcial chars: üñíçödé';

      const result = updateBodySection(content, 'details', newContent);

      const expected = `## Description
Description content.

## Details
Content with émojis 🚀 and spëcial chars: üñíçödé`;

      expect(result).toBe(expected);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null content gracefully', () => {
      const result = parseMarkdownSections(null as unknown as string);
      expect(result).toEqual({ description: '' });
    });

    it('should handle undefined content gracefully', () => {
      const result = parseMarkdownSections(undefined as unknown as string);
      expect(result).toEqual({ description: '' });
    });

    it('should handle extremely long content', () => {
      const longContent = 'A'.repeat(10000);
      const content = `${longContent}

## Details

${'B'.repeat(10000)}`;

      const result = parseMarkdownSections(content);
      expect(result.description).toBe(longContent);
      expect(result.details).toBe('B'.repeat(10000));
    });

    it('should handle content with many sections', () => {
      let content = 'Description content.';

      for (let i = 1; i <= 100; i++) {
        content += `\n\n## Section ${i}\n\nContent for section ${i}.`;
      }

      const result = parseMarkdownSections(content);
      expect(result.description).toBe('Description content.');
      expect(result['section 1']).toBe('Content for section 1.');
      expect(result['section 100']).toBe('Content for section 100.');
      expect(Object.keys(result)).toHaveLength(101); // description + 100 sections
    });

    it('should handle content with unusual line endings', () => {
      const content = 'Description\\r\\n\\r\\n## Details\\r\\nDetails content.';
      const normalizedContent = content.replace(/\\r\\n/g, '\n');

      const result = parseMarkdownSections(normalizedContent);
      expect(result.description).toBe('Description');
      expect(result.details).toBe('Details content.');
    });

    it('should handle empty section names gracefully', () => {
      const content = `Description content.

## 

Content under empty heading.

## Details

Regular details.`;

      const result = parseMarkdownSections(content);
      expect(result.description).toBe('Description content.');
      expect(result.details).toBe('Regular details.');
      expect(result['']).toBe('Content under empty heading.');
      // Empty section name should be handled gracefully
    });

    it('should handle sections with only whitespace names', () => {
      const content = `Description content.

##   

Content under whitespace heading.

## Details

Regular details.`;

      const result = parseMarkdownSections(content);
      expect(result.description).toBe('Description content.');
      expect(result.details).toBe('Regular details.');
      expect(result['']).toBe('Content under whitespace heading.');
    });

    it('should handle rapid consecutive section updates', () => {
      let content = 'Initial description.';

      // Simulate rapid updates
      content = updateBodySection(content, 'details', 'First details.');
      content = updateBodySection(content, 'validation', 'First validation.');
      content = updateBodySection(content, 'details', 'Updated details.');
      content = updateBodySection(content, 'notes', 'Added notes.');
      content = updateBodySection(content, 'validation', 'Updated validation.');

      const result = parseMarkdownSections(content);
      expect(result.description).toBe('Initial description.');
      expect(result.details).toBe('Updated details.');
      expect(result.validation).toBe('Updated validation.');
      expect(result.notes).toBe('Added notes.');
    });
  });

  describe('roundtrip consistency', () => {
    it('should maintain content through parse-build roundtrip', () => {
      const originalContent = `Task description content.

## Details

Implementation details here.
- Step 1
- Step 2

## Validation

- [ ] Test 1
- [ ] Test 2
- [x] Completed test`;

      const parsed = parseMarkdownSections(originalContent);
      const rebuilt = buildMarkdownContent(parsed);
      const reparsed = parseMarkdownSections(rebuilt);

      expect(reparsed).toEqual(parsed);
    });

    it('should maintain content through multiple update operations', () => {
      let content = `Original description.

## Details

Original details.

## Validation

Original validation.`;

      // Perform multiple updates
      content = updateBodySection(content, 'description', 'Updated description.');
      content = updateBodySection(content, 'details', 'Updated details.');
      content = updateBodySection(content, 'notes', 'Added notes.');
      content = updateBodySection(content, 'validation', 'Updated validation.');

      const parsed = parseMarkdownSections(content);
      const rebuilt = buildMarkdownContent(parsed);

      expect(rebuilt).toBe(content);
    });

    it('should handle complex formatting preservation', () => {
      const originalContent = `Task with complex formatting.

## Details

Implementation details:

1. First step with **bold** text
2. Second step with *italic* text
3. Code example:
   \`\`\`javascript
   function test() {
     return "hello";
   }
   \`\`\`

## Validation

Validation checklist:

- [x] ✅ Passed test
- [ ] 🔍 Manual testing
- [ ] 📖 Documentation

> **Note:** Important considerations
> 
> - Point 1
> - Point 2

## Notes

Additional notes with [links](http://example.com) and images:

![Alt text](image.png)

### Sub-section

Content under sub-section.`;

      const parsed = parseMarkdownSections(originalContent);
      const rebuilt = buildMarkdownContent(parsed);
      const reparsed = parseMarkdownSections(rebuilt);

      expect(reparsed.description).toBe(parsed.description);
      expect(reparsed.details).toBe(parsed.details);
      expect(reparsed.validation).toBe(parsed.validation);
      expect(reparsed.notes).toBe(parsed.notes);
    });
  });
});
