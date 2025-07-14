/// <reference types="node" />

/**
 * Mock filesystem for testing without actual file operations
 */
export class MockFileSystem {
  private files = new Map<string, string>();
  private directories = new Set<string>();

  constructor() {
    // Always include the root directory
    this.directories.add('/');
  }

  /**
   * Mock fs.readFile
   */
  async readFile(path: string, _encoding: BufferEncoding = 'utf8'): Promise<string> {
    if (!this.files.has(path)) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${path}'`
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = path;
      throw error;
    }
    const file = this.files.get(path);
    if (!file) throw new Error('File not found');
    return file;
  }

  /**
   * Mock fs.writeFile with atomic behavior simulation
   */
  async writeFileAtomic(
    path: string,
    content: string,
    _options?: { encoding?: BufferEncoding; mode?: number }
  ): Promise<void> {
    // Ensure directory exists
    const dir = this.getDirectoryPath(path);
    if (!this.directories.has(dir)) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${path}'`
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = path;
      throw error;
    }

    this.files.set(path, content);
  }

  /**
   * Mock fs.unlink
   */
  async unlink(path: string): Promise<void> {
    if (!this.files.has(path)) {
      const error = new Error(
        `ENOENT: no such file or directory, unlink '${path}'`
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'unlink';
      error.path = path;
      throw error;
    }
    this.files.delete(path);
  }

  /**
   * Mock fs.readdir
   */
  async readdir(path: string): Promise<string[]> {
    if (!this.directories.has(path)) {
      const error = new Error(
        `ENOENT: no such file or directory, scandir '${path}'`
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'scandir';
      error.path = path;
      throw error;
    }

    const files: string[] = [];
    const pathPrefix = path.endsWith('/') ? path : path + '/';

    // Find all files and directories in this path
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(pathPrefix)) {
        const relativePath = filePath.substring(pathPrefix.length);
        const parts = relativePath.split('/');
        if (parts.length === 1 && parts[0] !== '') {
          files.push(parts[0]);
        }
      }
    }

    for (const dirPath of this.directories) {
      if (dirPath.startsWith(pathPrefix) && dirPath !== path) {
        const relativePath = dirPath.substring(pathPrefix.length);
        const parts = relativePath.split('/');
        if (parts.length === 1 && parts[0] !== '') {
          files.push(parts[0]);
        }
      }
    }

    return [...new Set(files)].sort();
  }

  /**
   * Mock fs.mkdir
   */
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        this.directories.add(currentPath);
      }
    } else {
      const parentDir = this.getDirectoryPath(path);
      if (!this.directories.has(parentDir)) {
        const error = new Error(
          `ENOENT: no such file or directory, mkdir '${path}'`
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'mkdir';
        error.path = path;
        throw error;
      }
      this.directories.add(path);
    }
  }

  /**
   * Mock fs.access
   */
  async access(path: string): Promise<void> {
    if (!this.files.has(path) && !this.directories.has(path)) {
      const error = new Error(
        `ENOENT: no such file or directory, access '${path}'`
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'access';
      error.path = path;
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  /**
   * Check if a directory exists
   */
  directoryExists(path: string): boolean {
    return this.directories.has(path);
  }

  /**
   * Get all files (for testing)
   */
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  /**
   * Get all directories (for testing)
   */
  getAllDirectories(): Set<string> {
    return new Set(this.directories);
  }

  /**
   * Clear all files and directories (for testing)
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }

  /**
   * Set up a file directly (for testing)
   */
  setFile(path: string, content: string): void {
    const dir = this.getDirectoryPath(path);
    this.ensureDirectory(dir);
    this.files.set(path, content);
  }

  /**
   * Set up a directory directly (for testing)
   */
  setDirectory(path: string): void {
    this.directories.add(path);
  }

  /**
   * Helper to get directory path from file path
   */
  private getDirectoryPath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '/';
  }

  /**
   * Helper to ensure directory exists
   */
  private ensureDirectory(path: string): void {
    if (!this.directories.has(path)) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        this.directories.add(currentPath);
      }
    }
  }
}
