# Configuration Management Command Specification

**Title**: Add `config` command for post-initialization configuration management  
**Status**: Draft  
**Authors**: Claude (2025-07-24)  
**Related**: init command, ConfigManager

## Overview

Add a new `config` command to Simple Task Master that allows users to view and modify configuration settings after initialization. This complements the existing `init` command by providing ongoing configuration management capabilities without requiring manual editing of the config.json file.

## Background/Problem Statement

Currently, STM users can set configuration options during initialization using `stm init --tasks-dir <path>`, but there's no way to modify configuration after initialization without manually editing `.simple-task-master/config.json`. This creates several issues:

- Users must know the exact location and format of the config file
- Manual editing is error-prone and can break the configuration
- No validation is performed on manually edited values
- No way to view current configuration without reading the JSON file
- Changing the tasks directory after initialization requires careful manual updates

## Goals

- Provide a CLI interface for viewing and modifying STM configuration
- Validate all configuration changes before applying them
- Support atomic updates to prevent corruption
- Maintain backward compatibility with existing config files
- Follow established STM command patterns and conventions

## Non-Goals

- Migration of existing tasks when changing `tasksDir`
- Configuration profiles or environment-specific configs
- Remote configuration management
- GUI or interactive configuration editor
- Changing configuration schema version
- Global user-level configuration (only project-level)

## Technical Dependencies

### Internal Dependencies
- `ConfigManager` class (needs extension for write capabilities)
- `LockManager` for concurrent access safety
- `Workspace` for finding project root
- Existing validation utilities from init command
- Error handling classes (`ValidationError`, `ConfigurationError`)

### External Dependencies
- `write-file-atomic`: For safe configuration writes (already in project)
- `commander`: For command parsing (already in project)
- No new external dependencies required

## Detailed Design

### Command Structure

```bash
# Get a specific configuration value
stm config --get <key>

# Set a configuration value
stm config --set <key=value>

# List all configuration values
stm config --list
```

### Configuration Keys

The following keys will be supported:

- `tasksDir`: Custom directory for task files (validated path)
- `lockTimeoutMs`: Lock acquisition timeout in milliseconds (positive integer)
- `maxTaskSizeBytes`: Maximum task file size in bytes (positive integer)

### Implementation Architecture

#### 1. Extend ConfigManager (`src/lib/config.ts`)

Add new methods to ConfigManager:

```typescript
class ConfigManager {
  // Existing methods...
  
  /**
   * Update configuration values
   * @param updates - Partial config updates
   * @throws ValidationError if values are invalid
   */
  async update(updates: Partial<Config>): Promise<void> {
    await this.load(); // Ensure current config is loaded
    
    // If config doesn't exist (backward compatibility), start with defaults
    if (!this.config) {
      this.config = this.getDefaults();
      
      // Ensure .simple-task-master directory exists
      const baseDir = path.join(this.workspaceRoot, PATHS.BASE_DIR);
      await ensureDirectory(baseDir);
    }
    
    const newConfig = { ...this.config, ...updates };
    await this.validate(newConfig);
    await this.save(newConfig);
  }
  
  /**
   * Save configuration to file
   * Uses atomic write for safety
   */
  private async save(config: Config): Promise<void> {
    const configPath = PATHS.getConfigPath(this.workspaceRoot);
    await writeFileAtomic(
      configPath,
      JSON.stringify(config, null, 2) + '\n'
    );
    this.config = config; // Update cache
  }
  
  
  /**
   * Validate configuration values
   */
  private async validate(config: Config): Promise<void> {
    // Schema version check
    if (config.schema !== CURRENT_SCHEMA_VERSION) {
      throw new ValidationError(`Invalid schema version: ${config.schema}`);
    }
    
    // Validate numeric values
    if (!Number.isInteger(config.lockTimeoutMs) || config.lockTimeoutMs <= 0) {
      throw new ValidationError('lockTimeoutMs must be a positive integer');
    }
    
    if (!Number.isInteger(config.maxTaskSizeBytes) || config.maxTaskSizeBytes <= 0) {
      throw new ValidationError('maxTaskSizeBytes must be a positive integer');
    }
    
    // Validate tasksDir if provided
    if (config.tasksDir) {
      // Use shared validation utility
      const { validateTasksDir } = await import('../lib/path-validation');
      validateTasksDir(config.tasksDir);
    }
  }
}
```

#### 2. Create Config Command (`src/commands/config.ts`)

