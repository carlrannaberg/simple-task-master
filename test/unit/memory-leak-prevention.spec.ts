import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LockManager } from '@lib/lock-manager';
import { TempDirManager } from '@test/helpers/temp-utils';
import { tmpdir } from 'os';
import * as path from 'path';

describe('Memory Leak Prevention', () => {
  let tempDir: string;
  let lockManagers: LockManager[];
  let tempManagers: TempDirManager[];
  let originalMaxListeners: number;
  let initialListenerCounts: Record<string, number>;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), 'memory-leak-test');
    lockManagers = [];
    tempManagers = [];
    originalMaxListeners = process.getMaxListeners();

    // Clean up any existing listeners first
    LockManager.disposeGlobalListeners();

    // Record initial listener counts
    initialListenerCounts = {
      exit: process.listenerCount('exit'),
      sigint: process.listenerCount('SIGINT'),
      sigterm: process.listenerCount('SIGTERM'),
      uncaughtException: process.listenerCount('uncaughtException'),
      unhandledRejection: process.listenerCount('unhandledRejection')
    };

    // Set max listeners to a reasonable limit
    process.setMaxListeners(25);
  });

  afterEach(() => {
    // Clean up all managers
    for (const manager of lockManagers) {
      manager.dispose();
    }
    for (const manager of tempManagers) {
      manager.dispose();
    }

    // Clean up global listeners
    LockManager.disposeGlobalListeners();

    // Restore original max listeners
    process.setMaxListeners(originalMaxListeners);
  });

  it('should not trigger MaxListenersExceededWarning with multiple LockManager instances', () => {
    // Create multiple LockManager instances
    for (let i = 0; i < 10; i++) {
      const manager = new LockManager(tempDir);
      lockManagers.push(manager);
    }

    // Check that process listener count doesn't grow unboundedly
    const exitListeners = process.listenerCount('exit');
    const sigintListeners = process.listenerCount('SIGINT');
    const sigtermListeners = process.listenerCount('SIGTERM');
    const uncaughtExceptionListeners = process.listenerCount('uncaughtException');
    const unhandledRejectionListeners = process.listenerCount('unhandledRejection');

    // LockManager should only register global listeners once per setup
    // Each event should have approximately initial + 1 listeners
    expect(exitListeners).toBeLessThanOrEqual(initialListenerCounts.exit + 2);
    expect(sigintListeners).toBeLessThanOrEqual(initialListenerCounts.sigint + 2);
    expect(sigtermListeners).toBeLessThanOrEqual(initialListenerCounts.sigterm + 2);
    expect(uncaughtExceptionListeners).toBeLessThanOrEqual(
      initialListenerCounts.uncaughtException + 2
    );
    expect(unhandledRejectionListeners).toBeLessThanOrEqual(
      initialListenerCounts.unhandledRejection + 2
    );
  });

  it('should not trigger MaxListenersExceededWarning with multiple TempDirManager instances', () => {
    // Create multiple TempDirManager instances with cleanup enabled
    for (let i = 0; i < 5; i++) {
      const manager = new TempDirManager({ cleanupOnExit: true });
      tempManagers.push(manager);
    }

    // Check that process listener count doesn't exceed the limit
    const exitListeners = process.listenerCount('exit');
    const sigintListeners = process.listenerCount('SIGINT');
    const sigtermListeners = process.listenerCount('SIGTERM');
    const uncaughtExceptionListeners = process.listenerCount('uncaughtException');
    const unhandledRejectionListeners = process.listenerCount('unhandledRejection');

    // Should have reasonable number of listeners (initial + TempDirManager instances)
    expect(exitListeners).toBeLessThanOrEqual(initialListenerCounts.exit + 10);
    expect(sigintListeners).toBeLessThanOrEqual(initialListenerCounts.sigint + 10);
    expect(sigtermListeners).toBeLessThanOrEqual(initialListenerCounts.sigterm + 10);
    expect(uncaughtExceptionListeners).toBeLessThanOrEqual(
      initialListenerCounts.uncaughtException + 10
    );
    expect(unhandledRejectionListeners).toBeLessThanOrEqual(
      initialListenerCounts.unhandledRejection + 10
    );
  });

  it('should properly clean up listeners when LockManager is disposed', () => {
    const initialExitListeners = process.listenerCount('exit');
    const initialSigintListeners = process.listenerCount('SIGINT');

    // Create and dispose LockManager
    const manager = new LockManager(tempDir);
    manager.dispose();
    LockManager.disposeGlobalListeners();

    // Listener count should be back to initial state
    expect(process.listenerCount('exit')).toBe(initialExitListeners);
    expect(process.listenerCount('SIGINT')).toBe(initialSigintListeners);
  });

  it('should properly clean up listeners when TempDirManager is disposed', () => {
    const initialExitListeners = process.listenerCount('exit');
    const initialSigintListeners = process.listenerCount('SIGINT');

    // Create and dispose TempDirManager
    const manager = new TempDirManager({ cleanupOnExit: true });
    manager.dispose();

    // Listener count should be back to initial state
    expect(process.listenerCount('exit')).toBe(initialExitListeners);
    expect(process.listenerCount('SIGINT')).toBe(initialSigintListeners);
  });

  it('should handle mixed instances without exceeding listener limits', () => {
    // Create a mix of LockManager and TempDirManager instances
    for (let i = 0; i < 3; i++) {
      const lockManager = new LockManager(path.join(tempDir, `lock-${i}`));
      const tempManager = new TempDirManager({ cleanupOnExit: true });
      lockManagers.push(lockManager);
      tempManagers.push(tempManager);
    }

    // Should not exceed the max listeners limit we set (25)
    const exitListeners = process.listenerCount('exit');
    const sigintListeners = process.listenerCount('SIGINT');
    const sigtermListeners = process.listenerCount('SIGTERM');
    const uncaughtExceptionListeners = process.listenerCount('uncaughtException');
    const unhandledRejectionListeners = process.listenerCount('unhandledRejection');

    // No individual event type should exceed the limit
    expect(exitListeners).toBeLessThan(25);
    expect(sigintListeners).toBeLessThan(25);
    expect(sigtermListeners).toBeLessThan(25);
    expect(uncaughtExceptionListeners).toBeLessThan(25);
    expect(unhandledRejectionListeners).toBeLessThan(25);
  });
});
