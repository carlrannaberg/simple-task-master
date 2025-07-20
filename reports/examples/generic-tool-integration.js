/**
 * Generic Tool Integration Example for Simple Task Master
 * 
 * This example demonstrates a reusable pattern for integrating any external tool
 * with STM using unknown fields. It provides a base class that can be extended
 * for specific tool integrations.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
// Example imports - uncomment as needed:
// const fs = require('fs').promises;
// const path = require('path');
// const yaml = require('js-yaml');

const execAsync = promisify(exec);

/**
 * Base class for STM tool integrations
 */
class STMToolIntegration {
  constructor(toolName, toolVersion, options = {}) {
    this.toolName = toolName;
    this.toolVersion = toolVersion;
    this.fieldPrefix = options.fieldPrefix || toolName.toLowerCase().replace(/\s+/g, '_');
    this.workspacePath = options.workspacePath || process.cwd();
    this.debug = options.debug || false;
  }

  /**
   * Log debug messages
   */
  log(...args) {
    if (this.debug) {
      console.log(`[${this.toolName}]`, ...args);
    }
  }

  /**
   * Execute STM CLI command
   */
  async runSTM(args) {
    const command = `stm ${args}`;
    this.log(`Executing: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspacePath
      });
      
      if (stderr && this.debug) {
        console.error(`[${this.toolName}] stderr:`, stderr);
      }
      
      return stdout.trim();
    } catch (error) {
      throw new Error(`STM command failed: ${error.message}`);
    }
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId) {
    const output = await this.runSTM(`show ${taskId} --json`);
    return JSON.parse(output);
  }

  /**
   * List all tasks
   */
  async listTasks(filters = {}) {
    let args = 'list --json';
    
    if (filters.status) {
      args += ` --status ${filters.status}`;
    }
    if (filters.tags) {
      args += ` --tags ${filters.tags.join(',')}`;
    }
    
    const output = await this.runSTM(args);
    return JSON.parse(output);
  }

  /**
   * Update task with tool-specific fields
   */
  async updateTaskFields(taskId, fields) {
    const updates = [];
    
    for (const [key, value] of Object.entries(fields)) {
      const fieldName = this.prefixField(key);
      const fieldValue = this.serializeValue(value);
      updates.push(`${fieldName}=${fieldValue}`);
    }
    
    if (updates.length > 0) {
      await this.runSTM(`update ${taskId} ${updates.join(' ')}`);
      this.log(`Updated task ${taskId} with ${updates.length} fields`);
    }
  }

  /**
   * Get tool-specific fields from a task
   */
  getToolFields(task) {
    const toolFields = {};
    const prefix = `${this.fieldPrefix}_`;
    
    for (const [key, value] of Object.entries(task)) {
      if (key.startsWith(prefix)) {
        const fieldName = key.substring(prefix.length);
        toolFields[fieldName] = this.deserializeValue(value);
      }
    }
    
    return toolFields;
  }

  /**
   * Initialize tool metadata on a task
   */
  async initializeTask(taskId, config = {}) {
    const metadata = {
      tool_name: this.toolName,
      tool_version: this.toolVersion,
      initialized_at: new Date().toISOString(),
      config: config
    };
    
    await this.updateTaskFields(taskId, metadata);
    this.log(`Initialized task ${taskId} for ${this.toolName}`);
  }

  /**
   * Mark task as processed by this tool
   */
  async markProcessed(taskId, result) {
    const fields = {
      last_processed: new Date().toISOString(),
      process_count: await this.incrementCounter(taskId, 'process_count'),
      last_result: result
    };
    
    await this.updateTaskFields(taskId, fields);
  }

  /**
   * Add an event to task history
   */
  async addEvent(taskId, event) {
    const task = await this.getTask(taskId);
    const historyField = this.prefixField('history');
    
    // Get existing history or create new array
    let history = [];
    if (task[historyField]) {
      try {
        history = JSON.parse(task[historyField]);
      } catch {
        this.log('Warning: Could not parse history, starting fresh');
      }
    }
    
    // Add new event
    history.push({
      timestamp: new Date().toISOString(),
      event: event.type,
      details: event.details,
      user: event.user || 'system'
    });
    
    // Keep only last 50 events
    if (history.length > 50) {
      history = history.slice(-50);
    }
    
    await this.runSTM(`update ${taskId} ${historyField}='${JSON.stringify(history)}'`);
  }

  /**
   * Helper to prefix field names
   */
  prefixField(fieldName) {
    return `${this.fieldPrefix}_${fieldName}`;
  }

  /**
   * Serialize value for CLI
   */
  serializeValue(value) {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  /**
   * Deserialize value from string
   */
  deserializeValue(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  /**
   * Increment a counter field
   */
  async incrementCounter(taskId, counterName) {
    const task = await this.getTask(taskId);
    const fieldName = this.prefixField(counterName);
    const currentValue = parseInt(task[fieldName] || '0', 10);
    return currentValue + 1;
  }

  /**
   * Find tasks that need processing by this tool
   */
  async findUnprocessedTasks() {
    const allTasks = await this.listTasks();
    const toolField = this.prefixField('last_processed');
    
    return allTasks.filter(task => !task[toolField]);
  }

  /**
   * Sync task with external system
   */
  async syncTask(taskId, externalData) {
    const syncData = {
      last_sync: new Date().toISOString(),
      sync_source: externalData.source,
      external_id: externalData.id,
      external_status: externalData.status,
      sync_data: externalData.data
    };
    
    await this.updateTaskFields(taskId, syncData);
    
    await this.addEvent(taskId, {
      type: 'sync',
      details: {
        source: externalData.source,
        external_id: externalData.id,
        fields_updated: Object.keys(syncData).length
      }
    });
  }

  /**
   * Generate a report of tool usage
   */
  async generateReport() {
    const allTasks = await this.listTasks();
    const toolPrefix = `${this.fieldPrefix}_`;
    
    const report = {
      tool: this.toolName,
      version: this.toolVersion,
      total_tasks: allTasks.length,
      processed_tasks: 0,
      unprocessed_tasks: 0,
      total_events: 0,
      last_processed_times: []
    };
    
    for (const task of allTasks) {
      const hasToolFields = Object.keys(task).some(key => key.startsWith(toolPrefix));
      
      if (hasToolFields) {
        report.processed_tasks++;
        
        const lastProcessed = task[`${toolPrefix}last_processed`];
        if (lastProcessed) {
          report.last_processed_times.push(new Date(lastProcessed));
        }
        
        const processCount = parseInt(task[`${toolPrefix}process_count`] || '0', 10);
        report.total_events += processCount;
      } else {
        report.unprocessed_tasks++;
      }
    }
    
    // Calculate average time between processes
    if (report.last_processed_times.length > 0) {
      report.last_processed_times.sort((a, b) => b - a);
      report.most_recent_process = report.last_processed_times[0];
      report.oldest_process = report.last_processed_times[report.last_processed_times.length - 1];
    }
    
    return report;
  }
}

/**
 * Example: Project Management Tool Integration
 */
class ProjectManagementIntegration extends STMToolIntegration {
  constructor(options = {}) {
    super('Project Manager Pro', '2.0.0', {
      fieldPrefix: 'pmp',
      ...options
    });
  }

  /**
   * Assign task to a team member
   */
  async assignTask(taskId, assignee, role = 'developer') {
    await this.updateTaskFields(taskId, {
      assignee: assignee,
      assignee_role: role,
      assigned_at: new Date().toISOString()
    });
    
    await this.addEvent(taskId, {
      type: 'assignment',
      details: {
        assignee: assignee,
        role: role
      }
    });
  }

  /**
   * Update task priority
   */
  async setPriority(taskId, priority, reason) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    
    await this.updateTaskFields(taskId, {
      priority: priority,
      priority_reason: reason,
      priority_updated: new Date().toISOString()
    });
    
    await this.addEvent(taskId, {
      type: 'priority_change',
      details: {
        new_priority: priority,
        reason: reason
      }
    });
  }

  /**
   * Add time tracking entry
   */
  async logTime(taskId, hours, description, user) {
    const task = await this.getTask(taskId);
    const timeLogField = this.prefixField('time_log');
    
    let timeLog = [];
    if (task[timeLogField]) {
      try {
        timeLog = JSON.parse(task[timeLogField]);
      } catch {
        this.log('Warning: Could not parse time log, starting fresh');
      }
    }
    
    timeLog.push({
      date: new Date().toISOString(),
      hours: hours,
      description: description,
      user: user
    });
    
    // Calculate total hours
    const totalHours = timeLog.reduce((sum, entry) => sum + entry.hours, 0);
    
    await this.updateTaskFields(taskId, {
      time_log: timeLog,
      total_hours: totalHours,
      last_time_entry: new Date().toISOString()
    });
    
    await this.addEvent(taskId, {
      type: 'time_logged',
      details: {
        hours: hours,
        total_hours: totalHours,
        user: user
      }
    });
  }

  /**
   * Link task to external project
   */
  async linkToProject(taskId, projectId, projectName) {
    await this.updateTaskFields(taskId, {
      project_id: projectId,
      project_name: projectName,
      project_linked_at: new Date().toISOString()
    });
    
    await this.addEvent(taskId, {
      type: 'project_linked',
      details: {
        project_id: projectId,
        project_name: projectName
      }
    });
  }

  /**
   * Get team workload report
   */
  async getTeamWorkload() {
    const tasks = await this.listTasks({ status: 'in-progress' });
    const workload = {};
    
    for (const task of tasks) {
      const toolFields = this.getToolFields(task);
      
      if (toolFields.assignee) {
        if (!workload[toolFields.assignee]) {
          workload[toolFields.assignee] = {
            tasks: 0,
            total_hours: 0,
            priorities: { low: 0, medium: 0, high: 0, critical: 0 }
          };
        }
        
        workload[toolFields.assignee].tasks++;
        workload[toolFields.assignee].total_hours += toolFields.total_hours || 0;
        
        const priority = toolFields.priority || 'medium';
        workload[toolFields.assignee].priorities[priority]++;
      }
    }
    
    return workload;
  }
}

/**
 * Example usage
 */
async function demonstrateIntegration() {
  // Create integration instance
  const pm = new ProjectManagementIntegration({ debug: true });
  
  console.log('=== Project Management Integration Demo ===\n');
  
  // Find or create a test task
  let taskId;
  const tasks = await pm.listTasks();
  
  if (tasks.length > 0) {
    taskId = tasks[0].id;
    console.log(`Using existing task: ${taskId}`);
  } else {
    console.log('No tasks found. Please create a task first using: stm add "Test Task"');
    return;
  }
  
  // Initialize the task for our tool
  console.log('\n1. Initializing task for Project Manager Pro...');
  await pm.initializeTask(taskId, {
    billable: true,
    department: 'Engineering'
  });
  
  // Assign the task
  console.log('\n2. Assigning task...');
  await pm.assignTask(taskId, 'john.doe@company.com', 'senior-developer');
  
  // Set priority
  console.log('\n3. Setting priority...');
  await pm.setPriority(taskId, 'high', 'Customer deadline approaching');
  
  // Log some time
  console.log('\n4. Logging time...');
  await pm.logTime(taskId, 2.5, 'Initial implementation', 'john.doe@company.com');
  await pm.logTime(taskId, 1.5, 'Code review and fixes', 'john.doe@company.com');
  
  // Link to project
  console.log('\n5. Linking to external project...');
  await pm.linkToProject(taskId, 'PROJ-2024-Q1', 'Q1 Feature Release');
  
  // Mark as processed
  console.log('\n6. Marking task as processed...');
  await pm.markProcessed(taskId, 'success');
  
  // Get the updated task
  console.log('\n7. Retrieving updated task...');
  const updatedTask = await pm.getTask(taskId);
  const toolFields = pm.getToolFields(updatedTask);
  
  console.log('\nTool-specific fields:');
  console.log(JSON.stringify(toolFields, null, 2));
  
  // Generate workload report
  console.log('\n8. Generating team workload report...');
  const workload = await pm.getTeamWorkload();
  console.log('\nTeam Workload:');
  console.log(JSON.stringify(workload, null, 2));
  
  // Generate usage report
  console.log('\n9. Generating tool usage report...');
  const report = await pm.generateReport();
  console.log('\nTool Usage Report:');
  console.log(JSON.stringify(report, null, 2));
}

// Run demo if executed directly
if (require.main === module) {
  demonstrateIntegration().catch(console.error);
}

// Export for use in other projects
module.exports = {
  STMToolIntegration,
  ProjectManagementIntegration
};