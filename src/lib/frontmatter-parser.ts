/**
 * Custom frontmatter parser that preserves content exactly as written
 * Replaces gray-matter to eliminate the need for _contentMetadata workarounds
 */
import yaml from 'js-yaml';
import { ValidationError } from './errors';

export interface FrontmatterResult<T = Record<string, unknown>> {
  data: T;
  content: string;
  matter?: string;
  orig?: string;
}

export class FrontmatterParser {
  private static readonly DELIMITER = '---';
  private static readonly DELIMITER_REGEX = /^---\s*$/;

  /**
   * Parse markdown with frontmatter, preserving exact content formatting
   */
  static parse<T = Record<string, unknown>>(input: string): FrontmatterResult<T> {
    // Check for exact delimiter at start (no extra characters)
    const firstLine = input.split('\n')[0];
    if (!input.startsWith(this.DELIMITER) || !firstLine || !this.DELIMITER_REGEX.test(firstLine)) {
      return {
        data: {} as T,
        content: input,
        matter: '',
        orig: input
      };
    }

    // Special handling for content attached to closing delimiter
    // e.g., "---\nid: 1\n---Content" should be parsed correctly
    const delimiterWithContent = new RegExp(`^${this.DELIMITER}(.+)$`, 'm');
    const match = input.match(delimiterWithContent);

    if (match && match.index && match.index > 0) {
      // Found a delimiter with content attached
      const beforeMatch = input.substring(0, match.index);
      const attachedContent = match[1];
      const afterMatch = input.substring(match.index + match[0].length);

      // Check if this is a closing delimiter (not the opening one)
      const beforeLines = beforeMatch.split('\n');
      if (beforeLines.length > 1 && beforeLines[0] === this.DELIMITER) {
        // This is a closing delimiter with attached content
        const matter = beforeLines.slice(1).join('\n');

        let data: T;
        try {
          const parsed = matter.trim() ? yaml.load(matter) : {};
          // yaml.load returns null for comments-only content
          const normalizedParsed = parsed === null ? {} : parsed;
          data = this.convertDatesToStrings(normalizedParsed) as T;
        } catch (error) {
          throw new ValidationError(`Invalid YAML frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Combine attached content with any remaining content
        const content = attachedContent + (afterMatch ? '\n' + afterMatch : '');

        return {
          data,
          content,
          matter,
          orig: input
        };
      }
    }

    // Standard parsing logic
    const lines = input.split('\n');
    let endIndex = -1;

    // Find closing delimiter
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Check if line starts with delimiter
      if (line && line.startsWith(this.DELIMITER)) {
        // Check if it's exactly the delimiter (with possible trailing spaces)
        if (this.DELIMITER_REGEX.test(line)) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex === -1) {
      // Malformed frontmatter, treat as content
      return {
        data: {} as T,
        content: input,
        matter: '',
        orig: input
      };
    }

    const matter = lines.slice(1, endIndex).join('\n');

    let data: T;
    try {
      const parsed = matter.trim() ? yaml.load(matter) : {};
      // yaml.load returns null for comments-only content
      const normalizedParsed = parsed === null ? {} : parsed;
      // Convert Date objects back to ISO strings to match expected format
      data = this.convertDatesToStrings(normalizedParsed) as T;
    } catch (error) {
      throw new ValidationError(`Invalid YAML frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Preserve exact content including all whitespace
    // Calculate the position after the closing delimiter
    const frontmatterPart = lines.slice(0, endIndex + 1).join('\n');
    let contentStartIndex = frontmatterPart.length;

    // Only add 1 if there's actually a newline after the closing delimiter
    if (input.length > contentStartIndex && input[contentStartIndex] === '\n') {
      contentStartIndex += 1;
    }

    const content = input.substring(contentStartIndex);

    return {
      data,
      content,
      matter,
      orig: input
    };
  }

  /**
   * Stringify content with frontmatter, preserving exact content formatting
   */
  static stringify<T = Record<string, unknown>>(content: string, data?: T): string {
    if (!data || Object.keys(data).length === 0) {
      return content;
    }

    let matter = yaml.dump(data, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      quotingType: '"',
      forceQuotes: false,
      condenseFlow: false
    }).trimEnd();

    // Post-process to ensure strings with quotes are properly quoted
    matter = this.postProcessYaml(matter);

    return `${this.DELIMITER}\n${matter}\n${this.DELIMITER}\n${content}`;
  }

  /**
   * Post-process YAML to ensure proper quoting
   */
  private static postProcessYaml(yamlStr: string): string {
    const lines = yamlStr.split('\n');
    const processedLines = lines.map(line => {
      // Match YAML key-value pairs
      const match = line.match(/^(\s*)([^:]+):\s*(.+)$/);
      if (match) {
        const [, indent, key, value] = match;

        // Check if value contains quotes but isn't already quoted
        if (value && value.includes('"') && !value.startsWith('"') && !value.startsWith('\'')) {
          // Quote the value and escape internal quotes
          const quotedValue = '"' + value.replace(/"/g, '\\"') + '"';
          return `${indent}${key}: ${quotedValue}`;
        }
      }
      return line;
    });

    return processedLines.join('\n');
  }

  /**
   * Convert Date objects to ISO strings recursively
   */
  private static convertDatesToStrings(obj: unknown): unknown {
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesToStrings(item));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertDatesToStrings(value);
      }
      return result;
    }
    return obj;
  }

  /**
   * Validate task data structure with detailed error messages
   */
  static validateTaskData(data: unknown): void {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid task data structure: expected object');
    }

    const task = data as Record<string, unknown>;
    const missingFields: string[] = [];

    // Check only the required fields: id, title, status
    if (!('id' in task)) {
      missingFields.push('id');
    }
    if (!('title' in task)) {
      missingFields.push('title');
    }
    if (!('status' in task)) {
      missingFields.push('status');
    }

    if (missingFields.length > 0) {
      throw new ValidationError(`missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate field types only if they exist
    const errors: string[] = [];

    if ('id' in task && typeof task.id !== 'number') {
      errors.push('id must be a number');
    }
    if ('title' in task && typeof task.title !== 'string') {
      errors.push('title must be a string');
    }
    if ('status' in task && (typeof task.status !== 'string' || !['pending', 'in-progress', 'done'].includes(task.status))) {
      errors.push('status must be one of: pending, in-progress, done');
    }

    // Optional fields - only validate if present
    if ('schema' in task && typeof task.schema !== 'number') {
      errors.push('schema must be a number');
    }
    if ('created' in task && typeof task.created !== 'string') {
      errors.push('created must be an ISO date string');
    }
    if ('updated' in task && typeof task.updated !== 'string') {
      errors.push('updated must be an ISO date string');
    }
    if ('tags' in task) {
      if (!Array.isArray(task.tags)) {
        errors.push('tags must be an array');
      } else if (!task.tags.every((tag: unknown) => typeof tag === 'string')) {
        errors.push('tags must be an array of strings');
      }
    }
    if ('dependencies' in task) {
      if (!Array.isArray(task.dependencies)) {
        errors.push('dependencies must be an array');
      } else if (!task.dependencies.every((dep: unknown) => typeof dep === 'number')) {
        errors.push('dependencies must be an array of numbers');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`Invalid task data: ${errors.join(', ')}`);
    }
  }
}

// Export for drop-in replacement compatibility
export default FrontmatterParser;
