# Task Breakdown: Configuration Reset Feature
Generated: 2025-07-25  
Source: specs/feat-config-reset.md

## Overview

Add `--reset` functionality to the config command, allowing users to restore configuration values to their defaults without manual JSON editing.

## Phase 1: Foundation

### Task 1.1: Define configuration defaults
**Description**: Create a central definition of default configuration values
**Size**: Small
**Priority**: High  
**Dependencies**: None
**Can run parallel with**: None

**Technical Requirements**:
- Create CONFIG_DEFAULTS constant in src/lib/config.ts
- Include all configuration fields with their default values
- Mark optional fields (like tasksDir) appropriately
- Document which fields can be reset vs preserved

**Implementation Steps**:
1. Add CONFIG_DEFAULTS object to src/lib/config.ts
2. Include schema (marked as non-resettable), lockTimeoutMs, maxTaskSizeBytes
3. Handle optional tasksDir field (undefined = use default)
4. Export for use in both ConfigManager and config command

**Acceptance Criteria**:
- [ ] CONFIG_DEFAULTS defined with all current config fields
- [ ] Optional vs required fields clearly distinguished
- [ ] Schema marked as non-resettable
- [ ] Unit tests verify defaults match current behavior

## Phase 2: Core Implementation

### Task 2.1: Add reset method to ConfigManager
**Description**: Implement the reset functionality in ConfigManager class
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.2

**Technical Requirements**:
- Add `reset(keys: string[]): Promise<void>` method
- Handle optional fields by deletion
- Handle required fields by setting to default
- Prevent schema version reset
- Use atomic writes for safety

**Implementation example**:
```typescript
async reset(keys: string[]): Promise<void> {
  await this.load();
  
  const updatedConfig = { ...this.config };
  
  for (const key of keys) {
    if (key === 'schema') {
      throw new ValidationError('Cannot reset schema version');
    }
    
    if (key === 'tasksDir') {
      delete updatedConfig.tasksDir;
    } else if (key in CONFIG_DEFAULTS) {
      updatedConfig[key] = CONFIG_DEFAULTS[key];
    } else {
      throw new ValidationError(`Unknown configuration key: ${key}`);
    }
  }
  
  await this.save(updatedConfig);
}
```

**Acceptance Criteria**:
- [ ] Reset method handles all configuration keys correctly
- [ ] Optional fields removed from config when reset
- [ ] Required fields set to default values
- [ ] Schema version cannot be reset
- [ ] Unknown keys throw ValidationError
- [ ] Atomic writes prevent corruption

### Task 2.2: Add --reset option to config command
**Description**: Implement command-line interface for reset functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1

**Technical Requirements**:
- Add `--reset <key>` option to config command
- Optional: Add `--reset-all` for resetting entire config
- Integrate with ConfigManager.reset() method
- Provide clear success messages
- Handle errors gracefully

**Implementation Steps**:
1. Add reset option to Commander configuration
2. Parse reset key from command line
3. Call ConfigManager.reset() with appropriate keys
4. Display user-friendly success message with actual default values
5. Handle --reset-all by passing all resettable keys

**Acceptance Criteria**:
- [ ] --reset option accepts configuration key
- [ ] Success message shows what was reset and to what value
- [ ] Error messages are clear for invalid keys
- [ ] File locking prevents concurrent modifications
- [ ] Help text updated with reset examples

## Phase 3: Testing

### Task 3.1: Unit tests for ConfigManager reset
**Description**: Comprehensive unit tests for reset functionality
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.2, 3.3

**Test Cases**:
- Reset optional field (tasksDir) removes it from config
- Reset required field sets correct default value
- Reset multiple fields in one operation
- Cannot reset schema version
- Unknown keys throw appropriate error
- Config remains valid JSON after reset

**Acceptance Criteria**:
- [ ] All reset scenarios have test coverage
- [ ] Edge cases handled (empty config, missing fields)
- [ ] Error conditions properly tested
- [ ] Tests follow project pattern with purpose comments

### Task 3.2: Integration tests for reset
**Description**: Test reset functionality with file system
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.1, 3.3

**Test Cases**:
- Reset during concurrent config operations
- File system errors handled gracefully
- Atomic writes prevent partial updates
- Config file permissions preserved

**Acceptance Criteria**:
- [ ] Concurrent reset operations don't corrupt config
- [ ] File system errors provide clear messages
- [ ] Integration with existing ConfigManager methods

### Task 3.3: E2E tests for reset command
**Description**: End-to-end tests for complete reset workflows
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: Task 3.1, 3.2

**Test Scenarios**:
- Set custom value → reset → verify default behavior
- Reset with tasks in custom tasksDir
- Multiple resets in sequence
- Reset all functionality (if implemented)
- Error cases (invalid keys, schema reset attempt)

**Acceptance Criteria**:
- [ ] Complete user workflows tested
- [ ] Command output matches expected format
- [ ] Exit codes correct for success/failure
- [ ] Performance acceptable (<100ms)

## Phase 4: Documentation

### Task 4.1: Update command documentation
**Description**: Update all documentation for reset functionality
**Size**: Small
**Priority**: Medium
**Dependencies**: Tasks 2.1, 2.2
**Can run parallel with**: None

**Documentation Updates**:
- README.md: Add reset examples to config command section
- CHANGELOG.md: Document new feature
- Inline help: Update config command help text
- AGENT.md: Note reset functionality in command reference

**Acceptance Criteria**:
- [ ] README includes clear reset examples
- [ ] Help text explains reset behavior
- [ ] Changelog entry follows conventions
- [ ] Examples show both individual and batch reset

## Summary

**Total Tasks**: 7
- Phase 1 (Foundation): 1 task
- Phase 2 (Implementation): 2 tasks  
- Phase 3 (Testing): 3 tasks
- Phase 4 (Documentation): 1 task

**Execution Strategy**:
1. Start with Task 1.1 (define defaults)
2. Run Tasks 2.1 and 2.2 in parallel
3. Run all testing tasks (3.1, 3.2, 3.3) in parallel
4. Complete with documentation (Task 4.1)

**Estimated Complexity**: Medium
- Most complex: Task 2.1 (ConfigManager reset method)
- Simplest: Task 1.1 (Define defaults)

**Risk Assessment**: Low
- No breaking changes to existing functionality
- Atomic operations prevent data corruption
- Clear error handling for edge cases