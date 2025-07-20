/**
 * AutoAgent Integration Example for Simple Task Master
 * 
 * This example demonstrates how to integrate AutoAgent with STM using unknown fields
 * to track automation status, configuration, and execution history.
 */

import { TaskManager } from 'simple-task-master';
import type { Task } from 'simple-task-master';

// Define AutoAgent metadata schema
interface AutoAgentMetadata {
  autoagent_assigned: boolean;
  autoagent_version: string;
  autoagent_config: {
    automation_level: 'full' | 'partial' | 'monitor';
    retry_on_failure: boolean;
    max_retries: number;
    timeout_seconds: number;
    notification_channels: Array<{ type: string; target: string }>;
  };
  autoagent_status: {
    state: 'idle' | 'running' | 'completed' | 'failed';
    last_run?: string;
    next_scheduled?: string;
    runs_completed: number;
    runs_failed: number;
    success_rate: number;
    average_duration_seconds?: number;
  };
  autoagent_history?: Array<{
    run_id: string;
    started_at: string;
    completed_at: string;
    status: 'success' | 'failure';
    duration_seconds: number;
    error?: string;
  }>;
  github_integration?: {
    issue_number?: number;
    pr_number?: number;
    workflow_runs?: number[];
  };
}

// Extend Task type for TypeScript support
type AutoAgentTask = Task & Partial<AutoAgentMetadata>;

export class AutoAgentSTMIntegration {
  private taskManager: TaskManager;
  private agentVersion = '3.2.0';

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  /**
   * Assign a task to AutoAgent for automation
   */
  async assignTaskToAgent(
    taskId: number,
    config: AutoAgentMetadata['autoagent_config']
  ): Promise<void> {
    const metadata: Partial<AutoAgentMetadata> = {
      autoagent_assigned: true,
      autoagent_version: this.agentVersion,
      autoagent_config: config,
      autoagent_status: {
        state: 'idle',
        runs_completed: 0,
        runs_failed: 0,
        success_rate: 1.0
      },
      autoagent_history: []
    };

    // Update task with AutoAgent metadata
    // @ts-expect-error - Unknown fields require type assertion
    await this.taskManager.update(taskId, metadata);

    console.log(`Task ${taskId} assigned to AutoAgent with config:`, config);
  }

  /**
   * Update task status when AutoAgent starts execution
   */
  async startExecution(taskId: number, runId: string): Promise<void> {
    const task = await this.taskManager.get(taskId) as AutoAgentTask;
    
    if (!task.autoagent_assigned) {
      throw new Error(`Task ${taskId} is not assigned to AutoAgent`);
    }

    const updates: Partial<AutoAgentMetadata> = {
      autoagent_status: {
        ...task.autoagent_status!,
        state: 'running',
        last_run: new Date().toISOString()
      }
    };

    // Add to history
    if (task.autoagent_history) {
      updates.autoagent_history = [
        ...task.autoagent_history,
        {
          run_id: runId,
          started_at: new Date().toISOString(),
          completed_at: '', // Will be updated on completion
          status: 'success', // Optimistic, will be updated if failed
          duration_seconds: 0
        }
      ];
    }

    // @ts-expect-error - Unknown fields require type assertion
    await this.taskManager.update(taskId, updates);
  }

  /**
   * Update task when AutoAgent completes execution
   */
  async completeExecution(
    taskId: number,
    runId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    const task = await this.taskManager.get(taskId) as AutoAgentTask;
    
    if (!task.autoagent_history) {
      throw new Error(`Task ${taskId} has no execution history`);
    }

    // Find the current run in history
    const runIndex = task.autoagent_history.findIndex(run => run.run_id === runId);
    if (runIndex === -1) {
      throw new Error(`Run ${runId} not found in task ${taskId} history`);
    }

    // Calculate duration
    const run = task.autoagent_history[runIndex];
    const startTime = new Date(run.started_at).getTime();
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Update run in history
    const updatedHistory = [...task.autoagent_history];
    updatedHistory[runIndex] = {
      ...run,
      completed_at: new Date().toISOString(),
      status: success ? 'success' : 'failure',
      duration_seconds: durationSeconds,
      error: error
    };

    // Calculate new statistics
    const completedRuns = updatedHistory.filter(r => r.completed_at).length;
    const failedRuns = updatedHistory.filter(r => r.status === 'failure').length;
    const successRate = completedRuns > 0 ? (completedRuns - failedRuns) / completedRuns : 0;
    
    const durations = updatedHistory
      .filter(r => r.duration_seconds > 0)
      .map(r => r.duration_seconds);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const updates: Partial<AutoAgentMetadata> = {
      autoagent_status: {
        ...task.autoagent_status!,
        state: 'completed',
        runs_completed: task.autoagent_status!.runs_completed + 1,
        runs_failed: task.autoagent_status!.runs_failed + (success ? 0 : 1),
        success_rate: successRate,
        average_duration_seconds: Math.round(avgDuration)
      },
      autoagent_history: updatedHistory
    };

    // Update STM task status if configured for auto-completion
    if (success && task.autoagent_config?.automation_level === 'full') {
      // @ts-expect-error - Mixing known and unknown fields
      updates.status = 'done';
    }

    // @ts-expect-error - Unknown fields require type assertion
    await this.taskManager.update(taskId, updates);

    // Send notifications if configured
    await this.sendNotifications(task, success, error);
  }

  /**
   * Schedule next execution
   */
  async scheduleNextRun(taskId: number, scheduledTime: Date): Promise<void> {
    const task = await this.taskManager.get(taskId) as AutoAgentTask;
    
    const updates: Partial<AutoAgentMetadata> = {
      autoagent_status: {
        ...task.autoagent_status!,
        state: 'idle',
        next_scheduled: scheduledTime.toISOString()
      }
    };

    // @ts-expect-error - Unknown fields require type assertion
    await this.taskManager.update(taskId, updates);
  }

