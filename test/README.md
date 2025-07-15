# Simple Task Master - Test Infrastructure

This directory contains a comprehensive test infrastructure for Simple Task Master, designed to support unit, integration, and end-to-end testing with high coverage standards and robust testing utilities.

## Directory Structure

```
test/
├── unit/                     # Unit tests for individual components
│   ├── task-manager.spec.ts  # Example comprehensive unit test
│   └── lock-manager.spec.ts  # Existing lock manager tests
├── integration/              # Integration tests for component interactions
├── e2e/                      # End-to-end CLI workflow tests
├── fixtures/                 # Test data and mock files
│   ├── sample-tasks.json     # Sample task data
│   ├── task-files/          # Sample task markdown files
│   ├── configurations/      # Test configuration files
│   ├── invalid/             # Corrupted files for error testing
│   ├── scenarios/           # Test scenario definitions
│   └── fixtures.ts          # Fixture management utilities
├── helpers/                  # Test utilities and infrastructure
│   ├── assertions/          # Custom vitest matchers
│   ├── builders/            # Test data builders
│   ├── mocks/               # Mock implementations
│   ├── test-workspace.ts    # Isolated test environment
│   ├── cli-runner.ts        # CLI testing utilities
│   ├── temp-utils.ts        # Temporary directory management
│   └── index.ts             # Unified exports
├── setup.ts                 # Global test setup and utilities
└── README.md                # This documentation
```

## Test Configurations

### Main Configuration (`vitest.config.ts`)

- Enhanced coverage thresholds (90% lines, 85% functions, 80% branches)
- Global test setup with custom matchers
- Path aliases for easy imports

### Specialized Configurations

- **Unit Tests** (`vitest.config.unit.ts`) - Highest coverage requirements (95% lines)
- **Integration Tests** (`vitest.config.integration.ts`) - Moderate timeouts and coverage
- **E2E Tests** (`vitest.config.e2e.ts`) - Sequential execution, extended timeouts

## Key Testing Utilities

### TestWorkspace Class

Provides isolated test environments with:

- Temporary directory management
- STM initialization
- Task operations (create, read, update, delete)
- CLI command execution
- File system utilities

```typescript
import { TestWorkspace } from '@test/helpers';

const workspace = await TestWorkspace.create();
const task = await workspace.addTask({ title: 'Test Task' });
await workspace.cleanup();
```

### Custom Matchers

Enhanced assertions for task testing:

- `toBeValidTask()` - Validates task structure
- `toHaveTaskCount(n)` - Checks array task count
- `toHaveStatus(status)` - Validates task status
- `toHaveTags(...tags)` - Checks tag presence
- `toMatchTaskPartially(partial)` - Partial task matching

```typescript
expect(task).toBeValidTask();
expect(task).toHaveStatus('pending');
expect(taskList).toHaveTaskCount(5);
```

### Task Builders

Fluent API for creating test tasks:

- `TaskBuilder` - Flexible task construction
- `TaskFactory` - Common task patterns

```typescript
import { TaskBuilder, TaskFactory } from '@test/helpers';

const task = TaskBuilder.create()
  .withTitle('Test Task')
  .withTags('test', 'example')
  .inProgress()
  .build();

const simpleTasks = TaskFactory.createMultiple(10);
```

### Mock Implementations

- `MockFileSystem` - In-memory file operations
- `MockTaskStore` - In-memory task storage
- Supports all file system operations without actual I/O

```typescript
import { MockFileSystem, MockTaskStore } from '@test/helpers';

const mockFs = new MockFileSystem();
const mockStore = new MockTaskStore();
```

### CLI Testing

Comprehensive CLI testing utilities:

- `runSTM()` - Execute STM commands
- `CLITestRunner` - Advanced CLI testing
- Command result validation
- Timeout and error handling

```typescript
import { runSTM, CLITestRunner } from '@test/helpers';

const result = await runSTM(['add', 'New Task']);
const runner = new CLITestRunner({ cwd: workspace.directory });
```

### Test Fixtures

Pre-built test data and scenarios:

- Sample tasks with various states
- Configuration files
- Invalid data for error testing
- Performance test datasets

```typescript
import { TestFixtures } from '@test/helpers';

const sampleTasks = await TestFixtures.loadSampleTasks();
const largeDataset = TestFixtures.createPerformanceTestTasks(1000);
```

## Testing Patterns

### Unit Testing

Focus on individual component testing with mocks:

```typescript
describe('TaskManager', () => {
  let workspace: TestWorkspace;
  let taskManager: TaskManager;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
    taskManager = new TaskManager({
      tasksDir: workspace.tasksDirectory
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('should create valid tasks', async () => {
    const task = await taskManager.create({ title: 'Test' });
    expect(task).toBeValidTask();
  });
});
```

### Integration Testing

Test component interactions in realistic environments:

```typescript
describe('Task Workflow Integration', () => {
  it('should handle complete task lifecycle', async () => {
    await testIsolation.inTempDir(async (tempDir) => {
      const workspace = await TestWorkspace.create();
      // Test full workflow
    });
  });
});
```

### E2E Testing

Test complete CLI workflows:

```typescript
describe('CLI Workflows', () => {
  it('should complete task management workflow', async () => {
    const runner = new CLITestRunner();
    await runner.init();
    const { taskId } = await runner.addTask('New Task');
    await runner.updateTask(taskId, { status: 'done' });
  });
});
```

## Coverage Requirements

- **Unit Tests**: 95% lines, 90% functions, 85% branches
- **Integration Tests**: 85% lines, 80% functions, 75% branches
- **Overall Project**: 90% lines, 85% functions, 80% branches

## Running Tests

```bash
# All tests
npm test

# By type
npm run test:unit
npm run test:integration
npm run test:e2e

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Environment Setup

The test infrastructure automatically:

- Creates isolated temporary directories
- Sets up STM configurations
- Manages cleanup and teardown
- Provides debugging utilities
- Handles concurrent test execution

## Best Practices

1. **Isolation**: Each test runs in its own temporary directory
2. **Cleanup**: Automatic cleanup of resources
3. **Mocking**: Use mocks for external dependencies
4. **Builders**: Use builders for test data creation
5. **Matchers**: Use custom matchers for domain-specific assertions
6. **Fixtures**: Leverage fixtures for common test scenarios

## Debugging

Enable debugging output:

```bash
DEBUG=true npm test
SHOW_WARNINGS=true npm test
```

The test infrastructure provides comprehensive utilities for testing all aspects of Simple Task Master, ensuring high code quality and reliability through systematic testing approaches.
