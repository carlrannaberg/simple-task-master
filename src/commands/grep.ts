/**
 * Search tasks command (grep functionality)
 */

import { Command } from 'commander';
import { TaskManager } from '../lib/task-manager';
import { formatTasks, printError, printOutput } from '../lib/output';
import { ValidationError, FileSystemError, ConfigurationError } from '../lib/errors';
import type { OutputFormat, Task } from '../lib/types';

/**
 * Highlight matches in text using ANSI escape codes
 */
function highlightMatches(text: string, regex: RegExp): string {
  if (!process.stdout.isTTY) {
    return text; // No highlighting for non-TTY output
  }

  const highlightStart = '\x1b[43m\x1b[30m'; // Yellow background, black text
  const highlightEnd = '\x1b[0m'; // Reset

  return text.replace(regex, (match) => `${highlightStart}${match}${highlightEnd}`);
}

/**
 * Extract context lines around matching lines in content
 */
function extractContextLines(content: string, regex: RegExp, contextLines: number): string {
  if (contextLines === 0) {
    return content;
  }

  const lines = content.split('\n');
  const matchingLineNumbers = new Set<number>();

  // Find all lines that match the pattern
  lines.forEach((line, index) => {
    if (regex.test(line)) {
      matchingLineNumbers.add(index);
    }
  });

  if (matchingLineNumbers.size === 0) {
    return content;
  }

  // Collect all lines that should be included (matches + context)
  const linesToInclude = new Set<number>();

  matchingLineNumbers.forEach((lineNum) => {
    // Add the matching line
    linesToInclude.add(lineNum);

    // Add context lines before
    for (let i = Math.max(0, lineNum - contextLines); i < lineNum; i++) {
      linesToInclude.add(i);
    }

    // Add context lines after
    for (let i = lineNum + 1; i <= Math.min(lines.length - 1, lineNum + contextLines); i++) {
      linesToInclude.add(i);
    }
  });

  // Sort the line numbers and extract the lines
  const sortedLineNumbers = Array.from(linesToInclude).sort((a, b) => a - b);

  // Build the result with line numbers and separators
  const result: string[] = [];
  let lastLineNum = -2;

  sortedLineNumbers.forEach((lineNum) => {
    // Add separator if there's a gap
    if (lineNum > lastLineNum + 1 && result.length > 0) {
      result.push('--');
    }
    const line = lines[lineNum];
    if (line !== undefined) {
      result.push(line);
    }
    lastLineNum = lineNum;
  });

  return result.join('\n');
}

/**
 * Create a task object with highlighted matches for ND-JSON output
 */
function createHighlightedTask(
  task: Task,
  regex: RegExp,
  titleMatch: boolean,
  contentMatch: boolean,
  contextLines: number = 0
): Task {
  const highlighted: Task = { ...task };

  if (titleMatch) {
    highlighted.title = highlightMatches(task.title, regex);
  }

  if (contentMatch && task.content) {
    // Reset regex for context extraction
    const contextRegex = new RegExp(regex.source, regex.flags);
    const contextContent = extractContextLines(task.content, contextRegex, contextLines);
    highlighted.content = highlightMatches(contextContent, regex);
  }

  return highlighted;
}

/**
 * Search for tasks matching a pattern
 */
export async function grepTasks(
  pattern: string,
  options: {
    ignoreCase?: boolean;
    titleOnly?: boolean;
    contentOnly?: boolean;
    pretty?: boolean;
    format?: string;
    context?: string;
  }
): Promise<void> {
  try {
    const taskManager = await TaskManager.create();

    // Parse context option
    const contextLines = options.context ? parseInt(options.context, 10) : 0;
    if (options.context && (isNaN(contextLines) || contextLines < 0)) {
      throw new ValidationError('Context must be a non-negative number');
    }

    // Get all tasks (include content for searching)
    const allTasks = await taskManager.list();

    // Read content for each task
    const tasksWithContent = await Promise.all(
      allTasks.map(async (task) => {
        try {
          const fullTask = await taskManager.get(task.id);
          return fullTask;
        } catch {
          return task; // Fallback to task without content
        }
      })
    );

    // Handle empty pattern
    if (!pattern || pattern.trim() === '') {
      throw new ValidationError('Pattern cannot be empty');
    }

    // Create regex pattern with global flag for highlighting
    const flags = options.ignoreCase ? 'gi' : 'g';
    let regex: RegExp;

    try {
      regex = new RegExp(pattern, flags);
    } catch {
      throw new ValidationError(`Invalid regular expression: ${pattern}`);
    }

    // Filter tasks and track match locations
    const matchingTasks: Task[] = [];

    for (const task of tasksWithContent) {
      let titleMatch = false;
      let contentMatch = false;

      // Search in title
      if (!options.contentOnly && regex.test(task.title)) {
        titleMatch = true;
      }

      // Search in content
      if (!options.titleOnly && task.content && regex.test(task.content)) {
        contentMatch = true;
      }

      if (titleMatch || contentMatch) {
        // Reset regex for highlighting
        regex.lastIndex = 0;
        const highlightedTask = createHighlightedTask(
          task,
          regex,
          titleMatch,
          contentMatch,
          contextLines
        );
        matchingTasks.push(highlightedTask);
      }
    }

    // Handle no matches
    if (matchingTasks.length === 0) {
      // Return empty output with exit code 0
      return;
    }

    // Determine output format
    let format: OutputFormat = 'ndjson'; // default

    if (options.pretty) {
      format = 'table';
    }

    if (options.format) {
      const validFormats = ['ndjson', 'json', 'table', 'csv', 'yaml'];
      if (!validFormats.includes(options.format)) {
        throw new ValidationError(
          `Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`
        );
      }
      format = options.format as OutputFormat;
    }

    // Format and output
    const output = formatTasks(matchingTasks, format);
    printOutput(output);

    // Print summary to stderr only in interactive mode
    if (matchingTasks.length > 0 && process.stdout.isTTY) {
      const summary = `Found ${matchingTasks.length} matching task${matchingTasks.length === 1 ? '' : 's'}`;
      process.stderr.write(`\n${summary}\n`);
    }
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof FileSystemError ||
      error instanceof ConfigurationError ||
      error instanceof Error
    ) {
      printError(error.message);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Create the grep command
 */
export const grepCommand = new Command('grep')
  .description('Search tasks by pattern (supports regular expressions)')
  .argument('<pattern>', 'Search pattern (regular expression)')
  .option('-i, --ignore-case', 'Case-insensitive search')
  .option('--title-only', 'Search only in task titles')
  .option('--content-only', 'Search only in task content')
  .option('--context <lines>', 'Show lines of context around matches')
  .option('-p, --pretty', 'Pretty table output format')
  .option('-f, --format <format>', 'Output format (ndjson, json, table, csv, yaml)')
  .addHelpText(
    'after',
    `
Examples:
  stm grep "urgent"                    # Search for "urgent" in titles and content
  stm grep -i "TODO"                   # Case-insensitive search for "TODO"
  stm grep --title-only "^Fix"         # Search only titles starting with "Fix"
  stm grep --content-only "bug.*fix"   # Search only content for bug fix patterns
  stm grep --context 2 "bug"           # Show 2 lines of context around matches
  stm grep -p "feature"                # Pretty table output
  stm grep -f json "error"             # JSON output format`
  )
  .action(async (pattern: string, options) => {
    await grepTasks(pattern, options);
  });
