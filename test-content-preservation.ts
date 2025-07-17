/**
 * Test script demonstrating content preservation issues with gray-matter
 * and the proposed solution
 */

import matter from 'gray-matter';
import * as yaml from 'js-yaml';

// Test cases that demonstrate the problem
const testCases = [
  {
    name: 'Empty content',
    input: { content: '', data: { id: 1, title: 'Test' } },
    expected: '---\nid: 1\ntitle: Test\n---\n'
  },
  {
    name: 'Content without trailing newline',
    input: { content: 'Hello world', data: { id: 2, title: 'Test' } },
    expected: '---\nid: 2\ntitle: Test\n---\nHello world'
  },
  {
    name: 'Content with trailing newline',
    input: { content: 'Hello world\n', data: { id: 3, title: 'Test' } },
    expected: '---\nid: 3\ntitle: Test\n---\nHello world\n'
  },
  {
    name: 'Content with multiple trailing newlines',
    input: { content: 'Hello world\n\n', data: { id: 4, title: 'Test' } },
    expected: '---\nid: 4\ntitle: Test\n---\nHello world\n\n'
  }
];

console.log('=== GRAY-MATTER BEHAVIOR ===\n');

testCases.forEach(test => {
  const stringified = matter.stringify(test.input.content, test.input.data);
  const parsed = matter(stringified);
  
  console.log(`Test: ${test.name}`);
  console.log(`Input content: ${JSON.stringify(test.input.content)}`);
  console.log(`Expected output: ${JSON.stringify(test.expected)}`);
  console.log(`Actual output: ${JSON.stringify(stringified)}`);
  console.log(`Content preserved: ${test.expected === stringified}`);
  console.log(`Parsed back content: ${JSON.stringify(parsed.content)}`);
  console.log(`Round-trip preserved: ${test.input.content === parsed.content}`);
  console.log('---\n');
});

// Custom implementation that preserves content exactly
class ContentPreservingFrontmatter {
  static stringify(content: string, data: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
      return content;
    }

    const yamlStr = yaml.dump(data, {
      lineWidth: -1,
      sortKeys: false,
      noRefs: true
    }).trimEnd();

    return `---\n${yamlStr}\n---\n${content}`;
  }

  static parse(fileContent: string): { data: Record<string, any>, content: string } {
    const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    
    if (!match) {
      return { data: {}, content: fileContent };
    }

    const yamlContent = match[1];
    const data = yaml.load(yamlContent) as Record<string, any> || {};
    const content = fileContent.substring(match[0].length);
    
    return { data, content };
  }
}

console.log('\n=== CUSTOM IMPLEMENTATION BEHAVIOR ===\n');

testCases.forEach(test => {
  const stringified = ContentPreservingFrontmatter.stringify(test.input.content, test.input.data);
  const parsed = ContentPreservingFrontmatter.parse(stringified);
  
  console.log(`Test: ${test.name}`);
  console.log(`Input content: ${JSON.stringify(test.input.content)}`);
  console.log(`Expected output: ${JSON.stringify(test.expected)}`);
  console.log(`Actual output: ${JSON.stringify(stringified)}`);
  console.log(`Content preserved: ${test.expected === stringified}`);
  console.log(`Parsed back content: ${JSON.stringify(parsed.content)}`);
  console.log(`Round-trip preserved: ${test.input.content === parsed.content}`);
  console.log('---\n');
});

// Summary of findings
console.log('\n=== SUMMARY ===\n');
console.log('Gray-matter issues:');
console.log('1. Empty content "" becomes "\\n"');
console.log('2. Content without trailing newline gets one added');
console.log('3. Requires workarounds with _contentMetadata');
console.log('\nCustom implementation:');
console.log('✓ Preserves content exactly as provided');
console.log('✓ No workarounds needed');
console.log('✓ Simpler, more predictable behavior');