# Task Breakdown: Configuration Management Command
Generated: 2025-07-24
Source: specs/feat-config-command.md

## Overview
Adding a new `config` command to Simple Task Master that allows users to view and modify configuration settings after initialization. This enables ongoing configuration management without requiring manual JSON file editing.

## Phase 1: Foundation

### Task 1.1: Extract and refactor path validation utility
**Description**: Move validateTasksDir from init command to shared lib/path-validation.ts
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None

**Technical Requirements**:
- Extract validateTasksDir function from src/commands/init.ts
- Create new src/lib/path-validation.ts module
- Preserve all existing validation rules
- Export for use by both init and config commands

**Implementation Steps**:
1. Create src/lib/path-validation.ts file
2. Extract validateTasksDir function with all validation logic
3. Update imports in src/commands/init.ts
4. Ensure no system directories check
5. Ensure path traversal prevention
6. Test that init command still works correctly

**Acceptance Criteria**:
- [ ] Validation function extracted to shared module
- [ ] Init command continues to work with shared validation
- [ ] All existing validation rules preserved
- [ ] Tests pass for both init and new validation module

### Task 1.2: Extend ConfigManager with write capabilities
**Description**: Add update() and save() methods to ConfigManager for configuration persistence
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- Add update(updates: Partial<Config>): Promise<void> method
- Add private save(config: Config): Promise<void> method
- Add private validate(config: Config): Promise<void> method
- Use write-file-atomic for safe writes
- Handle backward compatibility for missing config files

**Implementation example from spec**:
```typescript
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
```

**Acceptance Criteria**:
- [ ] ConfigManager can update configuration values
- [ ] Atomic writes prevent corruption
- [ ] Validation ensures data integrity
- [ ] Backward compatibility with missing config files
- [ ] Unit tests cover all new methods

## Phase 2: Core Command Implementation

### Task 2.1: Create config command structure
**Description**: Implement basic config command with Commander.js integration
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**Technical Requirements**:
- Create src/commands/config.ts
- Implement command options: --get, --set, --list
- Use Commander.js patterns matching other commands
- Handle all option combinations correctly
- Return appropriate exit codes

**Command structure from spec**:
```bash
stm config --get <key>
stm config --set <key=value>
stm config --list
```

**Implementation includes**:
- ConfigOptions interface with get?, set?, list? properties
- parseValue function for type conversion
- handleCommandError for consistent error handling
- Main command action function

**Acceptance Criteria**:
- [ ] Command parses all options correctly
- [ ] Error handling matches project patterns
- [ ] Exit codes follow conventions (0=success, 1=error, 2=validation, 3=not found)
- [ ] Command registered in CLI
- [ ] Help text is clear and informative

### Task 2.2: Implement get functionality
**Description**: Add ability to retrieve individual configuration values
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.3, Task 2.4

**Technical Requirements**:
- Load current configuration
- Validate requested key exists
- Output single value to stdout
- Handle missing config gracefully
- Support all config keys: tasksDir, lockTimeoutMs, maxTaskSizeBytes

**Implementation Steps**:
1. Parse --get option value
2. Load config via ConfigManager
3. Check if key exists in config
4. Output value or throw ValidationError
5. Ensure output is script-friendly (single value)

**Acceptance Criteria**:
- [ ] Can get all valid configuration keys
- [ ] Unknown keys produce clear error
- [ ] Output suitable for scripting
- [ ] Works with default config values
- [ ] Tests cover all keys and error cases

### Task 2.3: Implement set functionality with validation
**Description**: Add ability to modify configuration values with full validation
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.2, Task 2.4

**Technical Requirements**:
- Parse key=value format
- Convert values to appropriate types
- Validate all inputs before saving
- Use LockManager for concurrent safety
- Show warning when changing tasksDir with existing tasks

**Validation rules from spec**:
- lockTimeoutMs: positive integer
- maxTaskSizeBytes: positive integer
- tasksDir: no traversal, no system dirs, valid chars

**Acceptance Criteria**:
- [ ] Can set all configuration values
- [ ] Type conversion works correctly
- [ ] Validation prevents invalid values
- [ ] Lock prevents concurrent modifications
- [ ] Warning shown for tasksDir changes with existing tasks
- [ ] Success message confirms updates

### Task 2.4: Implement list functionality
**Description**: Add ability to display all configuration values as JSON
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.2, Task 2.3

**Technical Requirements**:
- Load current configuration
- Output as formatted JSON
- Include all configuration fields
- Handle missing config gracefully

**Implementation Steps**:
1. Load config via ConfigManager
2. Output with JSON.stringify(config, null, 2)
3. Ensure output is valid JSON for scripting

**Acceptance Criteria**:
- [ ] Outputs valid JSON format
- [ ] Includes all configuration fields
- [ ] Pretty-printed for readability
- [ ] Works with default values
- [ ] Suitable for piping to jq or other tools

## Phase 3: Testing & Quality Assurance

### Task 3.1: Create unit tests for config command
**Description**: Comprehensive unit tests for all config command functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2, Task 2.3, Task 2.4
**Can run parallel with**: Task 3.2, Task 3.3

