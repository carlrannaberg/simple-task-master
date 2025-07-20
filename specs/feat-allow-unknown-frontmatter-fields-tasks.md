# Task Breakdown: Allow Unknown Fields in Frontmatter

Generated: July 19, 2025  
Source: specs/feat-allow-unknown-frontmatter-fields.md

## Overview

This implementation removes inconsistent validation behavior across STM's three validation systems, standardizing on lenient validation that allows unknown fields throughout. This enables external tool integration with maximum flexibility while maintaining data integrity for core STM functionality.

**Core Problem**: STM currently has inconsistent validation behavior:
- Task loading: ALLOWS unknown fields (lenient)
- Schema module: REJECTS unknown fields (strict, unused)
- Update command: REJECTS unknown fields (strict, used)

**Solution**: Standardize on lenient validation across all systems.

## Phase 1: Core Validation Changes

### Task 1.1: Update Schema Module Validation Logic
**Description**: Modify schema.ts to allow unknown fields while maintaining core field validation
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 102-121)

**Technical Requirements**:
- Modify `validateFields()` function in `/src/lib/schema.ts`
- Remove unknown field rejection loop (lines 83-91)
- Preserve required field validation
- Maintain type validation for known core STM fields
- Update error messages for clarity

**Core STM Fields to Validate**:
```typescript
const STM_CORE_FIELDS = {
  id: 'number',
  title: 'string', 
  status: 'string',
  schema: 'number',
  created: 'string',
  updated: 'string',
  tags: 'array',
  dependencies: 'array'
} as const;
```

**Implementation Steps**:
1. Read current `validateFields()` function in `/src/lib/schema.ts:83-91`
2. Remove the unknown field rejection loop that throws `SchemaValidationError`
3. Keep required field validation for core STM fields
4. Add type validation for known fields using `STM_CORE_FIELDS` mapping
5. Update error messages to clarify core vs unknown field validation
6. Ensure unknown fields are preserved without validation

**Code Changes Required**:
```typescript
// BEFORE (remove this logic):
for (const field of Object.keys(obj)) {
  if (!allowedFields.has(field)) {
    throw new SchemaValidationError(`Unknown field '${field}'`);
  }
}

// AFTER (replace with):
// Check for required fields only
for (const field of REQUIRED_FIELDS) {
  if (!(field in obj)) {
    throw new SchemaValidationError(`Missing required field: ${field}`);
  }
}

// Validate known field types (optional)
validateKnownFieldTypes(obj);

// Unknown fields are preserved without validation
```

**Acceptance Criteria**:
- [ ] Unknown fields no longer trigger `SchemaValidationError`
- [ ] Required core fields (`id`, `title`, `status`) still validated
- [ ] Type validation maintained for core STM fields
- [ ] Unknown fields preserved in task objects
- [ ] Error messages clarify core field vs unknown field validation
- [ ] All existing schema tests pass (except unknown field rejection tests)
- [ ] Function signature remains unchanged for backward compatibility

### Task 1.2: Update CLI Update Command Field Validation
**Description**: Modify update command to allow arbitrary field names while maintaining basic sanitization
**Size**: Medium  
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 123-141)

**Technical Requirements**:
- Modify `validateFieldName()` function in `/src/commands/update.ts:73-75`
- Remove strict field list validation
- Add basic field name sanitization (no newlines, control characters)
- Preserve field name format validation (no leading/trailing whitespace)
- Update help text and error messages

**Current Strict Validation to Remove**:
```typescript
const validFields = ['title', 'content', 'status', 'tags', 'dependencies', 'description', 'details', 'validation'];
if (!validFields.includes(field)) {
  throw new ValidationError(`Invalid field: ${field}`);
}
```

**Implementation Steps**:
1. Locate `validateFieldName()` function in `/src/commands/update.ts:73-75`
2. Remove the strict `validFields` array check
3. Implement basic field name sanitization:
   - Reject field names containing newlines (`\n`, `\r`)
   - Reject field names with leading/trailing whitespace
   - Allow all other field names
