import { spawn } from 'child_process';
import * as path from 'path';

/**
 * Result of running an STM CLI command
 */
export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  args: string[];
  duration: number;
}

/**
 * Options for running STM CLI commands
 */
export interface CLIRunOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Input to send to stdin */
  input?: string;
  /** Whether to capture output (default: true) */
  capture?: boolean;
}

/**
 * Run the STM CLI command with the given arguments
 */
export async function runSTM(args: string[], options: CLIRunOptions = {}): Promise<CLIResult> {
  const { cwd = process.cwd(), env = {}, timeout = 30000, input, capture = true } = options;

  // Path to the STM binary
  const stmBin = path.resolve(__dirname, '../../bin/stm');

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn('node', [stmBin, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit']
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${timeout}ms: stm ${args.join(' ')}`));
      }, timeout);
    }

    // Capture output if requested
    if (capture) {
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    // Send input if provided
    if (input && child.stdin) {
      child.stdin.on('error', (error) => {
        // Handle EPIPE errors gracefully - this occurs when the child process
        // has already closed its stdin but we're trying to write to it
        if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
          // EPIPE is expected when the child process closes stdin early
          // This is not an error condition, just ignore it
          return;
        }
        // For other errors, we should still log them
        console.warn('stdin error:', error.message);
      });

      try {
        child.stdin.write(input);
        child.stdin.end();
      } catch (error) {
        // Handle synchronous errors (e.g., if stdin is already closed)
        if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
          // EPIPE is expected when the child process closes stdin early
          // This is not an error condition, just ignore it
          return;
        }
        throw error;
      }
    }

    // Handle process completion
    child.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;
      const result: CLIResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
        command: 'stm',
        args,
        duration
      };

      resolve(result);
    });

    // Handle process errors
    child.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(new Error(`Failed to spawn STM process: ${error.message}`));
    });
  });
}

/**
 * Run STM command and expect success (exit code 0)
 */
export async function runSTMSuccess(
  args: string[],
  options: CLIRunOptions = {}
): Promise<CLIResult> {
  const result = await runSTM(args, options);

  if (result.exitCode !== 0) {
    throw new Error(
      `STM command failed with exit code ${result.exitCode}\n` +
        `Command: stm ${args.join(' ')}\n` +
        `Stdout: ${result.stdout}\n` +
        `Stderr: ${result.stderr}`
    );
  }

  return result;
}

/**
 * Run STM command and expect failure (non-zero exit code)
 */
export async function runSTMFailure(
  args: string[],
  options: CLIRunOptions = {}
): Promise<CLIResult> {
  const result = await runSTM(args, options);

  if (result.exitCode === 0) {
    throw new Error(
      'STM command unexpectedly succeeded\n' +
        `Command: stm ${args.join(' ')}\n` +
        `Stdout: ${result.stdout}\n` +
        `Stderr: ${result.stderr}`
    );
  }

  return result;
}

/**
 * CLI test helper class for more advanced scenarios
 */
export class CLITestRunner {
  private defaultOptions: CLIRunOptions;

  constructor(defaultOptions: CLIRunOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Run a command with the default options
   */
  async run(args: string[], options: CLIRunOptions = {}): Promise<CLIResult> {
    return runSTM(args, { ...this.defaultOptions, ...options });
  }

  /**
   * Run command and expect success
   */
  async runSuccess(args: string[], options: CLIRunOptions = {}): Promise<CLIResult> {
    return runSTMSuccess(args, { ...this.defaultOptions, ...options });
  }

  /**
   * Run command and expect failure
   */
  async runFailure(args: string[], options: CLIRunOptions = {}): Promise<CLIResult> {
    return runSTMFailure(args, { ...this.defaultOptions, ...options });
  }

  /**
   * Initialize STM in the current directory
   */
  async init(): Promise<CLIResult> {
    return this.runSuccess(['init']);
  }

  /**
   * Add a task
   */
  async addTask(
    title: string,
    options: {
      content?: string;
      description?: string;
      tags?: string[];
      status?: string;
    } = {}
  ): Promise<{ result: CLIResult; taskId: number }> {
    const args = ['add', title];

    // Use content or description (content takes precedence)
    const desc = options.content || options.description;
    if (desc) {
      args.push('--description', desc);
    }

    if (options.tags && options.tags.length > 0) {
      args.push('--tags', options.tags.join(','));
    }

    if (options.status) {
      args.push('--status', options.status);
    }

    const result = await this.runSuccess(args);

    // Parse task ID from output (now outputs just the ID)
    const taskId = parseInt(result.stdout.trim(), 10);

    if (isNaN(taskId) || taskId <= 0) {
      throw new Error(`Invalid task ID in output: ${result.stdout}`);
    }

    return { result, taskId };
  }

  /**
   * List tasks
   */
  async listTasks(
    options: {
      status?: string;
      tags?: string[];
      search?: string;
      format?: string;
    } = {}
  ): Promise<CLIResult> {
    const args = ['list'];

    if (options.status) {
      args.push('--status', options.status);
    }

    if (options.tags && options.tags.length > 0) {
      args.push('--tags', options.tags.join(','));
    }

    if (options.search) {
      args.push('--search', options.search);
    }

    if (options.format) {
      args.push('--format', options.format);
    }

    return this.runSuccess(args);
  }

  /**
   * Show a specific task
   */
  async showTask(id: number, format?: string): Promise<CLIResult> {
    const args = ['show', id.toString()];
    if (format) {
      args.push('--format', format);
    }
    return this.runSuccess(args);
  }

  /**
   * Update a task
   */
  async updateTask(
    id: number,
    updates: {
      title?: string;
      status?: string;
      tags?: string[];
      content?: string;
      description?: string;
    }
  ): Promise<CLIResult> {
    const args = ['update', id.toString()];

    if (updates.title) {
      args.push('--title', updates.title);
    }

    if (updates.status) {
      args.push('--status', updates.status);
    }

    if (updates.tags) {
      args.push('--tags', updates.tags.join(','));
    }

    // Use content or description (content takes precedence)
    const desc = updates.content || updates.description;
    if (desc) {
      args.push('--description', desc);
    }

    return this.runSuccess(args);
  }

  /**
   * Export tasks
   */
  async exportTasks(format: string, output?: string): Promise<CLIResult> {
    const args = ['export', '--format', format];

    if (output) {
      args.push('--output', output);
    }

    return this.runSuccess(args);
  }

  /**
   * Search in tasks
   */
  async grepTasks(
    pattern: string,
    options: {
      ignoreCase?: boolean;
      context?: number;
    } = {}
  ): Promise<CLIResult> {
    const args = ['grep', pattern];

    if (options.ignoreCase) {
      args.push('--ignore-case');
    }

    if (options.context !== undefined) {
      args.push('--context', options.context.toString());
    }

    return this.runSuccess(args);
  }

  /**
   * Run multiple commands in sequence
   */
  async runSequence(
    commands: Array<{ args: string[]; options?: CLIRunOptions }>
  ): Promise<CLIResult[]> {
    const results: CLIResult[] = [];

    for (const { args, options } of commands) {
      const result = await this.run(args, options);
      results.push(result);

      // Stop on first failure
      if (result.exitCode !== 0) {
        break;
      }
    }

    return results;
  }

  /**
   * Measure command performance
   */
  async benchmark(
    args: string[],
    iterations = 5
  ): Promise<{
    results: CLIResult[];
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  }> {
    const results: CLIResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await this.run(args);
      results.push(result);
    }

    const durations = results.map((r) => r.duration);

    return {
      results,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }
}

/**
 * Utility functions for common CLI testing patterns
 */
export const cliUtils = {
  /**
   * Parse NDJSON output from list command
   */
  parseNDJSON: (output: string): unknown[] => {
    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  },

  /**
   * Parse JSON output
   */
  parseJSON: (output: string): unknown => {
    return JSON.parse(output);
  },

  /**
   * Extract task ID from add command output
   */
  extractTaskId: (output: string): number => {
    // Parse task ID from output (now outputs just the ID)
    const taskId = parseInt(output.trim(), 10);

    if (isNaN(taskId) || taskId <= 0) {
      throw new Error(`Invalid task ID in output: ${output}`);
    }

    return taskId;
  },

  /**
   * Check if STM is initialized in a directory
   */
  isInitialized: async (cwd: string): Promise<boolean> => {
    try {
      const result = await runSTM(['list'], { cwd, capture: true });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  },

  /**
   * Get task count from list output
   */
  getTaskCount: (listOutput: string): number => {
    return listOutput.split('\n').filter((line) => line.trim()).length;
  }
};
