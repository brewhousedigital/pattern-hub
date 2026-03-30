import { z } from 'zod';

export type TextToken = {
  type: 'text';
  value: string;
  exclude: boolean;
};

export type TagToken = {
  type: 'tag';
  value: string;
  exclude: boolean;
};

export type AuthorToken = {
  type: 'author';
  value: string;
  exclude: boolean;
};

export type Token = TextToken | TagToken | AuthorToken;

// URL Search Params Schema
export const patternSearchSchema = z.object({
  q: z.string().default(''),
  tags: z.array(z.string()).default([]),
  authors: z.array(z.string()).default([]),
  patternId: z.string().optional(),
});

export type PatternSearch = z.infer<typeof patternSearchSchema>;

/**
 * Helpers: URL params ↔ Token list
 * Reconstruct a flat token list from the three URL params.
 * Order: text tokens first (preserving q word order), then tags, then authors.
 */
export function tokensFromSearch(search: PatternSearch): Token[] {
  const textTokens: Token[] = search.q
    .trim()
    .split(',')
    .filter(Boolean)
    .map((t) =>
      t.startsWith('-')
        ? { type: 'text', value: t.slice(1), exclude: true }
        : { type: 'text', value: t, exclude: false },
    );

  const tagTokens: Token[] = search.tags.map((tag) => ({
    type: 'tag',
    value: tag.startsWith('-') ? tag.slice(1) : tag,
    exclude: tag.startsWith('-'),
  }));

  const authorTokens: Token[] = search.authors.map((author) => ({
    type: 'author',
    value: author.startsWith('-') ? author.slice(1) : author,
    exclude: author.startsWith('-'),
  }));

  return [...textTokens, ...tagTokens, ...authorTokens];
}

/**
 * Reconstruct the three URL params from a flat token list.
 */
export function searchFromTokens(tokens: Token[]): Omit<PatternSearch, 'patternId'> {
  const q = tokens
    .filter((t): t is TextToken => t.type === 'text')
    .map((t) => (t.exclude ? `-${t.value}` : t.value))
    .join(',');

  const tags = tokens.filter((t): t is TagToken => t.type === 'tag').map((t) => (t.exclude ? `-${t.value}` : t.value));

  const authors = tokens
    .filter((t): t is AuthorToken => t.type === 'author')
    .map((t) => (t.exclude ? `-${t.value}` : t.value));

  return { q, tags, authors };
}

/**
 * Parse a raw typed string into a token, detecting the author: prefix.
 */
export function parseRawInput(raw: string): Token {
  const stripped = raw.trim();

  if (/^-?author:/i.test(stripped)) {
    const exclude = stripped.startsWith('-');
    const value = stripped.replace(/^-?author:/i, '');
    return { type: 'author', value, exclude };
  }

  return {
    type: 'text',
    value: stripped.startsWith('-') ? stripped.slice(1) : stripped,
    exclude: stripped.startsWith('-'),
  };
}

/**
 * PocketBase Filter Builder
 * Convert tokens into a PocketBase filter string.
 * Adjust field names (name, description, tags, author) to match your schema.
 */
export function buildPocketBaseFilter(tokens: Token[]): string {
  const parts: string[] = [];

  for (const token of tokens) {
    if (token.type === 'text') {
      if (token.exclude) {
        parts.push(`(name !~ "${token.value}" && description !~ "${token.value}")`);
      } else {
        parts.push(`(name ~ "${token.value}" || description ~ "${token.value}")`);
      }
    }

    if (token.type === 'tag') {
      if (token.exclude) {
        parts.push(`(tags !~ "${token.value}")`);
      } else {
        parts.push(`(tags ~ "${token.value}")`);
      }
    }

    if (token.type === 'author') {
      if (token.exclude) {
        parts.push(`(authors.name != "${token.value}")`);
      } else {
        parts.push(`(authors.name = "${token.value}")`);
      }
    }
  }

  return parts.join(' && ');
}
