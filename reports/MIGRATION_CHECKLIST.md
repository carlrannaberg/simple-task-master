# Migration Checklist: Remove \_contentMetadata Hack

## Pre-Migration

- [ ] **Backup all task files**
  ```bash
  cp -r .simple-task-master/tasks .simple-task-master/tasks.backup
  ```
- [ ] **Review current tests** - Ensure all tests are passing
- [ ] **Create migration branch**
  ```bash
  git checkout -b remove-content-metadata-hack
  ```

## Implementation

- [x] **Create `src/lib/frontmatter-parser.ts`**
  - Custom YAML frontmatter parser
  - Preserves content exactly as written
  - No newline manipulation
- [x] **Add unit tests for FrontmatterParser**
  - `test/unit/frontmatter-parser.spec.ts`
  - Tests for all edge cases
  - Round-trip preservation tests
- [x] **Update task-manager.ts**
  - Replace `import matter from 'gray-matter'` with `import { FrontmatterParser }`
  - Remove \_contentMetadata logic from create method (lines 96-109)
  - Remove \_contentMetadata logic from update method (lines 286-299)
  - Simplify readTaskFile method (lines 467-503)
- [x] **Add content preservation tests**
  - `test/unit/task-manager-content-preservation.spec.ts`
  - Verify no \_contentMetadata in files
  - Test all content edge cases

- [x] **Create migration script**
  - `scripts/migrate-remove-content-metadata.ts`
  - Removes \_contentMetadata from existing files
  - Reports migration statistics

## Validation

- [ ] **Run TypeScript compiler**
  ```bash
  npm run typecheck
  ```
- [ ] **Run all unit tests**
  ```bash
  npm test test/unit
  ```
- [ ] **Run integration tests**
  ```bash
  npm test test/integration
  ```
- [ ] **Run e2e tests**
  ```bash
  npm test test/e2e
  ```
- [ ] **Test content preservation manually**

  ```bash
  # Test empty content
  echo -n "" | stm add "Empty Test" --stdin

  # Test no trailing newline
  echo -n "No newline" | stm add "No Newline Test" --stdin

  # Verify files don't have _contentMetadata
  grep -r "_contentMetadata" .simple-task-master/tasks/
  ```

## Migration

- [ ] **Run migration script on test data**
  ```bash
  cp -r .simple-task-master/tasks .simple-task-master/tasks.test
  npx ts-node scripts/migrate-remove-content-metadata.ts .simple-task-master/tasks.test
  ```
- [ ] **Verify migrated files**
  - Check that \_contentMetadata is removed
  - Verify content is preserved correctly
- [ ] **Run migration on production data**
  ```bash
  npx ts-node scripts/migrate-remove-content-metadata.ts
  ```

## Cleanup

- [ ] **Remove gray-matter dependency**
  ```bash
  npm uninstall gray-matter
  npm install  # Update lock file
  ```
- [ ] **Update documentation**
  - Remove any references to gray-matter
  - Document the custom frontmatter parser
- [ ] **Create pull request**
  - Include all changes
  - Reference this migration guide
  - Add test results

## Post-Migration Verification

- [ ] **No \_contentMetadata in any files**
  ```bash
  find .simple-task-master/tasks -name "*.md" -exec grep -l "_contentMetadata" {} \;
  ```
- [ ] **All tests passing**
  ```bash
  npm test
  ```
- [ ] **Manual testing of edge cases**
  - Empty content preserved
  - Content without trailing newlines preserved
  - Update operations preserve content format
- [ ] **Performance check**
  - Compare task creation/reading speed
  - Should be similar or better than gray-matter

## Rollback Plan (if needed)

1. **Revert code changes**
   ```bash
   git checkout main -- src/lib/task-manager.ts
   ```
2. **Re-install gray-matter**
   ```bash
   npm install gray-matter
   ```
3. **Note**: Files with \_contentMetadata removed will still work with old code

## Success Criteria

- ✅ All tests pass
- ✅ No \_contentMetadata in task files
- ✅ Content preservation works correctly
- ✅ No performance regression
- ✅ Code is cleaner and more maintainable