  /**
   * Link task with GitHub integration
   */
  async linkGitHubIssue(
    taskId: number,
    issueNumber: number,
    prNumber?: number
  ): Promise<void> {
    const updates: Partial<AutoAgentMetadata> = {
      github_integration: {
        issue_number: issueNumber,
        pr_number: prNumber
      }
    };

    // @ts-expect-error - Unknown fields require type assertion
    await this.taskManager.update(taskId, updates);
  }

  /**
   * Get all tasks assigned to AutoAgent
   */
  async getAssignedTasks(): Promise<AutoAgentTask[]> {
    const allTasks = await this.taskManager.list();
    return allTasks.filter(task => 
      (task as AutoAgentTask).autoagent_assigned === true
    ) as AutoAgentTask[];
  }

  /**
   * Get tasks ready for execution
   */
  async getTasksReadyForExecution(): Promise<AutoAgentTask[]> {
    const assignedTasks = await this.getAssignedTasks();
    const now = new Date();

    return assignedTasks.filter(task => {
      if (task.autoagent_status?.state === 'running') {
        return false; // Already running
      }

      if (task.autoagent_status?.next_scheduled) {
        const scheduledTime = new Date(task.autoagent_status.next_scheduled);
        return scheduledTime <= now;
      }

      // If no schedule, task is ready
      return true;
    });
  }

  /**
   * Generate execution report
   */
  async generateReport(): Promise<{
    total_tasks: number;
    active_tasks: number;
    total_runs: number;
    success_rate: number;
    average_duration: number;
  }> {
    const tasks = await this.getAssignedTasks();
    
    let totalRuns = 0;
    let totalDuration = 0;
    let successfulRuns = 0;
    let activeTasks = 0;

    for (const task of tasks) {
      if (task.autoagent_status?.state !== 'idle') {
        activeTasks++;
      }

      if (task.autoagent_history) {
        for (const run of task.autoagent_history) {
          if (run.completed_at) {
            totalRuns++;
            totalDuration += run.duration_seconds;
            if (run.status === 'success') {
              successfulRuns++;
            }
          }
        }
      }
    }

    return {
      total_tasks: tasks.length,
      active_tasks: activeTasks,
      total_runs: totalRuns,
      success_rate: totalRuns > 0 ? successfulRuns / totalRuns : 0,
      average_duration: totalRuns > 0 ? totalDuration / totalRuns : 0
    };
  }

  /**
   * Send notifications based on configuration
   */
  private async sendNotifications(
    task: AutoAgentTask,
    success: boolean,
    error?: string
  ): Promise<void> {
    if (!task.autoagent_config?.notification_channels) {
      return;
    }

    for (const channel of task.autoagent_config.notification_channels) {
      const message = this.formatNotificationMessage(task, success, error);
      
      switch (channel.type) {
        case 'slack':
          console.log(`[Slack ${channel.target}] ${message}`);
          // await sendSlackMessage(channel.target, message);
          break;
        case 'email':
          console.log(`[Email ${channel.target}] ${message}`);
          // await sendEmail(channel.target, subject, message);
          break;
        case 'webhook':
          console.log(`[Webhook ${channel.target}] ${message}`);
          // await postWebhook(channel.target, { task, success, error });
          break;
      }
    }
  }

  private formatNotificationMessage(
    task: AutoAgentTask,
    success: boolean,
    error?: string
  ): string {
    const status = success ? '✅ Success' : '❌ Failed';
    let message = `AutoAgent Execution ${status}\n`;
    message += `Task: ${task.title} (#${task.id})\n`;
    
    if (task.autoagent_status) {
      message += `Runs: ${task.autoagent_status.runs_completed} `;
      message += `(${Math.round(task.autoagent_status.success_rate * 100)}% success rate)\n`;
    }
    
    if (error) {
      message += `Error: ${error}\n`;
    }
    
    return message;
  }
}

// Example usage
async function main() {
  // Initialize STM
  const taskManager = await TaskManager.create();
  const autoAgent = new AutoAgentSTMIntegration(taskManager);

  // Create a task
  const task = await taskManager.create({
    title: 'Deploy application to production',
    content: 'Deploy the latest version of the application to production environment',
    tags: ['deployment', 'production']
  });

  // Assign to AutoAgent
  await autoAgent.assignTaskToAgent(task.id, {
    automation_level: 'full',
    retry_on_failure: true,
    max_retries: 3,
    timeout_seconds: 300,
    notification_channels: [
      { type: 'slack', target: '#deployments' },
      { type: 'email', target: 'devops@company.com' }
    ]
  });

  // Simulate execution
  const runId = `run-${Date.now()}`;
  
  console.log('Starting AutoAgent execution...');
  await autoAgent.startExecution(task.id, runId);

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Complete execution
  await autoAgent.completeExecution(task.id, runId, true);
  
  // Schedule next run
  const nextRun = new Date();
  nextRun.setHours(nextRun.getHours() + 6); // Run again in 6 hours
  await autoAgent.scheduleNextRun(task.id, nextRun);

  // Generate report
  const report = await autoAgent.generateReport();
  console.log('AutoAgent Report:', report);

  // Get the updated task
  const updatedTask = await taskManager.get(task.id) as AutoAgentTask;
  console.log('Updated task with AutoAgent metadata:', {
    id: updatedTask.id,
    title: updatedTask.title,
    status: updatedTask.status,
    autoagent_status: updatedTask.autoagent_status,
    autoagent_config: updatedTask.autoagent_config
  });
}

// Run example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { AutoAgentTask, AutoAgentMetadata };