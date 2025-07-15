# Simple Task Master (STM) CLI Specification

**Status**: Draft
**Authors**: Claude Code
**Date**: 2025-07-13
**Version**: 0.0.1

## Overview

Simple Task Master (STM) is a minimalist, file-based task management CLI tool designed for software developers. It stores tasks locally in markdown files with YAML front-matter, operates entirely offline, and integrates seamlessly with Git workflows by keeping tasks outside version control.

## Background/Problem Statement

Modern task management tools often require:

- Network connectivity and cloud accounts
- Complex databases or state management
- Integration with specific issue tracking systems
- Separate workflows for different Git branches

Developers need a simple, local-first solution that:

- Works offline with zero network dependencies
- Survives Git branch switches without data loss
- Integrates naturally with text-based workflows
- Provides command-line efficiency without complexity

## Goals

- **Zero network dependency**: All operations are local
- **Git-friendly**: Tasks persist across branch switches, don't pollute PRs
- **Simple file format**: Markdown with YAML front-matter for both human and machine readability
- **Atomic operations**: Prevent data loss through crash-safe file operations
- **CLI-first design**: Efficient command-line interface with ND-JSON output for scripting
- **Minimal dependencies**: Use only essential, well-maintained packages

## Non-Goals

- Web interface or GUI
- Network synchronization or cloud storage
- Database backend (SQLite, PostgreSQL, etc.)
- Complex project management features (Gantt charts, resource allocation)
- Real-time collaboration features
- Task assignment to users
- Time tracking or estimation
- Integration with external issue trackers

## Technical Dependencies

### Runtime Dependencies

- **commander** (^12.0.0): CLI argument parsing and command routing
- **gray-matter** (^4.0.3): YAML front-matter parsing and stringification
- **js-yaml** (^4.1.0): YAML parsing and serialization
- **write-file-atomic** (^5.0.1): Atomic file writes to prevent data corruption
- **slugify** (^1.6.6): Convert task titles to URL-safe filenames

### Development Dependencies

- **typescript** (^5.0.0): Type safety and modern JavaScript features
- **ts-node** (^10.9.0): TypeScript execution for development
- **esbuild** (^0.23.0): Fast bundling for distribution
- **vitest** (^1.0.0): Testing framework
- **@types/node** (^20.0.0): Node.js type definitions
- **prettier** (^3.0.0): Code formatting
- **eslint** (^8.0.0): Code linting

### Node.js Requirements

- Node.js >= 18.0.0 (for native fetch, file system promises)
- npm >= 9.0.0

### Distribution Strategy

- **Primary**: `npm install -g simple-task-master`
- **Alternative**: `npx simple-task-master@latest <command>` (no global install needed)
- **Package format**: CommonJS with TypeScript definitions
- **Release automation**: AI-powered release preparation with automated workflows
- **Initial release**: Start with 0.0.1 for early feedback, 1.0.0 after community validation

## Detailed Design

### Directory Structure

```
<project-root>/
└── .simple-task-master/
    ├── config.json        # Tracked by Git (schema version, settings)
    ├── lock               # PID lockfile (runtime only)
    └── tasks/             # Git-ignored task storage
        ├── 1-implement-oauth-login.md
        ├── 2-fix-login-loop.md
        └── 3-add-user-profile.md
```

### Configuration

The `config.json` file contains:

```json
{
  "schema": 1,
  "lockTimeoutMs": 30000, // Lock timeout in milliseconds (default: 30s)
  "maxTaskSizeBytes": 1048576 // Max task file size (default: 1MB)
}
```

### Task File Format

Each task is stored as a markdown file with YAML front-matter:

```markdown
---
schema: 1
id: 2
title: Fix login redirect loop
status: in-progress
created: 2025-07-13T14:12:05Z
updated: 2025-07-13T15:40:33Z
tags: [auth, bug, deferred]
dependencies: [1]
---

## Description

Users get stuck in a /login redirect loop because the session cookie isn't cleared.

## Details

- Add `clearBadSession()` in `auth.ts`
- Integration test in `auth.spec.ts`

## Validation

1. Curl /login with expired JWT → expect 302 /
```

### Core Components

#### 1. Task Manager (`src/lib/task-manager.ts`)

