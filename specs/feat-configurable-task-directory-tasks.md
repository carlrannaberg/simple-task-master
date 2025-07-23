# Task Breakdown: Configurable Task Directory
Generated: 2025-07-22
Source: specs/feat-configurable-task-directory.md

## Overview
Implement support for configurable task directories in Simple Task Master, allowing users to specify custom locations for storing task files via the config.json file. This enables flexible workspace organization, cloud-synced folders, and project-specific task locations.

## Phase 1: Foundation

### Task 1.1: Create ConfigManager class for configuration loading
**Description**: Build the core ConfigManager class to load and manage config.json files
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None

**Technical Requirements**:
- Create new file `src/lib/config.ts`
- Implement ConfigManager class with caching
- Handle missing config files with defaults
- Validate schema version
- Support both absolute and relative paths

**Implementation Steps**:
1. Create ConfigManager class with constructor taking workspaceRoot
2. Implement load() method to read and parse config.json
3. Add schema validation to reject incompatible versions
4. Implement getTasksDir() method with path resolution logic
5. Add getDefaults() private method for backward compatibility
6. Handle all error cases (ENOENT, SyntaxError, etc.)

**Acceptance Criteria**:
- [ ] ConfigManager loads valid config files correctly
- [ ] Returns defaults when config.json is missing
- [ ] Validates schema version and rejects incompatible versions
- [ ] Correctly resolves both relative and absolute paths
- [ ] Caches loaded config to avoid repeated file reads
- [ ] Unit tests pass with 95%+ coverage

### Task 1.2: Update Config interface with tasksDir field
**Description**: Add optional tasksDir field to the Config interface
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Technical Requirements**:
- Update `src/lib/types.ts` Config interface
- Add `tasksDir?: string` field
- Ensure backward compatibility with optional field

**Implementation Steps**:
1. Open src/lib/types.ts
2. Add `tasksDir?: string;` to Config interface
3. Update any Config type references if needed

**Acceptance Criteria**:
- [ ] Config interface includes optional tasksDir field
- [ ] TypeScript compilation succeeds
- [ ] No breaking changes to existing code

### Task 1.3: Create comprehensive unit tests for ConfigManager
**Description**: Write unit tests for all ConfigManager functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**Technical Requirements**:
- Test file: `test/unit/lib/config.spec.ts`
- Cover all ConfigManager methods and edge cases
- Test backward compatibility scenarios
- Test path resolution logic

**Implementation Steps**:
1. Create test file with ConfigManager test suite
2. Test config loading with valid JSON
3. Test fallback to defaults when config missing
4. Test absolute path handling
5. Test relative path resolution
6. Test schema version validation
7. Test error handling for invalid JSON
8. Test caching behavior

**Acceptance Criteria**:
- [ ] All ConfigManager methods have test coverage
- [ ] Tests verify backward compatibility
- [ ] Path resolution tests cover edge cases
- [ ] Error scenarios are properly tested
- [ ] Tests pass and provide 95%+ coverage

## Phase 2: Core Integration

### Task 2.1: Integrate ConfigManager with TaskManager
**Description**: Update TaskManager to use ConfigManager for determining task directory
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: Task 2.2

**Technical Requirements**:
- Update TaskManager.create() static method
- Import and use ConfigManager
- Maintain backward compatibility
- Use configured directory for all operations

**Implementation Steps**:
1. Import ConfigManager in task-manager.ts
2. Update TaskManager.create() to instantiate ConfigManager
3. Load config and get tasks directory
4. Pass configured directory to TaskManager constructor
5. Ensure all task operations use the configured directory

**Acceptance Criteria**:
- [ ] TaskManager uses ConfigManager to determine task directory
- [ ] Tasks are created in configured directory
- [ ] Existing functionality remains unchanged
- [ ] Integration tests pass

### Task 2.2: Update workspace discovery functions
**Description**: Modify workspace.ts to respect configured task directories
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1

**Technical Requirements**:
- Update getTasksDirectory() function
- Import and use ConfigManager
- Maintain existing API

