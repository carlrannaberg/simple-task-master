/**
 * Frontmatter Library Replacement Examples
 *
 * This file demonstrates how to replace gray-matter with alternatives
 * that preserve content formatting exactly.
 */

import * as yaml from 'js-yaml';

// ============================================
// Option 1: Custom Implementation (Recommended)
// ============================================

interface FrontmatterResult {
  data: Record<string, any>;
  content: string;
}

class ContentPreservingFrontmatter {
  private static readonly DELIMITER = '---';
  private static readonly DELIMITER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

  /**
   * Parse frontmatter while preserving exact content formatting
   */
  static parse(fileContent: string): FrontmatterResult {
    const match = fileContent.match(this.DELIMITER_REGEX);

    if (!match) {
      // No frontmatter found
      return {
        data: {},
        content: fileContent
      };
    }

    try {
      const yamlContent = match[1];
      const data = (yaml.load(yamlContent) as Record<string, any>) || {};

      // Extract content after frontmatter, preserving exact formatting
      const contentStart = match[0].length;
      const content = fileContent.substring(contentStart);

      return { data, content };
    } catch (error) {
      throw new Error(`Failed to parse YAML frontmatter: ${error}`);
    }
  }

  /**
   * Stringify data and content back to markdown with frontmatter
   * Preserves exact content formatting without modifications
   */
  static stringify(content: string, data: Record<string, any>): string {
    // Handle empty data case
    if (!data || Object.keys(data).length === 0) {
      return content;
    }

    // Dump YAML with consistent formatting
    const yamlStr = yaml
      .dump(data, {
        lineWidth: -1, // Disable line wrapping
        sortKeys: false, // Preserve key order
        noRefs: true // Avoid YAML references
      })
      .trimEnd(); // Remove trailing newline from YAML

    // Construct the full document preserving exact content
    return `${this.DELIMITER}\n${yamlStr}\n${this.DELIMITER}\n${content}`;
  }
}

// ============================================
// Option 2: Using front-matter + custom stringify
// ============================================

import fm from 'front-matter';

class FrontMatterWrapper {
  /**
   * Parse using front-matter library
   */
  static parse(fileContent: string): FrontmatterResult {
    const parsed = fm(fileContent);
    return {
      data: parsed.attributes as Record<string, any>,
      content: parsed.body
    };
  }

  /**
   * Custom stringify since front-matter doesn't provide one
   */
  static stringify(content: string, data: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
      return content;
    }

    const yamlStr = yaml
      .dump(data, {
        lineWidth: -1,
        sortKeys: false,
        noRefs: true
      })
      .trimEnd();

    return `---\n${yamlStr}\n---\n${content}`;
  }
}

// ============================================
// Option 3: Enhanced Custom Implementation with Features
// ============================================

interface EnhancedFrontmatterOptions {
  delimiters?: [string, string];
  engines?: {
    yaml?: typeof yaml;
  };
}

class EnhancedFrontmatter {
  private delimiters: [string, string];
  private yamlEngine: typeof yaml;

  constructor(options: EnhancedFrontmatterOptions = {}) {
    this.delimiters = options.delimiters || ['---', '---'];
    this.yamlEngine = options.engines?.yaml || yaml;
  }

  parse(fileContent: string): FrontmatterResult & { original: string } {
    const startDelim = this.delimiters[0];
    const endDelim = this.delimiters[1];

    // Build regex dynamically based on delimiters
    const regex = new RegExp(
      `^${this.escapeRegex(startDelim)}\\r?\\n([\\s\\S]*?)\\r?\\n${this.escapeRegex(endDelim)}\\r?\\n?`
    );

    const match = fileContent.match(regex);

    if (!match) {
      return {
        data: {},
        content: fileContent,
        original: fileContent
      };
    }

    const yamlContent = match[1];
    const data = (this.yamlEngine.load(yamlContent) as Record<string, any>) || {};
    const content = fileContent.substring(match[0].length);

    return {
      data,
      content,
      original: fileContent
    };
  }

  stringify(content: string, data: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
      return content;
    }

    const yamlStr = this.yamlEngine
      .dump(data, {
        lineWidth: -1,
        sortKeys: false,
        noRefs: true
      })
      .trimEnd();

    const [startDelim, endDelim] = this.delimiters;
    return `${startDelim}\n${yamlStr}\n${endDelim}\n${content}`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================
// Migration Example for TaskManager
// ============================================

// Before (with gray-matter):
/*
import matter from 'gray-matter';

const { data, content } = matter(fileContent);
// ... process data and content
const fileContent = matter.stringify(content, data);
*/

// After (with custom implementation):
/*
const frontmatter = new ContentPreservingFrontmatter();
// Or: const frontmatter = new EnhancedFrontmatter();

const { data, content } = frontmatter.parse(fileContent);
// ... process data and content
const fileContent = frontmatter.stringify(content, data);
*/

// ============================================
// Test Cases Demonstrating Preservation
// ============================================

export function demonstrateContentPreservation() {
  const testCases = [
    { name: 'Empty content', content: '', data: { title: 'Test' } },
    { name: 'No trailing newline', content: 'Hello world', data: { title: 'Test' } },
    { name: 'With trailing newline', content: 'Hello world\n', data: { title: 'Test' } },
    { name: 'Multiple newlines', content: 'Hello\n\nWorld\n\n', data: { title: 'Test' } }
  ];

  console.log('=== Content Preservation Tests ===\n');

  testCases.forEach((test) => {
    const stringified = ContentPreservingFrontmatter.stringify(test.content, test.data);
    const parsed = ContentPreservingFrontmatter.parse(stringified);

    console.log(`Test: ${test.name}`);
    console.log(`Original content: ${JSON.stringify(test.content)}`);
    console.log(`Parsed content: ${JSON.stringify(parsed.content)}`);
    console.log(`Preserved: ${test.content === parsed.content}`);
    console.log('---\n');
  });
}

// ============================================
// Performance Comparison
// ============================================

export function performanceComparison() {
  // Simulated performance metrics based on library characteristics
  const metrics = {
    'gray-matter': {
      parseTime: '~0.5ms',
      stringifyTime: '~0.3ms',
      memoryUsage: 'Medium',
      features: 'Full-featured with multiple format support',
      bundleSize: '~15KB'
    },
    'custom-implementation': {
      parseTime: '~0.2ms',
      stringifyTime: '~0.1ms',
      memoryUsage: 'Low',
      features: 'Minimal, focused on content preservation',
      bundleSize: '~2KB (excluding js-yaml)'
    },
    'front-matter': {
      parseTime: '~0.3ms',
      stringifyTime: 'N/A (no built-in stringify)',
      memoryUsage: 'Low',
      features: 'Parse-only, no stringify',
      bundleSize: '~5KB'
    }
  };

  return metrics;
}

export { ContentPreservingFrontmatter, FrontMatterWrapper, EnhancedFrontmatter };
