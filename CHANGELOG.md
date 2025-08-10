# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2025-08-10

### Fixed

- **Task Content Duplication Prevention**
  - Fixed issue where task content was duplicated in both YAML frontmatter and markdown body when updating tasks
  - Task content is now properly excluded from frontmatter during serialization to prevent redundancy
  - Affects both task creation and update operations in `TaskManager`

### Changed

- **Claude Code Integration Updates**
  - Migrated from custom shell scripts to `claudekit-hooks` for development automation
  - Updated hook configurations to use standardized `claudekit-hooks run` commands
  - Removed deprecated custom hook scripts: `eslint.sh`, `typecheck.sh`, `project-validation.sh`, `run-related-tests.sh`, `auto-checkpoint.sh`, `validate-todo-completion.sh`
  - Improved hook matchers to trigger on `Write|Edit|MultiEdit` operations
  - Enhanced development workflow with more reliable automated checks

## [0.3.0] - 2025-07-25

### Added

- **Configuration Management Command (`stm config`)**
  - Post-initialization configuration management with `stm config` command
  - Get individual config values with `stm config --get <key>`
  - Set configuration values with `stm config --set <key=value>`
  - List all configuration as JSON with `stm config --list`
  - Reset individual configuration keys with `stm config --reset <key>`
  - Reset all configuration to defaults with `stm config --reset-all`
  - Supports all configuration keys: `tasksDir`, `lockTimeoutMs`, `maxTaskSizeBytes`
  - Comprehensive validation for all configuration values with security restrictions
  - Atomic file operations prevent configuration corruption during updates
  - Concurrent access safety with file locking system
  - Backward compatibility with existing installations missing config files
  - Warning displayed when changing `tasksDir` with existing tasks to prevent data loss

- **Configurable Task Directory Support**
  - Initialize STM with custom task directory using `stm init --tasks-dir <path>`
  - Support for both relative and absolute paths with comprehensive security validation
  - Automatic `.gitignore` updates for custom task directories to maintain git hygiene
  - Optional `tasksDir` field in `config.json` for persistent custom directory configuration
  - Path validation system prevents directory traversal attacks and system directory usage
  - Support for existing directories with non-empty directory warnings
  - Flexible path handling supporting both absolute and relative paths

- **Enhanced Path Security**
  - New `path-validation.ts` module with comprehensive path security checks
  - Prevents directory traversal attacks (`../` sequences blocked)
  - Blocks usage of system directories (`/etc`, `/usr`, `/bin`, etc.)
  - Smart handling of temporary directories for testing environments
  - Validates against file paths being used as directory paths
  - Supports reasonable project-relative paths while maintaining security

### Changed

- **Configuration System Architecture**
  - `Config` type now includes optional `tasksDir` field for custom directories
  - `TaskManagerConfig` updated to support optional `tasksDir` and `workspaceRoot` fields
  - Enhanced `isConfig()` type guard to validate optional `tasksDir` field
  - ConfigManager now handles missing configuration files gracefully with defaults

- **Initialization Process**
  - `stm init` command now accepts `--tasks-dir` option for custom task directories
  - Enhanced `.gitignore` management supports custom directory patterns
  - Improved directory creation logic with better error handling and validation
  - Added warnings for absolute paths in `.gitignore` for cross-system compatibility

### Fixed

- **Release Process Improvements**
  - Updated `prepare-release.sh` to use master branch and improve AI timeout handling
  - Removed dependency on `aio-stream` package for better compatibility
  - Enhanced release script with better error handling and validation
  - Fixed script quoting issues for AI tool name handling

## [0.2.0] - 2025-01-20

### Added

- **Delete Command (`stm delete`)**
  - Complete CRUD functionality with task deletion capability
  - Dependency validation to prevent breaking task relationships
  - Support for both standard `dependencies` and unknown field `depends_on` formats
  - Force flag (`--force`) to bypass dependency checks when needed
  - Comprehensive error handling with proper exit codes
  - Full test coverage including unit, integration, and E2E tests

## [0.1.2] - 2025-01-20

### Added

- **Unknown Field Support for External Tool Integration**
  - Tasks now support arbitrary custom metadata fields beyond core STM fields
  - External tools can add their own fields without modifying STM
  - Full support through CLI, library API, and direct file manipulation
  - Added comprehensive integration guide with examples for AutoAgent, GitHub Actions, JIRA
  - Field count limit of 100 fields per task for performance protection

### Changed

- **Enhanced Schema Validation**
  - Modified validation to preserve unknown fields while maintaining strict validation for core fields
  - Core STM fields (id, title, status, etc.) remain strictly validated
  - Unknown fields are preserved without type validation
  - Config and LockFile validation remains unchanged (strict)