```typescript
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from '../lib/config-manager';
import { LockManager } from '../lib/lock-manager';
import { Workspace } from '../lib/workspace';
import { printSuccess, printError, printWarning } from '../lib/output';
import { ValidationError, NotFoundError, FileSystemError, ConfigurationError } from '../lib/errors';
import { ensureDirectory } from '../lib/utils';
import { PATHS } from '../lib/constants';
import { validateTasksDir } from '../lib/path-validation'; // Shared validation utility

interface ConfigOptions {
  get?: string;
  set?: string;
  list?: boolean;
}

/**
 * Parse and validate configuration values from string input
 */
function parseValue(key: string, value: string): string | number {
  if (key === 'lockTimeoutMs' || key === 'maxTaskSizeBytes') {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new ValidationError(`${key} must be a number`);
    }
    return num;
  }
  // tasksDir remains as string
  return value;
}

/**
 * Handle command errors with appropriate exit codes
 */
function handleCommandError(error: unknown): never {
  if (error instanceof ValidationError) {
    printError(error.message);
    process.exit(2); // Invalid input
  }
  if (error instanceof NotFoundError) {
    printError(error.message);
    process.exit(3); // Resource not found
  }
  if (error instanceof FileSystemError) {
    printError(error.message);
    process.exit(1); // File system error
  }
  if (error instanceof ConfigurationError) {
    printError(error.message);
    process.exit(1); // Configuration error
  }
  
  // Unknown error
  const message = error instanceof Error ? error.message : String(error);
  printError(`Unexpected error: ${message}`);
  process.exit(1);
}

async function configCommand(options: ConfigOptions): Promise<void> {
  try {
    const workspace = await Workspace.find();
    const configManager = new ConfigManager(workspace.root);
    const lockManager = new LockManager(workspace.root);
    
    // Handle --get
    if (options.get) {
      const config = await configManager.load();
      const value = config[options.get as keyof Config];
      if (value === undefined) {
        throw new ValidationError(`Unknown configuration key: ${options.get}`);
      }
      console.log(value);
      return;
    }
    
    // Handle --list
    if (options.list) {
      const config = await configManager.load();
      console.log(JSON.stringify(config, null, 2));
      return;
    }
    
    // Handle --set (requires lock)
    if (options.set) {
      await lockManager.acquire();
      try {
        const [key, value] = options.set.split('=');
        if (!key || value === undefined) {
          throw new ValidationError('Invalid format. Use: --set key=value');
        }
        
        // Check if we're changing tasksDir with existing tasks
        if (key === 'tasksDir') {
          const config = await configManager.load();
          const currentTasksDir = configManager.getTasksDir();
          const newTasksDir = path.isAbsolute(value) 
            ? value 
            : path.join(workspace.root, value);
            
          if (currentTasksDir !== newTasksDir) {
            try {
              const files = await fs.readdir(currentTasksDir);
              const taskFiles = files.filter(f => f.endsWith('.md'));
              if (taskFiles.length > 0) {
                printWarning(
                  `Current tasks directory contains ${taskFiles.length} task(s). ` +
                  `Tasks will NOT be automatically migrated to the new location.`
                );
              }
            } catch {
              // Current tasks dir doesn't exist, no warning needed
            }
          }
        }
        
        const updates = { [key]: parseValue(key, value) };
        await configManager.update(updates);
        printSuccess('Configuration updated successfully');
      } finally {
        await lockManager.release();
      }
      return;
    }
    
    // No options provided - show help
    console.log('Usage: stm config [options]');
    console.log('Use "stm config --help" for more information');
    
  } catch (error) {
    handleCommandError(error);
  }
}

export const configCommand = new Command('config')
  .description('Manage Simple Task Master configuration')
  .option('--get <key>', 'Get a configuration value')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--list', 'List all configuration values')
  .action(configCommand);
```

#### 3. Update CLI Registration (`src/cli.ts`)

Add the config command to the CLI:

```typescript
import { configCommand } from './commands/config';

// In createProgram()
program.addCommand(configCommand);
```

### Validation Rules

#### tasksDir Validation
- No directory traversal sequences (`..`)
- No system directories (/, /usr, /bin, /etc, /var, /sys, /proc)
- Exception for temp directories during testing
- Cannot be inside `.simple-task-master` directory
- Maximum path length: 1000 characters
- Valid characters only (no control characters)

#### Numeric Validation
- `lockTimeoutMs`: Must be a positive integer
- `maxTaskSizeBytes`: Must be a positive integer

### Error Handling

The command will handle these error cases:

