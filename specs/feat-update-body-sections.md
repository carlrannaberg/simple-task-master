# Enhanced Body Section Editing for STM Update Command

**Status**: Draft  
**Authors**: Claude Code  
**Date**: 2025-07-14  
**Version**: 0.0.1

## Overview

This specification defines enhancements to the `stm update` command to support granular editing of task body sections (description, details, validation) through dedicated flags and stdin support. Additionally, it extends stdin support to the `stm add` command for consistency. These changes improve the user experience for managing task content while maintaining backward compatibility.

## Background/Problem Statement

The current `stm update` command implementation has limitations when editing task body content:

- The `--description` flag updates the entire content body, not specific sections
- No support for editing individual sections (details, validation) separately
- No stdin support for piping content from other commands
- No interactive editor fallback when no changes are specified
- Users must manually edit files or replace entire content to update specific sections

These limitations make it cumbersome to:

- Update validation steps after completing a task
- Add implementation details without overwriting the description
- Pipe content from other commands (e.g., test output to validation)
- Quickly edit a task without remembering all command options

## Goals

- **Section-specific editing**: Enable updating individual body sections (description, details, validation)
- **Stdin support**: Allow piping content from other commands using `-` as input for both add and update commands
- **Editor integration**: Launch `$EDITOR` when no specific changes are provided
- **Backward compatibility**: Maintain existing command syntax and behavior
- **Atomic operations**: Ensure all updates remain crash-safe
- **Intuitive UX**: Make common workflows more efficient
- **Command consistency**: Ensure add and update commands have similar input capabilities

## Non-Goals

- Changing the underlying file format or structure
- Adding new body sections beyond description/details/validation
- Supporting multiple file formats (remains markdown only)
- Implementing real-time collaborative editing
- Adding version control for individual sections
- Supporting section templates or snippets

## Technical Dependencies

No new dependencies required. The implementation uses:

- **gray-matter** (existing): For parsing and updating markdown with frontmatter
- **Node.js built-ins**: For stdin handling and editor launching
- **write-file-atomic** (existing): For safe file operations

## Detailed Design

### Command Syntax Enhancement

#### Update Command

```bash
stm update <id> [assignments...] [options]
```

#### Add Command Enhancement

```bash
stm add <title> [options]
# Now supports: --description, --details, --validation with stdin support
```

### New Options

#### Update Command

| Flag           | Long Form       | Description                | Example                            |
| -------------- | --------------- | -------------------------- | ---------------------------------- |
| `-d`           | `--description` | Update description section | `--description "New description"`  |
| `--details`    | -               | Update details section     | `--details "Implementation notes"` |
| `--validation` | -               | Update validation section  | `--validation "Test checklist"`    |

#### Add Command

| Flag           | Long Form       | Description             | Example                            |
| -------------- | --------------- | ----------------------- | ---------------------------------- |
| `-d`           | `--description` | Set description section | `--description "Task description"` |
| `--details`    | -               | Set details section     | `--details "Implementation notes"` |
| `--validation` | -               | Set validation section  | `--validation "Test checklist"`    |

### Input Methods

Each body flag accepts:

1. **Literal string**: `--description "New description"`
2. **Stdin marker**: `--description -` (reads from stdin)

### Section Handling

#### Section Identification

Sections are identified by markdown headings:

- Description: Content before first heading or under `## Description`
- Details: Content under `## Details`
- Validation: Content under `## Validation`

#### Section Creation

If a section doesn't exist when updating:

1. Create the appropriate heading
2. Insert content under the new heading
3. Preserve existing sections

#### Section Update Algorithm

```typescript
function updateBodySection(content: string, section: string, newText: string): string {
  const sections = parseMarkdownSections(content);

  if (section === 'description') {
    // Update content before first heading or under ## Description
    sections.description = newText;
  } else {
    // Update or create section with heading
    sections[section] = newText;
  }

  return buildMarkdownContent(sections);
}
```

### Editor Fallback

When no changes are specified:

```bash
stm update 42  # No assignments or options
```

The command will:

1. Create temporary file with current task content (full file)
2. Launch `$EDITOR` (or `vi` as fallback)
3. Read edited content
4. Apply changes if modified
5. Clean up temporary file

### Implementation Changes

#### 1. Update Command Options

```typescript
export const updateCommand = new Command('update')
  .description('Update a task')
  .argument('<id>', 'Task ID')
  .argument('[assignments...]', 'Field assignments (key=value, key+=value, key-=value)')
  .option('-d, --description <text>', 'Update description section (use - for stdin)')
  .option('--details <text>', 'Update details section (use - for stdin)')
  .option('--validation <text>', 'Update validation section (use - for stdin)');
// ... existing options
```

#### 2. Add Command Enhancement

```typescript
export const addCommand = new Command('add')
  .description('Add a new task')
  .argument('<title>', 'Task title')
  .option('-d, --description <desc>', 'Task description (use - for stdin)')
  .option('--details <text>', 'Task details section (use - for stdin)')
  .option('--validation <text>', 'Task validation section (use - for stdin)')
  .option('-t, --tags <tags>', 'Comma-separated list of tags');
// ... existing options
```

#### 3. Stdin Support

```typescript
async function readInput(value: string): Promise<string> {
  if (value === '-') {
    return readStdin();
  }
  return value;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

#### 3. Section Parser

```typescript
interface MarkdownSections {
  description: string;
  details?: string;
  validation?: string;
  [key: string]: string | undefined;
}

