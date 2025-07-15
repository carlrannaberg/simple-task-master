/**
 * Output formatting utilities for Simple Task Master
 */

import type { Task } from './types';

/**
 * Output format options
 */
export type OutputFormat = 'ndjson' | 'json' | 'yaml' | 'table' | 'csv' | 'markdown';

/**
 * Table configuration options
 */
export interface TableOptions {
  headers?: boolean;
  borders?: boolean;
  padding?: number;
  maxWidth?: number;
}

/**
 * Formats tasks as newline-delimited JSON (default format)
 */
export function formatAsNDJSON(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '';
  }
  return tasks.map((task) => JSON.stringify(task)).join('\n');
}

/**
 * Formats tasks as pretty JSON
 */
export function formatAsJSON(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

/**
 * Formats tasks as YAML
 */
export function formatAsYAML(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '';
  }

  // For multiple tasks, format as YAML array
  const yamlTasks = tasks.map((task) => {
    const lines = [];
    lines.push(`- id: ${task.id}`);
    lines.push(`  title: ${JSON.stringify(task.title)}`);
    lines.push(`  status: ${task.status}`);
    lines.push(`  created: ${JSON.stringify(task.created)}`);
    lines.push(`  updated: ${JSON.stringify(task.updated)}`);

    if (task.tags.length > 0) {
      lines.push('  tags:');
      task.tags.forEach((tag) => lines.push(`    - ${JSON.stringify(tag)}`));
    } else {
      lines.push('  tags: []');
    }

    if (task.dependencies.length > 0) {
      lines.push('  dependencies:');
      task.dependencies.forEach((dep) => lines.push(`    - ${dep}`));
    } else {
      lines.push('  dependencies: []');
    }

    if (task.content) {
      lines.push(`  content: ${JSON.stringify(task.content)}`);
    }

    return lines.join('\n');
  });

  return yamlTasks.join('\n');
}

/**
 * Formats a single task as YAML front-matter with markdown content
 */
