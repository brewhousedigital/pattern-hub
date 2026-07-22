import { slugifyHeading } from './slugify-heading';

export interface HeadingEntry {
  level: 2 | 3;
  text: string;
  id: string;
}

/** Extract all h2 / h3 headings from a raw markdown string. */
export function parseHeadings(markdown: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{2,3})\s+(.+)/);
    if (m) {
      const level = m[1].length as 2 | 3;
      const text = m[2].trim();
      headings.push({ level, text, id: slugifyHeading(text) });
    }
  }
  return headings;
}
