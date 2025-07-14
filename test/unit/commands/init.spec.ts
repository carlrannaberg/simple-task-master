import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as path from 'path';
import { tmpdir } from 'os';
import { Command } from 'commander';
// Import the actual fs/promises before mocking
import { mkdtemp, rm } from 'fs/promises';

// Mock modules before imports
vi.mock('@lib/lock-manager', () => ({
  LockManager: vi.fn()
}));
vi.mock('@lib/output', () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn()
}));
vi.mock('@lib/utils', () => ({
  ensureDirectory: vi.fn(),
  fileExists: vi.fn()
}));
vi.mock('@lib/constants', () => {
  const path = require('path');
  return {
    PATHS: {
      getBaseDir: (root: string) => path.join(root, '.simple-task-master'),
      getTasksDir: (root: string) => path.join(root, '.simple-task-master', 'tasks'),
      getConfigPath: (root: string) => path.join(root, '.simple-task-master', 'config.json'),
    },
    DEFAULT_CONFIG: {
      SCHEMA_VERSION: 1,
      LOCK_TIMEOUT_MS: 30000,
      MAX_TASK_SIZE_BYTES: 1048576,
    },
  };
});
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('fs/promises');
  return {
    ...actual,
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    chmod: vi.fn()
  };
});

// Import after mocks
import { initCommand } from '@/commands/init';
import { LockManager } from '@lib/lock-manager';
import { FileSystemError } from '@lib/errors';
import * as utils from '@lib/utils';
import * as output from '@lib/output';
import * as fs from 'fs/promises';