export function formatTaskAsYAML(task: Task): string {
  const { content, ...frontMatter } = task;

  const yamlContent = Object.entries(frontMatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return `${key}: []`;
        }
        return `${key}:\n${value.map((v) => `  - ${JSON.stringify(v)}`).join('\n')}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join('\n');

  return `---\n${yamlContent}\n---\n\n${content || ''}`;
}

/**
 * Formats a single task as markdown
 */
export function formatTaskAsMarkdown(task: Task): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${task.title}`);
  lines.push('');

  // Metadata
  lines.push('## Task Details');
  lines.push('');
  lines.push(`- **ID**: ${task.id}`);
  lines.push(`- **Status**: ${task.status}`);
  lines.push(`- **Created**: ${new Date(task.created).toLocaleString()}`);
  lines.push(`- **Updated**: ${new Date(task.updated).toLocaleString()}`);

  if (task.tags && task.tags.length > 0) {
    lines.push(`- **Tags**: ${task.tags.map((tag) => `\`${tag}\``).join(', ')}`);
  }

  if (task.dependencies && task.dependencies.length > 0) {
    lines.push(`- **Dependencies**: ${task.dependencies.join(', ')}`);
  }

  // Content
  if (task.content && task.content.trim()) {
    lines.push('');
    lines.push('## Description');
    lines.push('');
    lines.push(task.content);
  }

  return lines.join('\n');
}

/**
 * Formats tasks as a table
 */
export function formatAsTable(tasks: Task[], options: TableOptions = {}): string {
  if (tasks.length === 0) {
    return '';
  }

  const { headers = true, borders = true, padding = 1, maxWidth = 80 } = options;

  // Define columns
  const columns = [
    { key: 'id', title: 'ID', width: 4 },
    { key: 'title', title: 'Title', width: 30 },
    { key: 'status', title: 'Status', width: 12 },
    { key: 'tags', title: 'Tags', width: 20 },
    { key: 'updated', title: 'Updated', width: 12 }
  ];

  // Adjust column widths based on maxWidth
  const totalBorderWidth = borders ? (columns.length + 1) * 3 : 0;
  const totalPadding = columns.length * (padding * 2);
  const availableWidth = maxWidth - totalBorderWidth - totalPadding;

  if (availableWidth > 0) {
    const ratio = availableWidth / columns.reduce((sum, col) => sum + col.width, 0);
    columns.forEach((col) => {
      col.width = Math.floor(col.width * ratio);
    });
  }

  // Helper function to truncate and pad text
  const formatCell = (text: string, width: number): string => {
    const truncated = text.length > width ? text.substring(0, width - 3) + '...' : text;
    return truncated.padEnd(width);
  };

  // Build table rows
  const rows: string[] = [];

  // Header row
  if (headers) {
    const headerRow = columns
      .map((col) => formatCell(col.title, col.width))
      .join(borders ? ' │ ' : '   ');
    rows.push(borders ? `│ ${headerRow} │` : headerRow);

    // Separator
    if (borders) {
      const separator = columns.map((col) => '─'.repeat(col.width)).join('─┼─');
      rows.push(`├─${separator}─┤`);
    }
  }

  // Data rows
  tasks.forEach((task) => {
    const row = columns
      .map((col) => {
        let value: string;
        switch (col.key) {
          case 'id':
            value = task.id.toString();
            break;
          case 'title':
            value = task.title;
            break;
          case 'status':
            value = task.status;
            break;
          case 'tags':
            value = task.tags?.join(', ') || '';
            break;
          case 'updated':
            value = new Date(task.updated).toLocaleDateString();
            break;
          default:
            value = '';
        }
        return formatCell(value, col.width);
      })
      .join(borders ? ' │ ' : '   ');

    rows.push(borders ? `│ ${row} │` : row);
  });

  // Top and bottom borders
  if (borders && rows.length > 0) {
    const topBorder = '┌─' + columns.map((col) => '─'.repeat(col.width)).join('─┬─') + '─┐';
    const bottomBorder = '└─' + columns.map((col) => '─'.repeat(col.width)).join('─┴─') + '─┘';

    rows.unshift(topBorder);
    rows.push(bottomBorder);
  }

  return rows.join('\n');
}

/**
 * Formats tasks as CSV with proper escaping
 */
export function formatAsCSV(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '';
  }

  // CSV headers
  const headers = [
    'id',
    'title',
    'status',
    'created',
    'updated',
    'tags',
    'dependencies',
    'content'
  ];

  // Escape CSV values according to RFC 4180
  const escapeCsvValue = (value: unknown): string => {
    const str = String(value || '');

    // Always quote if contains: comma, quote, newline, or carriage return
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // Escape internal quotes by doubling them
      return `"${str.replace(/"/g, '""')}"`;
    }

    // Quote if starts or ends with whitespace
    if (str !== str.trim()) {
      return `"${str}"`;
    }

    return str;
  };

  // Build CSV rows
  const rows = [headers.join(',')];

  tasks.forEach((task) => {
    const row = [
      task.id,
      task.title,
      task.status,
      task.created,
      task.updated,
      task.tags?.join(';') || '',
      task.dependencies?.join(';') || '',
      task.content || ''
    ].map(escapeCsvValue);

    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Main formatting function that delegates to specific formatters
 */
export function formatTasks(
  tasks: Task[],
  format: OutputFormat,
  options: TableOptions = {}
): string {
  switch (format) {
    case 'ndjson':
      return formatAsNDJSON(tasks);
    case 'json':
      return formatAsJSON(tasks);
    case 'table':
      return formatAsTable(tasks, options);
    case 'csv':
      return formatAsCSV(tasks);
    case 'yaml':
      return formatAsYAML(tasks);
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}

/**
 * Formats a single task
 */
export function formatTask(task: Task, format: OutputFormat): string {
  switch (format) {
    case 'yaml':
      return formatTaskAsYAML(task);
    case 'markdown':
      return formatTaskAsMarkdown(task);
    case 'json':
      return JSON.stringify(task, null, 2);
    case 'ndjson':
      return JSON.stringify(task);
    case 'table':
      return formatAsTable([task]);
    case 'csv':
      return formatAsCSV([task]);
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}

/**
 * Prints output to stdout or stderr
 */
export function printOutput(content: string, toStderr = false): void {
  if (content.length === 0) {
    return; // Don't print anything for empty content
  }

  if (toStderr) {
    process.stderr.write(content + '\n');
  } else {
    process.stdout.write(content + '\n');
  }
}

/**
 * Prints an error message to stderr
 */
export function printError(error: Error | string): void {
  const message = typeof error === 'string' ? error : error.message;
  printOutput(`Error: ${message}`, true);
}

/**
 * Prints a success message to stderr
 */
export function printSuccess(message: string): void {
  printOutput(`✓ ${message}`, true);
}

/**
 * Prints a warning message to stderr
 */
export function printWarning(message: string): void {
  printOutput(`⚠ ${message}`, true);
}
