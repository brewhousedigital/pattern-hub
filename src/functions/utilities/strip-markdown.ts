// Same logic as the Deno-only stripMarkdown in netlify/edge-functions/og-meta.ts
// (kept as a separate copy since edge functions can't import browser-side app code) -
// used to build plain-text meta descriptions from markdown fields (wiki pages, set/author bios).
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s.*$/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
