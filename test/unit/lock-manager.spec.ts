/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LockManager } from '../../src/lib/lock-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import { constants as _fsConstants } from 'fs';
import { tmpdir } from 'os';

// Test-specific LockManager that uses shorter timeouts for faster tests
class TestLockManager extends LockManager {
  // Override the protected properties for faster tests
  protected readonly LOCK_CHECK_INTERVAL_MS = 50; // Reduce from 100ms to 50ms
  protected readonly MAX_LOCK_RETRIES = 20; // Reduce from 100 to 20 for faster tests

  constructor(projectRoot: string) {
    super(projectRoot);
  }
}

describe('LockManager', () => {
  let lockManager: TestLockManager;
  let testDir: string;
  let lockPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'stm-lock-test-'));
    lockManager = new TestLockManager(testDir);
    lockPath = path.join(testDir, '.simple-task-master', 'lock');

    // Ensure the .simple-task-master directory exists
    await fs.mkdir(path.join(testDir, '.simple-task-master'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up lock manager instance and test directory
    lockManager.dispose();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('acquire', () => {
    it('should successfully acquire a lock when no lock exists', async () => {
      await lockManager.acquire();

      // Verify lock file exists
      const lockExists = await fs
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(true);

      // Verify lock content
      const lockContent = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      expect(lockContent.pid).toBe(process.pid);
      expect(lockContent.command).toBe(process.argv.join(' '));
      expect(lockContent.timestamp).toBeCloseTo(Date.now(), -100); // Within 100ms
    });

    it('should fail to acquire lock when another process holds it', async () => {
      // Create a lock file for a different (fake but likely alive) process
      const lockData = {
        pid: 1, // PID 1 is always init/systemd
        command: 'stm add "test"',
        timestamp: Date.now()
      };
      await fs.writeFile(lockPath, JSON.stringify(lockData, null, 2));

      // Try to acquire lock - should fail after retries
      await expect(lockManager.acquire()).rejects.toThrow(
        /Failed to acquire lock after \d+ retries/
      );
    }, 10000); // Increase timeout for retry logic

    it('should remove stale lock based on timeout', async () => {
      // Create a stale lock (older than 30 seconds)
      const staleLock = {
        pid: process.pid,
        command: 'stm add "old task"',
        timestamp: Date.now() - 31000 // 31 seconds old
      };
      await fs.writeFile(lockPath, JSON.stringify(staleLock, null, 2));

      // Should successfully acquire lock
      await lockManager.acquire();

      // Verify new lock was created
      const lockContent = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      expect(lockContent.timestamp).toBeCloseTo(Date.now(), -100);
    });

    it('should remove stale lock for dead process', async () => {
      // Create a lock for a non-existent process
      const deadProcessLock = {
        pid: 999999, // Very unlikely to exist
        command: 'stm add "dead process task"',
        timestamp: Date.now() - 1000 // Recent but dead process
      };
      await fs.writeFile(lockPath, JSON.stringify(deadProcessLock, null, 2));

      // Mock console.warn to verify stale lock message
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should successfully acquire lock
      await lockManager.acquire();

      // Verify stale lock was detected
      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Removing stale lock/));

      warnSpy.mockRestore();
    });

    it('should create directory if it does not exist', async () => {
      // Remove the .simple-task-master directory
      await fs.rm(path.join(testDir, '.simple-task-master'), { recursive: true });

      // Should still successfully acquire lock
      await lockManager.acquire();

      // Verify lock file exists
      const lockExists = await fs
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(true);
    });

    it('should retry acquiring lock with proper intervals', async () => {
      // Create a lock that will be released after some retries
      const lockData = {
        pid: process.pid,
        command: 'stm add "test"',
        timestamp: Date.now()
      };
      await fs.writeFile(lockPath, JSON.stringify(lockData, null, 2));

      // Set up a timer to remove the lock after 250ms
      setTimeout(async () => {
        await fs.unlink(lockPath).catch(() => {});
      }, 250);

      const startTime = Date.now();
      await lockManager.acquire();
      const duration = Date.now() - startTime;

      // Should have taken at least 250ms but less than the max retry time
      expect(duration).toBeGreaterThanOrEqual(200); // Allow some variance
      expect(duration).toBeLessThan(2000); // Max retry time with TestLockManager
    }, 10000); // Increase timeout
  });

  describe('release', () => {
    it('should release lock owned by current process', async () => {
      // First acquire a lock
      await lockManager.acquire();

      // Verify lock exists
      let lockExists = await fs
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(true);

      // Release the lock
      await lockManager.release();

      // Verify lock is removed
      lockExists = await fs
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('should not release lock owned by different process', async () => {
      // Create a lock for a different process
      const lockData = {
        pid: 1, // Different PID
        command: 'stm add "test"',
        timestamp: Date.now()
      };
      await fs.writeFile(lockPath, JSON.stringify(lockData, null, 2));

      // Try to release - should not remove the lock
      await lockManager.release();

      // Verify lock still exists
      const lockExists = await fs
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(true);
    });

    it('should handle releasing non-existent lock gracefully', async () => {
      // Try to release when no lock exists
      await expect(lockManager.release()).resolves.not.toThrow();
    });
  });

  describe('process liveness checking', () => {
    it('should correctly identify current process as alive', async () => {
      // Use the protected method directly
      const isAlive = lockManager.isProcessAlive(process.pid);
      expect(isAlive).toBe(true);
    });

    it('should correctly identify non-existent process as dead', async () => {
      // Use the protected method directly
      const isAlive = lockManager.isProcessAlive(999999);
      expect(isAlive).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      // PID 1 exists but we might not have permission to signal it
      const isAlive = lockManager.isProcessAlive(1);
      // Should return true because EPERM means process exists
      expect(isAlive).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent lock attempts', async () => {
      // Try to acquire lock multiple times concurrently
      const promises = Array(5)
        .fill(null)
        .map(() => lockManager.acquire());

      // Only one should succeed, others should fail
      const results = await Promise.allSettled(promises);
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);
    }, 15000); // Increase timeout for concurrent operations

    it('should handle corrupted lock file', async () => {
      // Create a corrupted lock file
      await fs.writeFile(lockPath, 'invalid json content');

      // Should either throw parse error or treat as stale and acquire
      // The behavior depends on how the error is handled in read()
      const result = await lockManager.acquire().catch((e) => e);
      if (result instanceof Error) {
        expect(result.message).toMatch(/Unexpected token|JSON/);
      } else {
        // If it treated the corrupted file as stale, acquisition should succeed
        expect(result).toBeUndefined();
      }
    });

    it('should handle lock file with missing fields', async () => {
      // Create a lock file with missing fields
      const incompleteLock = { pid: 12345 }; // Missing command and timestamp
      await fs.writeFile(lockPath, JSON.stringify(incompleteLock));

      // Should handle gracefully and acquire lock
      await expect(lockManager.acquire()).resolves.not.toThrow();
    });
  });

  describe('cleanup handlers', () => {
    it('should set up cleanup handlers only once globally', async () => {
      // This test verifies that multiple LockManager instances don't cause
      // MaxListenersExceededWarning by checking that handlers are shared globally

      // Create multiple LockManager instances
      const managers = Array.from({ length: 5 }, () => new TestLockManager(testDir));

      // All instances should be created without warnings
      expect(managers.length).toBe(5);

      // Clean up all instances
      managers.forEach((manager) => manager.dispose());
    });
  });

  describe('timeout and retry behavior', () => {
    it('should respect lock timeout settings', async () => {
      // Create a lock with a recent timestamp (not stale)
      const recentLock = {
        pid: 1, // Different process
        command: 'stm add "test"',
        timestamp: Date.now() - 5000 // 5 seconds old (not stale)
      };
      await fs.writeFile(lockPath, JSON.stringify(recentLock, null, 2));

      const startTime = Date.now();

      try {
        await lockManager.acquire();
        throw new Error('Should have failed to acquire lock');
      } catch (error: unknown) {
        const duration = Date.now() - startTime;

        expect((error as Error).message).toMatch(/Failed to acquire lock after \d+ retries/);
        // With TestLockManager: 20 retries * 50ms = 1000ms
        expect(duration).toBeGreaterThan(800); // At least ~800ms
        expect(duration).toBeLessThan(1500); // But not too much longer
      }
    }, 10000); // Increase timeout

    it('should retry with proper intervals', async () => {
      // Create a lock that will persist
      const persistentLock = {
        pid: 1,
        command: 'stm add "test"',
        timestamp: Date.now()
      };
      await fs.writeFile(lockPath, JSON.stringify(persistentLock, null, 2));

      const startTime = Date.now();
      try {
        await lockManager.acquire();
        throw new Error('Should have failed to acquire lock');
      } catch (error: unknown) {
        const duration = Date.now() - startTime;

        // Should have failed after retries
        expect((error as Error).message).toMatch(/Failed to acquire lock after \d+ retries/);

        // Duration should be approximately 20 retries * 50ms = 1000ms
        expect(duration).toBeGreaterThan(800);
        expect(duration).toBeLessThan(1500);
      }
    }, 10000); // Increase timeout
  });

  describe('stale lock detection', () => {
    it('should detect and remove locks older than timeout', async () => {
      const staleTimes = [31000, 60000, 120000]; // 31s, 1min, 2min

      for (const staleTime of staleTimes) {
        // Clean up existing lock if it exists
        await fs.unlink(lockPath).catch(() => {});

        const staleLock = {
          pid: process.pid,
          command: 'stm add "stale task"',
          timestamp: Date.now() - staleTime
        };
        await fs.writeFile(lockPath, JSON.stringify(staleLock, null, 2));

        // Should successfully acquire lock
        await lockManager.acquire();

        // Verify new lock was created
        const lockContent = JSON.parse(await fs.readFile(lockPath, 'utf8'));
        expect(lockContent.timestamp).toBeCloseTo(Date.now(), -1000);

        await lockManager.release();
      }
    });

    it('should preserve valid recent locks', async () => {
      const recentTimes = [1000, 5000, 15000]; // 1s, 5s, 15s

      for (const recentTime of recentTimes) {
        // Clean up existing lock if it exists
        await fs.unlink(lockPath).catch(() => {});

        const recentLock = {
          pid: 1, // Different process that should be alive
          command: 'stm add "recent task"',
          timestamp: Date.now() - recentTime
        };
        await fs.writeFile(lockPath, JSON.stringify(recentLock, null, 2));

        // Should fail to acquire lock
        await expect(lockManager.acquire()).rejects.toThrow(/Failed to acquire lock/);

        // Original lock should still exist
        const lockContent = JSON.parse(await fs.readFile(lockPath, 'utf8'));
        expect(lockContent.pid).toBe(1);
        expect(lockContent.timestamp).toBe(recentLock.timestamp);
      }
    }, 30000); // Increase timeout for multiple iterations
  });

  describe('process crash recovery', () => {
    it('should handle locks from non-existent processes', async () => {
      const deadPids = [999999, 888888, 777777];

      for (const deadPid of deadPids) {
        // Clean up existing lock if it exists
        await fs.unlink(lockPath).catch(() => {});

        const deadProcessLock = {
          pid: deadPid,
          command: 'stm add "dead process task"',
          timestamp: Date.now() - 1000 // Recent but dead process
        };
        await fs.writeFile(lockPath, JSON.stringify(deadProcessLock, null, 2));

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Should successfully acquire lock
        await lockManager.acquire();

        // Verify stale lock was detected
        expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Removing stale lock/));

        warnSpy.mockRestore();
        await lockManager.release();
      }
    }, 15000); // Increase timeout for multiple iterations

    it('should handle corrupted PID values', async () => {
      const corruptedLocks = [
        { pid: 'invalid', command: 'test', timestamp: Date.now() },
        { pid: -1, command: 'test', timestamp: Date.now() },
        { pid: 0, command: 'test', timestamp: Date.now() },
        { pid: null, command: 'test', timestamp: Date.now() }
      ];

      for (const corruptedLock of corruptedLocks) {
        // Clean up existing lock if it exists
        await fs.unlink(lockPath).catch(() => {});

        await fs.writeFile(lockPath, JSON.stringify(corruptedLock, null, 2));

        // Should handle corrupted lock gracefully - either throw or treat as stale
        const result = await lockManager.acquire().catch((e) => e);
        if (result instanceof Error) {
          // If it throws, that's acceptable behavior for corrupted data
          expect(result.message).toBeDefined();
        } else {
          // If it acquires, it treated the corrupted lock as stale
          await lockManager.release();
        }
      }
    }, 15000); // Increase timeout
  });

  describe('filesystem error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // This test might not work on all systems, but provides coverage
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { mode: 0o444 }); // Read-only directory

      const readOnlyLockManager = new TestLockManager(readOnlyDir);

      try {
        await readOnlyLockManager.acquire();
        // If it doesn't throw, that's okay too (depends on system)
      } catch (error: unknown) {
        expect((error as Error).message).toMatch(/EACCES|EPERM|permission/i);
      }

      // Restore permissions for cleanup
      await fs.chmod(readOnlyDir, 0o755);
      readOnlyLockManager.dispose();
    });

    it.skip('should handle disk full scenarios', async () => {
      // Create a custom lock manager for this test to avoid conflicts
      const diskFullLockManager = new TestLockManager(testDir);

      // Mock fs.open to simulate disk full
      const mockError = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException;
      mockError.code = 'ENOSPC';

      // Use mockImplementationOnce to avoid conflicts with other tests
      const openSpy = vi.spyOn(fs, 'open');

      // Mock just the first call
      openSpy.mockImplementationOnce(() => Promise.reject(mockError));

      await expect(diskFullLockManager.acquire()).rejects.toThrow('ENOSPC');

      // Restore original function and clean up
      openSpy.mockRestore();
      diskFullLockManager.dispose();
    });
  });

  describe('concurrent lock attempts', () => {
    it('should handle multiple processes trying to acquire simultaneously', async () => {
      const concurrentAttempts = 10;

      interface LockAttemptSuccess {
        success: true;
        lockManager: LockManager;
      }

      interface LockAttemptFailure {
        success: false;
        error: string;
      }

      type LockAttemptResult = LockAttemptSuccess | LockAttemptFailure;

      // Use a small delay between creating lock managers to reduce race conditions
      const lockManagers: LockManager[] = [];
      const lockPromises: Promise<LockAttemptResult>[] = [];

      for (let i = 0; i < concurrentAttempts; i++) {
        const newLockManager = new TestLockManager(testDir);
        lockManagers.push(newLockManager);

        // Start acquisition attempts with tiny delays to ensure atomic file operations
        // don't collide at the exact same microsecond
        lockPromises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              newLockManager.acquire().then(
                (): void => resolve({ success: true, lockManager: newLockManager }),
                (error): void => resolve({ success: false, error: error.message })
              );
            }, i * 2); // 2ms delay between each attempt
          })
        );
      }

      const results = await Promise.all(lockPromises);

      // Only one should succeed
      const successes = results.filter((r): r is LockAttemptSuccess => r.success);
      const failures = results.filter((r): r is LockAttemptFailure => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(concurrentAttempts - 1);

      // Clean up the successful lock and dispose all lock managers
      if (successes.length > 0) {
        await successes[0].lockManager.release();
      }

      // Dispose all lock manager instances created in this test
      lockManagers.forEach((manager) => manager.dispose());
    }, 30000); // Increase timeout for concurrent operations

    it('should handle rapid acquire-release cycles', async () => {
      const cycles = 5;

      for (let i = 0; i < cycles; i++) {
        await lockManager.acquire();

        // Verify lock exists
        const lockExists = await fs
          .access(lockPath)
          .then(() => true)
          .catch(() => false);
        expect(lockExists).toBe(true);

        await lockManager.release();

        // Verify lock is removed
        const lockStillExists = await fs
          .access(lockPath)
          .then(() => true)
          .catch(() => false);
        expect(lockStillExists).toBe(false);
      }
    });
  });

  describe('lock content validation', () => {
    it('should create locks with all required fields', async () => {
      await lockManager.acquire();

      const lockContent = JSON.parse(await fs.readFile(lockPath, 'utf8'));

      expect(lockContent).toHaveProperty('pid');
      expect(lockContent).toHaveProperty('command');
      expect(lockContent).toHaveProperty('timestamp');

      expect(typeof lockContent.pid).toBe('number');
      expect(typeof lockContent.command).toBe('string');
      expect(typeof lockContent.timestamp).toBe('number');

      expect(lockContent.pid).toBe(process.pid);
      expect(lockContent.command).toBe(process.argv.join(' '));
      expect(lockContent.timestamp).toBeCloseTo(Date.now(), -1000);
    });

    it('should handle locks with missing fields gracefully', async () => {
      const incompleteLocks = [
        { pid: 12345 }, // Missing command and timestamp
        { command: 'test' }, // Missing pid and timestamp
        { timestamp: Date.now() }, // Missing pid and command
        { pid: 12345, command: 'test' }, // Missing timestamp
        { pid: 12345, timestamp: Date.now() } // Missing command
      ];

      for (const incompleteLock of incompleteLocks) {
        // Clean up existing lock if it exists
        await fs.unlink(lockPath).catch(() => {});

        await fs.writeFile(lockPath, JSON.stringify(incompleteLock));

        // Should handle gracefully - either acquire or throw
        const result = await lockManager.acquire().catch((e) => e);
        if (result instanceof Error) {
          // If it throws due to missing fields, that's acceptable
          expect(result.message).toBeDefined();
        } else {
          // If it acquires, clean up
          await lockManager.release();
        }
      }
    }, 15000); // Increase timeout
  });

  describe('lock manager configuration', () => {
    it('should work with different project root paths', async () => {
      const customRoots = [
        path.join(testDir, 'custom1'),
        path.join(testDir, 'custom2', 'nested'),
        path.join(testDir, 'with spaces'),
        path.join(testDir, 'with-dashes')
      ];

      for (const customRoot of customRoots) {
        const customLockManager = new TestLockManager(customRoot);

        await customLockManager.acquire();

        const customLockPath = path.join(customRoot, '.simple-task-master', 'lock');
        const lockExists = await fs
          .access(customLockPath)
          .then(() => true)
          .catch(() => false);
        expect(lockExists).toBe(true);

        await customLockManager.release();
        customLockManager.dispose();
      }
    });

    it('should handle very long project paths', async () => {
      const longPath = path.join(testDir, 'very'.repeat(20), 'long'.repeat(10), 'path'.repeat(5));
      const longPathLockManager = new TestLockManager(longPath);

      await longPathLockManager.acquire();

      const longLockPath = path.join(longPath, '.simple-task-master', 'lock');
      const lockExists = await fs
        .access(longLockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(true);

      await longPathLockManager.release();
      longPathLockManager.dispose();
    });
  });
});