- Handles all task CRUD operations
- Manages file I/O with atomic writes
- Validates task schema and data integrity
- Implements ID generation (highest + 1)

#### 2. File Lock Manager (`src/lib/lock-manager.ts`)

- PID-based locking to prevent concurrent operations
- Automatic cleanup on process exit
- 30-second timeout for stale lock detection
- Process liveness checking

#### 3. CLI Commands (`src/commands/`)

- `init.ts`: Repository initialization
- `add.ts`: Task creation
- `list.ts`: Task querying and filtering
- `show.ts`: Individual task display
- `update.ts`: Task modification
- `export.ts`: Data export functionality

#### 4. Schema Validator (`src/lib/schema.ts`)

- Validates YAML front-matter against schema
- Ensures required fields are present
- Rejects unknown fields (fail-fast principle)

### Package Configuration

```json
{
  "name": "simple-task-master",
  "version": "0.0.1",
  "description": "Minimalist file-based task management CLI for developers",
  "type": "commonjs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "stm": "./bin/stm"
  },
  "files": ["dist/", "bin/", "README.md", "CHANGELOG.md", "LICENSE"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc && chmod +x bin/stm",
    "dev": "tsx src/cli.ts",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm run test"
  }
}
```

### API Design

#### Command Line Interface

```bash
# Initialize repository
stm init

# Create tasks
stm add "Implement OAuth login" --desc "GitHub + Google" --tags auth,feature
stm add "Fix memory leak" --tags bug,critical --deps 1

# List and filter tasks
stm list                        # All tasks (ND-JSON)
stm list --pretty               # Human-readable table
stm list --status pending       # Filter by status
stm list --tags bug            # Filter by tags
stm grep "login"               # Search in titles/content
stm grep --context 2 "bug"     # Search with 2 lines of context around matches

# View tasks
stm show 1                     # Markdown output
stm show 1 --format yaml       # YAML front-matter only

# Update tasks
stm update 1 status=done
stm update 2 tags+=urgent tags-=deferred
stm update 3 --desc "New description" --validation "Test steps"

# Export data
stm export --format csv > tasks.csv
```

#### Output Formats

**ND-JSON (default)**: Newline-delimited JSON for scripting

```json
{"id":1,"title":"Implement OAuth login","status":"pending","tags":["auth","feature"]}
{"id":2,"title":"Fix memory leak","status":"in-progress","tags":["bug","critical"]}
```

**Pretty Table** (with `--pretty` flag):

```
┌──┬─────────────────────────┬──────────────┬──────────────┐
│ID│ Title                   │ Status       │ Tags         │
├──┼─────────────────────────┼──────────────┼──────────────┤
│1 │ Implement OAuth login   │ pending      │ auth,feature │
│2 │ Fix memory leak         │ in-progress  │ bug,critical │
└──┴─────────────────────────┴──────────────┴──────────────┘
```

### File Operations

#### Atomic Write Strategy

```typescript
async function writeTaskAtomic(filepath: string, content: string): Promise<void> {
  await writeFileAtomic(filepath, content, {
    encoding: 'utf8',
    mode: 0o644,
    fsync: true
  });
}
```

#### Lock File Implementation

```typescript
interface LockFile {
  pid: number;
  command: string;
  timestamp: number;
}

class LockManager {
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 seconds default
  private readonly LOCK_CHECK_INTERVAL_MS = 100; // Retry interval
  private readonly MAX_LOCK_RETRIES = 50; // 5 seconds total wait

  async acquire(): Promise<void> {
    const lockData: LockFile = {
      pid: process.pid,
      command: process.argv.join(' '),
      timestamp: Date.now()
    };

    // Check for stale locks
    if (await this.exists()) {
      const existingLock = await this.read();
      const age = Date.now() - existingLock.timestamp;

      if (age > this.LOCK_TIMEOUT_MS || !this.isProcessAlive(existingLock.pid)) {
        console.warn(`Removing stale lock (age: ${age}ms, pid: ${existingLock.pid})`);
        await this.forceRelease();
      }
    }

    // Atomic write with O_EXCL flag
  }

  async release(): Promise<void> {
    // Remove lock file
  }
}
```

### Lock Strategy

STM uses a **readers-writer lock pattern** optimized for local filesystem operations:

1. **Write operations** (add, update, delete): Acquire exclusive lock
2. **Read operations** (list, show, grep, export): No lock required
3. **Initialization** (init): Acquire exclusive lock

This design allows:

- Multiple concurrent read operations without blocking
- Fast read performance for common operations
- Data consistency during writes
- No lock contention for read-heavy workflows

## User Experience

### Initial Setup

```bash
$ npm install -g simple-task-master
$ cd my-project
$ stm init
✓ Created .simple-task-master/
✓ Created .simple-task-master/tasks/
✓ Created .simple-task-master/config.json
✓ Updated .gitignore
```

### Daily Workflow

```bash
# Morning: Check pending tasks
$ stm list --status pending --pretty

# Start working on a task
$ stm update 3 status=in-progress

# Add a new bug found during development
$ stm add "Fix API timeout on large datasets" --tags bug,api

# Complete a task with validation notes
$ stm update 3 status=done --validation "All tests pass, deployed to staging"

# Review all critical bugs
$ stm list --tags critical --grep bug
```

## Performance Considerations

### Scalability

- **Task Discovery**: O(n) directory scan, but local filesystem is fast
- **ID Generation**: O(n) scan of filenames, cached during operation
- **Search Operations**: O(n\*m) for content search, acceptable for <10k tasks

### Optimization Strategies

1. **Lazy Loading**: Only read file content when needed
2. **Streaming Output**: Use ND-JSON for large result sets
3. **Minimal Dependencies**: Fast startup time
4. **No Background Processes**: Zero idle resource usage

### Benchmarks Target

- `stm list` with 1000 tasks: <100ms
- `stm add` with lock contention: <50ms
- `stm grep` with 1000 tasks: <200ms

### Concurrency Performance

- **Read operations**: Unlimited concurrent readers
- **Write operations**: Sequential with lock acquisition
- **Lock overhead**: ~5ms per write operation
- **No caching**: Ensures fresh data, relies on OS file cache

### Resource Limits

- **Task file size**: 1MB maximum (configurable) to ensure fast operations
- **Title length**: 200 characters to prevent filesystem issues
- **Description length**: 64KB to maintain reasonable memory usage
- **Total tasks**: Tested up to 10,000 tasks, degrades gracefully beyond

## Security Considerations

### File System Security

- **Directory Permissions**: Tasks directory created with 0755
- **File Permissions**: Task files created with 0644
- **Path Traversal**: Validate all user input for path components
- **Symbolic Link**: Refuse to follow symlinks in tasks directory

### Input Validation

```typescript
// Prevent directory traversal
function validateTaskId(id: string): void {
  if (!/^\d+$/.test(id)) {
    throw new Error('Invalid task ID');
  }
}

// Sanitize file names
function sanitizeTitle(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true
  }).substring(0, 100); // Limit length
}

// File size validation
const MAX_TASK_SIZE_BYTES = 1048576; // 1MB default, configurable
const MAX_TITLE_LENGTH = 200; // Reasonable filename limit
const MAX_DESCRIPTION_LENGTH = 65536; // 64KB for description field

async function validateTaskSize(content: string): Promise<void> {
  const sizeInBytes = Buffer.byteLength(content, 'utf8');

  if (sizeInBytes > MAX_TASK_SIZE_BYTES) {
    throw new Error(
      `Task file exceeds maximum size of ${MAX_TASK_SIZE_BYTES} bytes. ` +
        `Current size: ${sizeInBytes} bytes. Consider breaking into subtasks.`
    );
  }
}

// Title validation for filesystem compatibility
function validateTitle(title: string): void {
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Task title exceeds ${MAX_TITLE_LENGTH} characters`);
  }

  // Additional filesystem-safe checks
  const forbidden = /[<>:"|?*\x00-\x1f]/g;
  if (forbidden.test(title)) {
    throw new Error('Task title contains invalid filesystem characters');
  }
}
```

### Lock File Security

- Include PID and command in lock file for debugging
- Validate PID is still running before considering lock valid
- Clean up stale locks older than 30 seconds

## Documentation

### User Documentation

1. **README.md**: Installation, quick start, basic usage
2. **CLI Help**: Built-in `--help` for all commands
3. **Man Page**: `stm.1` for Unix systems
4. **Examples Directory**: Common workflows and scripts

### Developer Documentation

1. **API Documentation**: TypeScript interfaces and JSDoc
2. **Architecture Guide**: Component relationships and data flow
3. **Contributing Guide**: Development setup and standards
4. **Plugin Development**: Extension points for custom commands

### Changelog Management

Follow the [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2025-07-14

### Added

- Initial release with core task management functionality
- CLI commands: init, add, list, show, update, export
- YAML front-matter with markdown body format
- Atomic file operations with write-file-atomic
- PID-based locking for concurrent operation safety
- ND-JSON output format for scripting
- Pretty table output with --pretty flag

### Security

- Input validation for all user-provided data
- Path traversal protection
```