4. Update error messages to be more helpful
5. Update help text to reflect new behavior
6. Ensure CLI assignment syntax (`field=value`) works with any field name

**New Validation Logic**:
```typescript
function validateFieldName(field: string): void {
  if (field.includes('\n') || field.includes('\r')) {
    throw new ValidationError('Field names cannot contain newlines');
  }
  if (field.trim() !== field) {
    throw new ValidationError('Field names cannot have leading/trailing whitespace');
  }
  // All other field names are allowed
}
```

**Acceptance Criteria**:
- [ ] CLI commands like `stm update 1 priority=high` succeed
- [ ] CLI commands like `stm update 1 external_id=JIRA-123` succeed
- [ ] Field names with newlines are rejected with clear error message
- [ ] Field names with leading/trailing whitespace are rejected
- [ ] All other field names are allowed (including dashes, underscores, dots)
- [ ] Help text updated to reflect new validation behavior
- [ ] Error messages are clear and helpful
- [ ] Existing core field updates continue to work

### Task 1.3: Remove Tests Expecting Unknown Field Rejection
**Description**: Update existing tests to remove expectations of unknown field rejection
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None (depends on implementation changes)

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 178-179)

**Technical Requirements**:
- Update `/test/unit/schema.spec.ts` to remove unknown field rejection tests
- Update `/test/unit/commands/update.spec.ts` to remove unknown field rejection tests
- Preserve all other existing test functionality
- Ensure no tests break due to validation changes

**Files to Update**:
1. `/test/unit/schema.spec.ts` - Remove tests expecting `SchemaValidationError` for unknown fields
2. `/test/unit/commands/update.spec.ts` - Remove test: "should reject unknown field names"

**Implementation Steps**:
1. Review existing tests in schema.spec.ts for unknown field rejection
2. Remove or modify tests that expect `SchemaValidationError` for unknown fields
3. Review update command tests for unknown field rejection
4. Remove the test that expects CLI rejection of unknown fields
5. Run test suite to ensure no other tests break
6. Update test descriptions to reflect new behavior

**Specific Test to Remove/Modify**:
```typescript
// In test/unit/commands/update.spec.ts - REMOVE THIS TEST:
it('should reject unknown field names', async () => {
  await expect(executeUpdate('1', ['unknown=value'])).rejects.toThrow('Process.exit(1)');
  expect(mockedPrintError).toHaveBeenCalledWith(
    expect.stringContaining('Unknown field: unknown')
  );
  expect(exitCode).toBe(1);
});
```

**Acceptance Criteria**:
- [ ] All tests expecting unknown field rejection are removed or updated
- [ ] Full test suite passes after validation changes
- [ ] No regression in other test functionality
- [ ] Test descriptions accurately reflect new behavior
- [ ] Core field validation tests remain intact
- [ ] Tests run successfully with `npm test`

## Phase 2: Enhanced Testing and Validation

### Task 2.1: Add Unit Tests for Unknown Field Support
**Description**: Create comprehensive unit tests validating unknown field preservation and core field validation
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2, Task 1.3
**Can run parallel with**: Task 2.2

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 294-341, 344-367)

**Technical Requirements**:
- Add tests for schema validation with unknown fields
- Add tests for update command with unknown fields
- Include edge case testing (nested objects, special characters, data types)
- Add performance tests for high field counts
- Follow project testing philosophy: "When tests fail, fix the code, not the test"

**Test Files to Create/Update**:
1. Add tests to `/test/unit/schema.spec.ts`
2. Add tests to `/test/unit/commands/update.spec.ts`
3. Create new edge case test sections

