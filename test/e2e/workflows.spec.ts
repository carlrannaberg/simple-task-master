import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestWorkspace } from '@test/helpers/test-workspace';
import { CLITestRunner, cliUtils } from '@test/helpers/cli-runner';
import type { Task } from '@lib/types';

describe(
  'End-to-End Workflows',
  () => {
    let workspace: TestWorkspace;
    let cliRunner: CLITestRunner;

    beforeEach(async () => {
      workspace = await TestWorkspace.create('e2e-workflows-test-');
      cliRunner = new CLITestRunner({ cwd: workspace.directory });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    describe('Complete Task Lifecycle Workflows', () => {
      it('should execute complete init → add → list → update → show workflow', async () => {
        // Step 1: Initialize STM (already done in beforeEach via TestWorkspace)
        const initCheck = await cliUtils.isInitialized(workspace.directory);
        expect(initCheck).toBe(true);

        // Step 2: Add initial task
        const { taskId: taskId1 } = await cliRunner.addTask('Initial Project Task', {
          content: 'Set up the foundation for the project',
          tags: ['project', 'setup', 'foundation'],
          status: 'pending',
        });

        expect(taskId1).toBe(1);

        // Step 3: Add more tasks to build a realistic workflow
        const { taskId: taskId2 } = await cliRunner.addTask('Database Design', {
          content: 'Design the database schema and relationships',
          tags: ['database', 'design'],
          status: 'pending',
        });

        const { taskId: taskId3 } = await cliRunner.addTask('Frontend Setup', {
          content: 'Initialize React application with routing',
          tags: ['frontend', 'react', 'setup'],
          status: 'pending',
        });

        // Step 4: List all tasks to verify creation
        const listAllResult = await cliRunner.listTasks();
        expect(listAllResult.exitCode).toBe(0);
        expect(listAllResult.stdout).toContain('Initial Project Task');
        expect(listAllResult.stdout).toContain('Database Design');
        expect(listAllResult.stdout).toContain('Frontend Setup');
        expect(cliUtils.getTaskCount(listAllResult.stdout)).toBe(3);

        // Step 5: Start working on first task (update to in-progress)
        await cliRunner.updateTask(taskId1, {
          status: 'in-progress',
          content: 'Set up the foundation for the project. Started with project structure setup.',
        });

        // Step 6: Show the updated task
        const showTask1Result = await cliRunner.showTask(taskId1);
        expect(showTask1Result.exitCode).toBe(0);
        expect(showTask1Result.stdout).toContain('Initial Project Task');
        expect(showTask1Result.stdout).toContain('in-progress');
        expect(showTask1Result.stdout).toContain('Started with project structure setup');

        // Step 7: List only in-progress tasks
        const listInProgressResult = await cliRunner.listTasks({ status: 'in-progress' });
        expect(listInProgressResult.exitCode).toBe(0);
        expect(listInProgressResult.stdout).toContain('Initial Project Task');
        expect(listInProgressResult.stdout).not.toContain('Database Design');
        expect(cliUtils.getTaskCount(listInProgressResult.stdout)).toBe(1);

        // Step 8: Complete first task and start second
        await cliRunner.updateTask(taskId1, { status: 'done' });
        await cliRunner.updateTask(taskId2, {
          status: 'in-progress',
          content:
            'Design the database schema and relationships. Starting with user authentication tables.',
        });

        // Step 9: Verify workflow state
        const listDoneResult = await cliRunner.listTasks({ status: 'done' });
        expect(cliUtils.getTaskCount(listDoneResult.stdout)).toBe(1);
        expect(listDoneResult.stdout).toContain('Initial Project Task');

        const listInProgressResult2 = await cliRunner.listTasks({ status: 'in-progress' });
        expect(cliUtils.getTaskCount(listInProgressResult2.stdout)).toBe(1);
        expect(listInProgressResult2.stdout).toContain('Database Design');

        const listPendingResult = await cliRunner.listTasks({ status: 'pending' });
        expect(cliUtils.getTaskCount(listPendingResult.stdout)).toBe(1);
        expect(listPendingResult.stdout).toContain('Frontend Setup');

        // Step 10: Final verification with show commands
        const finalTask1 = await cliRunner.showTask(taskId1);
        expect(finalTask1.stdout).toContain('done');

        const finalTask2 = await cliRunner.showTask(taskId2);
        expect(finalTask2.stdout).toContain('in-progress');
        expect(finalTask2.stdout).toContain('Starting with user authentication tables');

        const finalTask3 = await cliRunner.showTask(taskId3);
        expect(finalTask3.stdout).toContain('pending');
      });

      it('should handle complex workflow with tags and searching', async () => {
        // Create tasks with hierarchical tag structure
        const { taskId: backendId } = await cliRunner.addTask('Backend API Development', {
          content: 'Develop REST API endpoints for user management',
          tags: ['backend', 'api', 'user-management', 'high-priority'],
          status: 'in-progress',
        });

        const { taskId: _frontendId } = await cliRunner.addTask('Frontend Components', {
          content: 'Create reusable UI components for forms',
          tags: ['frontend', 'components', 'ui', 'forms'],
          status: 'pending',
        });

        const { taskId: testingId } = await cliRunner.addTask('Integration Testing', {
          content: 'Set up automated testing for API endpoints',
          tags: ['testing', 'automation', 'api', 'high-priority'],
          status: 'pending',
        });

        const { taskId: docsId } = await cliRunner.addTask('API Documentation', {
          content: 'Document all API endpoints with examples',
          tags: ['documentation', 'api', 'examples'],
          status: 'pending',
        });

        // Workflow: Filter by tags to focus on API-related tasks
        const apiTasksResult = await cliRunner.listTasks({ tags: ['api'] });
        expect(cliUtils.getTaskCount(apiTasksResult.stdout)).toBe(3);
        expect(apiTasksResult.stdout).toContain('Backend API Development');
        expect(apiTasksResult.stdout).toContain('Integration Testing');
        expect(apiTasksResult.stdout).toContain('API Documentation');

        // Workflow: Search for specific functionality
        const userMgmtResult = await cliRunner.listTasks({ search: 'user' });
        expect(cliUtils.getTaskCount(userMgmtResult.stdout)).toBe(1);
        expect(userMgmtResult.stdout).toContain('Backend API Development');

        // Workflow: Focus on high-priority items
        const highPriorityResult = await cliRunner.listTasks({ tags: ['high-priority'] });
        expect(cliUtils.getTaskCount(highPriorityResult.stdout)).toBe(2);
        expect(highPriorityResult.stdout).toContain('Backend API Development');
        expect(highPriorityResult.stdout).toContain('Integration Testing');

        // Workflow: Complete backend work and update related tasks
        await cliRunner.updateTask(backendId, {
          status: 'done',
          content: 'Develop REST API endpoints for user management. Completed all CRUD operations.',
        });

        // Start testing now that backend is ready
        await cliRunner.updateTask(testingId, {
          status: 'in-progress',
          content:
            'Set up automated testing for API endpoints. Backend API is now ready for testing.',
        });

        // Update documentation task with specific details
        await cliRunner.updateTask(docsId, {
          content:
            'Document all API endpoints with examples. Focus on user management endpoints first.',
          tags: ['documentation', 'api', 'examples', 'user-management'],
        });

        // Verify workflow progression
        const doneTasksResult = await cliRunner.listTasks({ status: 'done' });
        expect(cliUtils.getTaskCount(doneTasksResult.stdout)).toBe(1);

        const inProgressResult = await cliRunner.listTasks({ status: 'in-progress' });
        expect(cliUtils.getTaskCount(inProgressResult.stdout)).toBe(1);
        expect(inProgressResult.stdout).toContain('Integration Testing');

        // Show final state of key tasks
        const finalBackendTask = await cliRunner.showTask(backendId);
        expect(finalBackendTask.stdout).toContain('Completed all CRUD operations');

        const finalTestingTask = await cliRunner.showTask(testingId);
        expect(finalTestingTask.stdout).toContain('Backend API is now ready for testing');
      });

      it('should handle workflow with task dependencies and blocking', async () => {
        // Create tasks with implicit dependencies
        const { taskId: designId } = await cliRunner.addTask('Database Schema Design', {
          content: 'Design the complete database schema',
          tags: ['database', 'design', 'foundation'],
          status: 'in-progress',
        });

        const { taskId: migrationId } = await cliRunner.addTask('Database Migration Scripts', {
          content:
            'Create migration scripts for schema deployment. BLOCKED: Waiting for schema design.',
          tags: ['database', 'migration', 'blocked'],
          status: 'pending',
        });

        const { taskId: apiId } = await cliRunner.addTask('API Data Layer', {
          content: 'Implement data access layer for API. BLOCKED: Waiting for database setup.',
          tags: ['api', 'data-layer', 'blocked'],
          status: 'pending',
        });

        const { taskId: frontendId } = await cliRunner.addTask('Frontend Data Integration', {
          content: 'Connect frontend to API endpoints. BLOCKED: Waiting for API completion.',
          tags: ['frontend', 'integration', 'blocked'],
          status: 'pending',
        });

        // Workflow: Complete design phase
        await cliRunner.updateTask(designId, {
          status: 'done',
          content: 'Database schema design completed with user, product, and order tables.',
        });

        // Unblock and start migration
        await cliRunner.updateTask(migrationId, {
          status: 'in-progress',
          content: 'Creating migration scripts for schema deployment. Schema design is complete.',
          tags: ['database', 'migration'], // Remove 'blocked' tag
        });

        // Workflow: Complete migration and unblock API
        await cliRunner.updateTask(migrationId, {
          status: 'done',
          content: 'Migration scripts completed and tested. Database is ready for development.',
        });

        await cliRunner.updateTask(apiId, {
          status: 'in-progress',
          content: 'Implementing data access layer for API. Database is now available.',
          tags: ['api', 'data-layer'], // Remove 'blocked' tag
        });

        // Workflow: Complete API and unblock frontend
        await cliRunner.updateTask(apiId, {
          status: 'done',
          content: 'Data access layer implemented with full CRUD operations.',
        });

        await cliRunner.updateTask(frontendId, {
          status: 'in-progress',
          content: 'Connecting frontend to API endpoints. API is now ready.',
          tags: ['frontend', 'integration'], // Remove 'blocked' tag
        });

        // Verify dependency resolution workflow
        const allTasksResult = await cliRunner.listTasks();
        const finalStates = cliUtils.parseNDJSON(allTasksResult.stdout) as Task[];

        const design = finalStates.find((t) => t.id === designId);
        const migration = finalStates.find((t) => t.id === migrationId);
        const api = finalStates.find((t) => t.id === apiId);
        const frontend = finalStates.find((t) => t.id === frontendId);

        expect(design?.status).toBe('done');
        expect(migration?.status).toBe('done');
        expect(api?.status).toBe('done');
        expect(frontend?.status).toBe('in-progress');

        // Verify no tasks are still blocked
        const blockedResult = await cliRunner.listTasks({ tags: ['blocked'] });
        expect(cliUtils.getTaskCount(blockedResult.stdout)).toBe(0);
      });
    });

    describe('Real-World Project Workflows', () => {
      it('should handle agile sprint workflow', async () => {
        // Sprint Planning: Create backlog items
        const sprintTasks = [
          {
            title: 'User Registration Feature',
            content: 'Implement user registration with email verification',
            tags: ['user-story', 'authentication', 'sprint-1', 'frontend', 'backend'],
            status: 'pending',
          },
          {
            title: 'User Login System',
            content: 'Create secure login with session management',
            tags: ['user-story', 'authentication', 'sprint-1', 'backend'],
            status: 'pending',
          },
          {
            title: 'Password Reset Flow',
            content: 'Allow users to reset passwords via email',
            tags: ['user-story', 'authentication', 'sprint-1', 'backend', 'email'],
            status: 'pending',
          },
          {
            title: 'Unit Tests for Auth',
            content: 'Write comprehensive tests for authentication system',
            tags: ['testing', 'authentication', 'sprint-1'],
            status: 'pending',
          },
          {
            title: 'Sprint Demo Preparation',
            content: 'Prepare demo environment and presentation',
            tags: ['demo', 'sprint-1', 'presentation'],
            status: 'pending',
          },
        ];

        // Create all sprint tasks
        const taskIds: number[] = [];
        for (const task of sprintTasks) {
          const { taskId } = await cliRunner.addTask(task.title, task);
          taskIds.push(taskId);
        }

        // Sprint Start: Begin with foundation work
        await cliRunner.updateTask(taskIds[1], {
          status: 'in-progress',
          content:
            'Create secure login with session management. Starting with backend implementation.',
        });

        // Mid-sprint: Complete login, start registration
        await cliRunner.updateTask(taskIds[1], {
          status: 'done',
          content: 'Secure login system completed with JWT tokens and session management.',
        });

        await cliRunner.updateTask(taskIds[0], {
          status: 'in-progress',
          content: 'Implement user registration with email verification. Login system is ready.',
        });

        // Continue sprint progress
        await cliRunner.updateTask(taskIds[0], { status: 'done' });
        await cliRunner.updateTask(taskIds[2], { status: 'in-progress' });
        await cliRunner.updateTask(taskIds[3], { status: 'in-progress' });

        // Sprint end: Complete remaining items
        await cliRunner.updateTask(taskIds[2], { status: 'done' });
        await cliRunner.updateTask(taskIds[3], { status: 'done' });
        await cliRunner.updateTask(taskIds[4], {
          status: 'in-progress',
          content: 'Preparing demo environment and presentation. All features are complete.',
        });

        // Sprint Review: Check completion
        const sprintTasksResult = await cliRunner.listTasks({ tags: ['sprint-1'] });
        const sprintTasks2 = cliUtils.parseNDJSON(sprintTasksResult.stdout) as Task[];

        const completedCount = sprintTasks2.filter((t) => t.status === 'done').length;
        const inProgressCount = sprintTasks2.filter((t) => t.status === 'in-progress').length;

        expect(completedCount).toBe(4);
        expect(inProgressCount).toBe(1);
        expect(sprintTasks2).toHaveLength(5);

        // Complete final demo task
        await cliRunner.updateTask(taskIds[4], { status: 'done' });

        // Sprint Retrospective: All tasks should be done
        const finalSprintResult = await cliRunner.listTasks({ tags: ['sprint-1'] });
        const finalSprintTasks = cliUtils.parseNDJSON(finalSprintResult.stdout) as Task[];
        const finalCompletedCount = finalSprintTasks.filter((t) => t.status === 'done').length;

        expect(finalCompletedCount).toBe(5);
      });

      it('should handle bug tracking and fixing workflow', async () => {
        // Production issues discovered
        const { taskId: criticalBugId } = await cliRunner.addTask(
          'CRITICAL: Login fails for users with long emails',
          {
            content:
              'Users with email addresses longer than 50 characters cannot log in. Error: "Email too long".',
            tags: ['bug', 'critical', 'authentication', 'production'],
            status: 'pending',
          }
        );

        const { taskId: minorBugId } = await cliRunner.addTask(
          'UI: Button alignment issue on mobile',
          {
            content: 'Login button is misaligned on mobile devices in portrait mode.',
            tags: ['bug', 'minor', 'ui', 'mobile'],
            status: 'pending',
          }
        );

        const { taskId: enhancementId } = await cliRunner.addTask(
          'Enhancement: Add remember me checkbox',
          {
            content: 'Add "Remember Me" functionality to login form for better UX.',
            tags: ['enhancement', 'authentication', 'ux'],
            status: 'pending',
          }
        );

        // Triage: Prioritize critical bug
        await cliRunner.updateTask(criticalBugId, {
          status: 'in-progress',
          content:
            'CRITICAL BUG: Investigating email length validation. Database field might be too small.',
          tags: ['bug', 'critical', 'authentication', 'production', 'investigating'],
        });

        // Investigation and fix
        await cliRunner.updateTask(criticalBugId, {
          content:
            'CRITICAL BUG FIXED: Increased email field size to 255 characters. Deployed hotfix to production.',
          status: 'done',
          tags: ['bug', 'critical', 'authentication', 'production', 'fixed', 'deployed'],
        });

        // Address minor bug
        await cliRunner.updateTask(minorBugId, {
          status: 'in-progress',
          content: 'Fixing button alignment using flexbox. Testing on various mobile devices.',
        });

        await cliRunner.updateTask(minorBugId, {
          status: 'done',
          content: 'Button alignment fixed across all mobile devices. CSS improvements applied.',
          tags: ['bug', 'minor', 'ui', 'mobile', 'fixed'],
        });

        // Implement enhancement
        await cliRunner.updateTask(enhancementId, {
          status: 'in-progress',
          content: 'Adding remember me functionality with secure token storage.',
        });

        await cliRunner.updateTask(enhancementId, {
          status: 'done',
          content: 'Remember me feature implemented with 30-day secure tokens.',
          tags: ['enhancement', 'authentication', 'ux', 'implemented'],
        });

        // Verify bug workflow completion
        const bugResult = await cliRunner.listTasks({ tags: ['bug'] });
        const bugs = cliUtils.parseNDJSON(bugResult.stdout) as Task[];
        const fixedBugs = bugs.filter((b) => b.tags?.includes('fixed'));

        expect(bugs).toHaveLength(2);
        expect(fixedBugs).toHaveLength(2);
        expect(bugs.every((b) => b.status === 'done')).toBe(true);

        // Verify critical bug was properly tracked
        const criticalBugDetails = await cliRunner.showTask(criticalBugId);
        expect(criticalBugDetails.stdout).toContain('CRITICAL BUG FIXED');
        expect(criticalBugDetails.stdout).toContain('deployed');
      });

      it('should handle feature development lifecycle', async () => {
        // Feature: User Profile Management
        const featureTasks = [
          {
            title: 'Feature Analysis: User Profile Requirements',
            tags: ['analysis', 'user-profile'],
            content: 'Analyze requirements for user profile management system.',
          },
          {
            title: 'Design: User Profile UI Mockups',
            tags: ['design', 'ui', 'user-profile'],
            content: 'Create wireframes and mockups for profile pages.',
          },
          {
            title: 'Backend: User Profile API',
            tags: ['backend', 'api', 'user-profile'],
            content: 'Implement CRUD APIs for user profile data.',
          },
          {
            title: 'Frontend: Profile Edit Form',
            tags: ['frontend', 'forms', 'user-profile'],
            content: 'Create reactive form for editing user profiles.',
          },
          {
            title: 'Frontend: Profile Display Page',
            tags: ['frontend', 'display', 'user-profile'],
            content: 'Create read-only profile display page.',
          },
          {
            title: 'Testing: Profile Feature Tests',
            tags: ['testing', 'user-profile'],
            content: 'Write integration tests for profile functionality.',
          },
          {
            title: 'Documentation: Profile API Docs',
            tags: ['documentation', 'api', 'user-profile'],
            content: 'Document profile API endpoints and usage.',
          },
        ];

        // Create feature tasks
        const featureTaskIds: number[] = [];
        for (const task of featureTasks) {
          const { taskId } = await cliRunner.addTask(task.title, {
            content: task.content,
            tags: task.tags,
            status: 'pending',
          });
          featureTaskIds.push(taskId);
        }

        // Phase 1: Analysis and Design
        await cliRunner.updateTask(featureTaskIds[0], {
          status: 'in-progress',
          content:
            'Analyzing requirements: avatar upload, contact info, preferences, privacy settings.',
        });

        await cliRunner.updateTask(featureTaskIds[0], { status: 'done' });
        await cliRunner.updateTask(featureTaskIds[1], { status: 'in-progress' });
        await cliRunner.updateTask(featureTaskIds[1], { status: 'done' });

        // Phase 2: Backend Development
        await cliRunner.updateTask(featureTaskIds[2], {
          status: 'in-progress',
          content: 'Implementing profile CRUD operations with validation and file upload support.',
        });

        await cliRunner.updateTask(featureTaskIds[2], { status: 'done' });

        // Phase 3: Frontend Development (parallel)
        await cliRunner.updateTask(featureTaskIds[3], { status: 'in-progress' });
        await cliRunner.updateTask(featureTaskIds[4], { status: 'in-progress' });

        await cliRunner.updateTask(featureTaskIds[3], {
          status: 'done',
          content: 'Profile edit form completed with validation, avatar upload, and auto-save.',
        });

        await cliRunner.updateTask(featureTaskIds[4], {
          status: 'done',
          content: 'Profile display page completed with responsive design and social sharing.',
        });

        // Phase 4: Quality Assurance
        await cliRunner.updateTask(featureTaskIds[5], {
          status: 'in-progress',
          content: 'Writing comprehensive tests for profile CRUD, validation, and file uploads.',
        });

        await cliRunner.updateTask(featureTaskIds[6], {
          status: 'in-progress',
          content: 'Documenting all profile endpoints with request/response examples.',
        });

        await cliRunner.updateTask(featureTaskIds[5], { status: 'done' });
        await cliRunner.updateTask(featureTaskIds[6], { status: 'done' });

        // Verify feature completion
        const profileTasksResult = await cliRunner.listTasks({ tags: ['user-profile'] });
        const profileTasks = cliUtils.parseNDJSON(profileTasksResult.stdout) as Task[];

        expect(profileTasks).toHaveLength(7);
        expect(profileTasks.every((t) => t.status === 'done')).toBe(true);

        // Check that all phases were represented
        const phases = ['analysis', 'design', 'backend', 'frontend', 'testing', 'documentation'];
        for (const phase of phases) {
          const phaseTasksResult = await cliRunner.listTasks({ tags: [phase] });
          const phaseTasks = cliUtils.parseNDJSON(phaseTasksResult.stdout) as Task[];
          expect(phaseTasks.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Workflow State Persistence', () => {
      it.skip('should handle concurrent workflow sessions safely', async () => {
        // Create initial task
        const { taskId } = await cliRunner.addTask('Concurrent Session Test', {
          content: 'Initial content',
          status: 'pending',
        });

        // Create two concurrent sessions
        const session1 = new CLITestRunner({ cwd: workspace.directory });
        const session2 = new CLITestRunner({ cwd: workspace.directory });

        // Both sessions should see the same initial state
        const session1InitResult = await session1.showTask(taskId);
        const session2InitResult = await session2.showTask(taskId);

        expect(session1InitResult.stdout).toContain('Initial content');
        expect(session2InitResult.stdout).toContain('Initial content');

        // Make different updates from each session
        await session1.updateTask(taskId, {
          content: 'Updated by session 1',
          tags: ['session-1'],
        });

        await session2.updateTask(taskId, {
          status: 'in-progress',
          tags: ['session-2'],
        });

        // Final state should reflect last write (session 2)
        const finalResult = await cliRunner.showTask(taskId);
        expect(finalResult.stdout).toContain('in-progress');
        expect(finalResult.stdout).toContain('session-2');
        // Content might be from either session depending on write order
      });
    });
  },
  { timeout: 30000 }
);
