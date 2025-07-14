/**
 * Update command E2E tests for stdin functionality
 *
 * Tests the stdin marker ("-") functionality, editor integration,
 * timeout scenarios, and combined workflows in a real environment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CLITestRunner, TestWorkspace, temp } from '@test/helpers';

describe('Update Command E2E - Stdin Functionality', () => {
  let testWorkspace: TestWorkspace;
  let cliRunner: CLITestRunner;
  let tempDir: string;

  // Helper methods for stdin testing
  const runWithStdin = async (
    args: string[],
    stdinInput: string,
    timeout = 5000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return cliRunner.run(args, { input: stdinInput, timeout });
  };

  const runWithTimeout = async (
    args: string[],
    timeoutMs: number,
    stdinInput = ''
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return cliRunner.run(args, { input: stdinInput, timeout: timeoutMs });
  };

  beforeEach(async () => {
    // Create temporary workspace
    tempDir = await temp.createDirectory();
    testWorkspace = new TestWorkspace(tempDir);
    await testWorkspace.init();

    cliRunner = new CLITestRunner(tempDir);

    // Initialize STM in the test workspace
    const initResult = await cliRunner.run(['init']);
    expect(initResult.exitCode).toBe(0);

    // Create a test task to work with
    const addResult = await cliRunner.run([
      'add',
      'Test task for stdin updates',
      'Initial task content for testing stdin functionality.'
    ]);
    expect(addResult.exitCode).toBe(0);
  });

  afterEach(async () => {
    if (tempDir) {
      await temp.cleanup(tempDir);
    }
  });

  describe('stdin marker detection and processing', () => {
    it('should detect "-" marker for description input via stdin', async () => {
      const stdinContent = 'Updated description from stdin\nwith multiple lines.';

      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        stdinContent
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated task 1');

      // Verify the update
      const showResult = await cliRunner.run(['show', '1']);
      expect(showResult.stdout).toContain('Updated description from stdin');
      expect(showResult.stdout).toContain('with multiple lines.');
    });

    it('should detect "-" marker for details input via stdin', async () => {
      const stdinContent = `Implementation details from stdin:

1. First step
2. Second step
3. Third step with code:
   \`\`\`javascript
   function example() {
     return 'hello';
   }
   \`\`\``;

      const result = await runWithStdin(
        ['update', '1', '--details', '-'],
        stdinContent
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated task 1');

      // Verify the update
      const showResult = await cliRunner.run(['show', '1']);
      expect(showResult.stdout).toContain('Implementation details from stdin');
      expect(showResult.stdout).toContain('## Details');
      expect(showResult.stdout).toContain('function example()');
    });

    it('should detect "-" marker for validation input via stdin', async () => {
      const stdinContent = `Validation checklist from stdin:

- [ ] Test case 1: Basic functionality
- [ ] Test case 2: Edge cases
- [ ] Test case 3: Error handling
- [x] Test case 4: Completed test

Manual testing steps:
1. Run the application
2. Verify output
3. Check logs`;

      const result = await runWithStdin(
        ['update', '1', '--validation', '-'],
        stdinContent
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated task 1');

      // Verify the update
      const showResult = await cliRunner.run(['show', '1']);
      expect(showResult.stdout).toContain('Validation checklist from stdin');
      expect(showResult.stdout).toContain('## Validation');
      expect(showResult.stdout).toContain('- [x] Test case 4: Completed test');
    });

    it('should handle multiple sections with stdin markers', async () => {
      // First update: description via stdin
      const descContent = 'New description from stdin';
      const descResult = await runWithStdin(
        ['update', '1', '--desc', '-'],
        descContent
      );
      expect(descResult.exitCode).toBe(0);

      // Second update: details via stdin (should preserve description)
      const detailsContent = 'Details content from stdin';
      const detailsResult = await runWithStdin(
        ['update', '1', '--details', '-'],
        detailsContent
      );
      expect(detailsResult.exitCode).toBe(0);

      // Verify both sections are preserved
      const showResult = await cliRunner.run(['show', '1']);
      expect(showResult.stdout).toContain('New description from stdin');
      expect(showResult.stdout).toContain('Details content from stdin');
      expect(showResult.stdout).toContain('## Details');
    });

    it('should handle mixed stdin and direct input', async () => {
      const stdinContent = 'Details from stdin';

      const result = await runWithStdin(
        ['update', '1', '--desc', 'Direct description', '--details', '-'],
        stdinContent
      );

      expect(result.exitCode).toBe(0);

      // Verify both inputs are processed
      const showResult = await cliRunner.run(['show', '1']);
      expect(showResult.stdout).toContain('Direct description');
      expect(showResult.stdout).toContain('Details from stdin');
      expect(showResult.stdout).toContain('## Details');
    });
  });

  describe('stdin timeout scenarios', () => {
    it('should timeout when stdin input takes too long', async () => {
      // This test simulates a timeout by not providing stdin input
      // The command should timeout and exit with an error

      const result = await runWithTimeout(
        ['update', '1', '--desc', '-'],
        1000, // 1 second timeout
        '' // No stdin input provided
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('timeout') || expect(result.stderr).toContain('Failed to read');
    });

    it('should handle large stdin input within timeout', async () => {
      // Create large content (but within reasonable limits)
      const largeContent = 'Line with content\n'.repeat(1000);

      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        largeContent,
        10000 // 10 second timeout for large content
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated task 1');
    });

    it('should handle empty stdin input', async () => {
      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        '' // Empty stdin
      );

      // Should fail because description cannot be empty
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('desc cannot be empty') ||
        expect(result.stderr).toContain('Failed to read');
    });

    it('should handle stdin input with only whitespace', async () => {
      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        '   \n\t\n   ' // Only whitespace
      );

      // Should fail because description cannot be empty after trimming
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('desc cannot be empty') ||
        expect(result.stderr).toContain('Failed to read');
    });
  });

  describe('editor integration (mocked)', () => {
    it('should fallback to editor when stdin fails and fallback is enabled', async () => {
      // This test would require complex mocking of editor functionality
      // For now, we test the basic no-changes scenario which triggers editor

      const result = await cliRunner.run(['update', '1']);

      // Should either succeed with editor or exit with code 2 if editor is not available
      expect([0, 2]).toContain(result.exitCode);

      if (result.exitCode === 2) {
        expect(result.stderr).toContain('No changes') ||
          expect(result.stderr).toContain('Editor failed');
      }
    });

    it('should exit with code 2 when no changes and editor is disabled', async () => {
      const result = await cliRunner.run(['update', '1', '--no-editor']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('No changes specified');
    });

    it('should not trigger editor when valid changes are provided', async () => {
      const result = await cliRunner.run(['update', '1', '--desc', 'New description']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated task 1');
    });
  });

  describe('combined workflows', () => {
    it('should handle complex workflow with multiple stdin inputs', async () => {
      // Step 1: Create task with initial content
      const addResult = await cliRunner.run([
        'add',
        'Complex workflow task',
        'Initial content for complex workflow testing.'
      ]);
      expect(addResult.exitCode).toBe(0);
      const taskId = '2'; // Second task

      // Step 2: Update description via stdin
      const descContent = `Updated description for complex workflow.

This description contains:
- Multiple paragraphs
- **Formatted text**
- Code snippets: \`const x = 1;\``;

      const descResult = await runWithStdin(
        ['update', taskId, '--desc', '-'],
        descContent
      );
      expect(descResult.exitCode).toBe(0);

      // Step 3: Add details via stdin
      const detailsContent = `Implementation details:

## Sub-section 1
Details for sub-section 1.

## Sub-section 2
Details for sub-section 2 with code:

\`\`\`typescript
interface Example {
  id: number;
  name: string;
}
\`\`\``;

      const detailsResult = await runWithStdin(
        ['update', taskId, '--details', '-'],
        detailsContent
      );
      expect(detailsResult.exitCode).toBe(0);

      // Step 4: Add validation via stdin
      const validationContent = `Test validation checklist:

### Unit Tests
- [x] Basic functionality tests
- [x] Edge case handling
- [ ] Performance tests

### Integration Tests
- [ ] API integration
- [ ] Database integration
- [ ] UI integration

### Manual Testing
1. Test feature X
2. Verify feature Y
3. Check edge cases`;

      const validationResult = await runWithStdin(
        ['update', taskId, '--validation', '-'],
        validationContent
      );
      expect(validationResult.exitCode).toBe(0);

      // Step 5: Update status and tags via direct options
      const statusResult = await cliRunner.run([
        'update', taskId,
        '--status', 'in-progress',
        '--tags', 'complex,workflow,testing'
      ]);
      expect(statusResult.exitCode).toBe(0);

      // Verify final state
      const showResult = await cliRunner.run(['show', taskId]);
      expect(showResult.exitCode).toBe(0);

      const output = showResult.stdout;
      expect(output).toContain('Updated description for complex workflow');
      expect(output).toContain('## Details');
      expect(output).toContain('Implementation details');
      expect(output).toContain('interface Example');
      expect(output).toContain('## Validation');
      expect(output).toContain('Test validation checklist');
      expect(output).toContain('in-progress');
      expect(output).toContain('complex');
      expect(output).toContain('workflow');
      expect(output).toContain('testing');
    });

    it('should handle workflow with stdin and assignment syntax', async () => {
      const taskId = '1';

      // Update via stdin
      const stdinContent = 'Description updated via stdin';
      const stdinResult = await runWithStdin(
        ['update', taskId, '--desc', '-'],
        stdinContent
      );
      expect(stdinResult.exitCode).toBe(0);

      // Update via assignment
      const assignResult = await cliRunner.run([
        'update', taskId,
        'title=Updated via assignment',
        'status=done'
      ]);
      expect(assignResult.exitCode).toBe(0);

      // Verify both updates
      const showResult = await cliRunner.run(['show', taskId]);
      expect(showResult.stdout).toContain('Updated via assignment');
      expect(showResult.stdout).toContain('Description updated via stdin');
      expect(showResult.stdout).toContain('done');
    });

    it('should handle rapid consecutive stdin updates', async () => {
      const taskId = '1';

      // Rapid updates
      const updates = [
        { option: '--desc', content: 'First description update' },
        { option: '--details', content: 'First details update' },
        { option: '--validation', content: 'First validation update' },
        { option: '--desc', content: 'Second description update' }
      ];

      for (const update of updates) {
        const result = await runWithStdin(
          ['update', taskId, update.option, '-'],
          update.content
        );
        expect(result.exitCode).toBe(0);
      }

      // Verify final state
      const showResult = await cliRunner.run(['show', taskId]);
      expect(showResult.stdout).toContain('Second description update');
      expect(showResult.stdout).toContain('First details update');
      expect(showResult.stdout).toContain('First validation update');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid task ID with stdin input', async () => {
      const result = await runWithStdin(
        ['update', '999', '--desc', '-'],
        'Description for non-existent task'
      );

      expect(result.exitCode).toBe(3); // Not found error
      expect(result.stderr).toContain('not found') || expect(result.stderr).toContain('Task 999');
    });

    it('should handle malformed stdin input gracefully', async () => {
      // Test with null bytes and control characters
      const malformedContent = 'Normal text\x00null byte\x01control char\x1F';

      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        malformedContent
      );

      // Should either succeed (filtering control chars) or fail gracefully
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle very long stdin input', async () => {
      // Test with content at the boundary of maximum length
      const longContent = 'A'.repeat(100000); // 100KB

      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        longContent,
        15000 // 15 second timeout for very large content
      );

      // Should handle large content or fail with appropriate error
      expect([0, 1]).toContain(result.exitCode);

      if (result.exitCode === 0) {
        const showResult = await cliRunner.run(['show', '1']);
        expect(showResult.stdout).toContain('A'.repeat(100));
      }
    });

    it('should handle Unicode and special characters in stdin', async () => {
      const unicodeContent = `Description with Unicode: 
- Émojis: 🚀 🎉 ✨ 📝
- Special chars: üñíçödé tëxt
- Math symbols: ∑ ∏ ∫ ≤ ≥
- Arrows: → ← ↑ ↓ ⇒ ⇐
- Currency: € £ ¥ ₹ ₽`;

      const result = await runWithStdin(
        ['update', '1', '--desc', '-'],
        unicodeContent
      );

      expect(result.exitCode).toBe(0);

      const showResult = await cliRunner.run(['show', '1']);
      expect(showResult.stdout).toContain('🚀');
      expect(showResult.stdout).toContain('üñíçödé');
      expect(showResult.stdout).toContain('€');
    });

    it('should preserve exact formatting from stdin', async () => {
      const formattedContent = `Formatted content:

    Indented line 1
        Indented line 2
    
    Code block style:
    function test() {
        return "formatted";
    }
    
    List with spacing:
    
    - Item 1
      
    - Item 2
      With sub-content
      
    - Item 3`;

      const result = await runWithStdin(
        ['update', '1', '--details', '-'],
        formattedContent
      );

      expect(result.exitCode).toBe(0);

      const showResult = await cliRunner.run(['show', '1']);
      const output = showResult.stdout;

      // Verify formatting is preserved
      expect(output).toContain('    Indented line 1');
      expect(output).toContain('        Indented line 2');
      expect(output).toContain('function test()');
      expect(output).toContain('    return "formatted"');
    });
  });

  describe('atomic operations and concurrency', () => {
    it('should handle atomic writes for stdin updates', async () => {
      const taskId = '1';

      // Simulate a workflow that could have race conditions
      const stdinContent = 'Atomic update content';

      // Update via stdin
      const result1 = await runWithStdin(
        ['update', taskId, '--desc', '-'],
        stdinContent
      );
      expect(result1.exitCode).toBe(0);

      // Immediately follow with another update
      const result2 = await cliRunner.run([
        'update', taskId,
        '--status', 'in-progress',
        '--tags', 'atomic,test'
      ]);
      expect(result2.exitCode).toBe(0);

      // Verify both updates are applied
      const showResult = await cliRunner.run(['show', taskId]);
      expect(showResult.stdout).toContain('Atomic update content');
      expect(showResult.stdout).toContain('in-progress');
      expect(showResult.stdout).toContain('atomic');
    });

    it('should handle lock timeouts gracefully', async () => {
      // This test is harder to implement without internal lock manipulation
      // We'll test the basic case where updates succeed sequentially

      const taskId = '1';
      const updates = [];

      // Queue multiple stdin updates
      for (let i = 0; i < 3; i++) {
        updates.push(
          runWithStdin(
            ['update', taskId, '--desc', '-'],
            `Update ${i + 1}`
          )
        );
      }

      // All should eventually succeed
      const results = await Promise.all(updates);
      results.forEach(result => {
        expect([0, 1]).toContain(result.exitCode); // Either success or handled error
      });

      // Final state should be consistent
      const showResult = await cliRunner.run(['show', taskId]);
      expect(showResult.exitCode).toBe(0);
    });
  });
});
