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

export type TitleToken = {
  type: 'title';
  value: string;
  exclude: boolean;
};

export type DescriptionToken = {
  type: 'description';
  value: string;
  exclude: boolean;
};

export type Token = TextToken | TagToken | AuthorToken | TitleToken | DescriptionToken;

// URL Search Params Schema
export const patternSearchSchema = z.object({
  q: z.string().default(''),
  tags: z.array(z.string()).default([]),
  authors: z.array(z.string()).default([]),
  title: z.array(z.string()).default([]),
  description: z.array(z.string()).default([]),
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

  const titleTokens: Token[] = search.title.map((title) => ({
    type: 'title',
    value: title.startsWith('-') ? title.slice(1) : title,
    exclude: title.startsWith('-'),
  }));

  const descriptionTokens: Token[] = search.description.map((description) => ({
    type: 'description',
    value: description.startsWith('-') ? description.slice(1) : description,
    exclude: description.startsWith('-'),
  }));

  return [...textTokens, ...tagTokens, ...authorTokens, ...titleTokens, ...descriptionTokens];
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

  const title = tokens
    .filter((t): t is TitleToken => t.type === 'title')
    .map((t) => (t.exclude ? `-${t.value}` : t.value));

  const description = tokens
    .filter((t): t is DescriptionToken => t.type === 'description')
    .map((t) => (t.exclude ? `-${t.value}` : t.value));

  return { q, tags, authors, title, description };
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

  if (/^-?title:/i.test(stripped)) {
    const exclude = stripped.startsWith('-');
    const value = stripped.replace(/^-?title:/i, '');
    return { type: 'title', value, exclude };
  }

  if (/^-?description:/i.test(stripped)) {
    const exclude = stripped.startsWith('-');
    const value = stripped.replace(/^-?description:/i, '');
    return { type: 'description', value, exclude };
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
        //parts.push(`(name !~ "${token.value}" && description !~ "${token.value}")`);
        parts.push(`(tags !~ "${token.value}")`);
      } else {
        //parts.push(`(name ~ "${token.value}" || description ~ "${token.value}")`);
        parts.push(`(tags ~ "${token.value}")`);
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

    if (token.type === 'title') {
      if (token.exclude) {
        parts.push(`(name !~ "${token.value}")`);
      } else {
        parts.push(`(name ~ "${token.value}")`);
      }
    }

    if (token.type === 'description') {
      if (token.exclude) {
        parts.push(`(description !~ "${token.value}")`);
      } else {
        parts.push(`(description ~ "${token.value}")`);
      }
    }
  }

  return parts.join(' && ');
}