**Schema Validation Tests to Add**:
```typescript
describe('Schema validation with unknown fields', () => {
  it('should allow tasks with unknown fields', () => {
    const taskData = {
      id: 1, title: 'Test', status: 'pending', schema: 1,
      priority: 'high', custom_metadata: { tool: 'AutoAgent' }
    };
    expect(() => validateTask(taskData)).not.toThrow();
  });

  it('should validate core STM field types strictly', () => {
    const taskData = { id: 'invalid', title: 'Test', status: 'pending', unknown_field: 'allowed' };
    expect(() => validateTask(taskData)).toThrow(SchemaValidationError);
    expect(() => validateTask(taskData)).toThrow('Field \'id\' must be number');
  });

  it('should preserve unknown fields without validation', () => {
    const taskData = {
      id: 1, title: 'Test', status: 'pending', schema: 1,
      complex_unknown: { nested: { data: [1, 2, 3] }, date: '2025-07-19', bool: true }
    };
    expect(() => validateTask(taskData)).not.toThrow();
    const validated = validateAndReturn(taskData);
    expect(validated.complex_unknown).toEqual(taskData.complex_unknown);
  });
});
```

**Update Command Tests to Add**:
```typescript
describe('Update command with unknown fields', () => {
  it('should allow updating unknown fields', async () => {
    const result = await executeUpdate('1', ['priority=high']);
    expect(result.exitCode).toBe(0);
    const task = await taskManager.load(1);
    expect(task.priority).toBe('high');
  });

  it('should reject invalid field names', async () => {
    await expect(executeUpdate('1', ['field\nwith\nnewlines=value']))
      .rejects.toThrow('Field names cannot contain newlines');
  });

  it('should handle complex unknown field values', async () => {
    const result = await executeUpdate('1', ['metadata={"tool":"AutoAgent","version":"1.0"}']);
    expect(result.exitCode).toBe(0);
    const task = await taskManager.load(1);
    expect(task.metadata).toBe('{"tool":"AutoAgent","version":"1.0"}');
  });
});
```

**Edge Case Tests**:
```typescript
describe('Unknown field edge cases', () => {
  it('should handle deeply nested unknown objects', () => {
    const complex = { id: 1, title: 'Test', status: 'pending', deep: { level1: { level2: { level3: 'value' } } } };
    expect(() => validateTask(complex)).not.toThrow();
  });

  it('should handle unknown fields with special characters', () => {
    const special = {
      id: 1, title: 'Test', status: 'pending',
      'field-with-dashes': 'value', 'field_with_underscores': 'value', 'field.with.dots': 'value'
    };
    expect(() => validateTask(special)).not.toThrow();
  });

  it('should handle unknown fields with various data types', () => {
    const types = {
      id: 1, title: 'Test', status: 'pending',
      string_field: 'text', number_field: 42, boolean_field: true, 
      array_field: [1, 2, 3], object_field: { nested: true }, null_field: null
    };
    expect(() => validateTask(types)).not.toThrow();
  });
});
```

**Implementation Steps**:
1. Add schema validation tests to existing schema.spec.ts file
2. Add update command tests to existing update.spec.ts file
3. Create edge case test sections in appropriate test files
4. Add performance test for high field count scenarios
5. Include test documentation comments explaining test purpose
6. Run tests and ensure they can fail (validate they test real behavior)
7. Ensure all tests follow project testing philosophy

**Acceptance Criteria**:
- [ ] Schema validation tests cover unknown field preservation
- [ ] Update command tests cover CLI unknown field operations
- [ ] Edge case tests cover complex scenarios (nested objects, special chars, data types)
- [ ] Performance test validates handling 50+ unknown fields in <100ms
- [ ] All tests include purpose documentation comments
- [ ] Tests are designed to fail when behavior breaks (meaningful tests)
- [ ] Full test suite passes with `npm run test:unit`
- [ ] Tests follow project conventions and patterns

### Task 2.2: Add Integration Tests for Task Lifecycle
**Description**: Create integration tests validating unknown fields through complete task lifecycle
**Size**: Medium
**Priority**: High  
**Dependencies**: Task 1.1, Task 1.2, Task 1.3
**Can run parallel with**: Task 2.1

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 372-413)

