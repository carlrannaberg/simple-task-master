# Migration Guide: Removing \_contentMetadata Hack

This guide describes the process of migrating from gray-matter to a custom FrontmatterParser implementation that preserves content exactly as written.

## Overview

The migration replaces the gray-matter library with a custom implementation that:

- Preserves empty content as empty (not as '\n')
- Preserves content without trailing newlines exactly
- Eliminates the need for the `_contentMetadata` workaround
- Maintains full compatibility with existing task file format

## Migration Steps

### 1. Install Dependencies

No new dependencies are needed - we already use `js-yaml` which is sufficient.

### 2. Apply Code Changes

The following files have been created/modified:

#### New Files:

- `src/lib/frontmatter-parser.ts` - Custom frontmatter parser implementation
- `test/unit/frontmatter-parser.spec.ts` - Comprehensive tests for the parser
- `test/unit/task-manager-content-preservation.spec.ts` - Content preservation tests
- `scripts/migrate-remove-content-metadata.ts` - Migration script for existing files

#### Modified Files:

- `src/lib/task-manager.ts` - Updated to use FrontmatterParser instead of gray-matter

### 3. Run Tests

```bash
# Run all tests to ensure nothing is broken
npm test

# Run specific test suites
npm test test/unit/frontmatter-parser.spec.ts
npm test test/unit/task-manager-content-preservation.spec.ts
```

### 4. Migrate Existing Task Files

If you have existing task files that contain `_contentMetadata`, run the migration script:

```bash
# Default location (.simple-task-master/tasks)
npx ts-node scripts/migrate-remove-content-metadata.ts

# Custom location
npx ts-node scripts/migrate-remove-content-metadata.ts /path/to/tasks
```

The migration script will:

- Scan all .md files in the tasks directory
- Remove `_contentMetadata` from any files that contain it
- Preserve the actual content exactly as stored
- Report statistics on files migrated

### 5. Remove gray-matter Dependency

After successful migration:

```bash
npm uninstall gray-matter
```

## Key Changes

### Before (with gray-matter):

```typescript
// Content preservation required metadata hack
const taskData =
  content === '' || !content.endsWith('\n')
    ? {
        ...task,
        _contentMetadata: {
          wasEmpty: content === '',
          hadNoTrailingNewline: !content.endsWith('\n')
        }
      }
    : task;

const fileContent = matter.stringify(content, taskData);
```

### After (with FrontmatterParser):

```typescript
// Content is preserved exactly as provided
const fileContent = FrontmatterParser.stringify(content, task);
```

### Reading Files

```typescript
// Before
const { data, content } = matter(fileContent);
// Complex logic to restore original content using _contentMetadata

// After
const { data, content } = FrontmatterParser.parse(fileContent);
// Content is already correct, no restoration needed
```

## Verification

To verify the migration was successful:

1. Check that no files contain `_contentMetadata`:

   ```bash
   grep -r "_contentMetadata" .simple-task-master/tasks/
   ```

2. Create test tasks with edge cases:

   ```bash
   # Empty content
   stm add "Test Empty" --description ""

   # No trailing newline
   echo -n "No newline" | stm add "Test No Newline" --stdin

   # Verify content preservation
   stm show <task-id> --format yaml
   ```

3. Run the full test suite:
   ```bash
   npm test
   ```

## Rollback Plan

If issues arise, you can rollback by:

1. Restore the original `task-manager.ts` from git
2. Re-install gray-matter: `npm install gray-matter`
3. Keep the `_contentMetadata` in files (it doesn't affect functionality)

## Benefits

1. **Exact Content Preservation**: No more newline manipulation
2. **Cleaner Code**: Removed workaround logic
3. **Better Performance**: Custom parser is simpler and faster
4. **Fewer Dependencies**: One less external dependency
5. **Full Control**: Can customize behavior as needed

## Risk Assessment

### Low Risk:

- File format remains unchanged (except for removing `_contentMetadata`)
- All existing functionality preserved
- Comprehensive test coverage

### Mitigations:

- Migration script backs up files before modifying (in memory)
- Can be tested on a copy of the data first
- Easy rollback if needed
