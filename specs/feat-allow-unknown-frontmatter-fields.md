# Feature Specification: Allow Unknown Fields in Frontmatter

## Status
Draft

## Authors
Claude Code Assistant  
Date: July 19, 2025

## Overview
Modify Simple Task Master's frontmatter validation to allow unknown fields, providing maximum flexibility for integrations with external tools like AutoAgent while maintaining data integrity for core functionality.

## Background/Problem Statement

Currently, Simple Task Master has **inconsistent behavior** regarding unknown fields in task frontmatter:

1. **Task loading** via `FrontmatterParser.validateTaskData()` **allows** unknown fields
2. **Schema validation** in `/src/lib/schema.ts` **rejects** unknown fields (but is unused)
3. **Update command** **rejects** unknown fields for CLI operations

This inconsistency creates integration challenges:
- External tools (like AutoAgent) cannot add custom metadata fields
- CLI users cannot add custom fields for their workflows
- The system behavior is unpredictable and confusing

### Current Technical State

**Frontmatter Parser (LENIENT - Current Default):**
```typescript
// src/lib/frontmatter-parser.ts:209-276
static validateTaskData(data: unknown): void {
  // Only validates required fields: id, title, status
  // Unknown fields are preserved and passed through
}
```

**Schema Module (STRICT - Unused):**
```typescript
// src/lib/schema.ts:83-91
function validateFields(obj: Record<string, unknown>, allowedFields: Set<string>): void {
  for (const field of Object.keys(obj)) {
    if (!allowedFields.has(field)) {
      throw new SchemaValidationError(`Unknown field '${field}'`);
    }
  }
}
```

## Goals

- **Primary**: Ensure unknown fields are consistently **allowed** throughout the system
- **Flexibility**: Enable external tools to add custom metadata without STM modifications
- **Zero Configuration**: Work out-of-the-box for any integration
- **Future-proof**: Support emerging use cases without code changes
- **Backward Compatibility**: Preserve existing task files and functionality

## Non-Goals

- Validation of unknown field values (tools manage their own data)
- UI/CLI support for managing unknown fields
- Documentation of third-party field conventions
- Schema evolution or migration systems for unknown fields

## Technical Dependencies

### Internal Dependencies
- **Frontmatter Parser**: `/src/lib/frontmatter-parser.ts` - Core validation logic
- **Schema Module**: `/src/lib/schema.ts` - Strict validation (currently unused)
- **Update Command**: `/src/commands/update.ts` - CLI field validation
- **Task Manager**: `/src/lib/task-manager.ts` - Task loading orchestration

### External Libraries
- **js-yaml** (v4.1.0): YAML parsing (already in use)
- **gray-matter** (v4.0.3): Frontmatter extraction (already in use)

### Version Requirements
- Node.js >=18.0.0 (existing requirement)
- No new external dependencies required

## Detailed Design

### Architecture Changes

The system will standardize on **lenient validation** throughout:

```
Current State:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Task Loading    │    │ Schema Module    │    │ Update Command  │
│ (ALLOWS unknown)│    │ (REJECTS unknown)│    │ (REJECTS unknown)│
└─────────────────┘    └──────────────────┘    └─────────────────┘

Target State:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Task Loading    │    │ Schema Module    │    │ Update Command  │
│ (ALLOWS unknown)│    │ (ALLOWS unknown) │    │ (ALLOWS unknown)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Implementation Approach

#### Phase 1: Remove Schema Validation Restrictions

1. **Modify Schema Module** (`/src/lib/schema.ts`):
   ```typescript
   // Remove or comment out unknown field validation
   function validateFields(obj: Record<string, unknown>, allowedFields: Set<string>): void {
     // Check for required fields only
     for (const field of REQUIRED_FIELDS) {
       if (!(field in obj)) {
         throw new SchemaValidationError(`Missing required field: ${field}`);
       }
     }
     
     // Validate known field types (optional)
     validateKnownFieldTypes(obj);
     
     // REMOVED: Unknown field rejection
     // Unknown fields are preserved without validation
   }
   ```

2. **Update Command Field Validation** (`/src/commands/update.ts`):
   ```typescript
   // Current: Strict field list
   const validFields = ['title', 'content', 'status', 'tags', 'dependencies', 'description', 'details', 'validation'];
   
   // New: Allow any field for frontmatter updates
   function validateFieldName(field: string): void {
     // Allow any field name for frontmatter updates
     // STM core fields get type validation, unknown fields pass through
     
     if (field.includes('\n') || field.includes('\r')) {
       throw new ValidationError('Field names cannot contain newlines');
     }
     if (field.trim() !== field) {
       throw new ValidationError('Field names cannot have leading/trailing whitespace');
     }
     // All other field names are allowed
   }
   ```

#### Phase 2: Maintain Data Integrity for Core Fields

While allowing unknown fields, maintain strict validation for STM's core fields:

```typescript
// Known STM fields with type validation
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

