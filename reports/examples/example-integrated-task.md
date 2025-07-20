---
# STM Core Fields
id: 999
title: "Example Task with Multiple Tool Integrations"
status: "in-progress"
schema: 1
created: "2025-01-15T09:00:00.000Z"
updated: "2025-01-19T16:45:00.000Z"
tags: ["example", "integration", "demo"]
dependencies: []

# AutoAgent Integration
autoagent_assigned: true
autoagent_version: "3.2.0"
autoagent_config:
  automation_level: "partial"
  retry_on_failure: true
  max_retries: 3
  timeout_seconds: 300
  notification_channels:
    - type: "slack"
      target: "#dev-notifications"
    - type: "email"
      target: "team@company.com"
autoagent_status:
  state: "completed"
  last_run: "2025-01-19T14:30:00.000Z"
  next_scheduled: "2025-01-20T02:00:00.000Z"
  runs_completed: 42
  runs_failed: 3
  success_rate: 0.929
  average_duration_seconds: 156
autoagent_history:
  - run_id: "run-1737303000000"
    started_at: "2025-01-19T14:30:00.000Z"
    completed_at: "2025-01-19T14:32:36.000Z"
    status: "success"
    duration_seconds: 156
  - run_id: "run-1737216600000"
    started_at: "2025-01-18T14:30:00.000Z"
    completed_at: "2025-01-18T14:33:12.000Z"
    status: "success"
    duration_seconds: 192

# GitHub Integration
github_issue: 456
github_pr: 789
github_labels: ["enhancement", "backend", "high-priority"]
github_milestone: "v2.5.0"
github_workflow:
  workflow_id: "ci-cd.yml"
  run_id: 7891234567
  run_number: 234
  status: "completed"
  conclusion: "success"
  started_at: "2025-01-19T15:00:00.000Z"
  completed_at: "2025-01-19T15:15:23.000Z"
  html_url: "https://github.com/company/repo/actions/runs/7891234567"
github_metadata:
  repository: "company/project"
  branch: "feature/task-999-implementation"
  commit_sha: "a1b2c3d4e5f6789012345678901234567890abcd"
  actor: "john.doe"
  event: "pull_request"

# JIRA Integration
jira_issue:
  key: "PROJ-1234"
  type: "Story"
  priority: "High"
  story_points: 8
  sprint: "Sprint 23"
  epic: "PROJ-1000"
  labels: ["backend", "api", "customer-requested"]
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
  related_issues: ["PROJ-1233", "PROJ-1235", "PROJ-1237"]
  blocks: ["PROJ-1236"]
  blocked_by: []

# Time Tracking Integration
time_entries:
  - date: "2025-01-15"
    hours: 2.5
    description: "Initial analysis and design"
    user: "john.doe@company.com"
    logged_at: "2025-01-15T17:30:00.000Z"
  - date: "2025-01-16"
    hours: 4
    description: "Implementation of core functionality"
    user: "john.doe@company.com"
    logged_at: "2025-01-16T18:00:00.000Z"
  - date: "2025-01-17"
    hours: 3.5
    description: "Unit tests and documentation"
    user: "john.doe@company.com"
    logged_at: "2025-01-17T17:45:00.000Z"
  - date: "2025-01-18"
    hours: 2
    description: "Code review feedback implementation"
    user: "john.doe@company.com"
    logged_at: "2025-01-18T16:00:00.000Z"
  - date: "2025-01-19"
    hours: 1.5
    description: "Integration testing"
    user: "john.doe@company.com"
    logged_at: "2025-01-19T15:30:00.000Z"
time_total_hours: 13.5
time_entry_count: 5
time_last_entry: "2025-01-19T15:30:00.000Z"
time_today_hours: 1.5
time_timer_active: false
time_estimated_hours: 16
time_billable: true
time_hourly_rate: 150
time_currency: "USD"

# Project Management Integration
pmp_assignee: "john.doe@company.com"
pmp_assignee_role: "senior-developer"
pmp_assigned_at: "2025-01-15T09:30:00.000Z"
pmp_priority: "high"
pmp_priority_reason: "Customer deadline approaching"
pmp_priority_updated: "2025-01-17T10:00:00.000Z"
pmp_project_id: "PROJ-2025-Q1"
pmp_project_name: "Q1 Feature Release"
pmp_project_linked_at: "2025-01-15T09:30:00.000Z"
pmp_last_processed: "2025-01-19T16:00:00.000Z"
pmp_process_count: 15

# CI/CD Results
ci_results:
  tests_passed: true
  build_passed: true
  security_vulnerabilities: 0
  code_coverage: 87.5
  last_updated: "2025-01-19T15:15:00.000Z"
ci_deployments:
  - environment: "staging"
    version: "a1b2c3d4"
    deployed_at: "2025-01-19T15:30:00.000Z"
    deployed_by: "github-actions[bot]"
    status: "success"
  - environment: "production"
    version: "pending"
    scheduled_for: "2025-01-20T18:00:00.000Z"
    approval_required: true
    approvers: ["jane.smith", "bob.jones"]