- **Missing config file**: Create with defaults when attempting to update
- **Invalid key**: Clear error message listing valid keys
- **Invalid value**: Specific validation error message
- **Locked workspace**: Standard lock timeout behavior
- **Permission errors**: Clear message about file permissions
- **Malformed config.json**: Report parse error and exit

## User Experience

### Basic Usage Examples

```bash
# View all configuration
stm config --list

# Get specific value
stm config --get tasksDir
stm config --get lockTimeoutMs

# Change tasks directory
stm config --set tasksDir=docs/tasks

# Change multiple values (run multiple times)
stm config --set lockTimeoutMs=60000
stm config --set maxTaskSizeBytes=2097152
```

### User Feedback

- Success messages for all modifications
- Clear validation errors with suggested corrections
- JSON output for --list to support scripting
- Single value output for --get to support scripting

## Testing Strategy

### Unit Tests (`test/unit/commands/config.spec.ts`)

- **Command parsing**: Test all option combinations
- **Get functionality**: Valid/invalid keys, missing config
- **Set functionality**: Valid/invalid values, single value updates
- **List functionality**: JSON output format
- **Error cases**: All validation errors, file system errors

Each test should include a purpose comment:
```typescript
it('should reject negative timeout values', async () => {
  // Purpose: Ensure system stability by preventing invalid timeout configurations
  // that could cause lock acquisition to fail or behave unexpectedly
  await expect(config.set({ lockTimeoutMs: -1000 }))
    .rejects.toThrow('lockTimeoutMs must be positive');
});
```

### Integration Tests (`test/integration/config-integration.spec.ts`)

- **ConfigManager integration**: Full update cycle with file system
- **Lock management**: Concurrent access prevention
- **File atomicity**: No corruption on interrupted writes
- **Config migration**: Future schema version handling

### E2E Tests (`test/e2e/config-e2e.spec.ts`)

- **Full workflow**: Init → config changes → task operations
- **Directory changes**: Changing tasksDir and verifying task access
- **Script integration**: Using config in automated scripts
- **Error recovery**: Handling corrupted config files

### Edge Cases to Test

- Config file with extra unknown fields
- Config file with missing optional fields
- Invalid JSON in config file
- Setting non-existent configuration keys

## Performance Considerations

- **Config caching**: ConfigManager already caches loaded config
- **File operations**: Minimal - only read on first access, write on changes
- **Lock contention**: Brief lock duration for writes only
- **No performance impact**: On existing operations that only read config

## Security Considerations

- **Path validation**: Prevent directory traversal attacks
- **Input sanitization**: All user inputs validated before use
- **File permissions**: Respect existing file permissions
- **No sensitive data**: Config contains only application settings
- **Atomic writes**: Prevent partial writes that could break security

## Documentation

### Files to Update

1. **README.md**
   - Add config command to command reference
   - Add configuration section explaining all options
   - Update examples to show config usage

2. **CHANGELOG.md**
   - Document new config command
   - Note any breaking changes (none expected)

3. **AGENT.md**
   - Add config command to development commands list
   - Document config validation rules

### New Documentation

Create inline help that explains:
- Available configuration keys and their purposes
- Valid value ranges and formats
- Examples of common configuration changes
- How to restore defaults if needed

## Implementation Phases

### Phase 1: Core Functionality (MVP)
1. Refactor `validateTasksDir` from init command to shared `lib/path-validation.ts`
2. Extend ConfigManager with save/update methods
3. Implement basic config command (get, set, list)
4. Add validation for all config values
5. Integrate with CLI
6. Add comprehensive unit tests

### Phase 2: Enhanced Features
1. Improve error messages with suggestions
2. Add integration and E2E tests
3. Update all documentation


## Open Questions

1. **Should we support shorthand for common configs?**
   - e.g., `stm config --timeout 60` for `lockTimeoutMs=60000`
   - Decision: Not in initial version, can add if users request

2. **Should --list show descriptions of each config option?**
   - Would help users understand options
   - Decision: Start with JSON output, enhance later if needed

3. **Should we warn when changing tasksDir with existing tasks?**
   - Tasks won't be migrated automatically
   - Decision: Yes, warning implemented in the --set handler

4. **Should we support config comments in the JSON?**
   - Would lose them on updates
   - Decision: No, keep standard JSON format

## References

- Current init command: `src/commands/init.ts`
- ConfigManager implementation: `src/lib/config.ts`
- Configuration types: `src/lib/types.ts:Config`
- Validation patterns: `src/commands/init.ts:validateTasksDir()`
- Command patterns: `src/commands/*.ts`
- Error handling: `src/lib/errors.ts`