import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner, runSTMSuccess, runSTMFailure, cliUtils } from '@test/helpers/cli-runner';

describe('CLI Unknown Fields E2E', () => {
  let workspace: TestWorkspace;
  let cli: CLITestRunner;

  beforeEach(async () => {
    workspace = await TestWorkspace.create('cli-unknown-fields-');
    cli = new CLITestRunner({ cwd: workspace.directory });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('Full workflow with unknown fields', () => {
    it('should support complete CLI workflow: add → update with unknown fields → show → list', async () => {
      // Step 1: Add a new task
      const { taskId } = await cli.addTask('Project Documentation', {
        description: 'Create comprehensive project documentation',
        tags: ['docs', 'priority'],
        status: 'pending'
      });
      expect(taskId).toBe(1);

      // Step 2: Update task with multiple unknown fields
      const updateResult = await cli.run([
        'update',
        taskId.toString(),
        'assignee=john.doe@example.com',
        'priority=high',
        'estimated_hours=8',
        'sprint=Sprint-23',
        'team=backend',
        'reviewed_by=jane.smith@example.com',
        'ticket_url=https://jira.example.com/PROJ-123'
      ]);
      expect(updateResult.exitCode).toBe(0);

      // Step 3: Show task with JSON format to verify all fields
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      // Verify core fields
      expect(task.id).toBe(1);
      expect(task.title).toBe('Project Documentation');
      expect(task.status).toBe('pending');
      expect(task.tags).toEqual(['docs', 'priority']);
      
      // Verify unknown fields are preserved
      expect(task.assignee).toBe('john.doe@example.com');
      expect(task.priority).toBe('high');
      expect(task.estimated_hours).toBe('8');
      expect(task.sprint).toBe('Sprint-23');
      expect(task.team).toBe('backend');
      expect(task.reviewed_by).toBe('jane.smith@example.com');
      expect(task.ticket_url).toBe('https://jira.example.com/PROJ-123');

      // Step 4: List tasks with JSON format to verify unknown fields in list
      const listResult = await cli.listTasks({ format: 'json' });
      const tasks = JSON.parse(listResult.stdout);
      expect(tasks).toHaveLength(1);
      
      const listedTask = tasks[0];
      expect(listedTask.assignee).toBe('john.doe@example.com');
      expect(listedTask.priority).toBe('high');
      expect(listedTask.sprint).toBe('Sprint-23');
    });

    it('should handle workflow with mixed core and unknown field updates', async () => {
      // Create task
      const { taskId } = await cli.addTask('Feature Implementation');

      // Update with mix of core and unknown fields
      const updateResult = await cli.run([
        'update',
        taskId.toString(),
        '--status', 'in-progress',
        '--tags', 'feature,backend',
        'component=authentication',
        'risk_level=medium',
        'stakeholder=product_team'
      ]);
      expect(updateResult.exitCode).toBe(0);

      // Verify all fields
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task.status).toBe('in-progress');
      expect(task.tags).toEqual(['feature', 'backend']);
      expect(task.component).toBe('authentication');
      expect(task.risk_level).toBe('medium');
      expect(task.stakeholder).toBe('product_team');
    });
  });

  describe('Multiple unknown field assignments', () => {
    it('should handle multiple unknown field assignments in a single command', async () => {
      const { taskId } = await cli.addTask('Complex Task');

      // Update with many fields at once
      const fields = [
        'category=bug-fix',
        'severity=critical',
        'customer=ACME Corp',
        'region=us-west-2',
        'environment=production',
        'release_version=2.5.0',
        'qa_status=pending',
        'deploy_date=2024-03-15',
        'rollback_plan=automated',
        'monitoring_dashboard=https://metrics.example.com/dash-123'
      ];

      const updateResult = await cli.run(['update', taskId.toString(), ...fields]);
      expect(updateResult.exitCode).toBe(0);

      // Verify all fields were set
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task.category).toBe('bug-fix');
      expect(task.severity).toBe('critical');
      expect(task.customer).toBe('ACME Corp');
      expect(task.region).toBe('us-west-2');
      expect(task.environment).toBe('production');
      expect(task.release_version).toBe('2.5.0');
      expect(task.qa_status).toBe('pending');
      expect(task.deploy_date).toBe('2024-03-15');
      expect(task.rollback_plan).toBe('automated');
      expect(task.monitoring_dashboard).toBe('https://metrics.example.com/dash-123');
    });

    it('should update unknown fields over multiple commands', async () => {
      const { taskId } = await cli.addTask('Incremental Updates Task');

      // First update
      await cli.runSuccess(['update', taskId.toString(), 'phase=planning']);
      
      // Second update
      await cli.runSuccess(['update', taskId.toString(), 'phase=development', 'developer=alice']);
      
      // Third update
      await cli.runSuccess(['update', taskId.toString(), 'phase=testing', 'tester=bob']);

      // Verify final state
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task.phase).toBe('testing'); // Last update wins
      expect(task.developer).toBe('alice'); // Preserved from second update
      expect(task.tester).toBe('bob'); // Added in third update
    });
  });

  describe('JSON output preservation', () => {
    it('should preserve unknown fields in JSON show output', async () => {
      const { taskId } = await cli.addTask('JSON Test Task');
      
      // Add various types of values
      await cli.runSuccess([
        'update',
        taskId.toString(),
        'string_field=simple text',
        'number_field=42',
        'boolean_field=true',
        'url_field=https://example.com/path?query=value',
        'email_field=test@example.com',
        'json_string={"nested": "value"}',
        'array_string=[1, 2, 3]',
        'empty_field='
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      // All values are stored as strings
      expect(task.string_field).toBe('simple text');
      expect(task.number_field).toBe('42');
      expect(task.boolean_field).toBe('true');
      expect(task.url_field).toBe('https://example.com/path?query=value');
      expect(task.email_field).toBe('test@example.com');
      expect(task.json_string).toBe('{"nested": "value"}');
      expect(task.array_string).toBe('[1, 2, 3]');
      expect(task.empty_field).toBe(''); // Empty values are allowed for unknown fields
    });

    it('should preserve unknown fields in JSON list output', async () => {
      // Create multiple tasks with different unknown fields
      const { taskId: taskId1 } = await cli.addTask('Task One');
      await cli.runSuccess(['update', taskId1.toString(), 'project=Alpha', 'status_code=ALPHA-001']);

      const { taskId: taskId2 } = await cli.addTask('Task Two');
      await cli.runSuccess(['update', taskId2.toString(), 'project=Beta', 'status_code=BETA-002']);

      const { taskId: taskId3 } = await cli.addTask('Task Three');
      await cli.runSuccess(['update', taskId3.toString(), 'project=Gamma', 'status_code=GAMMA-003']);

      // List with JSON format
      const listResult = await cli.listTasks({ format: 'json' });
      const tasks = JSON.parse(listResult.stdout);
      
      expect(tasks).toHaveLength(3);
      
      // Verify each task has its unknown fields
      const taskOne = tasks.find((t: any) => t.id === taskId1);
      expect(taskOne.project).toBe('Alpha');
      expect(taskOne.status_code).toBe('ALPHA-001');

      const taskTwo = tasks.find((t: any) => t.id === taskId2);
      expect(taskTwo.project).toBe('Beta');
      expect(taskTwo.status_code).toBe('BETA-002');

      const taskThree = tasks.find((t: any) => t.id === taskId3);
      expect(taskThree.project).toBe('Gamma');
      expect(taskThree.status_code).toBe('GAMMA-003');
    });

    it('should include unknown fields in export output', async () => {
      // Create tasks with unknown fields
      const { taskId: taskId1 } = await cli.addTask('Export Test 1');
      await cli.runSuccess(['update', taskId1.toString(), 'client=ClientA', 'invoice_number=INV-2024-001']);

      const { taskId: taskId2 } = await cli.addTask('Export Test 2');
      await cli.runSuccess(['update', taskId2.toString(), 'client=ClientB', 'invoice_number=INV-2024-002']);

      // Export to file
      const exportFile = path.join(workspace.directory, 'export-with-unknown.json');
      await cli.exportTasks('json', exportFile);

      // Read and verify export
      const exportContent = await fs.readFile(exportFile, 'utf8');
      const exportedTasks = JSON.parse(exportContent);

      expect(exportedTasks).toHaveLength(2);
      
      const task1 = exportedTasks.find((t: any) => t.id === taskId1);
      expect(task1.client).toBe('ClientA');
      expect(task1.invoice_number).toBe('INV-2024-001');

      const task2 = exportedTasks.find((t: any) => t.id === taskId2);
      expect(task2.client).toBe('ClientB');
      expect(task2.invoice_number).toBe('INV-2024-002');
    });
  });

  describe('Error handling for invalid field names', () => {
    it('should reject field names with newlines', async () => {
      const { taskId } = await cli.addTask('Error Test Task');

      const result = await runSTMFailure(
        ['update', taskId.toString(), 'field\nwith\nnewlines=value'],
        { cwd: workspace.directory }
      );
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Field names cannot contain newlines');
    });

    it('should reject field names with carriage returns', async () => {
      const { taskId } = await cli.addTask('Error Test Task');

      const result = await runSTMFailure(
        ['update', taskId.toString(), 'field\rwith\rreturns=value'],
        { cwd: workspace.directory }
      );
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Field names cannot contain newlines');
    });

    it('should reject field names with leading/trailing whitespace', async () => {
      const { taskId } = await cli.addTask('Error Test Task');

      // Leading whitespace
      const result1 = await runSTMFailure(
        ['update', taskId.toString(), '  field=value'],
        { cwd: workspace.directory }
      );
      expect(result1.exitCode).not.toBe(0);
      expect(result1.stderr).toContain('Field names cannot have leading/trailing whitespace');

      // Trailing whitespace
      const result2 = await runSTMFailure(
        ['update', taskId.toString(), 'field  =value'],
        { cwd: workspace.directory }
      );
      expect(result2.exitCode).not.toBe(0);
      expect(result2.stderr).toContain('Field names cannot have leading/trailing whitespace');
    });

    it('should reject field names with control characters', async () => {
      const { taskId } = await cli.addTask('Error Test Task');

      // Test control characters that can be passed through command line
      // Skip null byte since Node.js spawn doesn't allow it
      const controlChars = [
        '\x01', // SOH
        '\x02', // STX
        '\x08', // BS
        '\x0B', // VT
        '\x0C', // FF
        '\x0E', // SO
        '\x0F', // SI
        '\x1F'  // US
      ];

      for (const char of controlChars) {
        const result = await runSTMFailure(
          ['update', taskId.toString(), `field${char}name=value`],
          { cwd: workspace.directory }
        );
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Field names cannot contain control characters');
      }
    });

    it('should allow tab character in field names', async () => {
      const { taskId } = await cli.addTask('Tab Test Task');

      // Tab character should be allowed
      const result = await runSTMSuccess(
        ['update', taskId.toString(), 'field\tname=value'],
        { cwd: workspace.directory }
      );
      expect(result.exitCode).toBe(0);

      // Verify the field was saved
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      expect(task['field\tname']).toBe('value');
    });

    it('should handle invalid assignment formats', async () => {
      const { taskId } = await cli.addTask('Assignment Test Task');

      // No equals sign
      const result1 = await runSTMFailure(
        ['update', taskId.toString(), 'fieldwithoutequals'],
        { cwd: workspace.directory }
      );
      expect(result1.exitCode).not.toBe(0);
      expect(result1.stderr).toContain('Invalid assignment format');

      // Empty field name
      const result2 = await runSTMFailure(
        ['update', taskId.toString(), '=value'],
        { cwd: workspace.directory }
      );
      expect(result2.exitCode).not.toBe(0);
      expect(result2.stderr).toContain('Invalid = assignment format');
    });
  });

  describe('Interaction with existing CLI features', () => {
    it('should work with array operations on known fields', async () => {
      const { taskId } = await cli.addTask('Array Operations Task');

      // Add unknown fields and use array operations on known fields
      await cli.runSuccess([
        'update',
        taskId.toString(),
        'custom_field=value',
        'tags+=urgent',
        'tags+=bug',
        'another_field=data'
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task.custom_field).toBe('value');
      expect(task.another_field).toBe('data');
      expect(task.tags).toContain('urgent');
      expect(task.tags).toContain('bug');
    });

    it('should preserve unknown fields when updating core fields', async () => {
      const { taskId } = await cli.addTask('Preservation Test');

      // First, add unknown fields
      await cli.runSuccess([
        'update',
        taskId.toString(),
        'metadata1=value1',
        'metadata2=value2'
      ]);

      // Update core fields
      await cli.updateTask(taskId, {
        title: 'Updated Title',
        status: 'in-progress',
        tags: ['updated']
      });

      // Verify unknown fields are preserved
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task.title).toBe('Updated Title');
      expect(task.status).toBe('in-progress');
      expect(task.tags).toEqual(['updated']);
      expect(task.metadata1).toBe('value1');
      expect(task.metadata2).toBe('value2');
    });

    it('should handle unknown fields with special characters in values', async () => {
      const { taskId } = await cli.addTask('Special Characters Test');

      // Test various special characters in values
      await cli.runSuccess([
        'update',
        taskId.toString(),
        'query=SELECT * FROM tasks WHERE id = 1',
        'path=/usr/local/bin/app',
        'regex=^[a-zA-Z0-9]+$',
        'emoji=🚀 Launch ready! 🎉',
        'unicode=ñáñà 中文 русский',
        'quotes=He said "Hello, World!"',
        'newline_escaped=Line 1\\nLine 2\\nLine 3'
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task.query).toBe('SELECT * FROM tasks WHERE id = 1');
      expect(task.path).toBe('/usr/local/bin/app');
      expect(task.regex).toBe('^[a-zA-Z0-9]+$');
      expect(task.emoji).toBe('🚀 Launch ready! 🎉');
      expect(task.unicode).toBe('ñáñà 中文 русский');
      expect(task.quotes).toBe('He said "Hello, World!"');
      expect(task.newline_escaped).toBe('Line 1\\nLine 2\\nLine 3');
    });

    it('should show unknown fields in markdown file content', async () => {
      // Create tasks with unknown fields
      const { taskId: taskId1 } = await cli.addTask('Search Test 1');
      await cli.runSuccess(['update', taskId1.toString(), 'project_code=PROJ-ALPHA-2024']);

      const { taskId: taskId2 } = await cli.addTask('Search Test 2');
      await cli.runSuccess(['update', taskId2.toString(), 'project_code=PROJ-BETA-2024']);

      // Unknown fields are stored in YAML frontmatter, not searchable via grep
      // Instead, verify they appear in the show output
      const showResult1 = await cli.showTask(taskId1);
      expect(showResult1.stdout).toContain('Search Test 1');
      expect(showResult1.stdout).toContain('project_code: "PROJ-ALPHA-2024"'); // YAML quotes string values

      const showResult2 = await cli.showTask(taskId2);
      expect(showResult2.stdout).toContain('Search Test 2');
      expect(showResult2.stdout).toContain('project_code: "PROJ-BETA-2024"'); // YAML quotes string values
    });

    it('should handle unknown fields in combination with content sections', async () => {
      const { taskId } = await cli.addTask('Combined Test');

      // Update with both content sections and unknown fields
      await cli.runSuccess([
        'update',
        taskId.toString(),
        '--description', 'Task description content',
        '--details', 'Implementation details here',
        'custom_status=awaiting_review',
        'assigned_team=backend',
        'complexity=high'
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      // Verify content sections
      expect(task.content).toContain('Task description content');
      expect(task.content).toContain('Implementation details here');
      
      // Verify unknown fields
      expect(task.custom_status).toBe('awaiting_review');
      expect(task.assigned_team).toBe('backend');
      expect(task.complexity).toBe('high');
    });
  });

  describe('Field name edge cases', () => {
    it('should handle field names with dashes in the middle', async () => {
      const { taskId } = await cli.addTask('Dash Fields Test');

      // Field names with dashes in the middle are allowed
      // Field names starting with dashes would be parsed as options by the CLI
      await cli.runSuccess([
        'update',
        taskId.toString(),
        'field-with-dashes=value1', // Contains dashes
        'field_with_underscores=value2',
        'field.with.dots=value3'
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task['field-with-dashes']).toBe('value1');
      expect(task['field_with_underscores']).toBe('value2');
      expect(task['field.with.dots']).toBe('value3');
    });

    it('should handle very long field names and values', async () => {
      const { taskId } = await cli.addTask('Long Fields Test');

      const longFieldName = 'a'.repeat(100) + '_field';
      const longValue = 'This is a very long value. '.repeat(50).trim(); // ~1350 characters, trimmed

      await cli.runSuccess([
        'update',
        taskId.toString(),
        `${longFieldName}=${longValue}`
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task[longFieldName]).toBe(longValue);
    });

    it('should handle field names with special syntax characters', async () => {
      const { taskId } = await cli.addTask('Special Syntax Test');

      // Various special characters in field names
      await cli.runSuccess([
        'update',
        taskId.toString(),
        'field.with.dots=value1',
        'field:with:colons=value2',
        'field/with/slashes=value3',
        'field@with@at=value4',
        'field#with#hash=value5',
        'field$with$dollar=value6',
        'field%with%percent=value7',
        'field&with&ampersand=value8',
        'field*with*asterisk=value9',
        'field(with)parens=value10',
        'field[with]brackets=value11',
        'field{with}braces=value12'
      ]);

      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      expect(task['field.with.dots']).toBe('value1');
      expect(task['field:with:colons']).toBe('value2');
      expect(task['field/with/slashes']).toBe('value3');
      expect(task['field@with@at']).toBe('value4');
      expect(task['field#with#hash']).toBe('value5');
      expect(task['field$with$dollar']).toBe('value6');
      expect(task['field%with%percent']).toBe('value7');
      expect(task['field&with&ampersand']).toBe('value8');
      expect(task['field*with*asterisk']).toBe('value9');
      expect(task['field(with)parens']).toBe('value10');
      expect(task['field[with]brackets']).toBe('value11');
      expect(task['field{with}braces']).toBe('value12');
    });

    it('should not allow array operations on unknown fields', async () => {
      const { taskId } = await cli.addTask('Array Operations Error Test');

      // Try += on unknown field
      const result1 = await runSTMFailure(
        ['update', taskId.toString(), 'custom_field+=value'],
        { cwd: workspace.directory }
      );
      expect(result1.exitCode).not.toBe(0);
      expect(result1.stderr).toContain("Cannot add to field 'custom_field'");
      expect(result1.stderr).toContain("The += operation is only supported for array fields");

      // Try -= on unknown field
      const result2 = await runSTMFailure(
        ['update', taskId.toString(), 'custom_field-=value'],
        { cwd: workspace.directory }
      );
      expect(result2.exitCode).not.toBe(0);
      expect(result2.stderr).toContain("Cannot remove from field 'custom_field'");
      expect(result2.stderr).toContain("The -= operation is only supported for array fields");
    });
  });

  describe('Performance with many unknown fields', () => {
    it('should handle tasks with many unknown fields efficiently', async () => {
      const { taskId } = await cli.addTask('Many Fields Test');

      // Create 50 unknown fields
      const fields: string[] = [];
      for (let i = 1; i <= 50; i++) {
        fields.push(`field_${i}=value_${i}`);
      }

      const startTime = Date.now();
      await cli.runSuccess(['update', taskId.toString(), ...fields]);
      const updateTime = Date.now() - startTime;

      // Update should complete quickly even with many fields
      expect(updateTime).toBeLessThan(5000); // 5 seconds

      // Verify all fields were saved
      const showResult = await cli.showTask(taskId, 'json');
      const task = JSON.parse(showResult.stdout);
      
      for (let i = 1; i <= 50; i++) {
        expect(task[`field_${i}`]).toBe(`value_${i}`);
      }
    });
  });

  describe('Default list output format', () => {
    it('should work correctly with NDJSON default list format', async () => {
      // Create tasks with unknown fields
      const { taskId: taskId1 } = await cli.addTask('NDJSON Test 1');
      await cli.runSuccess(['update', taskId1.toString(), 'category=frontend']);

      const { taskId: taskId2 } = await cli.addTask('NDJSON Test 2');
      await cli.runSuccess(['update', taskId2.toString(), 'category=backend']);

      // List without format (defaults to NDJSON)
      const listResult = await cli.listTasks();
      
      // Parse NDJSON output
      const tasks = cliUtils.parseNDJSON(listResult.stdout);
      expect(tasks).toHaveLength(2);
      
      // Each line should be a valid JSON object with unknown fields
      const task1 = tasks.find((t: any) => t.id === taskId1);
      expect(task1.category).toBe('frontend');

      const task2 = tasks.find((t: any) => t.id === taskId2);
      expect(task2.category).toBe('backend');
    });
  });
}, { timeout: 30000 });