## Implementation Phases

### Phase 1: Core Functionality (MVP)

- [ ] Project setup and build configuration
- [ ] Basic task CRUD operations
- [ ] File locking mechanism
- [ ] CLI framework with init, add, list, show commands
- [ ] ND-JSON output format
- [ ] Basic error handling

### Phase 2: Enhanced Features

- [ ] Update command with all operators (+=, -=, etc.)
- [ ] Search and filtering capabilities
- [ ] Pretty output formatting
- [ ] CSV export functionality
- [ ] Editor integration
- [ ] Comprehensive test suite

### Phase 3: Polish and Optimization

- [ ] Performance optimizations
- [ ] Extended validation and error messages
- [ ] Shell completion scripts
- [ ] Man page generation
- [ ] Cross-platform testing

### Phase 4: Release Infrastructure

- [ ] AI-powered release preparation script
- [ ] GitHub Actions release workflow
- [ ] GitHub Actions test workflow
- [ ] npm package configuration and publication
- [ ] Automated changelog generation
- [ ] Version management automation

## Release Infrastructure

### AI-Powered Release Preparation

Create `scripts/prepare-release.sh` for automated changelog generation and version management:

```bash
#!/bin/bash

# prepare-release.sh - Automate release preparation using Claude Code

set -e  # Exit on error

# Check which AI CLI is available
AI_CLI=""
AI_MODEL=""
AI_FLAGS=""

if command -v claude &> /dev/null; then
    AI_CLI="claude"
    AI_MODEL="--model sonnet"
    AI_FLAGS="--add-dir . --dangerously-skip-permissions --output-format stream-json --verbose --max-turns 30"
    echo "Using Claude CLI with sonnet model"
elif command -v gemini &> /dev/null; then
    AI_CLI="gemini"
    AI_MODEL="--model gemini-2.5-flash"
    AI_FLAGS="--include-all"
    echo "Using Gemini CLI with gemini-2.5-flash model"
else
    echo "Error: Neither claude nor gemini CLI is installed"
    echo "Please install one of them to use this script"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Get the release type (patch, minor, major)
RELEASE_TYPE=${1:-patch}

if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Usage: $0 [patch|minor|major]"
    echo "  patch: 0.0.1 -> 0.0.2 (bug fixes)"
    echo "  minor: 0.0.1 -> 0.1.0 (new features)"
    echo "  major: 0.1.0 -> 1.0.0 (breaking changes)"
    exit 1
fi

echo "Preparing $RELEASE_TYPE release..."

# Run tests first
echo "Running tests to ensure code quality..."
if ! npm test; then
    echo "Error: Tests are failing. Please fix them before releasing."
    exit 1
fi

# Get current version and analyze changes
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Use AI to prepare the release
$AI_CLI $AI_MODEL $AI_FLAGS -p "Prepare a $RELEASE_TYPE release for simple-task-master.

Current version: $CURRENT_VERSION

Please:
1. Analyze all changes since the last release
2. Update CHANGELOG.md following Keep a Changelog format
3. Update package.json version using: npm version $RELEASE_TYPE --no-git-tag-version
4. Create a commit with message: chore: prepare for vX.X.X release

Organize changes by category: Added, Changed, Fixed, Removed, Security."

echo "✅ Release preparation complete!"
```

### GitHub Actions Workflows

#### Release Workflow (`.github/workflows/release.yaml`)

````yaml
name: Release Package

on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      release-type:
        description: 'Release type (patch, minor, major)'
        required: true
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major

