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
npm run lint           # ESLint code analysis (includes formatting rules)
npm run lint:fix       # Auto-fix linting and formatting issues

# Testing
npm test               # Run all tests (excludes performance tests)
npm run test:all       # Run ALL tests including performance
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e       # End-to-end tests only
npm run test:performance # Performance benchmarks (~3 min runtime)
npm run test:watch     # Watch mode for development
npm run test:coverage  # Coverage reporting

# Single test execution
npm test -- test/unit/specific-test.spec.ts
npm run test:unit -- --grep "specific test name"
npm run test:e2e -- test/e2e/specific-e2e.spec.ts
```

### Important: Script Synchronization

**When modifying npm scripts in package.json, ensure all references are updated:**

1. **GitHub Workflows** (`.github/workflows/*.yaml`)
   - Test workflow uses individual test commands
   - Build/release workflows may reference build commands
   - Update any script that was renamed or removed

2. **Documentation**
   - README.md installation and usage sections
   - AGENT.md command reference (this file)
   - Any other docs referencing npm scripts

3. **CI/CD Configuration**
   - Check for hardcoded script names in CI configs
   - Verify all test suites are still being run
   - Update timeout values if test duration changes

4. **Example**: When we removed Prettier
   - Removed `format` and `format:check` from package.json
   - Updated GitHub workflow to remove `format:check` step
   - Updated this documentation to remove format commands

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
      await expect(taskManager.create({ title: '' })).rejects.toThrow(ValidationError);
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

### Claude Code Settings (.claude Directory)

The `.claude` directory contains Claude Code configuration files with specific version control rules:

#### Version Controlled Files (commit these):
- `.claude/settings.json` - Shared team settings for hooks, tools, and environment
- `.claude/commands/*.md` - Custom slash commands available to all team members
- `.claude/hooks/*.sh` - Hook scripts for automated validations and actions

#### Ignored Files (do NOT commit):
- `.claude/settings.local.json` - Personal preferences and local overrides
- Any `*.local.json` files - Personal configuration not meant for sharing

**Important Notes:**
- You must manually add `.claude/settings.local.json` to `.gitignore`
- The shared `settings.json` should contain team-wide standards (linting, type checking, etc.)
- Personal preferences or experimental settings belong in `settings.local.json`
- Hook scripts in `.claude/hooks/` should be executable (`chmod +x`)

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

#### Release Readiness Checklist

Before initiating a release, ensure ALL of the following checks pass:

**1. Code Quality Checks:**
```bash
npm run lint           # Must pass without errors
npm run typecheck      # Must pass without errors
npm run build          # Must compile successfully
```

**2. Test Suite:**
```bash
npm run test:unit      # All unit tests must pass
npm run test:integration # All integration tests must pass
npm run test:e2e       # All E2E tests must pass
npm test               # Full test suite must pass
```

**3. Git Status:**
```bash
git status             # Working directory must be clean
git log --oneline -5   # Verify recent commits follow conventions
```

**4. Dependencies:**
- Remove any unused dependencies from package.json
- Ensure package-lock.json is up to date
- Verify no temporary debugging dependencies remain

**5. Documentation:**
- README.md is current with latest features
- CHANGELOG.md includes all notable changes
- API documentation reflects any interface changes
- Usage examples are tested and working

**6. Version Management:**
- Current version in package.json is correct
- Version bump follows semantic versioning:
  - `patch`: Bug fixes (0.0.x)
  - `minor`: New features, backward compatible (0.x.0)
  - `major`: Breaking changes (x.0.0)

**7. Release Blockers:**
- No `console.log` statements in production code
- No commented-out code blocks
- No TODO/FIXME comments (unless intentional)
- No hardcoded test data or credentials
- No temporary test files in the repository

#### Release Process Steps

##### Option 1: Using Release Scripts (Recommended)

The project includes AI-powered release preparation scripts that automate the entire process:

```bash
# For bug fixes and small changes
npm run release:patch

# For new features (backward compatible)
npm run release:minor

# For breaking changes
npm run release:major
```

These scripts (`scripts/prepare-release.sh`) will:
- Validate all release readiness checks
- Generate changelog entries using AI assistance
- Update version numbers
- Create appropriate git commits and tags
- Push changes to trigger the release workflow

##### Option 2: Manual Release

1. **Ensure all checks pass** (see checklist above)
2. **Update version**: `npm version [patch|minor|major]`
3. **Update CHANGELOG.md** with release notes
4. **Commit changes**: `git add -A && git commit -m "chore: release v{version}"`
5. **Push with tags**: `git push && git push --tags`

##### GitHub Actions Workflows

###### Release Workflow (`.github/workflows/release.yaml`)

Automatically publishes to npm when version changes:
- **Triggers**: Pushes to main/master or manual dispatch
- **Process**:
  1. Checks if version tag already exists (prevents duplicate releases)
  2. Runs all quality checks (lint, typecheck, tests)
  3. Builds the package
  4. Publishes to npm registry
  5. Creates GitHub release with changelog
- **Manual dispatch**: Can select release type (patch/minor/major)

###### Version Bump Workflow (`.github/workflows/version-bump.yaml`)

Creates PRs for version updates:
- **Triggers**: Manual workflow dispatch only
- **Options**:
  - Version type: patch, minor, major, prerelease
  - Prerelease ID: beta, alpha, etc. (for prereleases)
- **Process**:
  1. Bumps version in package.json
  2. Creates PR with version change
  3. PR includes checklist for release readiness
- **Usage**: Alternative to local version bumping

**Manual Workflow Dispatch:**
```bash
# Both workflows can be triggered from GitHub Actions UI
# 1. Go to Actions tab → Select workflow → Run workflow
# 2. Choose options and run
```

##### Release Verification

After release:
1. **Check npm**: `npm view simple-task-master@latest`
2. **Check GitHub**: Verify release appears in GitHub releases
3. **Test installation**: `npm install -g simple-task-master@latest`
4. **Verify functionality**: `stm --version`

#### Post-Release

- Monitor npm downloads and issues
- Address any immediate bugs with patch releases
- Update project board with completed features

### Development Workflow

1. Create feature branch from main
2. Implement changes with tests
3. Run full test suite and linting
4. Submit PR with clear description
5. Address review feedback
6. Merge after approval and CI success