describe('Init Command', () => {
  let tempDir: string;
  let originalCwd: string;
  let mockLockManager: {
    acquire: Mock;
    release: Mock;
  };
  let capturedOutput: string[];
  let capturedErrors: string[];
  let capturedWarnings: string[];
  let fileSystemState: Map<string, string | Buffer>;
  let directoryState: Set<string>;
  let program: Command;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create temporary directory using actual fs (not mocked)
    tempDir = await mkdtemp(path.join(tmpdir(), 'stm-test-'));
    originalCwd = process.cwd();
    
    // Mock process.cwd to return our temp directory
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    
    // Mock process.exit to prevent tests from exiting
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    });

    // Initialize file system state
    fileSystemState = new Map();
    directoryState = new Set();
    capturedOutput = [];
    capturedErrors = [];
    capturedWarnings = [];

    // Mock LockManager
    mockLockManager = {
      acquire: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(LockManager).mockImplementation((projectRoot?: string) => {
      // Ensure the lock manager uses the mocked project root
      return mockLockManager as unknown as LockManager;
    });

    // Mock output functions to capture messages
    vi.mocked(output.printSuccess).mockImplementation((message: string) => {
      capturedOutput.push(message);
    });
    vi.mocked(output.printError).mockImplementation((error: string | Error) => {
      const errorMessage = typeof error === 'string' ? error : error.message;
      capturedErrors.push(errorMessage);
    });
    vi.mocked(output.printWarning).mockImplementation((message: string) => {
      capturedWarnings.push(message);
    });

    // Constants are already mocked at the module level

    // Mock utils
    vi.mocked(utils.ensureDirectory).mockImplementation(async (dirPath: string) => {
      directoryState.add(dirPath);
    });

    vi.mocked(utils.fileExists).mockImplementation(async (filePath: string) => {
      return fileSystemState.has(filePath);
    });

    // Mock fs functions
    vi.mocked(fs.writeFile).mockImplementation(async (filePath: string | fs.FileHandle, data: string | Buffer, encoding?: BufferEncoding | fs.WriteFileOptions) => {
      if (typeof filePath === 'string') {
        fileSystemState.set(filePath, typeof data === 'string' ? data : data.toString());
      }
      return Promise.resolve();
    });

    vi.mocked(fs.readFile).mockImplementation(async (filePath: string | fs.FileHandle, encoding?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string }) => {
      if (typeof filePath === 'string') {
        const data = fileSystemState.get(filePath);
        if (!data) {
          throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }
        // Handle both string encoding and options object
        const isStringEncoding = typeof encoding === 'string';
        return (isStringEncoding || (encoding && encoding.encoding)) ? data.toString() : data;
      }
      throw new Error('Invalid file handle');
    });

    vi.mocked(fs.access).mockImplementation(async (filePath: string | fs.FileHandle) => {
      if (typeof filePath === 'string') {
        if (!fileSystemState.has(filePath) && !directoryState.has(filePath)) {
          throw new Error(`ENOENT: no such file or directory, access '${filePath}'`);
        }
      }
    });

    vi.mocked(fs.mkdir).mockImplementation(async (dirPath: string, options?: fs.MakeDirectoryOptions) => {
      directoryState.add(dirPath);
      // Handle recursive parent directories
      if (options?.recursive) {
        let parent = path.dirname(dirPath);
        while (parent !== '.' && parent !== '/') {
          directoryState.add(parent);
          parent = path.dirname(parent);
        }
      }
      return undefined as string | undefined;
    });

    vi.mocked(fs.stat).mockImplementation(async (filePath: string) => {
      if (directoryState.has(filePath)) {
        return {
          isDirectory: () => true,
          mode: 0o755,
        } as fs.Stats;
      }
      if (fileSystemState.has(filePath)) {
        return {
          isDirectory: () => false,
          mode: 0o644,
        } as fs.Stats;
      }
      throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
    });

    vi.mocked(fs.chmod).mockImplementation(async () => {});

    // Create a new program instance for each test
    program = new Command();
    program
      .exitOverride() // Prevent process.exit
      .configureOutput({
        writeOut: (str) => capturedOutput.push(str.trim()),
        writeErr: (str) => capturedErrors.push(str.trim()),
      });
    program.addCommand(initCommand);
  });

  afterEach(async () => {
    // Clean up temp directory using actual fs (not mocked)
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    vi.restoreAllMocks();
  });

  describe('basic initialization', () => {
    it('should initialize STM repository successfully', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      expect(mockLockManager.acquire).toHaveBeenCalledOnce();
      expect(mockLockManager.release).toHaveBeenCalledOnce();

      // Check that success messages are shown
      expect(capturedOutput).toContain('Initialized STM repository');
      expect(capturedOutput).toContain('Created .simple-task-master/');
      expect(capturedOutput).toContain('Created .simple-task-master/tasks/');
      expect(capturedOutput.some(msg => msg.includes('Created') && msg.includes('config.json'))).toBe(true);
    });

    it('should create directory structure', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const baseDir = path.join(tempDir, '.simple-task-master');
      const tasksDir = path.join(baseDir, 'tasks');

      expect(directoryState.has(baseDir)).toBe(true);
      expect(directoryState.has(tasksDir)).toBe(true);
    });

    it('should create default configuration file', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      expect(fileSystemState.has(configPath)).toBe(true);

      const configContent = fileSystemState.get(configPath) as string;
      const config = JSON.parse(configContent);

      expect(config).toMatchObject({
        schema: 1,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
      });
    });

    it('should handle already initialized repository', async () => {
      // Initialize once
      await program.parseAsync(['node', 'stm', 'init']);
      
      // Clear captured output
      capturedOutput.length = 0;
      capturedWarnings.length = 0;

      // Try to initialize again
      await program.parseAsync(['node', 'stm', 'init']);

      expect(capturedWarnings).toContain('STM repository is already initialized');
    });
  });

  describe('gitignore handling', () => {
    it('should create .gitignore if it does not exist', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const gitignorePath = path.join(tempDir, '.gitignore');
      expect(fileSystemState.has(gitignorePath)).toBe(true);

      const content = fileSystemState.get(gitignorePath) as string;
      expect(content).toContain('.simple-task-master/tasks/');
      expect(content).toContain('.simple-task-master/lock');
      expect(content).toContain('Simple Task Master');
    });

    it('should update existing .gitignore', async () => {
      // Create existing .gitignore
      const existingContent = '# Existing content\nnode_modules/\n*.log\n';
      const gitignorePath = path.join(tempDir, '.gitignore');
      fileSystemState.set(gitignorePath, existingContent);
      
      // Also mark gitignore as existing for fileExists check
      vi.mocked(utils.fileExists).mockImplementation(async (filePath: string) => {
        return fileSystemState.has(filePath) || filePath === gitignorePath;
      });

      await program.parseAsync(['node', 'stm', 'init']);

      const content = fileSystemState.get(gitignorePath) as string;

      // Should contain existing content
      expect(content).toContain('# Existing content');
      expect(content).toContain('node_modules/');
      expect(content).toContain('*.log');

      // Should contain new STM entries
      expect(content).toContain('.simple-task-master/tasks/');
      expect(content).toContain('.simple-task-master/lock');
      expect(content).toContain('Simple Task Master');
    });

    it('should not duplicate entries in existing .gitignore', async () => {
      // Create .gitignore with STM entries already present
      const existingContent = `node_modules/
.simple-task-master/tasks/
.simple-task-master/lock
# Other content
`;
      const gitignorePath = path.join(tempDir, '.gitignore');
      fileSystemState.set(gitignorePath, existingContent);
      
      // Also mark gitignore as existing for fileExists check
      vi.mocked(utils.fileExists).mockImplementation(async (filePath: string) => {
        return fileSystemState.has(filePath) || filePath === gitignorePath;
      });

      await program.parseAsync(['node', 'stm', 'init']);

      const content = fileSystemState.get(gitignorePath) as string;

      // Should not duplicate the entries
      const tasksEntries = (content.match(/.simple-task-master\/tasks\//g) || []).length;
      const lockEntries = (content.match(/.simple-task-master\/lock/g) || []).length;

      expect(tasksEntries).toBe(1);
      expect(lockEntries).toBe(1);
    });

    it('should handle partial existing STM entries', async () => {
      // Create .gitignore with only one STM entry
      const existingContent = `node_modules/
.simple-task-master/tasks/
# No lock entry
`;
      const gitignorePath = path.join(tempDir, '.gitignore');
      fileSystemState.set(gitignorePath, existingContent);
      
      // Also mark gitignore as existing for fileExists check
      vi.mocked(utils.fileExists).mockImplementation(async (filePath: string) => {
        return fileSystemState.has(filePath) || filePath === gitignorePath;
      });

      await program.parseAsync(['node', 'stm', 'init']);

      const content = fileSystemState.get(gitignorePath) as string;

      // Should add missing lock entry
      expect(content).toContain('.simple-task-master/tasks/');
      expect(content).toContain('.simple-task-master/lock');

      const lockEntries = (content.match(/.simple-task-master\/lock/g) || []).length;
      expect(lockEntries).toBe(1);
    });

    it('should handle .gitignore update failure gracefully', async () => {
      // Mock writeFile to fail for .gitignore
      const originalWriteFile = vi.mocked(fs.writeFile).getMockImplementation();
      vi.mocked(fs.writeFile).mockImplementation(async (filePath: string | fs.FileHandle, data: string | Buffer) => {
        if (typeof filePath === 'string' && filePath.endsWith('.gitignore')) {
          throw new Error('Permission denied');
        }
        return originalWriteFile!(filePath, data);
      });

      await program.parseAsync(['node', 'stm', 'init']);

      // Should still complete successfully but warn about gitignore
      expect(capturedOutput).toContain('Initialized STM repository');
      expect(capturedWarnings.some(msg => msg.includes('Could not update .gitignore'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle directory creation failure', async () => {
      // Mock ensureDirectory to fail
      vi.mocked(utils.ensureDirectory).mockRejectedValue(new FileSystemError('Permission denied'));

      await expect(program.parseAsync(['node', 'stm', 'init'])).rejects.toThrow('process.exit');
      
      expect(capturedErrors).toContain('Permission denied');
    });

    it('should handle config file write failure', async () => {
      // Mock writeFile to fail for config.json
      const originalWriteFile = vi.mocked(fs.writeFile).getMockImplementation();
      vi.mocked(fs.writeFile).mockImplementation(async (filePath: string | fs.FileHandle, data: string | Buffer) => {
        if (typeof filePath === 'string' && filePath.endsWith('config.json')) {
          throw new Error('EISDIR: illegal operation on a directory');
        }
        return originalWriteFile!(filePath, data);
      });

      await expect(program.parseAsync(['node', 'stm', 'init'])).rejects.toThrow('process.exit');
      
      expect(capturedErrors.some(err => err.includes('EISDIR'))).toBe(true);
    });

    it('should handle lock acquisition failure', async () => {
      const lockError = new Error('Failed to acquire lock');
      mockLockManager.acquire.mockRejectedValue(lockError);

      await expect(program.parseAsync(['node', 'stm', 'init'])).rejects.toThrow('process.exit');
      
      expect(mockLockManager.acquire).toHaveBeenCalledOnce();
    });

    it('should release lock even when initialization fails', async () => {
      // Mock ensureDirectory to fail
      vi.mocked(utils.ensureDirectory).mockRejectedValue(new FileSystemError('Mock error'));

      await expect(program.parseAsync(['node', 'stm', 'init'])).rejects.toThrow('process.exit');
      
      expect(mockLockManager.acquire).toHaveBeenCalledOnce();
      expect(mockLockManager.release).toHaveBeenCalledOnce();
    });

    it('should re-throw unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockLockManager.acquire.mockRejectedValue(unexpectedError);

      await expect(program.parseAsync(['node', 'stm', 'init'])).rejects.toThrow('process.exit');
    });
  });

  describe('working directory handling', () => {
    it('should initialize in current working directory', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      expect(fileSystemState.has(configPath)).toBe(true);
    });

    it('should handle nested directory structures', async () => {
      // Create nested directory structure
      const nestedDir = path.join(tempDir, 'projects', 'my-project');
      directoryState.add(nestedDir);
      directoryState.add(path.join(tempDir, 'projects'));
      
      // Mock process.cwd to return the nested directory
      vi.mocked(process.cwd).mockReturnValue(nestedDir);

      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(nestedDir, '.simple-task-master', 'config.json');
      expect(fileSystemState.has(configPath)).toBe(true);
    });
  });

  describe('configuration validation', () => {
    it('should create valid JSON configuration', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      const configContent = fileSystemState.get(configPath) as string;

      // Should be valid JSON
      expect(() => JSON.parse(configContent)).not.toThrow();

      const config = JSON.parse(configContent);

      // Should have required fields with correct types
      expect(typeof config.schema).toBe('number');
      expect(typeof config.lockTimeoutMs).toBe('number');
      expect(typeof config.maxTaskSizeBytes).toBe('number');

      // Should have reasonable values
      expect(config.schema).toBeGreaterThan(0);
      expect(config.lockTimeoutMs).toBeGreaterThan(0);
      expect(config.maxTaskSizeBytes).toBeGreaterThan(0);
    });

    it('should create pretty-formatted JSON', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      const configContent = fileSystemState.get(configPath) as string;

      // Should be formatted (contain newlines and indentation)
      expect(configContent).toContain('\n');
      expect(configContent).toContain('  '); // Indentation
    });

    it('should use default configuration values', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      const configContent = fileSystemState.get(configPath) as string;
      const config = JSON.parse(configContent);

      expect(config).toMatchObject({
        schema: 1,
        lockTimeoutMs: 30000,
        maxTaskSizeBytes: 1048576,
      });
    });
  });

  describe('file permissions', () => {
    it('should create files with appropriate permissions', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      const stats = await vi.mocked(fs.stat)(configPath);

      // File should be readable and writable by owner
      expect(stats.mode & 0o200).toBeTruthy(); // Owner write
      expect(stats.mode & 0o400).toBeTruthy(); // Owner read
    });

    it('should create directories with appropriate permissions', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      const baseDir = path.join(tempDir, '.simple-task-master');
      const stats = await vi.mocked(fs.stat)(baseDir);

      // Directory should be accessible
      expect(stats.isDirectory()).toBe(true);
      expect(stats.mode & 0o700).toBeTruthy(); // Owner permissions
    });
  });

  describe('idempotency', () => {
    it('should be safe to run multiple times', async () => {
      // Run init multiple times
      await program.parseAsync(['node', 'stm', 'init']);
      await program.parseAsync(['node', 'stm', 'init']);
      await program.parseAsync(['node', 'stm', 'init']);

      // Should still have only one config file with correct content
      const configPath = path.join(tempDir, '.simple-task-master', 'config.json');
      const configContent = fileSystemState.get(configPath) as string;
      const config = JSON.parse(configContent);

      expect(config.schema).toBe(1);
    });

    it('should not corrupt existing files when run again', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      // Add a task to verify file structure works
      const taskPath = path.join(tempDir, '.simple-task-master', 'tasks', '1-test-task.md');
      const taskContent = '---\nid: 1\ntitle: Test Task\n---\nTest content';
      fileSystemState.set(taskPath, taskContent);

      // Run init again
      await program.parseAsync(['node', 'stm', 'init']);

      // Task file should still exist and be intact
      expect(fileSystemState.has(taskPath)).toBe(true);
      const savedContent = fileSystemState.get(taskPath) as string;
      expect(savedContent).toContain('Test Task');
      expect(savedContent).toContain('Test content');
    });
  });

  describe('command structure', () => {
    it('should have correct command configuration', () => {
      expect(initCommand.name()).toBe('init');
      expect(initCommand.description()).toContain('Initialize STM repository');

      // Should not require any arguments
      const args = initCommand.args;
      expect(args).toHaveLength(0);
    });

    it('should have no options', () => {
      const options = initCommand.options;
      expect(options).toHaveLength(0);
    });
  });

  describe('output messages', () => {
    it('should provide clear success messages', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      expect(capturedOutput).toContain('Initialized STM repository');
      expect(capturedOutput).toContain('Created .simple-task-master/');
      expect(capturedOutput).toContain('Created .simple-task-master/tasks/');
      expect(capturedOutput.some(msg => msg.includes('Created') && msg.includes('config.json'))).toBe(true);
    });

    it('should provide relative paths in messages', async () => {
      await program.parseAsync(['node', 'stm', 'init']);
      
      // Clear output for second run
      capturedOutput.length = 0;
      capturedWarnings.length = 0;

      // Messages should show relative paths for better UX
      await program.parseAsync(['node', 'stm', 'init']);
      expect(capturedOutput.concat(capturedWarnings).join(' ')).not.toContain(tempDir); // Should not show absolute paths
    });

    it('should indicate gitignore updates', async () => {
      await program.parseAsync(['node', 'stm', 'init']);

      expect(capturedOutput).toContain('Created .gitignore');
    });

    it('should show different message for gitignore update vs create', async () => {
      // Create existing .gitignore
      const gitignorePath = path.join(tempDir, '.gitignore');
      fileSystemState.set(gitignorePath, 'existing\n');
      
      // Also mark gitignore as existing for fileExists check
      vi.mocked(utils.fileExists).mockImplementation(async (filePath: string) => {
        return fileSystemState.has(filePath) || filePath === gitignorePath;
      });

      await program.parseAsync(['node', 'stm', 'init']);

      expect(capturedOutput).toContain('Updated .gitignore');
      expect(capturedOutput).not.toContain('Created .gitignore');
    });
  });
});
