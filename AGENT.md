# AGENT.md
This file provides guidance to AI coding assistants working in this repository.

**Note:** CLAUDE.md, .clinerules, .cursorrules, and other AI config files are symlinks to AGENT.md in this project.

# Simple Task Master (STM)

Simple Task Master is a sophisticated command-line task management tool built in TypeScript that stores tasks as markdown files with YAML frontmatter. This approach makes tasks both human-readable and version control-friendly, targeting developers who prefer markdown-based workflows.

## Build & Commands

### Core Development Commands
```bash
# Build pipeline
npm run build          # TypeScript compilation + binary permissions
npm run clean          # Clean dist and coverage directories
npm run dev            # Development mode with ts-node
npm run typecheck      # TypeScript type checking

# Code quality
npm run lint           # ESLint code analysis
npm run lint:fix       # Auto-fix linting issues
npm run format         # Prettier code formatting
npm run format:check   # Check code formatting compliance

# Testing
npm test               # Run all tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e       # End-to-end tests only
npm run test:performance # Performance benchmarks
npm run test:watch     # Watch mode for development
npm run test:coverage  # Coverage reporting

# Single test execution
npm test -- test/unit/specific-test.spec.ts
npm run test:unit -- --grep "specific test name"
npm run test:e2e -- test/e2e/specific-e2e.spec.ts
```

### Binary Usage
```bash
# Global installation
npm install -g .
stm --help

# Local development
npm run dev -- --help
node bin/stm --help
```

## Code Style

### TypeScript Configuration
- **Strict mode**: Full TypeScript strictness enabled
- **ES2022 target**: Modern JavaScript features
- **Path mapping**: Use `@lib/*`, `@test/*`, `@commands/*` aliases
- **Explicit return types**: Required for all functions
- **No `any` types**: Use proper typing or `unknown`

### Import Conventions
```typescript
// External imports first
import { Command } from 'commander';
import * as fs from 'fs/promises';

// Internal imports with path mapping
import { TaskManager } from '@lib/task-manager';
import { ValidationError } from '@lib/errors';
import type { Task, TaskStatus } from '@lib/types';

// Type-only imports should be explicit
import type { TaskInput } from '@lib/types';
```