**Implementation Steps**:
1. Import ConfigManager in workspace.ts
2. Update getTasksDirectory() to use ConfigManager
3. Ensure function returns configured directory path

**Acceptance Criteria**:
- [ ] getTasksDirectory() returns configured path
- [ ] Function maintains same API signature
- [ ] Works with both default and custom directories

### Task 2.3: Add --tasks-dir option to init command
**Description**: Enhance init command to accept custom task directory during initialization
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**Technical Requirements**:
- Add --tasks-dir option to commander setup
- Implement validateTasksDir() function
- Create directory with proper permissions
- Update config.json with custom path
- Handle security validation

**Implementation Steps**:
1. Add InitOptions interface with tasksDir property
2. Update command registration with --tasks-dir option
3. Implement validateTasksDir() with security checks:
   - Normalize path
   - Prevent directory traversal
   - Check existing directories
   - Validate path types
4. Update initCommand to:
   - Accept and validate custom directory
   - Create config with tasksDir field
   - Create actual directory
   - Show appropriate success message

**Acceptance Criteria**:
- [ ] Init accepts --tasks-dir option
- [ ] Security validation prevents directory traversal
- [ ] Custom directory is created successfully
- [ ] Config.json includes tasksDir when specified
- [ ] Proper error messages for invalid paths
- [ ] Unit tests verify all scenarios

### Task 2.4: Create integration tests for custom directories
**Description**: Write integration tests verifying end-to-end functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2, Task 2.3
**Can run parallel with**: None

**Technical Requirements**:
- Test file: `test/integration/custom-directory-integration.spec.ts`
- Test complete workflows with custom directories
- Verify file locations
- Test absolute path scenarios

**Implementation Steps**:
1. Create integration test suite
2. Test workspace initialization with custom directory
3. Verify TaskManager uses configured directory
4. Test task creation in custom location
5. Verify files are NOT in default location
6. Test absolute path functionality
7. Test shared directory scenarios

**Acceptance Criteria**:
- [ ] Integration tests cover all workflows
- [ ] Tasks are created in correct directories
- [ ] Absolute paths work correctly
- [ ] Tests verify file locations
- [ ] All tests pass

## Phase 3: Polish and Edge Cases

### Task 3.1: Implement gitignore handling for custom directories
**Description**: Update gitignore to include custom task directories
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 3.2, Task 3.3

**Technical Requirements**:
- Implement updateGitignore() helper function
- Handle relative vs absolute paths differently
- Warn users about absolute paths
- Don't duplicate existing entries

**Implementation Steps**:
1. Create updateGitignore() function in init.ts
2. Determine entries based on config:
   - Custom relative paths
   - Default path if no custom
   - Always include lock file
3. Read existing .gitignore content
4. Add entries if not present
5. Handle absolute paths with warning
6. Write updated .gitignore

**Acceptance Criteria**:
- [ ] Gitignore updated with custom paths
- [ ] No duplicate entries added
- [ ] Absolute paths trigger warning
- [ ] Lock file always included
- [ ] Tests verify gitignore updates

### Task 3.2: Add security validation for path traversal
**Description**: Implement comprehensive security checks for custom paths
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.3
**Can run parallel with**: Task 3.1, Task 3.3

**Technical Requirements**:
- Already implemented in validateTasksDir()
- Add additional test coverage
- Document security considerations

**Implementation Steps**:
1. Review existing validateTasksDir() implementation
2. Add edge case tests for path traversal attempts
3. Test various attack vectors:
   - ../../../etc patterns
   - Symbolic links
   - Unicode tricks
4. Document security measures

**Acceptance Criteria**:
- [ ] Path traversal attempts are blocked
- [ ] Security tests cover edge cases
- [ ] Clear error messages for violations
- [ ] Documentation includes security notes

### Task 3.3: Create E2E tests for CLI workflows
**Description**: Write end-to-end tests for complete CLI workflows with custom directories
**Size**: Medium
**Priority**: Medium
**Dependencies**: All Phase 2 tasks
**Can run parallel with**: Task 3.1, Task 3.2