# Custom Business Logic Fields
business_metadata:
  customer: "ACME Corporation"
  contract_id: "CTR-2024-0892"
  revenue_impact: 125000
  compliance_required: true
  compliance_standards: ["SOC2", "ISO27001"]
  risk_assessment: "medium"
  stakeholders:
    - name: "Product Owner"
      email: "po@company.com"
      role: "approver"
    - name: "Tech Lead"
      email: "tech.lead@company.com"
      role: "reviewer"
    - name: "Customer Success"
      email: "cs@company.com"
      role: "notified"

# Monitoring and Observability
monitoring:
  dashboards:
    - name: "Performance Metrics"
      url: "https://monitoring.company.com/d/task-999"
    - name: "Error Tracking"
      url: "https://sentry.company.com/issues/?query=task:999"
  alerts_configured: true
  sla_tracking: true
  uptime_requirement: 0.999
  response_time_p99_ms: 200

# Documentation and Knowledge Base
documentation:
  confluence_page: "https://company.atlassian.net/wiki/spaces/DEV/pages/123456/Task+999"
  api_docs: "https://api-docs.company.com/v2/endpoints/task-999"
  runbook: "https://runbooks.company.com/task-999-operations"
  architecture_diagram: "https://diagrams.company.com/task-999-architecture.png"
  recorded_demos:
    - title: "Feature Overview"
      url: "https://videos.company.com/task-999-overview"
      duration_minutes: 15
    - title: "Technical Deep Dive"
      url: "https://videos.company.com/task-999-technical"
      duration_minutes: 45

# External Tool Sync Metadata
_sync_metadata:
  last_full_sync: "2025-01-19T16:00:00.000Z"
  sync_sources: ["jira", "github", "autoagent", "time-tracker"]
  sync_errors: []
  sync_version: "2.0.0"
  next_sync_scheduled: "2025-01-19T17:00:00.000Z"

# Extension Points for Future Tools
_extensions:
  "com.company.custom-tool":
    version: "1.2.3"
    enabled: true
    config:
      feature_flags: ["new-ui", "advanced-analytics"]
  "io.analytics.tracker":
    metrics_collected: 1847
    last_report: "2025-01-19T12:00:00.000Z"
---

## Description

This is an example task demonstrating how multiple external tools can integrate with Simple Task Master using unknown fields. Each tool adds its own metadata without interfering with other tools or STM's core functionality.

### Integration Overview

This task is integrated with:
- **AutoAgent**: Automated task execution and monitoring
- **GitHub**: Source control and CI/CD pipeline tracking  
- **JIRA**: Project management and issue tracking
- **Time Tracking**: Hour logging and productivity metrics
- **Project Management**: Team assignments and prioritization
- **CI/CD Systems**: Build and deployment status
- **Business Systems**: Customer and revenue tracking
- **Monitoring**: Observability and performance tracking

## Details

### Technical Implementation

The implementation leverages STM's unknown field support to maintain tool-specific metadata:

1. **Namespacing**: Each tool uses a prefix (e.g., `autoagent_`, `github_`, `jira_`) to avoid conflicts
2. **Structured Data**: Complex data is stored as nested YAML objects
3. **Type Preservation**: Numbers, booleans, arrays, and objects maintain their types
4. **Sync Metadata**: `_sync_metadata` tracks cross-tool synchronization

### Data Flow

1. Developer updates code and pushes to GitHub
2. GitHub Actions workflow triggers and updates `github_*` fields
3. JIRA webhook receives GitHub events and updates `jira_*` fields
4. AutoAgent monitors task status and executes automated tests
5. Time tracking captures actual hours spent
6. All tools read/write their specific fields without conflicts

### Field Naming Patterns

- **Tool Prefixes**: `toolname_field` (e.g., `github_issue`)
- **Nested Objects**: Tool-specific configs and complex data
- **Private Fields**: Underscore prefix for internal metadata (`_sync_metadata`)
- **Arrays**: Lists of entries, history, or related items

## Validation

### Integration Testing

✅ All external tool fields are properly preserved through STM operations
✅ Field types (string, number, boolean, array, object) maintain integrity
✅ No conflicts between different tool namespaces
✅ Updates via CLI and API work correctly

### Performance Testing

- Task with 50+ unknown fields loads in <100ms
- YAML serialization handles deep nesting efficiently
- No memory leaks with large field values

### Manual Testing Checklist

- [ ] Create task via STM CLI
- [ ] Add AutoAgent fields via API
- [ ] Update GitHub fields via webhook
- [ ] Sync JIRA fields
- [ ] Log time entries
- [ ] Verify all fields persist after task updates
- [ ] Export task and reimport preserves all fields
- [ ] List command shows tasks with unknown fields