function parseMarkdownSections(content: string): MarkdownSections {
  const sections: MarkdownSections = { description: '' };
  const lines = content.split('\n');
  let currentSection = 'description';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      // Save previous section
      sections[currentSection] = currentContent.join('\n').trim();
      // Start new section
      currentSection = headingMatch[1].toLowerCase();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  sections[currentSection] = currentContent.join('\n').trim();

  return sections;
}
```

#### 4. Exit Code Behavior

The command must exit with code 2 when no changes are provided:

```typescript
if (!hasChanges && !willOpenEditor) {
  console.error('Error: No changes specified');
  process.exit(2);
}
```

## User Experience

### Common Workflows

#### 1. Create task with piped description

```bash
# Direct string
stm add "New Feature" --description "Implement user authentication"

# From command output or file
cat requirements.md | stm add "New Feature" --description -

# With details and validation sections
stm add "API Endpoint" --description "Create user profile endpoint" \
  --details "Use REST conventions, implement rate limiting" \
  --validation "- [ ] Unit tests\n- [ ] Integration tests\n- [ ] API docs"

# From multiple sources
cat spec.md | stm add "Feature X" --description - \
  --details "See architecture doc" \
  --validation "$(cat test-plan.md)"
```

#### 2. Update validation after testing

```bash
# Direct string
stm update 42 status=done --validation "✓ All tests pass\n✓ Manual QA complete"

# From command output
npm test | stm update 42 --validation -
```

#### 3. Add implementation details

```bash
stm update 42 --details "Implemented using Observer pattern for event handling"
```

#### 4. Quick edit with editor

```bash
stm update 42  # Opens full task in $EDITOR
```

#### 5. Combined metadata and body updates

```bash
stm update 42 status=in-progress --description "Revised approach after design review"
```

### Error Handling

| Scenario                | Behavior                            |
| ----------------------- | ----------------------------------- |
| No changes specified    | Exit with code 2                    |
| Invalid section content | Validation error with clear message |
| Stdin timeout           | Error after 30 seconds              |
| Editor not found        | Fall back to vi, then error         |
| File locked             | Retry with exponential backoff      |

## Testing Strategy

### Unit Tests

1. **Section Parsing**
   - Parse content with all sections
   - Handle missing sections
   - Preserve formatting and whitespace

2. **Section Updates**
   - Update existing sections
   - Create new sections
   - Handle empty sections

3. **Input Handling**
   - String input validation
   - Stdin marker detection
   - Maximum content length

### Integration Tests

1. **Command Execution**
   - Update single section
   - Update multiple sections
   - Combined metadata and body updates
   - Editor integration

2. **File Operations**
   - Atomic writes
   - Lock handling
   - Concurrent updates

### E2E Tests

```typescript
it('should update validation section from stdin', async () => {
  const { stdout, stdin } = await runCommand(['update', '1', '--validation', '-']);
  stdin.write('Test checklist\n- [ ] Unit tests\n- [ ] E2E tests');
  stdin.end();

  const task = await getTask(1);
  expect(task.content).toContain('## Validation\nTest checklist');
});
```

## Performance Considerations

- **Section parsing**: O(n) where n is content length
- **Memory usage**: Content loaded in memory (max 64KB)
- **File operations**: Single atomic write per update
- **Editor launch**: Adds ~100ms for process spawn

No significant performance impact expected for typical usage.

## Security Considerations

1. **Input validation**: All content validated against max length
2. **Shell injection**: Editor command properly escaped
3. **File permissions**: Temporary files created with 0600 permissions
4. **Path traversal**: Not applicable (IDs are numeric)

## Documentation

### Updates Required

1. **README.md**: Add examples for new flags
2. **Man page**: Document section editing behavior
3. **CLI help**: Update command help text
4. **Website docs**: Add section editing guide

### Example Documentation

````markdown
## Updating Task Content

The `update` command supports granular editing of task body sections:

- `--description`: Update the description (main content)
- `--details`: Update implementation details
- `--validation`: Update validation checklist

Each flag accepts a string or `-` to read from stdin:

```bash
# Update description directly
stm update 42 --description "Revised task description"

# Pipe test results to validation
npm test | stm update 42 --validation -

# Open in editor when no options provided
stm update 42
```
````

```

## Implementation Phases

### Phase 1: Core Section Editing (Week 1)
- [ ] Add `--description`, `--details`, `--validation` flags
- [ ] Implement section parsing and updating
- [ ] Basic string input support
- [ ] Exit code 2 for no changes

### Phase 2: Enhanced Input Methods (Week 2)
- [ ] Stdin support with `-` marker
- [ ] Editor fallback implementation
- [ ] Timeout handling for stdin
- [ ] Error message improvements

### Phase 3: Polish and Testing (Week 3)
- [ ] Comprehensive test suite
- [ ] Documentation updates
- [ ] Performance optimization
- [ ] Edge case handling

## Open Questions

1. **Section naming**: Should we support custom section names beyond the three defined?
2. **Section order**: Should sections be reordered to a standard sequence?
3. **Merge behavior**: How to handle conflicts when updating via editor after command-line changes?
4. **Template support**: Should we support section templates in future versions?

## References

- Original STM specification: `/specs/feat-simple-task-master-cli.md`
- Current update command: `/src/commands/update.ts`
- Task file format examples: `/test/fixtures/task-files/`
- Commander.js documentation: https://github.com/tj/commander.js
- Gray-matter documentation: https://github.com/jonschlinkert/gray-matter
```