**Technical Requirements**:
- Test create → update → load cycles with unknown fields
- Test file-based task loading with unknown fields
- Verify unknown field preservation across all operations
- Test YAML serialization/deserialization of unknown fields

**Integration Test File**:
Create `/test/integration/task-unknown-fields.spec.ts`

**Test Scenarios**:
```typescript
describe('Task lifecycle with unknown fields', () => {
  it('should create, update, and load tasks with unknown fields', async () => {
    // Create task with unknown field
    const task = await taskManager.create({ title: 'Test Task', custom_field: 'custom_value' });
    expect(task.custom_field).toBe('custom_value');

    // Update unknown field
    await taskManager.update(task.id, { custom_field: 'updated_value' });
    
    // Load and verify
    const loaded = await taskManager.load(task.id);
    expect(loaded.custom_field).toBe('updated_value');
  });

  it('should handle file-based task loading with unknown fields', async () => {
    // Create task file with unknown fields manually
    const taskPath = path.join(workspace.tasksDir, 'task-999.md');
    await fs.writeFile(taskPath, `---
id: 999
title: "Manual Task"
status: "pending"
schema: 1
external_tool: "AutoAgent"
priority: "high"
metadata:
  source: "manual"
  version: 2
---
Task content`);

    // Load via task manager
    const task = await taskManager.load(999);
    expect(task.external_tool).toBe('AutoAgent');
    expect(task.priority).toBe('high');
    expect(task.metadata).toEqual({ source: 'manual', version: 2 });
  });
});
```

**Implementation Steps**:
1. Create new integration test file for unknown field scenarios
2. Set up test workspace with proper cleanup
3. Implement task lifecycle tests (create → update → load)
4. Implement file-based loading tests with manual YAML creation
5. Test YAML serialization preserves unknown field types
6. Add test documentation explaining integration scenarios
7. Run integration tests and verify they pass

**Acceptance Criteria**:
- [ ] Unknown fields survive create → update → load cycles
- [ ] File-based loading preserves unknown fields from YAML
- [ ] YAML serialization/deserialization maintains unknown field types
- [ ] Complex unknown objects (nested, arrays) are preserved correctly
- [ ] Integration tests pass with `npm run test:integration`
- [ ] Tests validate real integration scenarios external tools would use
- [ ] Test cleanup properly manages test files and workspace

### Task 2.3: Add E2E Tests for CLI Workflows
**Description**: Create end-to-end tests validating unknown field support through CLI commands
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 1.1, Task 1.2, Task 1.3
**Can run parallel with**: Task 2.1, Task 2.2

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 418-441)

**Technical Requirements**:
- Test complete CLI workflows with unknown fields
- Verify CLI commands (add, update, show, list) work with unknown fields
- Test JSON output includes unknown fields
- Ensure backward compatibility with existing CLI usage

**E2E Test File**:
Create `/test/e2e/cli-unknown-fields.spec.ts`

**Test Scenarios**:
```typescript
describe('CLI with unknown fields', () => {
  it('should support end-to-end workflow with unknown fields', async () => {
    // Create task via CLI
    const createResult = await cli.run(['add', 'Test Task with Custom Field']);
    const taskId = extractTaskId(createResult.output);

    // Add unknown field via CLI
    const updateResult = await cli.run(['update', taskId, 'priority=urgent']);
    expect(updateResult.exitCode).toBe(0);

    // Verify via show command
    const showResult = await cli.run(['show', taskId, '--json']);
    const task = JSON.parse(showResult.output);
    expect(task.priority).toBe('urgent');

    // List should include unknown fields
    const listResult = await cli.run(['list', '--json']);
    const tasks = JSON.parse(listResult.output);
    const foundTask = tasks.find(t => t.id === parseInt(taskId));
    expect(foundTask.priority).toBe('urgent');
  });
});
```

