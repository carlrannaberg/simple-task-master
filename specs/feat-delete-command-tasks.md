# Task Breakdown: Delete Command Implementation
Generated: 2025-01-20
Source: specs/feat-delete-command.md

## Overview

Implementing a `delete` command for Simple Task Master to complete the CRUD operations. The feature adds the ability to remove tasks via CLI while ensuring task dependency integrity and providing safety mechanisms.

## Phase 1: Foundation

### Task 1.1: Create delete command file structure
**Description**: Set up the basic command file and integrate it into the CLI
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None

**Technical Requirements**:
- Create `src/commands/delete.ts` file
- Import required dependencies from existing modules
- Define `DeleteOptions` interface with `force?: boolean`
- Create command structure using Commander.js pattern

**Implementation Steps**:
1. Create new file `src/commands/delete.ts`
2. Import: `Command` from 'commander', TaskManager, Workspace, error classes, output utilities
3. Define interface for command options
4. Create placeholder command function
5. Export Command instance following existing patterns

**Acceptance Criteria**:
- [ ] File `src/commands/delete.ts` exists with proper imports
- [ ] DeleteOptions interface defined
- [ ] Basic command structure matches existing commands
- [ ] TypeScript compilation passes

### Task 1.2: Register delete command in CLI
**Description**: Add the delete command to the main CLI program
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- Import deleteCommand in `src/cli.ts`
- Add command to program chain after exportCommand
- Maintain alphabetical ordering in imports

**Implementation Steps**:
1. Open `src/cli.ts`
2. Add import: `import { deleteCommand } from './commands/delete';`
3. Add `.addCommand(deleteCommand)` after `.addCommand(exportCommand)`
4. Verify command registration order

**Acceptance Criteria**:
- [ ] Delete command imported in cli.ts
- [ ] Command registered in correct position
- [ ] `stm delete --help` shows command help
- [ ] No TypeScript errors

## Phase 2: Core Implementation

### Task 2.1: Implement basic delete functionality
**Description**: Implement the core delete command that removes tasks without dependency checking
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: Task 2.2

**Technical Requirements**:
- Implement `deleteCommand` function with proper error handling
- Use existing TaskManager.delete() method
- Handle NotFoundError, FileSystemError, ValidationError
- Print success message with task title and ID
- Set proper exit codes (3 for NotFoundError, 1 for others)

**Implementation from spec**:
```typescript
export async function deleteCommand(id: string, options: DeleteOptions): Promise<void> {
  try {
    const workspace = new Workspace(process.cwd());
    await workspace.validate();
    
    const taskManager = new TaskManager(workspace.rootDir);
    
    // Get task to show title in confirmation and verify existence
    const task = await taskManager.get(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    
    // Perform deletion
    await taskManager.delete(id);
    printSuccess(`Deleted task: ${task.title} (${task.id})`);
    
  } catch (error) {
    if (error instanceof ValidationError || 
        error instanceof FileSystemError || 
        error instanceof NotFoundError) {
      printError(error.message);
      process.exit(error instanceof NotFoundError ? 3 : 1);
    }
    throw error;
  }
}
```

**Acceptance Criteria**:
- [ ] Can delete existing tasks successfully
- [ ] Shows task title in success message
- [ ] Handles task not found with exit code 3
- [ ] Handles filesystem errors with exit code 1
- [ ] Task file removed from filesystem

### Task 2.2: Configure Commander.js command definition
**Description**: Set up the command definition with proper arguments and options
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.1

**Technical Requirements**:
- Define command with name 'delete'
- Add description: 'Delete a task permanently'
- Add required argument '<id>' with description 'Task ID to delete'
- Add option '-f, --force' with description
- Connect to action handler

**Implementation from spec**:
```typescript
export const deleteCommand = new Command('delete')
  .description('Delete a task permanently')
  .argument('<id>', 'Task ID to delete')
  .option('-f, --force', 'Force deletion even if other tasks depend on it')
  .action(deleteCommand);
```

**Acceptance Criteria**:
- [ ] Command name is 'delete'
- [ ] Help text shows proper description
- [ ] ID argument is required
- [ ] Force option available with -f and --force
- [ ] Command executes deleteCommand function

### Task 2.3: Implement dependency validation
**Description**: Add validation to prevent deleting tasks that others depend on
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.1

**Technical Requirements**:
- Implement `validateNoDependents` function
- Check both `dependencies` array and `depends_on` field (unknown fields)
- Support integer and string task ID formats
- Throw ValidationError with list of dependent tasks
- Skip validation when --force flag is used

**Implementation from spec**:
```typescript
async function validateNoDependents(taskManager: TaskManager, taskId: string): Promise<void> {
  const allTasks = await taskManager.list();
  const dependents = allTasks.filter(task => 
    task.dependencies?.includes(parseInt(taskId)) ||
    (task as any).depends_on?.includes(taskId) // Handle unknown fields
  );
  
  if (dependents.length > 0) {
    const dependentTitles = dependents.map(t => `${t.id}: ${t.title}`).join(', ');
    throw new ValidationError(
      `Cannot delete task: ${dependents.length} task(s) depend on it (${dependentTitles}). Use --force to delete anyway.`
    );
  }
}
```

