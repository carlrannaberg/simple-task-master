#!/usr/bin/env node
import { Command } from 'commander';
import { version, description } from '../package.json';
import { handleGlobalError } from './lib/errors';

// Import commands
import { initCommand } from './commands/init';
import { addCommand } from './commands/add';
import { listCommand } from './commands/list';
import { showCommand } from './commands/show';
import { updateCommand } from './commands/update';
import { grepCommand } from './commands/grep';
import { exportCommand } from './commands/export';

// Set up process error handlers
process.on('unhandledRejection', (reason: unknown) => {
  handleGlobalError(new Error(`Unhandled rejection: ${String(reason)}`));
});

process.on('uncaughtException', (error: Error) => {
  handleGlobalError(error);
});

// Create the main program
const program = new Command();

program
  .name('stm')
  .description(description)
  .version(version, '-v, --version', 'display version information')
  .configureHelp({
    sortSubcommands: true,
    sortOptions: true,
  });

// Register commands
program.addCommand(initCommand);
program.addCommand(addCommand);
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
