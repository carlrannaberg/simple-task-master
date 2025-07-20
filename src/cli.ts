#!/usr/bin/env node
import { Command } from 'commander';
import { version, description } from '../package.json';
import { handleGlobalError } from './lib/errors';

// Import commands
import { initCommand } from './commands/init';
import { addCommand } from './commands/add';
import { deleteCommand } from './commands/delete';
import { listCommand } from './commands/list';
import { showCommand } from './commands/show';
import { updateCommand } from './commands/update';
import { grepCommand } from './commands/grep';
import { exportCommand } from './commands/export';

// Set up process error handlers only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason: unknown) => {
    handleGlobalError(new Error(`Unhandled rejection: ${String(reason)}`));
  });

  process.on('uncaughtException', (error: Error) => {
    // Handle EPIPE errors specifically - they occur when writing to a closed pipe
    if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
      // EPIPE errors are usually not fatal and can be ignored
      // They commonly occur when the stdin/stdout pipe is closed prematurely
      // Log a warning but don't crash the process
      console.warn('Warning: Broken pipe detected (EPIPE). This is usually not an error.');
      return;
    }

    handleGlobalError(error);
  });

  // Handle EPIPE errors on stdout/stderr streams
  process.stdout.on('error', (error: Error) => {
    if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
      // EPIPE on stdout is common when output is piped to a command that exits early
      // (e.g., `stm list | head -1`). This is expected behavior.
      process.exit(0);
    }
  });

  process.stderr.on('error', (error: Error) => {
    if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
      // EPIPE on stderr is also common in similar scenarios
      process.exit(0);
    }
  });
}

// Create the main program
const program = new Command();

program
  .name('stm')
  .description(description)
  .version(version, '-v, --version', 'display version information')
  .configureHelp({
    sortSubcommands: true,
    sortOptions: true
  });

// Register commands
program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(deleteCommand);
program.addCommand(listCommand);
program.addCommand(showCommand);
program.addCommand(updateCommand);
program.addCommand(grepCommand);
program.addCommand(exportCommand);

// Parse command line arguments
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleGlobalError(error as Error);
  }
}

// Run the CLI
void main();
