/**
 * Configuration management for Simple Task Master
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import writeFileAtomic from 'write-file-atomic';
import type { Config } from './types';
import { PATHS, DEFAULT_CONFIG, CURRENT_SCHEMA_VERSION } from './constants';
import { FileSystemError, ValidationError } from './errors';
import { validateTasksDir } from './path-validation';

/**
 * Default configuration values for Simple Task Master
 *
 * These defaults are used when:
 * - No config.json file exists (backward compatibility)
 * - A configuration field is missing from config.json
 * - Users want to reset specific fields to defaults
 */
export const CONFIG_DEFAULTS: Config = Object.freeze({
  /**
   * Schema version - REQUIRED, NON-RESETTABLE
   * This field should never be manually changed by users.
   * It's used for configuration migration and compatibility.
   */
  schema: CURRENT_SCHEMA_VERSION,

  /**
   * Lock acquisition timeout in milliseconds - REQUIRED, RESETTABLE
   * Default: 30 seconds (30000ms)
   * Valid range: 1 - 300000 (max 5 minutes)
   *
   * Controls how long STM will wait to acquire a lock before timing out.
   * Can be increased on slower systems or decreased for faster failure detection.
   */
  lockTimeoutMs: DEFAULT_CONFIG.LOCK_TIMEOUT_MS,

  /**
   * Maximum task file size in bytes - REQUIRED, RESETTABLE
   * Default: 1MB (1048576 bytes)
   * Valid range: 1 - 10485760 (max 10MB)
   *
   * Prevents creation of oversized task files that could impact performance.
   * Can be increased for tasks with extensive documentation or content.
   */
  maxTaskSizeBytes: DEFAULT_CONFIG.MAX_TASK_SIZE_BYTES

  /**
   * Custom tasks directory path - OPTIONAL, RESETTABLE
   * Default: undefined (uses .simple-task-master/tasks)
   *
   * When undefined, tasks are stored in the default location.
   * Can be set to any valid directory path (relative or absolute).
   * Note: Changing this value does NOT migrate existing tasks.
   */
  // tasksDir is intentionally omitted as it's optional
});

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
    return CONFIG_DEFAULTS;
  }

  /**
   * Update configuration with partial updates
   * Merges updates with existing configuration and saves atomically
   */
  async update(updates: Partial<Config>): Promise<void> {
    // Load current config or use defaults
    const currentConfig = await this.load();

    // Merge updates with current config
    const newConfig: Config = {
      ...currentConfig,
      ...updates,
      // Always preserve schema version unless explicitly updating it
      schema: updates.schema ?? currentConfig.schema
    };

    // Validate before saving
    await this.validate(newConfig);

    // Save the updated configuration
    await this.save(newConfig);

    // Update cached config
    this.config = newConfig;
  }

  /**
   * Save configuration to disk atomically
   * Uses write-file-atomic to prevent corruption
   */
  private async save(config: Config): Promise<void> {
    const configPath = PATHS.getConfigPath(this.workspaceRoot);
    const configDir = path.dirname(configPath);

    try {
      // Ensure the directory exists
      await fs.mkdir(configDir, { recursive: true });

      // Write atomically with pretty formatting
      await writeFileAtomic(configPath, JSON.stringify(config, null, 2) + '\n', {
        mode: 0o644,
        encoding: 'utf-8'
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FileSystemError(`Failed to save config: ${errorMessage}`);
    }
  }

  /**
   * Reset specific configuration fields to their default values
   * - Optional fields (tasksDir) are deleted when reset
   * - Required fields are set to their default values
   * - Schema version cannot be reset
   * @param keys Array of configuration field names to reset
   * @throws ValidationError if trying to reset schema or unknown keys
   */
  async reset(keys: string[]): Promise<void> {
    // Validate keys
    const validKeys = ['lockTimeoutMs', 'maxTaskSizeBytes', 'tasksDir'];
    const invalidKeys = keys.filter((key) => !validKeys.includes(key) && key !== 'schema');

    if (invalidKeys.length > 0) {
      throw new ValidationError(
        `Unknown configuration keys: ${invalidKeys.join(', ')}. ` +
        `Valid keys are: ${validKeys.join(', ')}`
      );
    }

    // Prevent schema reset
    if (keys.includes('schema')) {
      throw new ValidationError('Schema version cannot be reset');
    }

    // Load current configuration
    const currentConfig = await this.load();

    // Create a new config object with resets applied
    const newConfig = { ...currentConfig };

    for (const key of keys) {
      switch (key) {
        case 'tasksDir':
          // Optional field - delete it to reset to default
          delete newConfig.tasksDir;
          break;

        case 'lockTimeoutMs':
          // Required field - set to default value
          newConfig.lockTimeoutMs = CONFIG_DEFAULTS.lockTimeoutMs;
          break;

        case 'maxTaskSizeBytes':
          // Required field - set to default value
          newConfig.maxTaskSizeBytes = CONFIG_DEFAULTS.maxTaskSizeBytes;
          break;
      }
    }

    // Save the updated configuration atomically
    await this.save(newConfig);

    // Update cached config
    this.config = newConfig;
  }

  /**
   * Validate configuration before saving
   * Ensures all values are within acceptable ranges and paths are valid
   */
  private async validate(config: Config): Promise<void> {
    // Validate schema version
    if (config.schema !== CURRENT_SCHEMA_VERSION) {
      throw new ValidationError(
        `Invalid schema version: ${config.schema}. Expected: ${CURRENT_SCHEMA_VERSION}`
      );
    }

    // Validate lockTimeoutMs
    if (typeof config.lockTimeoutMs !== 'number' || config.lockTimeoutMs <= 0) {
      throw new ValidationError('lockTimeoutMs must be a positive number');
    }
    if (config.lockTimeoutMs > 300000) { // 5 minutes max
      throw new ValidationError('lockTimeoutMs cannot exceed 5 minutes (300000ms)');
    }

    // Validate maxTaskSizeBytes
    if (typeof config.maxTaskSizeBytes !== 'number' || config.maxTaskSizeBytes <= 0) {
      throw new ValidationError('maxTaskSizeBytes must be a positive number');
    }
    if (config.maxTaskSizeBytes > 10485760) { // 10MB max
      throw new ValidationError('maxTaskSizeBytes cannot exceed 10MB (10485760 bytes)');
    }

    // Validate tasksDir if provided
    if (config.tasksDir !== undefined) {
      // Type check first
      if (typeof config.tasksDir !== 'string') {
        throw new ValidationError('tasksDir must be a string');
      }
      validateTasksDir(config.tasksDir);
    }
  }
}