**Acceptance Criteria**:
- [ ] Detects dependencies in standard `dependencies` field
- [ ] Detects dependencies in unknown `depends_on` field
- [ ] Shows count and list of dependent tasks
- [ ] Validation skipped with --force flag
- [ ] Clear error message with force option hint

## Phase 3: Testing

### Task 3.1: Create unit tests for delete command
**Description**: Implement comprehensive unit tests with mocking
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1, Task 2.3
**Can run parallel with**: Task 2.3

**Test File**: `test/unit/commands/delete.spec.ts`

**Test Coverage Requirements**:
- Successful deletion with no dependencies
- Force deletion with dependencies
- Task not found error (exit code 3)
- Dependency validation error (exit code 1)
- Filesystem error handling
- Unknown field dependency detection

**Key Test Cases from spec**:
1. Delete existing task without dependencies
2. Delete with force flag bypasses validation
3. Handle nonexistent task with proper error
4. Prevent deletion when dependencies exist
5. Handle filesystem errors gracefully
6. Detect dependencies in both field types

**Acceptance Criteria**:
- [ ] All test cases implemented with purpose comments
- [ ] Proper mocking of TaskManager and Workspace
- [ ] Exit codes verified for each error type
- [ ] Success and error messages validated
- [ ] 95%+ code coverage for delete command

### Task 3.2: Create integration tests
**Description**: Test delete functionality with real file system operations
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.3
**Can run parallel with**: Task 3.3

**Test File**: `test/integration/delete-integration.spec.ts`

**Test Scenarios**:
- Delete task and verify file removal
- Dependency relationship validation
- Delete order (child before parent)
- Real TaskManager interaction

**Key Implementation from spec**:
- Use TestWorkspace for isolated testing
- Verify actual file deletion
- Test real dependency relationships
- Confirm TaskManager state after deletion

**Acceptance Criteria**:
- [ ] Tests use real filesystem via TestWorkspace
- [ ] File removal verified after deletion
- [ ] Dependency validation tested end-to-end
- [ ] No test artifacts left after cleanup
- [ ] Tests can fail to reveal real issues

### Task 3.3: Create end-to-end CLI tests
**Description**: Test complete CLI workflows from command line interface
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.3
**Can run parallel with**: Task 3.2

**Test File**: `test/e2e/delete-e2e.spec.ts`

**Test Workflows**:
- Create task → Delete task → Verify removal
- Create parent/child → Try delete parent → Force delete
- Delete nonexistent task → Verify error
- Help command output verification

**Key Implementation**:
- Use CLITestRunner for command execution
- Verify exit codes match specification
- Test both stdout and stderr output
- Complete user workflows

**Acceptance Criteria**:
- [ ] Full CLI workflow tests implemented
- [ ] Exit codes match specification
- [ ] Error messages match expected format
- [ ] Force flag functionality verified
- [ ] Help text displays correctly

## Phase 4: Documentation and Polish

### Task 4.1: Update README with delete command
**Description**: Add delete command documentation to README.md
**Size**: Small
**Priority**: Medium
**Dependencies**: All Phase 2 and 3 tasks
**Can run parallel with**: Task 4.2

**Documentation Requirements**:
- Add to CLI commands section
- Include basic usage example
- Include force flag example
- Add warning about permanent deletion
- Note about dependency validation

**README Addition**:
```markdown
### Delete Tasks

```bash
# Delete a task
stm delete 123

# Force delete (bypass dependency checks)  
stm delete 123 --force
```

**Note**: Deletion is permanent. Tasks that depend on the deleted task may become invalid unless `--force` is used.
```

**Acceptance Criteria**:
- [ ] Delete command documented in README
- [ ] Examples show both normal and force usage
- [ ] Warning about permanence included
- [ ] Dependency note included
- [ ] Formatting consistent with other commands

### Task 4.2: Run comprehensive validation
**Description**: Execute all quality checks and fix any issues
**Size**: Small
**Priority**: High
**Dependencies**: All implementation and test tasks
**Can run parallel with**: Task 4.1

**Validation Steps**:
1. Run `npm run lint` and fix any issues
2. Run `npm run typecheck` and fix any errors
3. Run `npm test` and ensure all pass
4. Run `npm run test:coverage` and verify thresholds
5. Build project with `npm run build`
6. Test built binary locally

**Acceptance Criteria**:
- [ ] All linting rules pass
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Binary builds successfully
- [ ] Manual testing confirms functionality

## Summary

### Task Count by Phase
- Phase 1 (Foundation): 2 tasks
- Phase 2 (Core Implementation): 3 tasks  
- Phase 3 (Testing): 3 tasks
- Phase 4 (Documentation): 2 tasks
- **Total**: 10 tasks

### Execution Strategy
1. **Sequential Requirements**: Phase 1 → Phase 2 → Phase 3/4
2. **Parallel Opportunities**: 
   - Task 2.1 and 2.2 can run in parallel
   - Task 2.3 and 3.1 can run in parallel
   - All Phase 3 tests can run in parallel
   - Phase 4 tasks can run in parallel

### Critical Path
1. Task 1.1 → Task 1.2 → Task 2.1 → Task 3.1 → Task 4.2

### Risk Mitigation
- Dependency validation is most complex component
- Force flag provides escape hatch for edge cases
- Comprehensive test coverage ensures reliability
- Following existing patterns reduces implementation risk