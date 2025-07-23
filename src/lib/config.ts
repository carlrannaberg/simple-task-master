/**
 * Configuration management for Simple Task Master
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { Config } from './types';
import { PATHS, DEFAULT_CONFIG, CURRENT_SCHEMA_VERSION } from './constants';
import { FileSystemError, ValidationError } from './errors';

/**
 * Manages loading and accessing configuration from config.json files
 */
export class ConfigManager {
  private config: Config | null = null;

  constructor(private workspaceRoot: string) {}

  /**
   * Load configuration from config.json file
   * Returns defaults if file doesn't exist (backward compatibility)
   */
  async load(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    const configPath = PATHS.getConfigPath(this.workspaceRoot);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;

      // Validate schema version
      if (config.schema !== CURRENT_SCHEMA_VERSION) {
        throw new ValidationError(
          `Unsupported config schema version: ${config.schema}`
        );
      }

      this.config = config;
      return config;
    } catch (error: unknown) {
      // Handle file not found errors
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        // Return defaults for backward compatibility
        this.config = this.getDefaults();
        return this.config;
      }
      if (error instanceof SyntaxError) {
        throw new ValidationError(`Invalid config.json: ${error.message}`);
      }
      if (error instanceof ValidationError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FileSystemError(`Failed to load config: ${errorMessage}`);
    }
  }

  /**
   * Get the configured tasks directory path
   * Handles both relative and absolute paths
   */
  getTasksDir(): string {
    const config = this.config || this.getDefaults();

    // If no custom tasksDir specified, use default
    if (!config.tasksDir) {
      return path.join(this.workspaceRoot, PATHS.BASE_DIR, PATHS.TASKS_DIR);
    }

    // Handle absolute vs relative paths
    if (path.isAbsolute(config.tasksDir)) {
      return config.tasksDir;
    }

    // Relative paths are relative to workspace root
    return path.join(this.workspaceRoot, config.tasksDir);
  }

  /**
   * Get default configuration values
   */
  private getDefaults(): Config {
    return {
      schema: DEFAULT_CONFIG.SCHEMA_VERSION,
      lockTimeoutMs: DEFAULT_CONFIG.LOCK_TIMEOUT_MS,
      maxTaskSizeBytes: DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES
    };
  }
}