### Naming Conventions
- **Files**: kebab-case (`task-manager.ts`, `lock-manager.ts`)
- **Classes**: PascalCase (`TaskManager`, `LockManager`)
- **Functions**: camelCase (`createTask`, `validateInput`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_TITLE_LENGTH`)
- **Interfaces**: PascalCase (`Task`, `TaskInput`)
- **Types**: PascalCase (`TaskStatus`, `OutputFormat`)

### Error Handling Patterns
```typescript
// Use custom error classes
import { ValidationError, NotFoundError } from '@lib/errors';

// Throw specific errors
if (!title.trim()) {
  throw new ValidationError('Title cannot be empty');
}

// Handle async errors properly
try {
  const task = await taskManager.create(input);
  return task;
} catch (error) {
  if (error instanceof ValidationError) {
    printError(error.message);
    process.exit(1);
  }
  throw error; // Re-throw unexpected errors
}
```

### Code Formatting
- **Line length**: 100 characters maximum
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Only for multiline objects/arrays

## Testing

### Framework: Vitest
The project uses Vitest with a sophisticated three-tier testing approach:

1. **Unit Tests** (`test/unit/`): Individual function/class testing
2. **Integration Tests** (`test/integration/`): Component interaction testing
3. **E2E Tests** (`test/e2e/`): Full CLI workflow testing
4. **Performance Tests** (`test/performance/`): Benchmarking and performance validation

### Test File Patterns
- Unit tests: `test/unit/**/*.spec.ts`
- Integration tests: `test/integration/**/*.spec.ts`
- E2E tests: `test/e2e/**/*.spec.ts`
- Performance tests: `test/performance/**/*.spec.ts`

### Test Conventions
```typescript
// Use descriptive test names
describe('TaskManager', () => {
  describe('create', () => {
    it('should create a task with valid input', async () => {
      // Test implementation
    });
    
    it('should throw ValidationError for empty title', async () => {
      await expect(taskManager.create({ title: '' }))
        .rejects.toThrow(ValidationError);
    });
  });
});

// Use custom matchers
expect(task).toBeValidTask();
expect(task).toHaveStatus('pending');
expect(task).toHaveValidTimestamps();

// Use test builders for complex objects
const task = new TaskBuilder()
  .withTitle('Test Task')
  .withStatus('in-progress')
  .withTags(['urgent', 'bug'])
  .build();
```

### Test Utilities
- **Custom matchers**: `toBeValidTask()`, `toHaveStatus()`, `toHaveValidTimestamps()`
- **Test builders**: `TaskBuilder` for fluent test data creation
- **Test workspace**: `TestWorkspace` for isolated filesystem testing
- **CLI runner**: `CLITestRunner` for E2E command testing

### Testing Philosophy
**When tests fail, fix the code, not the test.**

Key principles:
- **Tests should be meaningful** - Avoid tests that always pass regardless of behavior
- **Test actual functionality** - Call the functions being tested, don't just check side effects
- **Failing tests are valuable** - They reveal bugs or missing features
- **Fix the root cause** - When a test fails, fix the underlying issue, don't hide the test
- **Test edge cases** - Tests that reveal limitations help improve the code
- **Document test purpose** - Each test should include a comment explaining why it exists and what it validates

### Coverage Requirements
- **Unit tests**: 95% coverage threshold
- **Integration tests**: 85% coverage threshold
- **E2E tests**: Coverage disabled (focuses on workflow validation)

## Security

### Input Validation
- **Title validation**: Max 500 characters, no control characters
- **Content validation**: Max 1MB, safe encoding
- **Path validation**: Prevent directory traversal attacks
- **Command injection**: All user inputs are sanitized

### File System Safety
- **Atomic operations**: Use `write-file-atomic` for data integrity
- **File locking**: Prevent concurrent access corruption
- **Path sanitization**: Safe filename generation with `slugify`
- **Size limits**: Prevent oversized files from causing issues

### Data Protection
- **Local-only**: No remote connections, all data stays local
- **No sensitive data**: Tasks are stored in plain text markdown
- **Minimal dependencies**: Reduced attack surface
- **Input sanitization**: All user inputs validated and sanitized

## Directory Structure & File Organization

### Source Code Organization
```
src/
├── cli.ts                 # CLI entry point with error handling
├── index.ts               # Library API exports
├── commands/              # Command implementations
│   ├── add.ts            # Task creation
│   ├── list.ts           # Task listing and filtering
│   ├── show.ts           # Task display
│   ├── update.ts         # Task modification
│   ├── grep.ts           # Task searching
│   └── export.ts         # Data export
├── lib/                   # Core library code
│   ├── task-manager.ts   # Central task operations
│   ├── lock-manager.ts   # File locking for concurrency
│   ├── frontmatter-parser.ts # YAML frontmatter processing
│   ├── markdown-sections.ts # Markdown content manipulation
│   ├── workspace.ts      # Workspace discovery and management
│   ├── output.ts         # Output formatting (JSON, table, CSV)
│   ├── schema.ts         # Data validation
│   ├── types.ts          # TypeScript type definitions
│   ├── errors.ts         # Error handling classes
│   ├── constants.ts      # Application constants
│   └── utils.ts          # Utility functions
└── types/                 # Type definitions
    └── index.ts          # Exported types
```

### Test Architecture
```
test/
├── unit/                  # Unit tests
├── integration/          # Integration tests
├── e2e/                  # End-to-end tests
├── performance/          # Performance tests
├── fixtures/             # Test data and scenarios
├── helpers/              # Test utilities and builders
└── setup.ts              # Global test configuration
```

### Reports Directory
ALL project reports and documentation should be saved to the `reports/` directory:

```
reports/                   # All project reports and documentation
├── README.md             # Report directory documentation
├── PHASE_*.md            # Phase validation reports
├── IMPLEMENTATION_*.md   # Implementation summaries
├── FEATURE_*.md          # Feature completion reports
├── TEST_RESULTS_*.md     # Test execution results
├── COVERAGE_*.md         # Coverage analysis
├── PERFORMANCE_*.md      # Performance benchmarks
└── SECURITY_*.md         # Security analysis
```

### Report Generation Guidelines
**Important**: ALL reports should be saved to the `reports/` directory with descriptive names:

**Implementation Reports:**
- Phase validation: `PHASE_X_VALIDATION_REPORT.md`
- Implementation summaries: `IMPLEMENTATION_SUMMARY_[FEATURE].md`
- Feature completion: `FEATURE_[NAME]_REPORT.md`

**Testing & Analysis Reports:**
- Test results: `TEST_RESULTS_[DATE].md`
- Coverage reports: `COVERAGE_REPORT_[DATE].md`
- Performance analysis: `PERFORMANCE_ANALYSIS_[SCENARIO].md`
- Security scans: `SECURITY_SCAN_[DATE].md`

**Quality & Validation:**
- Code quality: `CODE_QUALITY_REPORT.md`
- Dependency analysis: `DEPENDENCY_REPORT.md`
- API compatibility: `API_COMPATIBILITY_REPORT.md`

**Report Naming Conventions:**
- Use descriptive names: `[TYPE]_[SCOPE]_[DATE].md`
- Include dates: `YYYY-MM-DD` format
- Group with prefixes: `TEST_`, `PERFORMANCE_`, `SECURITY_`
- Markdown format: All reports end in `.md`

### Temporary Files & Debugging
All temporary files, debugging scripts, and test artifacts should be organized in a `/temp` folder:

**Temporary File Organization:**
- **Debug scripts**: `temp/debug-*.js`, `temp/analyze-*.py`
- **Test artifacts**: `temp/test-results/`, `temp/coverage/`
- **Generated files**: `temp/generated/`, `temp/build-artifacts/`
- **Logs**: `temp/logs/debug.log`, `temp/logs/error.log`

**Guidelines:**
- Never commit files from `/temp` directory
- Use `/temp` for all debugging and analysis scripts created during development
- Clean up `/temp` directory regularly or use automated cleanup
- Include `/temp/` in `.gitignore` to prevent accidental commits

## Configuration

### Environment Setup
```bash
# Node.js version
node --version  # Should be >= 18.0.0

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

### Development Configuration
- **TypeScript**: Strict mode enabled with path mapping
- **ESLint**: Modern flat config with TypeScript rules
- **Prettier**: 100 char line width, single quotes
- **Vitest**: Multiple configurations for different test types

### Package Configuration
```json
{
  "name": "simple-task-master",
  "version": "0.0.1",
  "bin": {
    "stm": "./bin/stm"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Architecture Details

### Core Components
- **TaskManager**: Central task operations and data management
- **LockManager**: File-level locking for concurrent access safety
- **FrontmatterParser**: YAML frontmatter processing for markdown files
- **Workspace**: Project root discovery and workspace management
- **OutputFormatter**: Multi-format output (JSON, table, CSV, markdown)

### Data Flow
1. CLI command parsing with Commander.js
2. Workspace discovery and validation
3. Task manager initialization with file locking
4. Command execution with error handling
5. Output formatting and display

### Concurrency Safety
- **File locking**: Prevents concurrent access corruption
- **Atomic operations**: Use `write-file-atomic` for data integrity
- **Lock timeouts**: Configurable timeout for lock acquisition
- **Retry logic**: Automatic retry for transient failures

## Git Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Examples

- `feat: add user authentication`
- `fix(auth): resolve token expiration issue`
- `docs: update API documentation`
- `chore: add Claude Code configuration`

### Claude Code Attribution

All commits generated by Claude Code should include:

```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Performance Considerations

### Optimization Guidelines
- **Task loading**: Optimized for 1000+ tasks
- **Search operations**: Efficient regex-based searching
- **Memory usage**: Linear scaling with task count
- **File operations**: Minimized disk I/O with caching

### Limits & Thresholds
- **Maximum task size**: 1MB (configurable)
- **Lock timeout**: 30 seconds (configurable)
- **Title length**: 500 characters maximum
- **Content length**: 1MB maximum

### Performance Testing
- **Benchmarks**: Automated performance test suite
- **Load testing**: Tested with 1000+ tasks
- **Memory profiling**: Regular memory usage validation
- **Concurrent operations**: Safe multi-process execution

## Contributing Guidelines

### Code Reviews
- **Type safety**: All code must pass TypeScript strict checks
- **Test coverage**: New features require comprehensive tests
- **Documentation**: Public APIs must be documented
- **Performance**: Consider performance impact of changes

### Release Process
- **Semantic versioning**: Follow semver for releases
- **Changelog**: Update CHANGELOG.md for notable changes
- **CI/CD**: All tests must pass before release
- **NPM publishing**: Automated release workflow

### Development Workflow
1. Create feature branch from main
2. Implement changes with tests
3. Run full test suite and linting
4. Submit PR with clear description
5. Address review feedback
6. Merge after approval and CI success