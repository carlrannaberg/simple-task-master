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

## 📖 Command Reference

### `stm init`

Initialize STM repository in the current directory.

```bash
stm init
```

Creates:

- `.simple-task-master/` directory
- `config.json` configuration file
- `tasks/` directory for task files
- Updates `.gitignore` to exclude task files but include config

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

Update an existing task's properties.

```bash
# Update status
stm update 1 --status=done

# Update title
stm update 1 --title="New task title"

# Update multiple properties
stm update 1 --status=in-progress --priority=high --tags=urgent,backend

# Update description
stm update 1 --description="Updated task description with more details"

# Update due date
stm update 1 --due-date="2024-12-25"

# Remove due date
stm update 1 --due-date=""
```

**Options:**

- `--title, -T <title>`: Update task title
- `--status, -s <status>`: Update status (pending, in-progress, done)
- `--priority, -p <priority>`: Update priority (low, medium, high)
- `--tags, -t <tags>`: Update tags (comma-separated)
- `--description, -d <description>`: Update description
- `--due-date <date>`: Update due date (YYYY-MM-DD)

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

## ⚙️ Configuration

STM stores its configuration in `.simple-task-master/config.json`. You can customize:

```json
{
  "schema": "1.0.0",
  "lockTimeoutMs": 30000,
  "maxTaskSizeBytes": 1048576
}
```

**Configuration Options:**

- `schema`: Configuration schema version
- `lockTimeoutMs`: File lock timeout in milliseconds (default: 30000)
- `maxTaskSizeBytes`: Maximum task file size in bytes (default: 1MB)

## 📁 File Structure

```
project-root/
├── .simple-task-master/
│   ├── config.json          # STM configuration
│   ├── tasks/               # Task files directory
│   │   ├── 1-task-title.md  # Individual task files
│   │   ├── 2-another-task.md
│   │   └── ...
│   └── lock                 # Lock file (temporary)
└── .gitignore               # Updated to exclude tasks/
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

# Start working on a task
stm update 5 --status=in-progress

# Mark task as complete
stm update 5 --status=done

# Review completed work
stm list --status=done --format=table
```

### Project Management

```bash
# Add feature tasks with tags
stm add "Design user dashboard" --tags=frontend,design --priority=medium
stm add "Implement user API" --tags=backend,api --priority=high
stm add "Write unit tests" --tags=testing --priority=medium

# Track frontend work
stm list --tags=frontend --pretty

# Find all high-priority tasks
stm list --search="priority.*high" --format=table

# Export project status
stm export --format=csv > project-status.csv
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
- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests only
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint code with ESLint
- `npm run format` - Format code with Prettier
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

## 🗺️ Roadmap

- [ ] Task dependencies and relationships
- [ ] Time tracking and reporting
- [ ] Integration with popular IDEs
- [ ] Sync capabilities between machines
- [ ] Advanced filtering and queries
- [ ] Task templates and automation
- [ ] Integration with CI/CD pipelines

---

<div align="center">
Made with ❤️ for developers who love the command line
</div>
