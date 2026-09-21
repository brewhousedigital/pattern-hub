// Turns markdown into a short plain-text teaser for the cards that list wiki pages.
// It uses regular expressions, not a full markdown parser. It covers the syntax that the wiki
// renders: headings, emphasis, links, images, [[wiki links]], lists, quotes, tables, code and HTML.

// The teaser reads only the start of a page, so a very long page does not slow the list down.
const SOURCE_LIMIT = 4000;

// The address part of a link, with one level of brackets inside it. Example: (https://example.com/a_(b))
const LINK_ADDRESS = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const IMAGE = new RegExp(String.raw`!\[[^\]]*\](?:${LINK_ADDRESS}|\[[^\]]*\])`, 'g');
const INLINE_LINK = new RegExp(String.raw`\[([^\]]*)\]${LINK_ADDRESS}`, 'g');

// An escaped character, such as "\*", must stay in the text. It changes to a private-use
// character while the syntax is removed, and changes back at the end.
const ESCAPE_OFFSET = 0xe000;
const hideEscapes = (text: string) =>
  text.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, (_, char: string) =>
    String.fromCharCode(ESCAPE_OFFSET + char.charCodeAt(0)),
  );
const showEscapes = (text: string) =>
  text.replace(/[\ue000-\ue07f]/g, (char) => String.fromCharCode(char.charCodeAt(0) - ESCAPE_OFFSET));

// [[category-slug/page-slug]] -> "page slug". The page shows the real title of the linked page, but the teaser has only the slug.
const wikiLinkToText = (target: string) => target.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').trim() ?? '';

// Block syntax works on whole lines: code blocks, headings, rules, quotes, lists and tables.
const stripBlocks = (markdown: string): string => {
  const kept: string[] = [];
  let fence = ''; // The opening marker of the code block that the loop is in. Empty when the loop is not in one.

  for (const rawLine of markdown.replace(/\r\n?/g, '\n').slice(0, SOURCE_LIMIT).split('\n')) {
    const marker = rawLine.match(/^ {0,3}(`{3,}|~{3,})/)?.[1] ?? '';

    if (fence) {
      if (marker.startsWith(fence[0]) && marker.length >= fence.length) fence = '';
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }

    const line = rawLine.replace(/^ {0,3}(?:>[ \t]?)+/, ''); // Quote marks.

    const isSkipped =
      /^\s{0,3}#{1,6}(?:\s|$)/.test(line) || // Heading.
      /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) || // Horizontal rule.
      /^\s{0,3}=+\s*$/.test(line) || // Line under a heading.
      /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(line) || // Table separator, or a line of dashes.
      /^\s{0,3}\[[^\]]+\]:\s*\S/.test(line); // Link or footnote definition.
    if (isSkipped) continue;

    kept.push(
      line
        .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/, '') // List mark and task box.
        .replace(/^\s*\|(.*?)\|?\s*$/, (_, cells: string) => cells.replace(/\s*\|\s*/g, ' ')), // Table row.
    );
  }

  return kept.join(' ');
};

// Inline syntax works inside the text of a line: images, links, code, emphasis and HTML.
const stripInline = (text: string): string =>
  text
    .replace(IMAGE, '')
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => wikiLinkToText(target))
    .replace(INLINE_LINK, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/`+([^`]+)`+/g, '$1')
    .replace(/~~(\S(?:.*?\S)?)~~/g, '$1')
    .replace(/\*\*\*(\S(?:.*?\S)?)\*\*\*/g, '$1')
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1')
    .replace(/\*(\S(?:.*?\S)?)\*/g, '$1')
    .replace(/(^|[^\w])__(\S(?:.*?\S)?)__(?=[^\w]|$)/g, '$1$2')
    .replace(/(^|[^\w])_(\S(?:.*?\S)?)_(?=[^\w]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Plain-text teaser of a markdown string. It removes the markdown syntax, and it ends at a whole
 * word with "…" when the text is longer than `maxLength`. The text of headings and code is left out.
 */
export const createMarkdownSnippet = (markdown: string, maxLength = 150): string => {
  const text = showEscapes(stripInline(stripBlocks(hideEscapes(markdown))));
  if (text.length <= maxLength) return text;

  // End at the last space, so that the teaser does not stop in the middle of a word.
  const lastSpace = text.lastIndexOf(' ', maxLength);
  const end = lastSpace > maxLength * 0.6 ? lastSpace : maxLength;
  return `${text.slice(0, end).replace(/[\s.,;:(\-–—]+$/, '')}…`;
};
