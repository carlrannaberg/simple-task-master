# Integration Guide for External Tools

**Date**: 2025-01-19  
**Version**: 1.0.0  
**Feature**: Unknown Field Support for External Tool Integration

## Table of Contents

1. [Overview](#overview)
2. [Unknown Field Support](#unknown-field-support)
3. [Integration Patterns](#integration-patterns)
4. [Field Naming Conventions](#field-naming-conventions)
5. [Example Integrations](#example-integrations)
   - [AutoAgent Integration](#autoagent-integration)
   - [GitHub Actions Integration](#github-actions-integration)
   - [JIRA Integration](#jira-integration)
   - [Time Tracking Integration](#time-tracking-integration)
6. [Best Practices](#best-practices)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [Performance Considerations](#performance-considerations)
10. [Security Considerations](#security-considerations)

## Overview

Simple Task Master (STM) allows external tools to seamlessly integrate by supporting arbitrary "unknown fields" in task frontmatter. This enables tools to add custom metadata without modifying STM's core functionality.

### Key Benefits

- **Zero Configuration**: No STM modifications needed to add custom fields
- **Type Preservation**: Complex data types (objects, arrays, numbers) are preserved
- **Full API Support**: Unknown fields work through CLI, library API, and direct file manipulation
- **Backward Compatible**: Existing integrations continue working without changes

## Unknown Field Support

### How It Works

STM uses YAML frontmatter in markdown files to store task metadata. While STM validates its core fields (id, title, status, etc.), it preserves any additional fields without validation:

```yaml
---
# STM Core Fields (validated)
id: 123
title: "Implement user authentication"
status: "in-progress"
schema: 1
created: "2025-01-19T10:00:00.000Z"
updated: "2025-01-19T15:30:00.000Z"
tags: ["feature", "security"]
dependencies: []

# External Tool Fields (preserved as-is)
github_issue: 456
assignee: "john.doe@company.com"
priority: "high"
automation_config:
  auto_close: true
  notify_on_complete: ["team-channel"]
---
```

### Supported Data Types

Unknown fields support all YAML data types:

- **Strings**: `field: "text value"`
- **Numbers**: `priority: 1`, `score: 95.5`
- **Booleans**: `reviewed: true`
- **Arrays**: `labels: ["bug", "urgent"]`
- **Objects**: `metadata: { version: "1.0", author: "bot" }`
- **Null**: `parent_task: null`
- **Dates**: `deadline: "2025-02-01T00:00:00.000Z"`

## Integration Patterns

### 1. Direct File Manipulation

Write directly to STM's task files:

```javascript
// Node.js example
import fs from 'fs/promises';
import yaml from 'js-yaml';

async function addCustomMetadata(taskPath, metadata) {
  const content = await fs.readFile(taskPath, 'utf8');
  const [, frontmatter, body] = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  const data = yaml.load(frontmatter);
  
  // Add custom fields
  data.tool_name = 'MyIntegration';
  data.tool_version = '2.1.0';
  data.custom_metadata = metadata;
  
  const updatedContent = `---\n${yaml.dump(data)}---\n${body}`;
  await fs.writeFile(taskPath, updatedContent);
}
```

### 2. CLI Integration

Use STM's CLI to update fields:

```bash
# Add single field
stm update 123 assignee=john.doe@company.com

# Add multiple fields
stm update 123 \
  priority=high \
  sprint=Sprint-23 \
  team=backend \
  estimated_hours=8

# Complex values (as JSON strings)
stm update 123 metadata='{"source": "api", "version": "2.0"}'
```

### 3. Library API Integration

```typescript
import { TaskManager } from 'simple-task-master';

const taskManager = await TaskManager.create();

// Create task with custom fields
const task = await taskManager.create({
  title: 'API Integration Task',
  // @ts-expect-error - Unknown fields require type assertion
  integration_id: 'EXT-123',
  external_status: 'synced',
  metadata: {
    source: 'external-api',
    timestamp: new Date().toISOString()
  }
});

// Update with custom fields
await taskManager.update(task.id, {
  // @ts-expect-error - Unknown fields require type assertion
  sync_status: 'completed',
  last_sync: new Date().toISOString()
});
```

## Field Naming Conventions

### Recommended Patterns

1. **Namespace Your Fields**: Prevent conflicts with future STM fields

   ```yaml
   # Good: Namespaced
   autoagent_status: "active"
   autoagent_config:
     retry_count: 3
   
   # Avoid: Generic names
   status: "active"  # Conflicts with STM's status field
   config: {}        # Too generic
   ```

2. **Use Descriptive Prefixes**: Make field purpose clear

   ```yaml
   # Good: Clear purpose
   github_issue_number: 123
   jira_ticket_key: "PROJ-456"
   ci_build_status: "passing"
   
   # Avoid: Ambiguous
   issue: 123
   ticket: "PROJ-456"
   build: "passing"
   ```

3. **Follow Consistent Casing**: Use snake_case for compatibility

   ```yaml
   # Recommended: snake_case
   external_task_id: "ABC-123"
   last_sync_date: "2025-01-19"
   
   # Also valid but less portable
   externalTaskId: "ABC-123"    # camelCase
   external-task-id: "ABC-123"  # kebab-case
   ```

### Reserved Patterns

Avoid these patterns to prevent future conflicts:

- `stm_*`: Reserved for future STM features
- Single-word generic terms: `data`, `metadata`, `info`, `config`
- STM core field names: `id`, `title`, `status`, `schema`, `created`, `updated`

### Field Name Validation Rules

Field names must:
- Not contain newlines (`\n`) or carriage returns (`\r`)
- Not have leading or trailing whitespace
- Not contain control characters (ASCII 0-31, except tab)
- Be non-empty after the `=` sign in CLI assignments

Valid special characters in field names:
- Dots: `field.with.dots`
- Dashes: `field-with-dashes`
- Underscores: `field_with_underscores`
- Most symbols: `@`, `#`, `$`, `%`, etc.

## Example Integrations

### AutoAgent Integration

AutoAgent can track task automation status and configuration:

```yaml
---
# STM Core Fields
id: 789
title: "Automated deployment pipeline"
status: "in-progress"
tags: ["automation", "devops"]

# AutoAgent Fields
autoagent_assigned: true
autoagent_version: "3.2.0"
autoagent_config:
  automation_level: "full"
  retry_on_failure: true
  max_retries: 3
  notification_channels:
    - slack: "#deployments"
    - email: "devops@company.com"
autoagent_status:
  last_run: "2025-01-19T14:30:00.000Z"
  runs_completed: 15
  success_rate: 0.93
  next_scheduled: "2025-01-19T16:00:00.000Z"
github_integration:
  issue_number: 234
  pr_number: 567
  workflow_runs: [1234567, 1234568]
---
```

**CLI Usage**:
```bash
# Mark task as assigned to AutoAgent
stm update 789 autoagent_assigned=true

# Update automation configuration
stm update 789 \
  autoagent_config='{"automation_level":"full","retry_on_failure":true}'

# Update status after run
stm update 789 \
  autoagent_status='{"last_run":"2025-01-19T14:30:00.000Z","runs_completed":16}'
```

**API Usage**:
```typescript
// AutoAgent TypeScript Integration
interface AutoAgentMetadata {
  autoagent_assigned: boolean;
  autoagent_version: string;
  autoagent_config: {
    automation_level: 'full' | 'partial' | 'monitor';
    retry_on_failure: boolean;
    max_retries: number;
    notification_channels: Array<Record<string, string>>;
  };
  autoagent_status: {
    last_run: string;
    runs_completed: number;
    success_rate: number;
    next_scheduled?: string;
  };
}

async function assignToAutoAgent(taskId: number): Promise<void> {
  const taskManager = await TaskManager.create();
  
  const updates: Partial<AutoAgentMetadata> = {
    autoagent_assigned: true,
    autoagent_version: '3.2.0',
    autoagent_config: {
      automation_level: 'full',
      retry_on_failure: true,
      max_retries: 3,
      notification_channels: [
        { slack: '#deployments' },
        { email: 'devops@company.com' }
      ]
    }
  };
  
  // @ts-expect-error - Unknown fields require type assertion
  await taskManager.update(taskId, updates);
}
```

### GitHub Actions Integration

Track GitHub Actions workflow status:

```yaml
---
# STM Core Fields
id: 456
title: "Fix security vulnerability"
status: "in-progress"
tags: ["security", "bug"]

# GitHub Actions Fields
github_workflow:
  workflow_id: "security-scan.yml"
  run_id: 987654321
  run_number: 42
  status: "in_progress"
  conclusion: null
  started_at: "2025-01-19T12:00:00Z"
  html_url: "https://github.com/org/repo/actions/runs/987654321"
github_metadata:
  repository: "org/repo"
  branch: "fix/security-issue"
  commit_sha: "abc123def456"
  actor: "dependabot[bot]"
  event: "pull_request"
github_outputs:
  vulnerabilities_found: 2
  vulnerabilities_fixed: 1
  scan_duration_seconds: 240
---
```

**GitHub Actions Workflow Example**:
```yaml
# .github/workflows/update-stm-task.yml
name: Update STM Task
on:
  workflow_run:
    workflows: ["Security Scan"]
    types: [completed]

jobs:
  update-task:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install STM
        run: npm install -g simple-task-master
      
      - name: Update task with workflow status
        run: |
          stm update ${{ env.TASK_ID }} \
            github_workflow.run_id=${{ github.run_id }} \
            github_workflow.status=completed \
            github_workflow.conclusion=${{ github.event.workflow_run.conclusion }} \
            github_outputs.scan_duration_seconds=${{ env.SCAN_DURATION }}
```

### JIRA Integration

Sync with JIRA issue tracking:

```yaml
---
# STM Core Fields
id: 234
title: "Implement user preferences API"
status: "in-progress"
tags: ["feature", "api", "backend"]

# JIRA Integration Fields
jira_issue:
  key: "PROJ-1234"
  type: "Story"
  priority: "High"
  story_points: 8
  sprint: "Sprint 23"
  epic: "PROJ-1000"
  labels: ["api", "user-preferences", "backend"]
jira_status:
  workflow_status: "In Development"
  assignee: "john.doe"
  reporter: "jane.smith"
  created: "2025-01-15T09:00:00.000Z"
  updated: "2025-01-19T14:45:00.000Z"
  due_date: "2025-01-25T17:00:00.000Z"
jira_links:
  web_url: "https://company.atlassian.net/browse/PROJ-1234"
  api_url: "https://company.atlassian.net/rest/api/2/issue/PROJ-1234"
  related_issues: ["PROJ-1233", "PROJ-1235"]
  blocks: ["PROJ-1236"]
---
```

**JIRA Webhook Integration**:
```javascript
// Express.js webhook handler
app.post('/webhooks/jira', async (req, res) => {
  const { issue, webhookEvent } = req.body;
  
  // Find STM task by JIRA key
  const taskId = await findTaskByJiraKey(issue.key);
  
  if (taskId) {
    // Update STM task with JIRA data
    await exec(`stm update ${taskId} \
      jira_issue.priority="${issue.fields.priority.name}" \
      jira_status.workflow_status="${issue.fields.status.name}" \
      jira_status.assignee="${issue.fields.assignee?.name || 'unassigned'}" \
      jira_status.updated="${issue.fields.updated}"`);
  }
  
  res.status(200).send('OK');
});
```

### Time Tracking Integration

Track time spent on tasks:

```yaml
---
# STM Core Fields
id: 567
title: "Code review for feature branch"
status: "done"
tags: ["review", "quality"]

# Time Tracking Fields
time_tracking:
  estimated_hours: 4
  actual_hours: 5.5
  billable: true
  rate_per_hour: 150
  currency: "USD"
time_entries:
  - date: "2025-01-18"
    hours: 2.5
    description: "Initial review and feedback"
    user: "senior.dev@company.com"
  - date: "2025-01-19"
    hours: 3
    description: "Follow-up review and approval"
    user: "senior.dev@company.com"
time_summary:
  total_hours: 5.5
  total_cost: 825
  efficiency_ratio: 0.73  # estimated/actual
  completed_date: "2025-01-19T16:00:00.000Z"
---
```

**Time Tracking CLI Script**:
```bash
#!/bin/bash
# track-time.sh - Add time entry to STM task

TASK_ID=$1
HOURS=$2
DESCRIPTION=$3
USER=$(git config user.email)
DATE=$(date -u +"%Y-%m-%d")

# Get current time entries
CURRENT=$(stm show $TASK_ID --json | jq -r '.time_entries // []')

# Add new entry
NEW_ENTRY=$(jq -n \
  --arg date "$DATE" \
  --arg hours "$HOURS" \
  --arg desc "$DESCRIPTION" \
  --arg user "$USER" \
  '{date: $date, hours: ($hours | tonumber), description: $desc, user: $user}')

# Update task
UPDATED_ENTRIES=$(echo "$CURRENT" | jq ". + [$NEW_ENTRY]")
stm update $TASK_ID time_entries="$UPDATED_ENTRIES"

# Update total hours
TOTAL_HOURS=$(echo "$UPDATED_ENTRIES" | jq '[.[].hours] | add')
stm update $TASK_ID time_summary.total_hours="$TOTAL_HOURS"
```

## Best Practices

### 1. Data Type Consistency

Maintain consistent data types for your fields:

```yaml
# Good: Consistent types
priority: 1              # Always number
estimated_hours: 8.5     # Always number
tags: ["bug", "urgent"]  # Always array

# Bad: Inconsistent types
priority: "1"           # Sometimes string
priority: 1             # Sometimes number
estimated_hours: "8h"   # String format varies
```

### 2. Structured Namespacing

Use structured objects for related data:

```yaml
# Good: Structured
github:
  issue: 123
  pr: 456
  labels: ["bug", "help-wanted"]

# Less organized
github_issue: 123
github_pr: 456
github_labels: ["bug", "help-wanted"]
```

### 3. Avoid Field Proliferation

Limit the number of top-level fields:

```yaml
# Good: Organized metadata
integration_metadata:
  source: "api"
  version: "2.0"
  timestamp: "2025-01-19T10:00:00Z"
  request_id: "abc-123"

# Avoid: Too many top-level fields
source: "api"
version: "2.0"
timestamp: "2025-01-19T10:00:00Z"
request_id: "abc-123"
```

### 4. Document Your Schema

Create documentation for your custom fields:

```yaml
# .stm/schemas/my-tool-fields.md
## My Tool Custom Fields

### `mytool_status` (string)
Current synchronization status with My Tool.
Values: "synced", "pending", "error", "disabled"

### `mytool_id` (string)
Unique identifier in My Tool's system.
Format: "MT-XXXXX" where X is a digit

### `mytool_metadata` (object)
Additional metadata from My Tool:
- `last_sync` (string): ISO 8601 timestamp
- `sync_errors` (array): List of error messages
- `version` (string): My Tool API version
```

### 5. Handle Missing Fields Gracefully

Always check for field existence:

```javascript
// Good: Defensive programming
const priority = task.custom_priority || 'medium';
const assignee = task.assignee || 'unassigned';

// Bad: Assumes fields exist
const priority = task.custom_priority; // Could be undefined
const teamSize = task.team.members.length; // Could throw
```

## API Reference

### CLI Commands

#### Update with Unknown Fields

```bash
stm update <task-id> <field>=<value> [<field>=<value> ...]
```

Examples:
```bash
# Single field
stm update 123 assignee=john.doe

# Multiple fields
stm update 123 priority=high team=backend sprint=23

# Complex values (JSON string)
stm update 123 config='{"auto_close": true, "notify": ["slack"]}'

# Empty value (allowed for unknown fields)
stm update 123 cleared_field=
```

#### Array Operations (Known Fields Only)

```bash
# These only work with known array fields (tags, dependencies)
stm update 123 tags+=urgent
stm update 123 tags-=low-priority

# Unknown fields don't support += or -=
stm update 123 custom_tags+=new  # ERROR
```

### Library API

```typescript
// Type assertion for unknown fields
interface CustomFields {
  [key: string]: unknown;
}

// Create with unknown fields
const task = await taskManager.create({
  title: 'Task Title',
  ...customFields as any
});

// Update with unknown fields
await taskManager.update(taskId, {
  ...updates as any
});

// Access unknown fields
const customValue = (task as any).custom_field;
```

### Direct File API

```javascript
import { FrontmatterParser } from 'simple-task-master';

// Parse task file
const content = await fs.readFile(taskPath, 'utf8');
const { data, content: body } = FrontmatterParser.parse(content);

// Modify unknown fields
data.my_custom_field = 'new value';
data.my_metadata = { updated: Date.now() };

// Write back
const updated = FrontmatterParser.stringify(body, data);
await fs.writeFile(taskPath, updated);
```

## Troubleshooting

### Common Issues

#### 1. Field Not Appearing in Output

**Problem**: Updated field doesn't show in `stm show` or `stm list`

**Solution**: Check that you're using JSON output format:
```bash
stm show 123 --json  # Shows all fields
stm list --json      # Shows all fields
```

#### 2. Complex Values Treated as Strings

**Problem**: Objects/arrays saved as strings via CLI

**Solution**: CLI always saves as strings. Use the API or direct file manipulation for complex types:
```bash
# CLI saves as string
stm update 123 data='{"key": "value"}'  # Saved as string

# Use API for proper types
await taskManager.update(123, { 
  data: { key: "value" }  // Saved as object
});
```

#### 3. Field Name Validation Errors

**Problem**: "Field names cannot contain control characters"

**Solution**: Ensure field names are clean:
```javascript
// Clean field name
const fieldName = userInput
  .trim()
  .replace(/[\x00-\x08\x0B-\x1F]/g, ''); // Remove control chars
```

#### 4. Array Operations on Unknown Fields

**Problem**: `+=` or `-=` operations fail on custom fields

**Solution**: These operations only work on known array fields. For unknown fields, manage arrays manually:
```bash
# Get current value
CURRENT=$(stm show 123 --json | jq -r '.custom_array // []')

# Modify array
UPDATED=$(echo "$CURRENT" | jq '. + ["new-item"]')

# Save back
stm update 123 custom_array="$UPDATED"
```

### Debugging Tips

1. **Verify File Format**: Check the markdown file directly
   ```bash
   cat tasks/123-*.md
   ```

2. **Validate YAML**: Ensure frontmatter is valid
   ```bash
   # Extract frontmatter
   sed -n '/^---$/,/^---$/p' tasks/123-*.md | sed '1d;$d' | yamllint -
   ```

3. **Check Task Loading**: Use the library API to debug
   ```javascript
   const task = await taskManager.get(123);
   console.log(JSON.stringify(task, null, 2));
   ```

4. **Monitor File Changes**: Watch for external modifications
   ```bash
   fswatch tasks/ | while read path; do
     echo "Changed: $path"
     stm show $(basename $path | cut -d- -f1) --json
   done
   ```

## Performance Considerations

### Field Count Limits

STM enforces performance limits to ensure optimal operation:

- **Maximum Fields**: 100 total fields per task (including core and unknown fields)
- **Maximum Task Size**: 1MB total content (including all fields and markdown content)
- **Performance Targets**: Task operations complete in <100ms with 50+ fields

### Performance Characteristics

Based on performance testing with unknown fields:

1. **Task Creation Performance**:
   - 50 unknown fields: <100ms average operation time
   - 100 fields (limit): ~150-200ms operation time
   - Memory usage scales linearly with field count

2. **Update Performance**:
   - Similar performance characteristics to creation
   - Batch updates are more efficient than individual field updates

3. **Query Performance**:
   - JSON output format has minimal overhead
   - Large field counts may impact table formatting performance

### Best Practices for Performance

1. **Use Structured Data**: Group related fields in objects
   ```yaml
   # Good: Structured data reduces top-level field count
   automation_status:
     last_run: "2025-01-19T10:00:00Z"
     runs_completed: 15
     success_rate: 0.93
   
   # Less efficient: Many top-level fields
   automation_last_run: "2025-01-19T10:00:00Z"
   automation_runs_completed: 15
   automation_success_rate: 0.93
   ```

2. **Batch Operations**: Update multiple fields in one operation
   ```bash
   # Good: Single update operation
   stm update 123 field1=value1 field2=value2 field3=value3
   
   # Less efficient: Multiple operations
   stm update 123 field1=value1
   stm update 123 field2=value2
   stm update 123 field3=value3
   ```

3. **Monitor Field Growth**: Regularly audit unknown field usage
   ```bash
   # Check field count for a task
   stm show 123 --json | jq 'keys | length'
   
   # Find tasks with many fields
   for task in tasks/*.md; do
     count=$(stm show $(basename $task | cut -d- -f1) --json | jq 'keys | length')
     if [ $count -gt 50 ]; then
       echo "Task $(basename $task): $count fields"
     fi
   done
   ```

### Memory Usage Guidelines

- Base task overhead: ~1KB
- Per field overhead: ~100-500 bytes (depending on value size)
- 50 fields with small values: ~25KB total
- 100 fields with small values: ~50KB total

For large-scale integrations, consider:
- Storing large data externally and referencing it
- Using compression for large string values
- Implementing field cleanup for obsolete data

## Security Considerations

### Input Validation

STM performs minimal validation on unknown fields:

1. **Field Names**: Basic sanitization (no newlines, control chars)
2. **Field Values**: No validation - tools are responsible
3. **Size Limits**: Total task size limited to 1MB

### Best Practices for External Tools

1. **Sanitize Input**: Validate data before storing
   ```javascript
   // Sanitize user input
   function sanitizeFieldValue(value) {
     if (typeof value === 'string') {
       // Remove potential script injections
       return value.replace(/<script[^>]*>.*?<\/script>/gi, '');
     }
     return value;
   }
   ```

2. **Limit Field Count**: Prevent field proliferation
   ```javascript
   const MAX_CUSTOM_FIELDS = 50;
   if (Object.keys(customFields).length > MAX_CUSTOM_FIELDS) {
     throw new Error('Too many custom fields');
   }
   ```

3. **Validate Data Types**: Ensure type safety
   ```javascript
   // Type validation
   function validateCustomFields(fields) {
     const schema = {
       priority: 'number',
       assignee: 'string',
       tags: 'array'
     };
     
     for (const [key, expectedType] of Object.entries(schema)) {
       if (key in fields) {
         const actualType = Array.isArray(fields[key]) ? 'array' : typeof fields[key];
         if (actualType !== expectedType) {
           throw new Error(`Field ${key} must be ${expectedType}`);
         }
       }
     }
   }
   ```

4. **Namespace Sensitive Data**: Use clear prefixes
   ```yaml
   # Clear indication of sensitive data
   _private_api_key: "encrypted:AES256:..."
   _internal_user_id: "user-12345"
   ```

### Data Protection

Remember that STM tasks are stored as plain text files:

- Don't store passwords or API keys
- Use references to secure storage instead
- Consider encryption for sensitive metadata
- Apply appropriate file system permissions

```bash
# Restrict task directory permissions
chmod 700 .stm/tasks/
```

## Conclusion

STM's unknown field support provides a flexible foundation for tool integration. By following the conventions and best practices in this guide, you can build robust integrations that enhance your task management workflow while maintaining compatibility with STM's core functionality.

For questions or issues with integration, consult the STM documentation or file an issue in the project repository.