**Implementation Steps**:
1. Create E2E test file using existing CLI test patterns
2. Implement full workflow test (add → update → show → list)
3. Test JSON output preservation of unknown fields
4. Test multiple unknown field assignments in single command
5. Verify error handling for invalid field names
6. Test interaction with existing CLI features
7. Run E2E tests and ensure they pass

**Acceptance Criteria**:
- [ ] CLI update commands accept arbitrary field names
- [ ] CLI show command displays unknown fields
- [ ] CLI list command preserves unknown fields in output
- [ ] JSON output includes all unknown fields correctly
- [ ] Multiple field assignments work in single command
- [ ] Invalid field names (newlines, etc.) produce clear errors
- [ ] E2E tests pass with `npm run test:e2e`
- [ ] Backward compatibility maintained for existing CLI usage

## Phase 3: Documentation and Polish

### Task 3.1: Update Core Documentation
**Description**: Update README, API docs, and help text to reflect unknown field support  
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1, Task 2.2, Task 2.3
**Can run parallel with**: Task 3.2

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 583-624)

**Technical Requirements**:
- Update README.md feature list to include unknown field support
- Update CLI help text for update command
- Update error messages for field validation
- Document API behavior changes

**Files Requiring Updates**:
1. **README.md**: Add unknown field support to feature list
2. **CLI Help**: Update field validation error messages in update command
3. **API Documentation**: Document unknown field behavior (if exists)

**README Updates**:
```markdown
## ✨ Features

- **📝 Markdown-based tasks**: Each task is stored as a readable markdown file
- **🏷️ Flexible tagging system**: Organize tasks with multiple tags
- **🔧 Custom metadata fields**: Add any custom fields for external tool integration
- **🔍 Powerful search**: Find tasks by content, title, tags, or status
```

**CLI Help Updates**:
- Update help text for `stm update` command to mention unknown field support
- Clarify field validation rules in error messages
- Add examples of custom field usage

**Implementation Steps**:
1. Update README.md features section to mention custom metadata support
2. Update CLI help text in update command implementation
3. Review and update error messages for clarity
4. Add examples of unknown field usage to README
5. Update any existing API documentation
6. Review all user-facing text for consistency

**Acceptance Criteria**:
- [ ] README.md mentions custom metadata field support
- [ ] CLI help text reflects new field validation behavior
- [ ] Error messages are clear and helpful for field validation
- [ ] Documentation examples show unknown field usage
- [ ] All user-facing text is consistent with new behavior
- [ ] Documentation is accurate and up-to-date

### Task 3.2: Create Integration Guide for External Tools
**Description**: Create comprehensive guide for external tools to integrate with unknown field support
**Size**: Large
**Priority**: Low
**Dependencies**: Task 2.1, Task 2.2, Task 2.3
**Can run parallel with**: Task 3.1

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 598-624)

**Technical Requirements**:
- Create integration guide for external tools
- Document best practices for field naming
- Provide example integrations (AutoAgent, GitHub Actions)
- Document field naming conventions and recommendations

**New Documentation Files**:
1. Create `docs/integration-guide.md` or add section to existing docs
2. Create example integration files
3. Document field naming conventions

**Integration Guide Content**:
```markdown
## Adding Custom Fields to Tasks

Simple Task Master allows external tools to add custom metadata fields to tasks without modification:

### Example: AutoAgent Integration
```yaml
---
# STM Core Fields
id: 123
title: "Implement login feature"
status: "in-progress"

# AutoAgent Fields
agent_assigned: true
automation_level: "full"
github_issue: 456
priority: "high"
---
```

### Best Practices
- Use descriptive field names: `tool_priority` instead of `priority`
- Namespace complex tools: `autoagent_config` vs `config`
- Document your field schema for team members
```

**Example Integrations**:
- AutoAgent integration example with metadata fields
- GitHub Actions integration example
- Generic external tool integration patterns

