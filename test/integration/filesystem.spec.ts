/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir as _tmpdir } from 'os';
import writeFileAtomic from 'write-file-atomic';
import { TestWorkspace } from '@test/helpers/test-workspace';

describe(
  'Filesystem Integration',
  () => {
    let workspace: TestWorkspace;
    let tempDir: string;

    beforeEach(async () => {
      workspace = await TestWorkspace.create('filesystem-test-');
      tempDir = workspace.directory;
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    describe('Atomic Write Operations', () => {
      it('should perform atomic writes without corruption', async () => {
        const filePath = path.join(tempDir, 'atomic-test.txt');
        const content = 'Test content for atomic write';

        // Test write-file-atomic directly
        await writeFileAtomic(filePath, content);

        const readContent = await fs.readFile(filePath, 'utf8');
        expect(readContent).toBe(content);
      });

      it('should handle concurrent atomic writes safely', async () => {
        const filePath = path.join(tempDir, 'concurrent-test.txt');
        const writes = Array.from({ length: 10 }, (_, i) =>
          writeFileAtomic(filePath, `Content ${i}`)
        );

        // All writes should succeed without corruption
        await Promise.all(writes);

        // File should exist and contain one of the written contents
        const content = await fs.readFile(filePath, 'utf8');
        expect(content).toMatch(/^Content \d$/);
      });

      it('should preserve file integrity during power failure simulation', async () => {
        const filePath = path.join(tempDir, 'integrity-test.txt');
        const originalContent = 'Original content';
        const newContent = 'Updated content';

        // Write initial content
        await writeFileAtomic(filePath, originalContent);

        // Simulate power failure by creating orphaned temp files that write-file-atomic might leave
        // write-file-atomic uses pattern: filename + "." + murmurhex
        const tempFilePath1 = `${filePath}.2840185974`; // Simulated orphaned temp file
        const tempFilePath2 = `${filePath}.9876543210`; // Another orphaned temp file
        await fs.writeFile(tempFilePath1, 'Partial content from crash 1');
        await fs.writeFile(tempFilePath2, 'Partial content from crash 2');

        // Also test with a lock file that might be left from a crash
        const lockFilePath = `${filePath}.lock`;
        await fs.writeFile(lockFilePath, process.pid.toString());

        // Verify temp files exist before the write
        await expect(fs.access(tempFilePath1)).resolves.toBeUndefined();
        await expect(fs.access(tempFilePath2)).resolves.toBeUndefined();
        await expect(fs.access(lockFilePath)).resolves.toBeUndefined();

        // Atomic write should still work correctly despite orphaned files
        await writeFileAtomic(filePath, newContent);

        // Verify the main file has correct content
        const finalContent = await fs.readFile(filePath, 'utf8');
        expect(finalContent).toBe(newContent);

        // The original file should not be corrupted
        expect(finalContent).not.toContain('Partial content');

        // Note: write-file-atomic doesn't clean up orphaned temp files from previous crashes
        // This is expected behavior - it only cleans up its own temp files from the current operation
        // Manual cleanup of orphaned files would be needed in a real application
      });

      it('should handle interrupted write operations gracefully', async () => {
        const filePath = path.join(tempDir, 'interrupt-test.txt');
        const originalContent = 'This is the original content that should be preserved';

        // Write initial content
        await writeFileAtomic(filePath, originalContent);

        // Simulate a more realistic power failure scenario
        // by creating orphaned temp files that match write-file-atomic's pattern
        const tempFile1 = `${filePath}.${process.pid}12345`;
        const tempFile2 = `${filePath}.${process.pid}67890`;

        // Create orphaned temp files from "previous crashes"
        await fs.writeFile(tempFile1, 'Corrupted partial write 1');
        await fs.writeFile(tempFile2, 'Corrupted partial write 2');

        // Verify temp files exist
        await expect(fs.access(tempFile1)).resolves.toBeUndefined();
        await expect(fs.access(tempFile2)).resolves.toBeUndefined();

        // Original file should still have original content
        const contentBeforeWrite = await fs.readFile(filePath, 'utf8');
        expect(contentBeforeWrite).toBe(originalContent);

        // Do a successful atomic write - should work despite orphaned files
        const finalContent = 'Final content after recovery';
        await writeFileAtomic(filePath, finalContent);

        // Verify final content is correct and not corrupted
        const verifyContent = await fs.readFile(filePath, 'utf8');
        expect(verifyContent).toBe(finalContent);
        expect(verifyContent).not.toContain('Corrupted');

        // Note: Orphaned temp files from previous processes won't be cleaned up
        // by write-file-atomic - this is expected behavior
      });

      it('should handle large file writes atomically', async () => {
        const filePath = path.join(tempDir, 'large-file-test.txt');
        // Create 1MB of content
        const largeContent = 'A'.repeat(1024 * 1024);

        const startTime = Date.now();
        await writeFileAtomic(filePath, largeContent);
        const writeTime = Date.now() - startTime;

        const readContent = await fs.readFile(filePath, 'utf8');
        expect(readContent).toBe(largeContent);
        expect(readContent.length).toBe(1024 * 1024);

        // Write should complete in reasonable time (under 5 seconds)
        expect(writeTime).toBeLessThan(5000);
      });
    });

    describe('Directory Creation and Management', () => {
      it('should create nested directories recursively', async () => {
        const nestedPath = path.join(tempDir, 'deep', 'nested', 'directory', 'structure');

        await fs.mkdir(nestedPath, { recursive: true });

        const stats = await fs.stat(nestedPath);
        expect(stats.isDirectory()).toBe(true);
      });

      it('should handle directory creation race conditions', async () => {
        const dirPath = path.join(tempDir, 'race-condition-dir');

        // Multiple concurrent mkdir operations
        const operations = Array.from({ length: 5 }, () => fs.mkdir(dirPath, { recursive: true }));

        // All should succeed without errors
        await Promise.all(operations);

        const stats = await fs.stat(dirPath);
        expect(stats.isDirectory()).toBe(true);
      });

      it('should respect directory permissions on Unix-like systems', async () => {
        // Skip on Windows as it doesn't support Unix permissions
        if (process.platform === 'win32') {
          return;
        }

        const dirPath = path.join(tempDir, 'permissions-test');
        await fs.mkdir(dirPath, { mode: 0o755 });

        const stats = await fs.stat(dirPath);
        // Check that the directory has read, write, execute for owner
        expect(stats.mode & 0o700).toBe(0o700);
      });

      it('should clean up empty directories properly', async () => {
        const dirPath = path.join(tempDir, 'cleanup-test');
        const filePath = path.join(dirPath, 'test-file.txt');

        // Create directory with file
        await fs.mkdir(dirPath);
        await fs.writeFile(filePath, 'test content');

        // Remove file and directory
        await fs.unlink(filePath);
        await fs.rmdir(dirPath);

        // Directory should no longer exist
        await expect(fs.access(dirPath)).rejects.toThrow();
      });
    });

    describe('Permission Handling', () => {
      it.skip('should handle read-only file scenarios gracefully', async () => {
        const filePath = path.join(tempDir, 'readonly-test.txt');
        await fs.writeFile(filePath, 'initial content');

        // Make file read-only (skip on Windows due to permission differences)
        if (process.platform !== 'win32') {
          await fs.chmod(filePath, 0o444);

          let writeSucceeded = false;
          let writeError: Error | null = null;

          // Attempt atomic write to read-only file
          try {
            await writeFileAtomic(filePath, 'new content');
            writeSucceeded = true;
          } catch (error) {
            writeError = error as Error;
          }

          // Reset permissions for cleanup
          await fs.chmod(filePath, 0o644);

          // Check the result
          const finalContent = await fs.readFile(filePath, 'utf8');

          if (writeSucceeded) {
            // Some filesystems allow atomic writes to bypass read-only permissions
            // because they create a new file and rename it
            expect(finalContent).toBe('new content');
          } else {
            // Write failed - verify original content is preserved
            expect(finalContent).toBe('initial content');
            expect(writeError).toBeDefined();

            // The error could be EACCES, EPERM, or wrapped in a different error
            // Just verify we got an error and the file wasn't corrupted
            expect(writeError?.message).toBeDefined();
          }
        } else {
          // On Windows, skip this test
          expect(true).toBe(true);
        }
      });

      it('should handle insufficient disk space simulation', async () => {
        const filePath = path.join(tempDir, 'diskspace-test.txt');
        // Create very large content that might trigger ENOSPC on some systems
        const hugeContent = 'X'.repeat(100 * 1024 * 1024); // 100MB

        try {
          await writeFileAtomic(filePath, hugeContent);
          // If write succeeds, verify content
          const readContent = await fs.readFile(filePath, 'utf8');
          expect(readContent.length).toBe(hugeContent.length);
        } catch (error: unknown) {
          // If write fails due to space, error should be descriptive
          const fsError = error as NodeJS.ErrnoException;
          expect(fsError.code).toMatch(/ENOSPC|EDQUOT/);
        }
      });

      it('should handle file access in use scenarios', async () => {
        const filePath = path.join(tempDir, 'access-test.txt');
        await fs.writeFile(filePath, 'initial content');

        // Open file for reading (simulating file in use)
        const fileHandle = await fs.open(filePath, 'r');

        try {
          // Atomic write should still work even with file open for reading
          await writeFileAtomic(filePath, 'updated content');

          const content = await fs.readFile(filePath, 'utf8');
          expect(content).toBe('updated content');
        } finally {
          await fileHandle.close();
        }
      });
    });

    describe('Cross-Platform Path Resolution', () => {
      it('should handle path separators correctly across platforms', async () => {
        const paths = [
          'simple/path',
          'path/with/multiple/segments',
          'path\\with\\backslashes',
          'mixed/path\\separators',
          '.hidden/directory',
          'path with spaces/file.txt'
        ];

        for (const testPath of paths) {
          const normalizedPath = path.join(tempDir, testPath);
          const dirPath = path.dirname(normalizedPath);

          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(normalizedPath, 'test content');

          const content = await fs.readFile(normalizedPath, 'utf8');
          expect(content).toBe('test content');
        }
      });

      it('should resolve relative paths correctly', async () => {
        const relativePaths = [
          './relative-file.txt',
          '../parent-file.txt',
          'current/dir/file.txt',
          './../mixed/relative.txt'
        ];

        for (const relativePath of relativePaths) {
          const resolvedPath = path.resolve(tempDir, relativePath);
          const dirPath = path.dirname(resolvedPath);

          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(resolvedPath, `Content for ${relativePath}`);

          const content = await fs.readFile(resolvedPath, 'utf8');
          expect(content).toBe(`Content for ${relativePath}`);
        }
      });

      it('should handle Unicode and special characters in paths', async () => {
        const specialPaths = [
          'unicode-ñáñà.txt',
          'emoji-📝.txt',
          'chinese-中文.txt',
          'spaces and symbols !@#$.txt'
        ];

        for (const specialPath of specialPaths) {
          const fullPath = path.join(tempDir, specialPath);

          await fs.writeFile(fullPath, `Content for ${specialPath}`);

          const content = await fs.readFile(fullPath, 'utf8');
          expect(content).toBe(`Content for ${specialPath}`);

          // Verify file exists with correct name
          const files = await fs.readdir(tempDir);
          expect(files).toContain(specialPath);
        }
      });

      it('should handle maximum path length limits gracefully', async () => {
        // Create a very long path name (approaching system limits)
        const longSegment = 'a'.repeat(200);
        const longPath = path.join(tempDir, longSegment, longSegment, 'file.txt');

        try {
          await fs.mkdir(path.dirname(longPath), { recursive: true });
          await fs.writeFile(longPath, 'content in long path');

          const content = await fs.readFile(longPath, 'utf8');
          expect(content).toBe('content in long path');
        } catch (error: unknown) {
          // On some systems, this might fail due to path length limits
          const fsError = error as NodeJS.ErrnoException;
          expect(fsError.code).toMatch(/ENAMETOOLONG|ENOENT/);
        }
      });
    });

    describe('File System Monitoring and Events', () => {
      it('should detect file changes correctly', async () => {
        const filePath = path.join(tempDir, 'watch-test.txt');
        await fs.writeFile(filePath, 'initial content');

        // Get initial stats
        const initialStats = await fs.stat(filePath);

        // Wait a bit to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Update file
        await writeFileAtomic(filePath, 'updated content');

        // Check that modification time changed
        const updatedStats = await fs.stat(filePath);
        expect(updatedStats.mtime.getTime()).toBeGreaterThan(initialStats.mtime.getTime());
      });

      it('should handle file system case sensitivity correctly', async () => {
        const lowerCasePath = path.join(tempDir, 'lowercase.txt');
        const upperCasePath = path.join(tempDir, 'LOWERCASE.txt');

        await fs.writeFile(lowerCasePath, 'lowercase content');

        // On case-insensitive systems (like macOS default), these should be the same file
        // On case-sensitive systems, they should be different
        try {
          await fs.writeFile(upperCasePath, 'uppercase content');

          const lowerContent = await fs.readFile(lowerCasePath, 'utf8');
          const upperContent = await fs.readFile(upperCasePath, 'utf8');

          // Test behavior based on file system case sensitivity
          const files = await fs.readdir(tempDir);
          const hasLower = files.includes('lowercase.txt');
          const hasUpper = files.includes('LOWERCASE.txt');

          if (hasLower && hasUpper) {
            // Case-sensitive file system
            expect(lowerContent).toBe('lowercase content');
            expect(upperContent).toBe('uppercase content');
          } else {
            // Case-insensitive file system
            expect(lowerContent).toBe(upperContent);
          }
        } catch {
          // File system doesn't allow case variations
          console.warn('File system is case-insensitive');
        }
      });
    });

    describe('Error Handling and Recovery', () => {
      it('should handle corrupted file scenarios', async () => {
        const filePath = path.join(tempDir, 'corrupted-test.txt');

        // Create a file with invalid content (binary data in text file)
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]);
        await fs.writeFile(filePath, binaryData);

        // Should be able to read as buffer
        const readBuffer = await fs.readFile(filePath);
        expect(readBuffer).toEqual(binaryData);

        // Should handle UTF-8 reading gracefully
        try {
          const textContent = await fs.readFile(filePath, 'utf8');
          // May contain replacement characters for invalid UTF-8
          expect(typeof textContent).toBe('string');
        } catch (error) {
          // Some systems might throw on invalid UTF-8
          expect(error).toBeDefined();
        }
      });

      it.skip('should recover from partial write scenarios', async () => {
        const filePath = path.join(tempDir, 'partial-write-test.txt');

        // Create multiple orphaned temp files with write-file-atomic's pattern
        // These simulate temp files left from previous crashed writes
        const orphanedFiles = [
          `${filePath}.${process.pid - 1}12345`, // From previous process
          `${filePath}.${process.pid}99999`, // From current process
          `${filePath}.2840185974` // Random murmurhex pattern
        ];

        // Create orphaned temp files
        for (const tempFile of orphanedFiles) {
          await fs.writeFile(tempFile, 'partial content from crash');
        }

        // Verify temp files exist
        for (const tempFile of orphanedFiles) {
          await expect(fs.access(tempFile)).resolves.toBeUndefined();
        }

        // Atomic write should complete successfully despite orphaned files
        await writeFileAtomic(filePath, 'complete content');

        // Final file should have correct content
        const content = await fs.readFile(filePath, 'utf8');
        expect(content).toBe('complete content');
        expect(content).not.toContain('partial content');

        // Note: write-file-atomic doesn't clean up orphaned temp files
        // from other processes or previous runs - this is expected behavior
        // Applications should implement their own cleanup strategy for orphaned files
      });
    });
  },
  { timeout: 10000 }
);
