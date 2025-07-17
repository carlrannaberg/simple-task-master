#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { FrontmatterParser } from '../src/lib/frontmatter-parser';

interface MigrationStats {
  totalFiles: number;
  migratedFiles: number;
  skippedFiles: number;
  errors: string[];
}

async function migrateTaskFiles(tasksDir: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalFiles: 0,
    migratedFiles: 0,
    skippedFiles: 0,
    errors: []
  };

  try {
    // Check if directory exists
    await fs.access(tasksDir);
  } catch {
    console.error(`Error: Tasks directory not found: ${tasksDir}`);
    process.exit(1);
  }

  const files = await fs.readdir(tasksDir);
  const taskFiles = files.filter(f => f.endsWith('.md'));
  stats.totalFiles = taskFiles.length;

  console.log(`Found ${taskFiles.length} task files to check...`);
  
  for (const file of taskFiles) {
    const filepath = path.join(tasksDir, file);
    
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const { data, content: bodyContent } = FrontmatterParser.parse(content);
      
      // Check if _contentMetadata exists in the data
      if ('_contentMetadata' in data) {
        // Remove _contentMetadata
        const cleanData = { ...data };
        delete cleanData._contentMetadata;
        
        // Rewrite the file without the metadata
        const newContent = FrontmatterParser.stringify(bodyContent, cleanData);
        await fs.writeFile(filepath, newContent, 'utf8');
        
        console.log(`✓ Migrated: ${file}`);
        stats.migratedFiles++;
      } else {
        stats.skippedFiles++;
      }
    } catch (error) {
      const errorMsg = `Failed to migrate ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`✗ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  return stats;
}

// Run migration
async function main() {
  const tasksDir = process.argv[2] || '.simple-task-master/tasks';
  
  console.log('=== Simple Task Master: Remove _contentMetadata Migration ===');
  console.log(`Tasks directory: ${tasksDir}`);
  console.log('');
  
  const stats = await migrateTaskFiles(tasksDir);
  
  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`Total files checked: ${stats.totalFiles}`);
  console.log(`Files migrated: ${stats.migratedFiles}`);
  console.log(`Files skipped (no _contentMetadata): ${stats.skippedFiles}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\nErrors encountered:');
    stats.errors.forEach(err => console.log(`  - ${err}`));
    process.exit(1);
  }
  
  if (stats.migratedFiles > 0) {
    console.log('\n✓ Migration completed successfully!');
    console.log('  All _contentMetadata has been removed from task files.');
  } else {
    console.log('\n✓ No migration needed - no files contained _contentMetadata.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});