**Test Coverage Required**:
- Command parsing tests
- Get functionality with valid/invalid keys
- Set functionality with type conversion
- List functionality JSON output
- Error handling for all cases
- Validation edge cases

**Test file**: test/unit/commands/config.spec.ts

**Key test cases from spec**:
```typescript
it('should reject negative timeout values', async () => {
  // Purpose: Ensure system stability by preventing invalid timeout configurations
  // that could cause lock acquisition to fail or behave unexpectedly
  await expect(config.set({ lockTimeoutMs: -1000 }))
    .rejects.toThrow('lockTimeoutMs must be positive');
});
```

**Acceptance Criteria**:
- [ ] All command options tested
- [ ] Edge cases covered
- [ ] Error messages verified
- [ ] Each test includes purpose comment
- [ ] 95% code coverage achieved

### Task 3.2: Create integration tests for ConfigManager updates
**Description**: Test ConfigManager integration with file system and locking
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 3.1, Task 3.3

**Test Coverage Required**:
- Full update cycle with file system
- Lock management during updates
- Atomic write verification
- Concurrent access prevention
- Config file creation when missing

**Test file**: test/integration/config-integration.spec.ts

**Acceptance Criteria**:
- [ ] File system operations tested
- [ ] Lock contention handled correctly
- [ ] Atomic writes prevent corruption
- [ ] Missing config file handled
- [ ] 85% integration test coverage

### Task 3.3: Create E2E tests for config workflows
**Description**: End-to-end tests for complete config command workflows
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2, Task 2.3, Task 2.4
**Can run parallel with**: Task 3.1, Task 3.2

**Test Scenarios**:
- Full workflow: init → config changes → task operations
- Changing tasksDir and verifying task access
- Script integration with get/list commands
- Error recovery from corrupted config
- Multiple config changes in sequence

**Test file**: test/e2e/config-e2e.spec.ts

**Acceptance Criteria**:
- [ ] Complete workflows tested
- [ ] Real CLI execution verified
- [ ] Output format validated
- [ ] Error scenarios tested
- [ ] Performance acceptable

## Phase 4: Documentation & Polish

### Task 4.1: Update README with config command documentation
**Description**: Add config command to README command reference
**Size**: Small
**Priority**: Medium
**Dependencies**: All Phase 2 tasks
**Can run parallel with**: Task 4.2, Task 4.3

**Documentation Requirements**:
- Add to command reference section
- Include usage examples
- Document all configuration options
- Explain validation rules
- Show common use cases

**Sections to update**:
- Command reference
- Configuration section (new)
- Examples section

**Acceptance Criteria**:
- [ ] Config command documented
- [ ] Examples are clear and tested
- [ ] Configuration options explained
- [ ] Validation rules documented

### Task 4.2: Update CHANGELOG and AGENT.md
**Description**: Document config command in project metadata files
**Size**: Small
**Priority**: Medium
**Dependencies**: All Phase 2 tasks
**Can run parallel with**: Task 4.1, Task 4.3

**Updates Required**:
- CHANGELOG.md: New feature entry
- AGENT.md: Add to command list
- AGENT.md: Document validation rules

**Acceptance Criteria**:
- [ ] CHANGELOG entry added
- [ ] AGENT.md commands updated
- [ ] Validation rules documented
- [ ] No breaking changes noted

### Task 4.3: Add inline help documentation
**Description**: Enhance command help text with detailed information
**Size**: Small
**Priority**: Low
**Dependencies**: Task 2.1
**Can run parallel with**: Task 4.1, Task 4.2

**Documentation Requirements**:
- Explain each configuration key
- Show valid value ranges
- Include practical examples
- Note how to restore defaults

**Acceptance Criteria**:
- [ ] Help text is comprehensive
- [ ] Examples are practical
- [ ] Value ranges documented
- [ ] Clear and concise

## Execution Strategy

### Recommended Sequence
1. Phase 1: Foundation (Tasks 1.1, 1.2) - Sequential
2. Phase 2: Core Implementation (Task 2.1, then 2.2-2.4 in parallel)
3. Phase 3: Testing (Tasks 3.1-3.3 in parallel after Phase 2)
4. Phase 4: Documentation (Tasks 4.1-4.3 in parallel after Phase 2)

### Critical Path
Task 1.1 → Task 1.2 → Task 2.1 → Testing & Documentation

### Parallel Opportunities
- Tasks 2.2, 2.3, 2.4 can run in parallel after 2.1
- All Phase 3 testing tasks can run in parallel
- All Phase 4 documentation tasks can run in parallel

## Risk Assessment

### Technical Risks
- **Config file corruption**: Mitigated by atomic writes
- **Breaking changes**: Mitigated by backward compatibility
- **Lock contention**: Mitigated by brief lock duration

### Implementation Risks
- **Complex validation**: Clear rules in spec
- **Type conversion**: Well-defined in parseValue function
- **Error handling**: Consistent patterns to follow

## Summary
- **Total Tasks**: 11
- **Phase 1**: 2 tasks (foundation)
- **Phase 2**: 4 tasks (core features)
- **Phase 3**: 3 tasks (testing)
- **Phase 4**: 3 tasks (documentation)
- **Estimated Complexity**: Medium
- **Parallel Execution**: High potential in phases 2-4