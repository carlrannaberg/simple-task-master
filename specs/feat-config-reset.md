# Configuration Reset Feature Specification

**Title**: Add reset functionality to config command  
**Status**: Draft  
**Authors**: Claude (2025-07-25)  
**Related**: config command, ConfigManager

## Overview

Add `--reset` option to the config command that allows users to reset configuration values to their defaults. This provides a user-friendly way to restore default behavior without manually editing JSON or remembering default values.

## Background/Problem Statement

Currently, users cannot easily reset configuration values to defaults:
- Must manually edit config.json to remove optional values
- Must remember exact default values for required fields
- No clear distinction between "not set" (use default) and "explicitly set to default"
- Confusing for users who want to undo configuration changes

## Goals

- Provide `--reset <key>` option to reset individual config values
- Optional: Provide `--reset-all` to reset entire configuration
- Maintain clear distinction between optional and required config fields
- Give users confidence to experiment with configuration

## Technical Design

### Command Structure

```bash
# Reset individual configuration value
stm config --reset <key>

# Optional: Reset all configuration to defaults
stm config --reset-all
```

### Implementation Details

1. **For Optional Fields (e.g., tasksDir)**:
   - Remove the field from config.json entirely
   - ConfigManager will use built-in defaults when field is absent

2. **For Required Fields (e.g., lockTimeoutMs, maxTaskSizeBytes)**:
   - Set the field to its default value explicitly
   - Maintain field presence in config.json

3. **Schema Version**:
   - Always preserve (never reset)
   - Required for config file validity

### Default Values

```typescript
const CONFIG_DEFAULTS = {
  schema: 1, // Never reset
  lockTimeoutMs: 30000,
  maxTaskSizeBytes: 1048576,
  tasksDir: undefined // Optional - absence means use default
};
```

### ConfigManager Changes

Add new method:
```typescript
async reset(keys: string[]): Promise<void> {
  await this.load();
  
  const updatedConfig = { ...this.config };
  
  for (const key of keys) {
    if (key === 'schema') {
      throw new ValidationError('Cannot reset schema version');
    }
    
    if (key === 'tasksDir') {
      // Optional field - remove it
      delete updatedConfig.tasksDir;
    } else if (key in CONFIG_DEFAULTS) {
      // Required field - set to default
      updatedConfig[key] = CONFIG_DEFAULTS[key];
    } else {
      throw new ValidationError(`Unknown configuration key: ${key}`);
    }
  }
  
  await this.save(updatedConfig);
}
```

## User Experience

### Reset Individual Value
```bash
$ stm config --reset tasksDir
✓ Reset tasksDir to default (.simple-task-master/tasks)

$ stm config --reset lockTimeoutMs  
✓ Reset lockTimeoutMs to default (30000ms)
```

### Reset All (Optional)
```bash
$ stm config --reset-all
✓ Reset all configuration to defaults
  - lockTimeoutMs: 30000ms
  - maxTaskSizeBytes: 1048576 bytes (1 MB)
  - tasksDir: .simple-task-master/tasks (default)
```

### Error Cases
```bash
$ stm config --reset unknownKey
Error: Unknown configuration key: unknownKey

$ stm config --reset schema
Error: Cannot reset schema version
```

## Testing Requirements

### Unit Tests
- Reset optional field removes it from config
- Reset required field sets default value
- Cannot reset schema version
- Unknown keys throw error
- File locking during reset operation

### Integration Tests  
- Reset works with concurrent operations
- Config file remains valid JSON after reset
- Other config values preserved during single reset

### E2E Tests
- Full workflow: set value → use it → reset → verify default behavior
- Reset with existing tasks using custom tasksDir
- Multiple resets in sequence

## Success Criteria

- Users can reset any configuration value (except schema)
- Optional fields are removed from config when reset
- Required fields are set to default values when reset
- Clear success messages indicate what was reset
- Config file remains valid after any reset operation