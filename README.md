# Simple Task Master (STM)

[![npm version](https://badge.fury.io/js/simple-task-master.svg)](https://badge.fury.io/js/simple-task-master)
[![Node.js CI](https://github.com/your-username/simple-task-master/workflows/Node.js%20CI/badge.svg)](https://github.com/your-username/simple-task-master/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, lightweight command-line task management tool built for developers who prefer markdown files over complex project management systems. STM stores tasks as individual markdown files with YAML frontmatter, making them both human-readable and version control friendly.

## ✨ Features

- **📝 Markdown-based tasks**: Each task is stored as a readable markdown file
- **🏷️ Flexible tagging system**: Organize tasks with multiple tags
- **🔍 Powerful search**: Find tasks by content, title, tags, or status
- **📊 Multiple output formats**: JSON, table, CSV, or pretty-printed views
- **🔒 Safe concurrent access**: Built-in file locking prevents data corruption
- **⚡ Fast performance**: Optimized for handling thousands of tasks
- **🎯 Simple workflow**: Initialize, add, list, update - that's it!
- **🔄 Export capabilities**: Export tasks to various formats for reporting
- **🔧 Custom metadata fields**: Add any custom fields for external tool integration
- **⚙️ Flexible configuration**: Configurable task directories and runtime settings with reset capabilities

## 🚀 Quick Start

### Installation

#### Global Installation (Recommended)

```bash
npm install -g simple-task-master
```

#### Using npx (No Installation)

```bash
npx simple-task-master init
```

### Basic Usage

1. **Initialize a new task repository**:

   ```bash
   stm init
   ```

2. **Add your first task**:

   ```bash
   stm add "Implement user authentication" --tags=backend,security --priority=high
   ```

3. **List all tasks**:

   ```bash
   stm list
   ```

4. **View a specific task**:

   ```bash
   stm show 1
   ```

5. **Update task status**:
   ```bash
   stm update 1 --status=in-progress
   ```

## 📝 Task Structure

STM tasks use three main content sections to organize information clearly:

### Section Purposes

- **Description** (`--description`): **Why & What**
  - Problem context and background
  - Solution overview and approach
  - Acceptance criteria and definition of done
  
- **Details** (`--details`): **How**
  - Implementation approach and technical design
  - Architecture notes and design decisions
  - Step-by-step implementation plan

- **Validation** (`--validation`): **Quality Assurance**
  - Testing strategy and approach
  - Verification steps and quality checks
  - Manual testing procedures and checklists

### Example Task Structure

```markdown
---
id: 1
title: 'Implement user authentication'
status: 'pending'
---

# Implement user authentication

## Description

**Problem**: Users currently cannot securely access the application.

**Solution**: Implement JWT-based authentication with secure password handling.

**Acceptance Criteria**:
- [ ] Users can register with email/password
- [ ] Users can login and receive JWT tokens
- [ ] Protected routes require valid tokens
- [ ] Passwords are securely hashed

## Details

**Implementation approach**:
- Use bcrypt for password hashing (salt rounds: 12)
- JWT tokens with 24-hour expiration
- Express middleware for route protection
- Database schema: users table with email, password_hash, created_at

**Architecture**:
- auth.ts: Core authentication logic
- middleware/auth.ts: Route protection
- routes/auth.ts: Login/register endpoints

## Validation

**Testing strategy**:
- Unit tests for password hashing/verification
- Integration tests for auth endpoints
- E2E tests for complete login flow

**Manual verification**:
- [ ] Register new user via API
- [ ] Login returns valid JWT
- [ ] Protected routes reject invalid tokens
- [ ] Password reset flow works end-to-end
```

## 📖 Command Reference

### `stm init`

Initialize STM repository in the current directory.

```bash
# Initialize with default settings
stm init

# Initialize with custom task directory
stm init --tasks-dir ./my-tasks
```

Creates:

- `.simple-task-master/` directory
- `config.json` configuration file
- `tasks/` directory (or your custom directory)
- Updates `.gitignore` to exclude task files but include config

**Options:**

- `--tasks-dir <path>`: Custom directory for storing task files (default: `.simple-task-master/tasks/`)

### `stm add <title>`

Add a new task with the specified title.

```bash
# Basic task
stm add "Fix login bug"

# Task with tags and priority
stm add "Implement dashboard" --tags=frontend,ui --priority=high

# Task with description
stm add "Update documentation" --description="Update API docs and examples"

# Task with due date
stm add "Deploy to production" --due-date="2024-12-31"
```

**Options:**

- `--tags, -t <tags>`: Comma-separated list of tags
- `--priority, -p <priority>`: Task priority (low, medium, high)
- `--description, -d <description>`: Task description
- `--due-date <date>`: Due date (YYYY-MM-DD format)
- `--status, -s <status>`: Initial status (pending, in-progress, done)

### `stm list`

List tasks with optional filtering and formatting.

```bash
# List all tasks
stm list

# Filter by status
stm list --status=pending
stm list --status=in-progress
stm list --status=done

# Filter by tags
stm list --tags=frontend,ui
stm list --tags=backend

# Search in task content
stm list --search="authentication"

# Combine filters
stm list --status=pending --tags=backend --search="API"

# Different output formats
stm list --format=json
stm list --format=csv
stm list --format=table
stm list --pretty  # Enhanced pretty-printing
```

**Filtering Options:**

- `--status, -s <status>`: Filter by status (pending, in-progress, done)
- `--tags, -t <tags>`: Filter by comma-separated tags
- `--search <query>`: Search in task titles and descriptions

**Output Options:**

- `--format, -f <format>`: Output format (json, table, csv)
- `--pretty, -p`: Enable pretty-printing with colors and formatting

### `stm show <id>`

Display detailed information about a specific task.

```bash
# Show task by ID
stm show 1

# Show with different formats
stm show 1 --format=json
stm show 1 --format=yaml
```

**Options:**

- `--format, -f <format>`: Output format (default, json, yaml)

### `stm update <id>`

Update an existing task's properties with flexible options for metadata, content sections, and editor integration.

#### Basic Property Updates

```bash
# Update status
stm update 1 --status=done

# Update title
stm update 1 --title="New task title"

# Update tags
stm update 1 --tags=urgent,backend,security
```

#### Section-Specific Updates

```bash
# Update description section directly
stm update 42 --desc "Revised task description with new requirements"

# Update details section with multi-line content
stm update 42 --details "## Implementation Notes
- Use TypeScript for type safety
- Add comprehensive error handling
- Include unit tests"

# Update validation section
stm update 42 --validation "✓ All tests pass
✓ Code review completed
✓ Manual QA approved"
```

#### Stdin Input Support

```bash
# Pipe content to description section
echo "New description from command output" | stm update 42 --desc -

# Pipe test results to validation section
npm test | stm update 42 --validation -

# Use complex piping with other tools
curl -s api.example.com/requirements | stm update 42 --details -

# Multi-line input using heredoc
stm update 42 --validation - << 'EOF'
✓ Unit tests: 45/45 passing
✓ Integration tests: 12/12 passing
✓ Performance benchmarks within limits
✓ Security scan: no vulnerabilities
EOF
```

#### Key=Value Assignment Syntax

```bash
# Basic assignments
stm update 42 status=done title="Completed feature implementation"

# Content section assignments
stm update 42 desc="Updated description" details="New implementation details"

# Array operations - adding tags
stm update 42 tags+=security,performance

# Array operations - removing tags
stm update 42 tags-=deprecated,old

# Multiple mixed operations
stm update 42 status=in-progress tags+=urgent desc="High priority update"
```

#### Editor Integration

```bash
# Open task in editor when no changes specified
stm update 42

# Disable editor fallback
stm update 42 --no-editor
```

#### Combined Usage Examples

```bash
# Update metadata and add validation results
stm update 42 status=done --validation "✓ All tests pass
✓ Manual QA complete"

# Update multiple sections with different input methods
stm update 42 --desc "Updated requirements" details="$(cat implementation-notes.md)"

# Complex workflow with piped validation
npm run test:full | stm update 42 status=done --validation -

# Batch update with assignment syntax
stm update 42 status=in-progress tags+=urgent,hotfix desc="Critical bug fix in progress"
```

**Options:**

- `--title, -t <title>`: Update task title
- `--desc, -d <text>`: Update description section (use `-` for stdin)
- `--details <text>`: Update details section (use `-` for stdin)
- `--validation <text>`: Update validation section (use `-` for stdin)
- `--status, -s <status>`: Update status (pending, in-progress, done)
- `--tags <tags>`: Set task tags (comma-separated)
- `--deps <dependencies>`: Set task dependencies (comma-separated IDs)
- `--no-editor`: Disable editor fallback when no changes are specified

**Assignment Syntax:**

- `key=value`: Set field value
- `key+=value`: Add to array fields (tags, dependencies)
- `key-=value`: Remove from array fields (tags, dependencies)

**Valid Fields for Assignments:**

- `title`: Task title
- `content`: Full task content (markdown body)
- `status`: Task status (pending, in-progress, done)
- `tags`: Task tags (comma-separated for arrays)
- `dependencies`: Task dependencies (comma-separated IDs)
- `desc`: Description section content
- `details`: Details section content
- `validation`: Validation section content
- **Any custom field**: You can add custom metadata fields for external tool integration

### `stm grep <pattern>`

Search for tasks using regular expressions.

```bash
# Search in task content
stm grep "authentication"

# Case-insensitive search
stm grep -i "API"

# Search in specific fields
stm grep --field=title "user"
stm grep --field=description "implement"

# Different output formats
stm grep "bug" --format=json
stm grep "feature" --format=table
```

**Options:**

- `--case-insensitive, -i`: Case-insensitive search
- `--field <field>`: Search in specific field (title, description, tags)
- `--format, -f <format>`: Output format (default, json, table)

### `stm export`

Export tasks to various formats for reporting and analysis.

```bash
# Export all tasks to JSON
stm export --format=json > tasks.json

# Export to CSV
stm export --format=csv > tasks.csv

# Export filtered tasks
stm export --status=done --format=json > completed-tasks.json

# Export with specific fields
stm export --format=csv --fields=id,title,status,tags
```

**Options:**

- `--format, -f <format>`: Export format (json, csv, md)
- `--status, -s <status>`: Filter by status
- `--tags, -t <tags>`: Filter by tags
- `--fields <fields>`: Comma-separated fields to include in export

### `stm delete <id>`

Delete a task permanently.

```bash
# Delete a task
stm delete 123

# Force delete (bypass dependency checks)
stm delete 123 --force
```

**Note**: Deletion is permanent. Tasks that depend on the deleted task may become invalid unless `--force` is used.

**Options:**

- `--force, -f`: Force deletion even if other tasks depend on this task

### `stm config`

View and modify Simple Task Master configuration settings.

```bash
# View all configuration
stm config --list

# Get specific configuration value
stm config --get tasksDir
stm config --get lockTimeoutMs
stm config --get maxTaskSizeBytes

# Change tasks directory
stm config --set tasksDir=docs/tasks

# Change lock timeout to 60 seconds
stm config --set lockTimeoutMs=60000

# Change max task size to 2MB
stm config --set maxTaskSizeBytes=2097152

# Reset individual configuration values to defaults
stm config --reset tasksDir
stm config --reset lockTimeoutMs

# Reset all configuration values to defaults
stm config --reset-all
```

**Options:**

- `--get <key>`: Get a specific configuration value
- `--set <key=value>`: Set a configuration value
- `--list`: List all configuration values as JSON
- `--reset <key>`: Reset a specific configuration value to its default
- `--reset-all`: Reset all configuration values to defaults

**Configuration Keys:**

- `tasksDir`: Directory where task files are stored (relative or absolute path)
- `lockTimeoutMs`: Lock acquisition timeout in milliseconds (default: 30000)
- `maxTaskSizeBytes`: Maximum task file size in bytes (default: 1048576)

**Common Use Cases:**

```bash
# Move tasks to a project-specific directory
stm config --set tasksDir=./project/tasks

# Increase timeout for slower systems
stm config --set lockTimeoutMs=60000

# Allow larger task files (e.g., 5MB)
stm config --set maxTaskSizeBytes=5242880

# Check current configuration
stm config --list

# Use in scripts
TASKS_DIR=$(stm config --get tasksDir)
echo "Tasks are stored in: $TASKS_DIR"

# Reset to defaults when switching projects
stm config --reset tasksDir        # Back to .simple-task-master/tasks
stm config --reset lockTimeoutMs   # Back to 30 seconds
stm config --reset-all             # Reset everything to defaults
```

## ⚙️ Configuration

STM stores its configuration in `.simple-task-master/config.json`. You can view and modify these settings using the `config` command or by editing the JSON file directly.

### Using the Config Command

The `config` command provides a safe way to view and modify configuration without manually editing JSON:

```bash
# View current configuration
stm config --list

# Get a specific value
stm config --get tasksDir

# Change a setting
stm config --set lockTimeoutMs=45000

# Reset settings to defaults
stm config --reset tasksDir
stm config --reset-all
```

### Configuration File Format

```json
{
  "schema": 1,
  "lockTimeoutMs": 30000,
  "maxTaskSizeBytes": 1048576,
  "tasksDir": "./my-tasks"
}
```

### Configuration Options

#### `tasksDir` (string)
Directory where task files are stored. Can be relative or absolute path.

- **Default**: `.simple-task-master/tasks/`
- **Valid values**: Any valid directory path within the project
- **Restrictions**: 
  - Cannot use system directories (`/etc`, `/usr`, etc.)
  - Cannot contain path traversal sequences (`..`)
  - Must be within the project directory if absolute

**Examples:**
```bash
# Use a project-specific directory
stm config --set tasksDir=./todos

# Use a nested structure
stm config --set tasksDir=./docs/project-tasks

# Check current value
stm config --get tasksDir
```

#### `lockTimeoutMs` (number)
Maximum time in milliseconds to wait for acquiring a file lock. Prevents indefinite waiting when another process is accessing task files.

- **Default**: `30000` (30 seconds)
- **Valid values**: Positive integer
- **Recommended range**: 5000-120000 (5-120 seconds)

**Examples:**
```bash
# Increase for slower systems or network drives
stm config --set lockTimeoutMs=60000

# Decrease for faster failure detection
stm config --set lockTimeoutMs=10000
```

#### `maxTaskSizeBytes` (number)
Maximum allowed size for a single task file in bytes. Prevents excessive memory usage and ensures reasonable performance.

- **Default**: `1048576` (1 MB)
- **Valid values**: Positive integer
- **Recommended range**: 10240-10485760 (10 KB - 10 MB)

**Examples:**
```bash
# Allow larger tasks (2 MB)
stm config --set maxTaskSizeBytes=2097152

# Allow very large tasks (5 MB)
stm config --set maxTaskSizeBytes=5242880

# Common sizes:
# 512 KB = 524288
# 1 MB   = 1048576 (default)
# 2 MB   = 2097152
# 5 MB   = 5242880
# 10 MB  = 10485760
```

### Validation Rules

The config command validates all settings before saving:

- **`tasksDir`**: 
  - Must be a valid path format
  - Cannot contain system directory paths
  - Cannot use path traversal (`../`)
  - Shows warning if changing with existing tasks

- **`lockTimeoutMs`**: 
  - Must be a positive integer
  - Values below 1000 (1 second) are not recommended
  - Very high values may cause long waits

- **`maxTaskSizeBytes`**: 
  - Must be a positive integer
  - Values below 1024 (1 KB) are not practical
  - Consider system memory when setting high values

### Custom Task Directory

By default, STM stores tasks in `.simple-task-master/tasks/`. However, you can configure a custom directory for task storage, which is useful for:

- Organizing tasks in a project-specific location
- Separating tasks from the STM configuration
- Using existing directories for task management
- Following your team's directory structure conventions

#### Setting Up a Custom Task Directory

**Option 1: Initialize with a custom directory**
```bash
# Use a relative path (recommended)
stm init --tasks-dir ./project-tasks

# Use a nested directory structure
stm init --tasks-dir ./docs/tasks

# Initialize in an existing directory
stm init --tasks-dir ./existing-tasks-folder
```

**Option 2: Modify config.json after initialization**
```json
{
  "schema": 1,
  "lockTimeoutMs": 30000,
  "maxTaskSizeBytes": 1048576,
  "tasksDir": "./my-custom-tasks"
}
```

#### Examples

```bash
# Initialize with tasks in a 'todo' directory
stm init --tasks-dir ./todo

# Initialize with tasks in a documentation folder
stm init --tasks-dir ./docs/project-tasks

# Initialize with deeply nested structure
stm init --tasks-dir ./project/management/tasks
```

#### Important Considerations

1. **Relative vs Absolute Paths**
   - **Relative paths** (recommended): Portable across different systems and users
   - **Absolute paths**: Must be within the project directory for security
   
2. **Git Integration**
   - STM automatically updates `.gitignore` to exclude task files
   - The pattern added depends on your custom directory
   - Config file remains tracked for team synchronization

3. **Migration Guide**

   If you have an existing STM workspace and want to move tasks to a custom directory:

   ```bash
   # 1. Move existing tasks to the new location
   mv .simple-task-master/tasks ./my-tasks
   
   # 2. Update config.json
   # Add: "tasksDir": "./my-tasks"
   
   # 3. Update .gitignore
   # Replace: .simple-task-master/tasks/
   # With: my-tasks/
   ```

4. **Limitations**
   - Custom directories cannot be inside `.simple-task-master/`
   - System directories (`/etc`, `/usr`, etc.) are not allowed
   - Directory traversal sequences (`..`) in paths are blocked
   - Absolute paths must be within the current project

## 📁 File Structure

**Default Structure:**
```
project-root/
├── .simple-task-master/
│   ├── config.json          # STM configuration
│   ├── tasks/               # Default task files directory
│   │   ├── 1-task-title.md  # Individual task files
│   │   ├── 2-another-task.md
│   │   └── ...
│   └── lock                 # Lock file (temporary)
└── .gitignore               # Updated to exclude tasks/
```

**With Custom Task Directory:**
```
project-root/
├── .simple-task-master/
│   ├── config.json          # Contains "tasksDir": "./my-tasks"
│   └── lock                 # Lock file (temporary)
├── my-tasks/                # Custom task directory
│   ├── 1-task-title.md      # Individual task files
│   ├── 2-another-task.md
│   └── ...
└── .gitignore               # Updated to exclude my-tasks/
```

### Task File Format

Each task is stored as a markdown file with YAML frontmatter:

```markdown
---
id: 1
title: 'Implement user authentication'
status: 'pending'
priority: 'high'
tags:
  - backend
  - security
created: '2024-01-15T10:30:00.000Z'
updated: '2024-01-15T10:30:00.000Z'
dueDate: '2024-01-31'
# Custom fields (added by external tools or workflows)
external_id: 'JIRA-456'
sprint: '2024-Q1-Sprint-2'
story_points: 8
---

# Implement user authentication

## Description

Create a secure authentication system using JWT tokens.

## Requirements

- [ ] Password hashing with bcrypt
- [ ] JWT token generation
- [ ] Login/logout endpoints
- [ ] Password reset functionality

## Notes

Research industry best practices for session management.
```

## 💡 Usage Examples

### Daily Workflow

```bash
# Start your day by checking pending tasks
stm list --status=pending --pretty

# Add a new urgent task
stm add "Fix critical production bug" --tags=urgent,bugfix --priority=high

# Start working on a task and add implementation notes
stm update 5 status=in-progress --details "Started debugging the authentication flow"

# Update progress with detailed validation checks
stm update 5 --validation - << 'EOF'
✓ Reproduced the issue locally
✓ Identified root cause in JWT validation
⏳ Working on fix implementation
EOF

# Complete the task with final validation
npm test | stm update 5 status=done --validation -

# Review completed work
stm list --status=done --format=table
```

### Project Management

```bash
# Add feature tasks with tags
stm add "Design user dashboard" --tags=frontend,design --priority=medium
stm add "Implement user API" --tags=backend,api --priority=high
stm add "Write unit tests" --tags=testing --priority=medium

# Start working on API implementation with detailed plan
stm update 2 status=in-progress --details "## Implementation Plan
- Design REST endpoints
- Set up authentication middleware
- Implement CRUD operations
- Add input validation"

# Update progress with specific validation criteria
stm update 2 --validation "## Acceptance Criteria
- [ ] All endpoints documented in OpenAPI
- [ ] Authentication tests pass
- [ ] Error handling implemented
- [ ] Performance benchmarks met"

# Add urgent tag when priorities change
stm update 2 tags+=urgent

# Complete with comprehensive validation results
stm update 2 status=done --validation "## Final Validation
✓ All endpoints implemented and tested
✓ API documentation updated
✓ Security review completed
✓ Performance tests: avg 45ms response time
✓ Integration tests: 100% passing"

# Track frontend work
stm list --tags=frontend --pretty

# Export project status
stm export --format=csv > project-status.csv
```

### Advanced Update Patterns

```bash
# Automated testing workflow with piped results
npm run test:unit | stm update 15 --validation -
npm run test:integration | stm update 15 --validation -

# Code review workflow
stm update 23 --desc "Feature implementation complete" --validation "✓ Code review requested"

# CI/CD integration - update from build results
if npm run build; then
  stm update 18 status=done --validation "✓ Build successful: $(date)"
else
  stm update 18 --validation "❌ Build failed: $(date)"
fi

# Multi-step task progression with section updates
stm update 31 status=in-progress --desc "Starting phase 1: Requirements gathering"
stm update 31 --details "$(cat requirements.md)"
stm update 31 --validation "✓ Requirements approved by stakeholders"

# Batch updates with assignment syntax
stm update 42 status=done tags+=completed,released desc="Feature deployed to production"

# Editor-based updates for complex content
stm update 55  # Opens editor for detailed content editing

# Dependency management with array operations
stm update 60 deps+=45,46  # Add dependencies
stm update 60 deps-=32     # Remove dependency

# Documentation sync from external sources
curl -s https://api.example.com/spec | stm update 67 --details -
cat design-notes.md | stm update 67 --desc -
```

### Team Coordination

```bash
# Export tasks for team review
stm export --status=pending --format=json > pending-tasks.json

# Find tasks by keyword
stm grep "authentication" --format=table

# Track progress by status
echo "Pending: $(stm list --status=pending --format=json | jq length)"
echo "In Progress: $(stm list --status=in-progress --format=json | jq length)"
echo "Done: $(stm list --status=done --format=json | jq length)"
```

### Configuration Management

```bash
# Check current configuration
stm config --list

# Adjust settings for your workflow
stm config --set tasksDir=./project-tasks
stm config --set maxTaskSizeBytes=2097152  # 2MB for detailed tasks

# Use configuration in scripts
TASK_DIR=$(stm config --get tasksDir)
MAX_SIZE=$(stm config --get maxTaskSizeBytes)
echo "Tasks stored in: $TASK_DIR (max size: $MAX_SIZE bytes)"

# Backup configuration before changes
stm config --list > config-backup.json

# Verify changes took effect
stm config --get tasksDir
ls -la $(stm config --get tasksDir)
```

### Custom Metadata Fields

STM allows you to add custom metadata fields to tasks, enabling seamless integration with external tools and workflows:

```bash
# Add custom fields for external tool integration
stm update 42 external_id="JIRA-1234" priority="P1"

# Track AutoAgent execution metadata
stm update 56 agent_id="agent-123" execution_time="45s" success=true

# Add project management metadata
stm update 78 sprint="2024-Q1-Sprint-3" story_points=5 assignee="john.doe"

# Complex metadata with JSON values
stm update 90 metadata='{"tool":"vscode","extensions":["prettier","eslint"]}'

# View tasks with custom fields (shown in JSON output)
stm show 42 --format=json
# Output includes all fields, both core and custom

# Export with custom fields preserved
stm export --format=json > tasks-with-metadata.json
```

Custom fields are:
- **Preserved**: Maintained through all operations (create, update, show, export)
- **Flexible**: Accept any valid string value
- **Tool-friendly**: Enable external tools to store their own metadata
- **Non-validated**: STM doesn't validate custom field values (tools manage their own data)

## 🔧 Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/simple-task-master.git
cd simple-task-master

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with ts-node
- `npm test` - Run all tests (excludes performance tests)
- `npm run test:all` - Run ALL tests including performance
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests only
- `npm run test:performance` - Run performance benchmarks (~3 min)
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint code with ESLint (includes formatting rules)
- `npm run lint:fix` - Auto-fix linting and formatting issues
- `npm run typecheck` - Type check with TypeScript

### Testing

STM has comprehensive test coverage across three levels:

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test command interactions and file system operations
3. **E2E Tests**: Test complete CLI workflows

```bash
# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Project Structure

```
src/
├── cli.ts                 # Main CLI entry point
├── commands/              # Command implementations
│   ├── add.ts
│   ├── export.ts
│   ├── grep.ts
│   ├── init.ts
│   ├── list.ts
│   ├── show.ts
│   └── update.ts
├── lib/                   # Core library code
│   ├── constants.ts       # Application constants
│   ├── errors.ts          # Error classes
│   ├── lock-manager.ts    # File locking
│   ├── output.ts          # Output formatting
│   ├── schema.ts          # Validation schemas
│   ├── task-manager.ts    # Task CRUD operations
│   ├── types.ts           # Type definitions
│   └── utils.ts           # Utility functions
└── types/                 # TypeScript type definitions
    └── index.ts
```

## 📊 Performance

STM is optimized for performance with the following characteristics:

- **Task Loading**: < 50ms for 1000+ tasks
- **Search Operations**: < 100ms across 10,000+ tasks
- **File Operations**: Atomic writes with proper locking
- **Memory Usage**: ~10MB baseline, scales linearly with task count
- **Concurrent Safety**: File-level locking prevents corruption

### Limitations

- Maximum task file size: 1MB (configurable)
- Recommended maximum tasks: 50,000 per repository
- Lock timeout: 30 seconds (configurable)
- Node.js requirement: >= 18.0.0

## 📚 API Behavior for Custom Fields

STM's API allows custom metadata fields in task frontmatter, enabling external tools to extend tasks with their own data:

### Field Validation Behavior

**Core Fields** (strictly validated):
- `id`, `title`, `status`, `created`, `updated`: Required with specific types
- `tags`, `dependencies`: Optional arrays with validation
- `priority`, `dueDate`: Optional with format validation

**Custom Fields** (flexibly handled):
- **Any field name**: Allowed except those containing newlines or control characters
- **Any value type**: Stored as-is without validation
- **Preservation**: Maintained through all operations (create, update, list, show, export)
- **No STM validation**: External tools manage their own field semantics

### Integration Guidelines

When integrating with STM:

1. **Choose unique field names**: Prefix with your tool name (e.g., `jira_id`, `github_issue`)
2. **Handle your own validation**: STM won't validate custom field values
3. **Use consistent formats**: Maintain your data format across operations
4. **Document your fields**: Let users know what custom fields your tool adds

### Example Integration

```javascript
// External tool adding custom metadata
const task = {
  title: 'Implement feature',
  status: 'pending',
  // Custom fields for integration
  jira_id: 'PROJ-123',
  github_pr: 456,
  ci_status: 'passing',
  metrics: {
    complexity: 'high',
    estimated_hours: 8
  }
};

// STM preserves all custom fields
const updated = await taskManager.create(task);
console.log(updated.jira_id); // 'PROJ-123'
console.log(updated.metrics); // { complexity: 'high', estimated_hours: 8 }
```

## 🔒 Security

STM implements several security measures:

- **Input validation**: All user inputs are validated and sanitized
- **File path validation**: Prevents directory traversal attacks
- **Safe file operations**: Uses atomic writes to prevent corruption
- **No remote connections**: All data stays local to your machine
- **Minimal dependencies**: Reduces attack surface

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Lint your code: `npm run lint`
6. Commit your changes: `git commit -m 'feat: add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/simple-task-master/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/simple-task-master/discussions)
- **Documentation**: This README and inline code documentation

---

<div align="center">
Made with ❤️ for developers who love the command line
</div>