function validateTaskData(data: unknown): void {
  // Validate core STM fields strictly
  for (const [field, expectedType] of Object.entries(STM_CORE_FIELDS)) {
    if (field in data && !isValidType(data[field], expectedType)) {
      throw new ValidationError(`Field '${field}' must be ${expectedType}`);
    }
  }
  
  // Unknown fields are preserved without validation
  // External tools are responsible for their field validation
}
```

### Code Structure and File Organization

**Files requiring changes:**
1. `/src/lib/schema.ts` - Remove unknown field rejection
2. `/src/commands/update.ts` - Allow arbitrary field names
3. `/test/unit/schema.spec.ts` - Update validation tests
4. `/test/unit/commands/update.spec.ts` - Remove unknown field rejection tests

**Files unchanged:**
- `/src/lib/frontmatter-parser.ts` - Already allows unknown fields
- `/src/lib/task-manager.ts` - Uses frontmatter parser (inherits behavior)

### API Changes

**Command Line Interface:**
```bash
# Before: ERROR - Unknown field 'priority'
stm update 1 priority=high

# After: SUCCESS - Field allowed and saved
stm update 1 priority=high
stm update 1 assignee=john.doe@company.com
stm update 1 external_id=JIRA-123
```

**Library API (No Changes):**
```typescript
// Existing behavior preserved
const task = await taskManager.create({
  title: 'My Task',
  customField: 'Custom Value'  // Already works
});
```

### Data Model Changes

**Task Object Structure:**
```typescript
// Core STM fields (validated)
interface TaskCore {
  id: number;
  title: string;
  status: string;
  schema: number;
  created: string;
  updated: string;
  tags: string[];
  dependencies: number[];
}

// Full task allows arbitrary additional properties
interface Task extends TaskCore {
  [key: string]: unknown;  // Unknown fields preserved
}
```

**Frontmatter Example:**
```yaml
---
# STM Core Fields (validated)
id: 1
title: "Implement feature X"
status: "in-progress"
schema: 1
created: "2025-07-19T10:00:00Z"
updated: "2025-07-19T10:30:00Z"
tags: ["feature", "urgent"]
dependencies: []

# External Tool Fields (preserved as-is)
priority: "high"
assignee: "john.doe@company.com"
external_id: "JIRA-123"
automation_config:
  auto_close: true
  notify_on_complete: ["team-channel"]
---
```

## User Experience

### CLI Usage
```bash
# Users can add any field via update command
stm update 123 priority=high
stm update 123 assignee="jane.doe@company.com"
stm update 123 external_id=JIRA-456

# View tasks with unknown fields (displayed in output)
stm show 123
# Output includes all fields, both core and unknown

# List tasks (unknown fields preserved but not filtered)
stm list --json  # Shows all fields including unknown ones
```

### Tool Integration
```typescript
// AutoAgent or other tools can freely add metadata
await fs.writeFile('tasks/task-123.md', `---
id: 123
title: "User Story: Login Feature"
status: "in-progress"
# AutoAgent fields
agent_assigned: true
automation_level: "full"
github_issue: 456
---
Task content here...`);