**Technical Requirements**:
- Test file: `test/e2e/custom-directory-e2e.spec.ts`
- Test complete CLI workflows
- Verify backward compatibility
- Test all commands with custom directories

**Implementation Steps**:
1. Create E2E test suite
2. Test init with custom directory via CLI
3. Verify task creation in custom location
4. Test all commands (list, show, update, etc.)
5. Test backward compatibility:
   - Old workspaces without config
   - Missing config.json scenarios
6. Verify proper error handling

**Acceptance Criteria**:
- [ ] E2E tests cover all CLI commands
- [ ] Custom directories work end-to-end
- [ ] Backward compatibility verified
- [ ] Error scenarios properly tested
- [ ] All tests pass

### Task 3.4: Update documentation and README
**Description**: Add documentation for configurable task directory feature
**Size**: Small
**Priority**: Low
**Dependencies**: All previous tasks
**Can run parallel with**: None

**Technical Requirements**:
- Update README.md configuration section
- Add migration guide
- Include examples
- Document limitations

**Implementation Steps**:
1. Add "Custom Task Directory" section to README
2. Include initialization examples
3. Show config.json examples
4. Add migration guide for existing workspaces
5. Document absolute path considerations
6. Update command help text if needed

**Acceptance Criteria**:
- [ ] README includes configuration section
- [ ] Examples are clear and tested
- [ ] Migration guide is accurate
- [ ] All options documented

### Task 3.5: Performance validation and optimization
**Description**: Validate performance impact and optimize if needed
**Size**: Small
**Priority**: Low
**Dependencies**: All previous tasks
**Can run parallel with**: None

**Technical Requirements**:
- Verify no performance regression
- Test with 1000+ tasks
- Profile config loading
- Document performance characteristics

**Implementation Steps**:
1. Run performance tests with custom directories
2. Profile ConfigManager loading times
3. Test with various directory locations
4. Compare with baseline performance
5. Optimize if any bottlenecks found
6. Document performance impact

**Acceptance Criteria**:
- [ ] No performance regression
- [ ] Config loads in < 1ms
- [ ] Path resolution < 0.1ms overhead
- [ ] Performance tests pass

## Task Dependencies Graph

```
Phase 1:
  Task 1.1 (ConfigManager) ──┬──→ Task 1.3 (Unit tests)
  Task 1.2 (Interface) ──────┘
  
Phase 2:
  Task 1.1 ──┬──→ Task 2.1 (TaskManager integration) ──┐
             ├──→ Task 2.2 (Workspace discovery) ──────┤
             └──→ Task 2.3 (Init command) ─────────────┴──→ Task 2.4 (Integration tests)
  
Phase 3:
  Task 2.3 ──┬──→ Task 3.1 (Gitignore)
             ├──→ Task 3.2 (Security)
             └──→ Task 3.3 (E2E tests)
  
  All tasks ────→ Task 3.4 (Documentation)
                └→ Task 3.5 (Performance)
```

## Execution Strategy

### Parallel Execution Opportunities
- Phase 1: Tasks 1.1 and 1.2 can run in parallel
- Phase 2: Tasks 2.1 and 2.2 can run in parallel after Phase 1
- Phase 3: Tasks 3.1, 3.2, and 3.3 can run in parallel

### Critical Path
1. Task 1.1 (ConfigManager) - Foundation
2. Task 2.3 (Init command) - Core functionality
3. Task 2.4 (Integration tests) - Validation
4. Task 3.3 (E2E tests) - Complete validation

### Risk Mitigation
- Start with foundation tasks to catch design issues early
- Comprehensive testing at each phase
- Maintain backward compatibility throughout
- Security validation as high priority

## Summary

- **Total Tasks**: 11
- **Phase 1**: 3 tasks (Foundation)
- **Phase 2**: 4 tasks (Core Features)
- **Phase 3**: 5 tasks (Polish)
- **Estimated Complexity**: Medium-High
- **Parallel Opportunities**: Multiple tasks can run in parallel within phases