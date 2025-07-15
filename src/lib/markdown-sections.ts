/**
 * Markdown section parsing and manipulation utilities
 */

export interface MarkdownSections {
  description: string;
  details?: string;
  validation?: string;
  [key: string]: string | undefined;
}

/**
 * Parse markdown content into sections based on ## headings
 */
export function parseMarkdownSections(content: string): MarkdownSections {
  const sections: MarkdownSections = { description: '' };

  if (!content) {
    return sections;
  }

  const lines = content.split('\n');
  let currentSection = 'description';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##(?!#)\s*(.*)$/);

    if (headingMatch) {
      // Save previous section
      if (currentContent.length > 0 || currentSection === 'description') {
        sections[currentSection] = currentContent.join('\n').trim();
      }

      // Start new section
      const sectionName = headingMatch[1]?.trim() || '';
      currentSection = sectionName.toLowerCase();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0 || currentSection === 'description') {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Build markdown content from sections
 */
export function buildMarkdownContent(sections: MarkdownSections): string {
  const parts: string[] = [];

  // Add description (if exists and not under its own heading)
  if (sections.description && !hasDescriptionHeading(sections)) {
    parts.push(sections.description);
  }

  // Add sections with headings
  const sectionOrder = ['description', 'details', 'validation'];
  const otherSections = Object.keys(sections).filter(
    (key) => !sectionOrder.includes(key) && sections[key]
  );

  // Add known sections in order
  for (const sectionName of sectionOrder) {
    const content = sections[sectionName];
    if (content && (sectionName !== 'description' || hasDescriptionHeading(sections))) {
      if (parts.length > 0) parts.push(''); // Empty line before heading
      parts.push(`## ${capitalize(sectionName)}`);
      parts.push(content);
    }
  }

  // Add any other sections
  for (const sectionName of otherSections) {
    const content = sections[sectionName];
    if (content) {
      if (parts.length > 0) parts.push(''); // Empty line before heading
      parts.push(`## ${capitalize(sectionName)}`);
      parts.push(content);
    }
  }

  return parts.join('\n');
}

/**
 * Update a specific section in markdown content
 */
export function updateBodySection(content: string, section: string, newText: string): string {
  const sections = parseMarkdownSections(content);

  // Normalize section name
  const normalizedSection = section.toLowerCase();

  // Update the section
  sections[normalizedSection] = newText;

  // Rebuild content
  return buildMarkdownContent(sections);
}

/**
 * Check if description should have its own heading
 */
function hasDescriptionHeading(sections: MarkdownSections): boolean {
  // If there's a description section and other sections exist, use heading
  const hasOtherSections = Object.keys(sections).some(
    (key) => key !== 'description' && sections[key]
  );
  return hasOtherSections && !!sections.description;
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