// STM loads and preserves all fields
const task = await taskManager.load(123);
console.log(task.agent_assigned);     // true
console.log(task.automation_level);   // "full"
console.log(task.github_issue);       // 456
```

## Testing Strategy

### Unit Tests

**Schema Validation Tests** (`test/unit/schema.spec.ts`):
```typescript
describe('Schema validation with unknown fields', () => {
  it('should allow tasks with unknown fields', () => {
    const taskData = {
      id: 1,
      title: 'Test',
      status: 'pending',
      schema: 1,
      // Unknown fields
      priority: 'high',
      custom_metadata: { tool: 'AutoAgent' }
    };
    
    expect(() => validateTask(taskData)).not.toThrow();
  });

  it('should validate core STM field types strictly', () => {
    const taskData = {
      id: 'invalid',  // Should be number
      title: 'Test',
      status: 'pending',
      unknown_field: 'allowed'
    };
    
    expect(() => validateTask(taskData)).toThrow(SchemaValidationError);
    expect(() => validateTask(taskData)).toThrow('Field \'id\' must be number');
  });

  it('should preserve unknown fields without validation', () => {
    const taskData = {
      id: 1,
      title: 'Test',
      status: 'pending',
      schema: 1,
      complex_unknown: {
        nested: { data: [1, 2, 3] },
        date: '2025-07-19',
        bool: true
      }
    };
    
    expect(() => validateTask(taskData)).not.toThrow();
    // Verify unknown field is preserved as-is
    const validated = validateAndReturn(taskData);
    expect(validated.complex_unknown).toEqual(taskData.complex_unknown);
  });
});
```

**Update Command Tests** (`test/unit/commands/update.spec.ts`):
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

### Integration Tests

**Task Lifecycle with Unknown Fields** (`test/integration/task-unknown-fields.spec.ts`):
```typescript
describe('Task lifecycle with unknown fields', () => {
  it('should create, update, and load tasks with unknown fields', async () => {
    // Create task with unknown field
    const task = await taskManager.create({
      title: 'Test Task',
      custom_field: 'custom_value'
    });
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

### E2E Tests

**CLI Workflow Tests** (`test/e2e/cli-unknown-fields.spec.ts`):
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

### Test Documentation

Each test includes purpose comments explaining validation behavior:

```typescript
/**
 * Tests that unknown fields are preserved throughout the task lifecycle.
 * 
 * Why this test exists:
 * - Validates external tools can add metadata that survives STM operations
 * - Ensures unknown fields don't break core STM functionality
 * - Verifies data integrity for integration scenarios
 * 
 * What this test validates:
 * - Unknown fields survive create/update/load cycles
 * - Core STM fields maintain strict validation
 * - YAML serialization/deserialization preserves unknown field types
 */
it('should preserve unknown fields through task lifecycle', async () => {
  // Test implementation
});
```

### Meaningful Test Design

Tests are designed to **fail when behavior breaks**:

```typescript
// Good: Tests actual functionality - can fail if unknown fields are rejected
it('should allow unknown fields in frontmatter', () => {
  const taskWithUnknown = { id: 1, title: 'Test', status: 'pending', custom: 'value' };
  expect(() => validateTask(taskWithUnknown)).not.toThrow();
});

// Avoid: Test that always passes regardless of behavior
it('should have a validateTask function', () => {
  expect(typeof validateTask).toBe('function');  // Always true
});
```

### Edge Case Testing

Tests include scenarios that reveal implementation quality:

```typescript
describe('Unknown field edge cases', () => {
  it('should handle deeply nested unknown objects', () => {
    const complex = {
      id: 1, title: 'Test', status: 'pending',
      deep: { level1: { level2: { level3: 'value' } } }
    };
    expect(() => validateTask(complex)).not.toThrow();
  });

  it('should handle unknown fields with special characters', () => {
    const special = {
      id: 1, title: 'Test', status: 'pending',
      'field-with-dashes': 'value',
      'field_with_underscores': 'value',
      'field.with.dots': 'value'
    };
    expect(() => validateTask(special)).not.toThrow();
  });

  it('should handle unknown fields with various data types', () => {
    const types = {
      id: 1, title: 'Test', status: 'pending',
      string_field: 'text',
      number_field: 42,
      boolean_field: true,
      array_field: [1, 2, 3],
      object_field: { nested: true },
      null_field: null,
      undefined_field: undefined
    };
    expect(() => validateTask(types)).not.toThrow();
  });
});
```

## Performance Considerations

### Impact Analysis
- **Minimal performance impact**: Removes validation logic rather than adding it
- **Memory usage**: Slightly higher (unknown fields stored in task objects)
- **Disk I/O**: No change (frontmatter serialization unchanged)
- **Parsing time**: Marginally faster (less validation)

### Mitigation Strategies
- **Field count limits**: Reasonable limit on total frontmatter fields (e.g., 100)
- **Size limits**: Maintain existing 1MB limit for total task content
- **Type preservation**: Use efficient YAML serialization for unknown field types

### Benchmarks
```typescript
// Performance test for tasks with many unknown fields
describe('Performance with unknown fields', () => {
  it('should handle tasks with 50+ unknown fields efficiently', async () => {
    const taskWithManyFields = {
      id: 1, title: 'Test', status: 'pending',
      ...Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`])
      )
    };

    const start = performance.now();
    const task = await taskManager.create(taskWithManyFields);
    const end = performance.now();

    expect(end - start).toBeLessThan(100); // Should complete within 100ms
    expect(Object.keys(task)).toHaveLength(53); // 3 core + 50 unknown
  });
});
```

## Security Considerations

### Input Validation
- **Core STM fields**: Maintain strict type and format validation
- **Unknown fields**: No validation - external tools responsible
- **Field names**: Basic sanitization (no newlines, control characters)
- **Size limits**: Apply existing 1MB task content limit to all fields

### Potential Risks
1. **Data injection**: Unknown fields could contain malicious data
2. **Storage bloat**: External tools could add excessive metadata
3. **Type confusion**: Unknown fields might conflict with future STM fields

### Safeguards
- **No code execution**: STM never executes unknown field values
- **YAML safety**: Use `yaml.load()` with safe schema (already implemented)
- **Content limits**: Existing 1MB limit applies to total task content
- **Namespace recommendation**: Document field naming conventions for tools

### Data Protection
- **Local-only**: Unknown fields stored locally like core fields
- **No transmission**: STM doesn't send unknown fields to external services
- **Access control**: Standard filesystem permissions apply

## Documentation

### Files Requiring Updates
1. **README.md**: Add unknown field support to feature list
2. **API Documentation**: Document unknown field behavior
3. **Integration Guide**: Add section for external tools
4. **CLI Help**: Update field validation error messages

### New Documentation
1. **Integration Guidelines**: Best practices for external tools
2. **Field Naming Conventions**: Recommended namespacing
3. **Migration Guide**: For users with custom validation scripts

### Documentation Examples

**Integration Guide Section:**
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

## Implementation Phases

### Phase 1: Core Validation Changes (Week 1)
**Goal**: Remove unknown field rejection from core validation

**Tasks**:
1. **Update Schema Module**
   - Modify `validateFields()` to allow unknown fields
   - Maintain strict validation for core STM fields
   - Update error messages for clarity

2. **Update Command Changes**
   - Allow arbitrary field names in update command
   - Add basic field name sanitization
   - Update help text and error messages

3. **Test Updates**
   - Remove tests expecting unknown field rejection
   - Add tests for unknown field preservation
   - Update custom matchers if needed

**Deliverable**: All validation consistently allows unknown fields

### Phase 2: Enhanced Testing and Documentation (Week 2)
**Goal**: Comprehensive test coverage and user documentation

**Tasks**:
1. **Comprehensive Testing**
   - Add integration tests for unknown field workflows
   - Add E2E tests for CLI unknown field operations
   - Add performance tests with many unknown fields

2. **Documentation Updates**
   - Update README and API docs
   - Create integration guide for external tools
   - Add field naming convention recommendations

3. **Error Message Improvements**
   - Clarify core field validation errors
   - Add helpful messages for field name issues
   - Update CLI help text

**Deliverable**: Production-ready feature with full documentation

### Phase 3: Integration Examples and Polish (Week 3)
**Goal**: Real-world integration examples and edge case handling

**Tasks**:
1. **Integration Examples**
   - Create example integrations (AutoAgent, GitHub Actions)
   - Add sample task files with unknown fields
   - Document common field patterns

2. **Edge Case Handling**
   - Handle deeply nested unknown objects
   - Test with various YAML data types
   - Validate memory usage with large unknown field sets

3. **Performance Optimization**
   - Benchmark unknown field performance
   - Optimize YAML serialization if needed
   - Add configurable limits if necessary

**Deliverable**: Robust feature ready for external tool integration

## Open Questions

1. **Field Naming Conventions**: Should STM recommend/enforce namespacing?
   - **Options**: Document conventions vs. enforce prefixes vs. no guidance
   - **Recommendation**: Document conventions only (non-breaking)

2. **Future Core Fields**: How to handle conflicts with future STM fields?
   - **Options**: Reserved field list vs. semantic versioning vs. namespacing
   - **Recommendation**: Document reserved prefixes (e.g., `stm_*`)

3. **Validation Hooks**: Should external tools be able to register validation?
   - **Scope**: Out of scope for this feature
   - **Future**: Consider plugin system in later releases

4. **Field Limits**: Should there be limits on unknown field count/size?
   - **Current**: Existing 1MB task content limit applies
   - **Future**: Monitor usage and add limits if needed

## References

### Related Issues and PRs
- **Issue**: External tool integration requirements
- **Discussion**: Frontmatter validation consistency
- **Background**: AutoAgent integration challenges

### Existing Codebase References
- `/src/lib/frontmatter-parser.ts`: Current lenient validation
- `/src/lib/schema.ts`: Strict validation (unused)
- `/src/commands/update.ts`: CLI field validation
- `/test/unit/`: Existing validation test patterns

### External Documentation
- **YAML Specification**: https://yaml.org/spec/1.2/spec.html
- **Gray Matter**: https://github.com/jonschlinkert/gray-matter
- **js-yaml Safety**: https://github.com/nodeca/js-yaml#safe-load

### Design Patterns
- **Frontmatter Best Practices**: Jekyll, Hugo, and other static site generators
- **Extensible Configuration**: VS Code settings, Prettier config patterns
- **Schema Evolution**: Database migration patterns for additive changes