**Implementation Steps**:
1. Create integration guide document structure
2. Write AutoAgent integration example with real field usage
3. Create GitHub Actions integration example
4. Document best practices for field naming
5. Add troubleshooting section for common issues
6. Create example task files showing integration patterns
7. Review and edit for clarity and completeness

**Acceptance Criteria**:
- [ ] Integration guide provides clear examples for external tools
- [ ] AutoAgent integration example is realistic and complete
- [ ] Best practices section covers field naming conventions
- [ ] Troubleshooting section addresses common integration issues
- [ ] Examples show real-world usage patterns
- [ ] Documentation is well-organized and easy to follow
- [ ] Guide is accessible to external tool developers

### Task 3.3: Add Performance Monitoring and Limits
**Description**: Implement performance monitoring for unknown fields and add reasonable limits
**Size**: Small
**Priority**: Low
**Dependencies**: Task 2.1, Task 2.2, Task 2.3
**Can run parallel with**: Task 3.1, Task 3.2

**Source**: specs/feat-allow-unknown-frontmatter-fields.md (lines 532-557)

**Technical Requirements**:
- Add performance tests for high unknown field counts
- Implement reasonable limits for field count (e.g., 100 fields)
- Monitor memory usage with many unknown fields
- Ensure existing 1MB task content limit applies to unknown fields

**Performance Considerations**:
- Field count limits: Reasonable limit on total frontmatter fields (e.g., 100)
- Size limits: Maintain existing 1MB limit for total task content
- Performance benchmarks: Handle 50+ unknown fields in <100ms

**Performance Test to Add**:
```typescript
describe('Performance with unknown fields', () => {
  it('should handle tasks with 50+ unknown fields efficiently', async () => {
    const taskWithManyFields = {
      id: 1, title: 'Test', status: 'pending',
      ...Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`]))
    };

    const start = performance.now();
    const task = await taskManager.create(taskWithManyFields);
    const end = performance.now();

    expect(end - start).toBeLessThan(100); // Should complete within 100ms
    expect(Object.keys(task)).toHaveLength(53); // 3 core + 50 unknown
  });
});
```

**Implementation Steps**:
1. Add performance test to `/test/performance/` directory
2. Benchmark task operations with many unknown fields
3. Monitor memory usage with large unknown field sets
4. Consider adding configurable field count limits (optional)
5. Ensure existing size limits apply to total task content
6. Document performance characteristics in integration guide

**Acceptance Criteria**:
- [ ] Performance test validates <100ms operation with 50+ fields
- [ ] Memory usage scales reasonably with unknown field count
- [ ] Existing 1MB task content limit applies to all fields
- [ ] Performance characteristics documented
- [ ] Performance tests pass with `npm run test:performance`
- [ ] No performance regression for normal task operations

## Summary

**Total Tasks**: 11 tasks across 3 phases
**Critical Path**: Phase 1 (Tasks 1.1-1.3) → Phase 2 (Tasks 2.1-2.3) → Phase 3 (Tasks 3.1-3.3)
**Parallel Execution Opportunities**: 
- Phase 1: Tasks 1.1 and 1.2 can run in parallel
- Phase 2: Tasks 2.1, 2.2, and 2.3 can run in parallel after Phase 1
- Phase 3: Tasks 3.1, 3.2, and 3.3 can run in parallel after Phase 2

**Complexity Distribution**:
- Small tasks: 2 (Task 1.3, Task 3.3)
- Medium tasks: 6 (Task 1.1, Task 1.2, Task 2.2, Task 2.3, Task 3.1)
- Large tasks: 3 (Task 2.1, Task 3.2)

**Risk Mitigation**:
- Phase 1 addresses core functionality first to minimize risk
- Comprehensive testing in Phase 2 validates implementation
- Documentation in Phase 3 ensures usability

**Dependencies**:
- All Phase 2 tasks depend on completion of Phase 1
- All Phase 3 tasks depend on completion of Phase 2 testing
- Task 1.3 depends on Tasks 1.1 and 1.2 to avoid test conflicts