- **Improved Update Command**
  - Now accepts arbitrary field names in key=value assignments
  - Unknown fields can be set to any value, including empty strings
  - Array operations (+=, -=) remain limited to known array fields
  - Better error messages for invalid field names

### Fixed

- **Code Quality Improvements**
  - Resolved all ESLint errors (238 → 0)
  - Replaced `any` types with proper type aliases for better type safety
  - Fixed unused variables and imports
  - Corrected line length violations
  - Added missing newlines at end of files

### Technical

- Added `[key: string]: unknown` index signature to Task, TaskCreateInput, and TaskUpdateInput interfaces
- Created 76 new tests covering unknown field functionality
- Added performance benchmarks for tasks with many unknown fields
- Documented field naming conventions and best practices

## [0.1.1] - 2025-01-19

### Enhanced

- **Enhanced Update Command (`stm update`)**
  - Added section-specific content editing with `--desc`, `--details`, and `--validation` flags
  - Implemented stdin support using `-` for piping content into specific sections
  - Added editor integration that launches when no changes are specified
  - Introduced flexible key=value assignment syntax for all task properties
  - Added array operation support with `+=` (add) and `-=` (remove) operators
  - Enhanced command help text with comprehensive descriptions
  - Improved workflow integration for CI/CD and testing pipelines
  - Added support for multi-line content updates via heredoc and piping

## [0.0.1] - 2024-07-13

### Added

- **Core Task Management Features**
  - `stm init` - Initialize STM repository with configuration and directory structure
  - `stm add` - Add new tasks with title, description, tags, priority, and due dates
  - `stm list` - List tasks with filtering by status, tags, and search queries
  - `stm show` - Display detailed task information with multiple output formats
  - `stm update` - Update task properties including status, title, priority, tags, and due dates
  - `stm grep` - Search tasks using regular expressions with field-specific filtering
  - `stm export` - Export tasks to JSON, CSV, and Markdown formats

- **Task Storage System**
  - Individual markdown files with YAML frontmatter for each task
  - Human-readable task files with support for rich content
  - Automatic task ID generation and management
  - File-based storage in `.simple-task-master/tasks/` directory

- **Configuration Management**
  - JSON-based configuration file (`.simple-task-master/config.json`)
  - Configurable lock timeout and maximum task file size
  - Schema versioning for configuration compatibility
  - Automatic .gitignore management to exclude task files

- **Output Formats and Filtering**
  - Multiple output formats: JSON, table, CSV, and pretty-printed views
  - Advanced filtering by status (pending, in-progress, done)
  - Tag-based filtering with comma-separated tag lists
  - Full-text search across task titles and descriptions
  - Combinable filters for precise task selection

- **Command-Line Interface**
  - Built with Commander.js for robust argument parsing
  - Comprehensive help system with command-specific documentation
  - Global options and command-specific flags
  - Input validation and error handling

### Security

- **File System Protection**
  - Input validation and sanitization for all user inputs
  - Path validation to prevent directory traversal attacks
  - Atomic file operations using write-file-atomic
  - Safe concurrent access with file-based locking system

- **Data Integrity**
  - Lock manager to prevent concurrent file access conflicts
  - Validation schemas for task data structure
  - Error handling with graceful degradation
  - Backup and recovery mechanisms for corrupted data

### Technical Features

- **Performance Optimizations**
  - Efficient file system operations with minimal I/O
  - Lazy loading of task data for large repositories
  - Optimized search algorithms for fast grep operations
  - Memory-efficient processing of large task sets

- **Developer Experience**
  - TypeScript implementation with full type safety
  - Comprehensive test suite (unit, integration, E2E)
  - ESLint and Prettier configuration for code quality
  - Modular architecture with clear separation of concerns

- **Cross-Platform Compatibility**
  - Support for macOS, Linux, and Windows
  - Node.js 18+ compatibility
  - Consistent behavior across different environments
  - Unicode and emoji support in task content

### Documentation

- **Comprehensive README**
  - Detailed installation and setup instructions
  - Complete command reference with examples
  - Usage patterns and workflow examples
  - Development setup and contribution guidelines

- **API Documentation**
  - Inline TypeScript documentation
  - JSDoc comments for all public interfaces
  - Type definitions for external integrations
  - Error handling documentation

### Performance

- **Benchmarks**
  - Task loading: < 50ms for 1000+ tasks
  - Search operations: < 100ms across 10,000+ tasks
  - Memory usage: ~10MB baseline, linear scaling
  - File operations: atomic writes with proper locking

- **Scalability**
  - Support for up to 50,000 tasks per repository
  - Configurable file size limits (default: 1MB per task)
  - Efficient storage with minimal overhead
  - Lock timeout management (default: 30 seconds)

[Unreleased]: https://github.com/your-username/simple-task-master/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-username/simple-task-master/releases/tag/v1.0.0