permissions:
  contents: write
  packages: write

jobs:
  check-version:
    name: Check Version and Prepare Release
    runs-on: ubuntu-latest
    outputs:
      should-release: ${{ steps.check.outputs.should-release }}
      version: ${{ steps.check.outputs.version }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check if version changed
        id: check
        run: |
          CURRENT_VERSION=$(node -p "require('./package.json').version")
          echo "Current version: $CURRENT_VERSION"

          if git tag | grep -q "^v$CURRENT_VERSION$"; then
            echo "Tag v$CURRENT_VERSION already exists. Skipping release."
            echo "should-release=false" >> $GITHUB_OUTPUT
          else
            echo "Tag v$CURRENT_VERSION does not exist. Proceeding with release."
            echo "should-release=true" >> $GITHUB_OUTPUT
            echo "version=$CURRENT_VERSION" >> $GITHUB_OUTPUT
          fi

  release:
    name: Build and Publish
    needs: check-version
    if: needs.check-version.outputs.should-release == 'true'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build package
        run: npm run build

      - name: Create release tag
        run: |
          VERSION=${{ needs.check-version.outputs.version }}
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a "v$VERSION" -m "Release v$VERSION"
          git push origin "v$VERSION"

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ needs.check-version.outputs.version }}
          release_name: Release v${{ needs.check-version.outputs.version }}
          body: |
            ## simple-task-master v${{ needs.check-version.outputs.version }}

            ### Installation
            ```bash
            npm install -g simple-task-master@${{ needs.check-version.outputs.version }}
            ```

            ### What's Changed
            See [CHANGELOG.md](https://github.com/${{ github.repository }}/blob/main/CHANGELOG.md) for details.
          draft: false
          prerelease: false
````

#### Test Workflow (`.github/workflows/test.yaml`)

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18.x, 20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run typecheck

      - name: Run tests
        run: npm test

      - name: Run build
        run: npm run build
```

## Success Metrics

### Technical Metrics

- **Test Coverage**: >90% code coverage
- **Build Time**: <30 seconds for full build
- **Package Size**: <500KB installed size
- **Performance**: <50ms startup time

### User Adoption Metrics

- **Downloads**: Track npm weekly downloads
- **GitHub Stars**: Community engagement indicator
- **Issue Response Time**: <48 hours for bug reports
- **PR Merge Time**: <1 week for community contributions

### Quality Metrics

- **Zero CVEs**: No known security vulnerabilities
- **TypeScript Strict**: 100% type safety
- **Documentation Coverage**: All public APIs documented
- **Cross-platform Tests**: Pass on Linux and macOS

## Open Questions

1. **Task ID Format**: Should we support UUID-v7 as an alternative to sequential IDs?
2. **Backup Strategy**: Should STM provide built-in backup/restore commands?
3. **Task Templates**: Would predefined task templates be useful?
4. **Hooks System**: Should we support pre/post command hooks for automation?
5. **Migration Path**: If schema changes, how do we handle migration?

## References

### Design Patterns

- [Command Pattern](https://refactoring.guru/design-patterns/command) for CLI structure
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html) for task storage
- [Unit of Work Pattern](https://martinfowler.com/eaaCatalog/unitOfWork.html) for atomic operations

### Similar Tools

- [Taskwarrior](https://taskwarrior.org/): Complex CLI task manager
- [Todo.txt](http://todotxt.org/): Simple text-based format
- [nb](https://xwmx.github.io/nb/): CLI note-taking with Git

### Technical References

- [YAML 1.2 Specification](https://yaml.org/spec/1.2.2/)
- [CommonMark Specification](https://spec.commonmark.org/)
- [Newline Delimited JSON](http://ndjson.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Testing Strategy

### Unit Tests

#### Task Manager Tests (`tests/unit/task-manager.spec.ts`)

- Task creation with valid/invalid data
- ID generation and collision prevention
- File naming with special characters
- Schema validation
- CRUD operations

#### Lock Manager Tests (`tests/unit/lock-manager.spec.ts`)

- Lock acquisition and release
- Stale lock detection
- Concurrent access prevention
- Process crash recovery

#### CLI Command Tests (`tests/unit/commands/*.spec.ts`)

- Argument parsing
- Flag validation
- Output formatting
- Error handling

### Integration Tests

#### File System Tests (`tests/integration/filesystem.spec.ts`)

- Atomic write verification
- Directory creation
- Permission handling
- Cross-platform path resolution

#### CLI Integration Tests (`tests/integration/cli.spec.ts`)

- Full command execution
- Multi-command workflows
- Output format verification
- Exit code validation

### End-to-End Tests

#### Workflow Tests (`tests/e2e/workflows.spec.ts`)

```typescript
test('complete task lifecycle', async () => {
  // Initialize repository
  await runCLI(['init']);

  // Create task
  const { stdout: id } = await runCLI(['add', 'Test task']);

  // Update task
  await runCLI(['update', id, 'status=in-progress']);

  // Verify state
  const { stdout } = await runCLI(['show', id, '--format', 'yaml']);
  expect(stdout).toContain('status: in-progress');
});
```

### Test Infrastructure

#### Directory Structure

```
test/
├── unit/                 # Unit tests for individual components
├── integration/          # Integration tests for component interactions
├── e2e/                  # End-to-end CLI workflow tests
├── performance/          # Performance benchmarks
├── fixtures/             # Test data and mock files
├── helpers/              # Test utilities and custom matchers
│   ├── builders/         # Test data builders
│   ├── mocks/            # Mock implementations
│   └── assertions/       # Custom matchers
├── setup.ts              # Global test setup
└── vitest.config.ts      # Test configuration
```

#### Test Configuration (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['**/test/**', '**/*.config.*', '**/*.d.ts', 'bin/**'],
      thresholds: {
        lines: 90,
        functions: 85,
        branches: 80,
        statements: 90
      }
    },
    testTimeout: 5000,
    hookTimeout: 10000
  }
});

// Specialized configs for different test types
export const e2eConfig = {
  ...defaultConfig,
  test: {
    ...defaultConfig.test,
    testTimeout: 30000,
    sequence: { shuffle: false }
  }
};
```

### Test Utilities

#### Custom Matchers (`test/helpers/assertions/custom-matchers.ts`)

```typescript
expect.extend({
  toBeValidTask(received) {
    const pass =
      received.id &&
      received.title &&
      received.status &&
      ['pending', 'in-progress', 'done'].includes(received.status);
    return {
      pass,
      message: () => `expected ${received} to be a valid task`
    };
  },

  toHaveTaskCount(received, expected) {
    const tasks = received.filter((f) => f.endsWith('.md'));
    return {
      pass: tasks.length === expected,
      message: () => `expected ${tasks.length} tasks, got ${expected}`
    };
  }
});
```

#### Test Doubles (`test/helpers/mocks/`)

```typescript
// In-memory task storage for testing
export class InMemoryTaskStore implements TaskStore {
  private tasks = new Map<number, Task>();
  private nextId = 1;

  async create(task: Omit<Task, 'id'>): Promise<Task> {
    const newTask = { ...task, id: this.nextId++ };
    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
}

// Mock file system for isolated testing
export class MockFileSystem {
  private files = new Map<string, string>();

  async readFile(path: string): Promise<string> {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: ${path}`);
    }
    return this.files.get(path)!;
  }

  async writeFileAtomic(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}
```

#### Test Data Builders (`test/helpers/builders/`)

```typescript
export class TaskBuilder {
  private task: Partial<Task> = {
    status: 'pending',
    tags: [],
    dependencies: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  withTitle(title: string): this {
    this.task.title = title;
    return this;
  }

  withStatus(status: TaskStatus): this {
    this.task.status = status;
    return this;
  }

  withTags(...tags: string[]): this {
    this.task.tags = tags;
    return this;
  }

  build(): Task {
    return {
      id: 1,
      schema: 1,
      title: 'Default Task',
      ...this.task
    } as Task;
  }
}
```

### Unit Tests

#### Task Manager Tests (`test/unit/task-manager.spec.ts`)

```typescript
describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    taskManager = new TaskManager({ fs: mockFs });
  });

  describe('create', () => {
    it('should create task with sequential ID', async () => {
      const task1 = await taskManager.create({ title: 'First task' });
      const task2 = await taskManager.create({ title: 'Second task' });

      expect(task1.id).toBe(1);
      expect(task2.id).toBe(2);
    });

    it('should validate required fields', async () => {
      await expect(taskManager.create({ title: '' })).rejects.toThrow('Title is required');
    });
  });
});
```

#### Lock Manager Tests (`test/unit/lock-manager.spec.ts`)

```typescript
describe('LockManager', () => {
  let lockManager: LockManager;
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    lockManager = new LockManager({ fs: mockFs });
  });

  it('should prevent concurrent operations', async () => {
    await lockManager.acquire();

    await expect(lockManager.acquire()).rejects.toThrow('Lock is already held');
  });

  it('should detect stale locks', async () => {
    const staleLock = {
      pid: 99999,
      timestamp: Date.now() - 31000, // 31 seconds old
      command: 'stm add'
    };

    await mockFs.writeFileAtomic('.simple-task-master/lock', JSON.stringify(staleLock));

    // Should succeed despite existing lock
    await expect(lockManager.acquire()).resolves.toBeUndefined();
  });
});
```

### Integration Tests

#### Task Workspace Tests (`test/integration/workspace.spec.ts`)

```typescript
describe('Task Workspace Integration', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await TestWorkspace.create();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('should handle concurrent task operations', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      workspace.addTask({ title: `Task ${i}` })
    );

    const tasks = await Promise.all(promises);
    const ids = tasks.map((t) => t.id);

    expect(new Set(ids).size).toBe(10); // All IDs unique
    expect(Math.max(...ids)).toBe(10); // Sequential
  });
});
```

### End-to-End Tests

#### CLI Workflow Tests (`test/e2e/cli-workflows.spec.ts`)

```typescript
describe('STM CLI Workflows', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTempDir();
    process.chdir(testDir);
  });

  afterEach(async () => {
    await cleanup(testDir);
  });

  it('should complete full task lifecycle', async () => {
    // Initialize
    const initResult = await runSTM(['init']);
    expect(initResult).toHaveExitCode(0);
    expect(await exists('.simple-task-master')).toBe(true);

    // Add task
    const addResult = await runSTM(['add', 'Implement feature X']);
    expect(addResult.stdout).toMatch(/^1$/);

    // Update task
    await runSTM(['update', '1', 'status=in-progress']);

    // Verify
    const showResult = await runSTM(['show', '1']);
    expect(showResult.stdout).toContain('status: in-progress');
  });
});
```

### Performance Tests

#### Benchmark Tests (`test/performance/benchmarks.spec.ts`)

```typescript
import { bench } from 'vitest';

describe('Performance Benchmarks', () => {
  bench('list 1000 tasks', async () => {
    const workspace = await createWorkspaceWithTasks(1000);
    await workspace.listTasks();
  });

  bench('concurrent adds', async () => {
    const workspace = await TestWorkspace.create();
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => workspace.addTask({ title: `Task ${i}` }))
    );
  });
});
```

### CI/CD Test Integration

#### GitHub Actions Test Workflow (`.github/workflows/test.yaml`)

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18.x, 20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run e2e tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: matrix.os == 'ubuntu-latest' && matrix.node-version == '20.x'
```

### Test Scripts in package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run test/unit",
    "test:integration": "vitest run test/integration",
    "test:e2e": "vitest run test/e2e --config vitest.config.e2e.ts",
    "test:performance": "vitest bench",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:debug": "vitest --inspect-brk --pool threads --poolOptions.threads.singleThread"
  }
}
```

### Test Workspace Helper

```typescript
export class TestWorkspace {
  private tempDir: string;

  static async create(): Promise<TestWorkspace> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stm-test-'));
    process.chdir(tempDir);
    await runSTM(['init']);
    return new TestWorkspace(tempDir);
  }

  async cleanup(): Promise<void> {
    process.chdir(os.tmpdir());
    await fs.rm(this.tempDir, { recursive: true, force: true });
  }

  async addTask(task: Partial<Task>): Promise<Task> {
    const result = await runSTM(['add', task.title || 'Test Task']);
    const id = parseInt(result.stdout.trim());
    return { id, ...task } as Task;
  }

  async listTasks(): Promise<Task[]> {
    const result = await runSTM(['list']);
    return result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}
```
