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

export type IdToken = {
  type: 'id';
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

export type NumericOperator = '>' | '<' | '=';

export type PartsToken = {
  type: 'parts';
  operator: NumericOperator;
  value: number;
};

export type WidthToken = {
  type: 'width';
  operator: NumericOperator;
  value: number;
};

export type HeightToken = {
  type: 'height';
  operator: NumericOperator;
  value: number;
};

export type FileSizeToken = {
  type: 'filesize';
  operator: NumericOperator;
  value: number;
};

export type Token =
  | TextToken
  | TagToken
  | AuthorToken
  | IdToken
  | TitleToken
  | DescriptionToken
  | PartsToken
  | WidthToken
  | HeightToken
  | FileSizeToken;

// URL Search Params Schema
export const SORT_OPTIONS = [
  { value: '-created', label: 'Last uploaded' },
  { value: 'created', label: 'First uploaded' },
  { value: '-design_date', label: 'Newest first' },
  { value: 'design_date', label: 'Oldest first' },
  { value: '-updated', label: 'Recently updated' },
  { value: 'updated', label: 'Oldest updated' },
  { value: '-tag_count', label: 'Most tags' },
  { value: 'tag_count', label: 'Fewest tags' },
  { value: '-avg_rating', label: 'Highest rated' },
  { value: 'avg_rating', label: 'Lowest rated' },
  { value: '-total_ratings', label: 'Most rated' },
  { value: 'total_ratings', label: 'Least rated' },
  { value: '-avg_difficulty', label: 'Hardest' },
  { value: 'avg_difficulty', label: 'Easiest' },
  { value: '-total_difficulty_ratings', label: 'Most difficulty votes' },
  { value: 'total_difficulty_ratings', label: 'Fewest difficulty votes' },
  { value: '-favorite_count', label: 'Most favorited' },
  { value: 'favorite_count', label: 'Least favorited' },
  { value: '-pieces', label: 'Most pieces' },
  { value: 'pieces', label: 'Fewest pieces' },
  { value: '-design_height', label: 'Tallest' },
  { value: 'design_height', label: 'Shortest' },
  { value: '-design_width', label: 'Widest' },
  { value: 'design_width', label: 'Skinniest' },
  { value: '-has_layers', label: 'Has layers' },
  { value: 'has_layers', label: 'No layers' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const EXPORT_TABS = ['print', 'svg', 'image'] as const;
export type ExportTab = (typeof EXPORT_TABS)[number];

export const patternSearchSchema = z.object({
  q: z.string().default(''),
  tags: z.array(z.string()).default([]),
  authors: z.array(z.string()).default([]),
  id: z.array(z.string()).default([]),
  title: z.array(z.string()).default([]),
  description: z.array(z.string()).default([]),
  parts: z.array(z.string()).default([]),
  width: z.array(z.string()).default([]),
  height: z.array(z.string()).default([]),
  filesize: z.array(z.string()).default([]),
  sort: z
    .enum([
      '-created',
      'created',
      '-design_date',
      'design_date',
      '-updated',
      'updated',
      '-tag_count',
      'tag_count',
      '-avg_rating',
      'avg_rating',
      '-total_ratings',
      'total_ratings',
      '-avg_difficulty',
      'avg_difficulty',
      '-total_difficulty_ratings',
      'total_difficulty_ratings',
      '-favorite_count',
      'favorite_count',
      '-pieces',
      'pieces',
      '-design_height',
      'design_height',
      '-design_width',
      'design_width',
      '-has_layers',
      'has_layers',
    ])
    .default('-created'),
  patternId: z.string().optional(),
  pageNumber: z.number().int().min(1).default(1),
  exportTab: z.enum(EXPORT_TABS).default('print'),
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

  const idTokens: Token[] = search.id.map((id) => ({
    type: 'id',
    value: id.startsWith('-') ? id.slice(1) : id,
    exclude: id.startsWith('-'),
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

  function parseNumericTokens<T extends 'parts' | 'width' | 'height' | 'filesize'>(type: T, values: string[]): Token[] {
    return values
      .map((v): Token | null => {
        const operator = v.startsWith('>') ? '>' : v.startsWith('<') ? '<' : v.startsWith('=') ? '=' : null;
        if (!operator) return null;
        const num = parseFloat(v.slice(1));
        if (isNaN(num)) return null;
        return { type, operator, value: num } as Token;
      })
      .filter((t): t is Token => t !== null);
  }

  const partsTokens = parseNumericTokens('parts', search.parts);
  const widthTokens = parseNumericTokens('width', search.width);
  const heightTokens = parseNumericTokens('height', search.height);
  const filesizeTokens = parseNumericTokens('filesize', search.filesize);

  return [
    ...textTokens,
    ...tagTokens,
    ...authorTokens,
    ...idTokens,
    ...titleTokens,
    ...descriptionTokens,
    ...partsTokens,
    ...widthTokens,
    ...heightTokens,
    ...filesizeTokens,
  ];
}

/**
 * Reconstruct the three URL params from a flat token list.
 */
export function searchFromTokens(
  tokens: Token[],
): Omit<PatternSearch, 'patternId' | 'pageNumber' | 'sort' | 'exportTab'> {
  const q = tokens
    .filter((t): t is TextToken => t.type === 'text')
    .map((t) => (t.exclude ? `-${t.value}` : t.value))
    .join(',');

  const tags = tokens.filter((t): t is TagToken => t.type === 'tag').map((t) => (t.exclude ? `-${t.value}` : t.value));

  const authors = tokens
    .filter((t): t is AuthorToken => t.type === 'author')
    .map((t) => (t.exclude ? `-${t.value}` : t.value));

  const id = tokens.filter((t): t is IdToken => t.type === 'id').map((t) => (t.exclude ? `-${t.value}` : t.value));

  const title = tokens
    .filter((t): t is TitleToken => t.type === 'title')
    .map((t) => (t.exclude ? `-${t.value}` : t.value));

  const description = tokens
    .filter((t): t is DescriptionToken => t.type === 'description')
    .map((t) => (t.exclude ? `-${t.value}` : t.value));

  const parts = tokens.filter((t): t is PartsToken => t.type === 'parts').map((t) => `${t.operator}${t.value}`);

  const width = tokens.filter((t): t is WidthToken => t.type === 'width').map((t) => `${t.operator}${t.value}`);

  const height = tokens.filter((t): t is HeightToken => t.type === 'height').map((t) => `${t.operator}${t.value}`);

  const filesize = tokens
    .filter((t): t is FileSizeToken => t.type === 'filesize')
    .map((t) => `${t.operator}${t.value}`);

  return { q, tags, authors, id, title, description, parts, width, height, filesize };
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

  if (/^-?id:/i.test(stripped)) {
    const exclude = stripped.startsWith('-');
    const value = stripped.replace(/^-?id:/i, '');
    return { type: 'id', value, exclude };
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

  const numericMatch = stripped.match(/^(width|height|parts|pieces|filesize)([><=])([\d.]+)$/i);
  if (numericMatch) {
    const rawType = numericMatch[1].toLowerCase();
    const type = (rawType === 'pieces' ? 'parts' : rawType) as 'width' | 'height' | 'parts' | 'filesize';
    const operator = numericMatch[2] as NumericOperator;
    const value = parseFloat(numericMatch[3]);
    if (!isNaN(value)) return { type, operator, value };
  }

  return {
    type: 'text',
    value: stripped.startsWith('-') ? stripped.slice(1) : stripped,
    exclude: stripped.startsWith('-'),
  };
}

// Convert tokens into a PocketBase filter string.
// Use decodeURIComponent("") to read the output to test directly in Pocketbase
export function buildPocketBaseFilter(tokens: Token[]): string {
  const parts: string[] = [];
  const authorParts: string[] = [];
  const idParts: string[] = [];

  for (const token of tokens) {
    if (token.type === 'text') {
      if (token.exclude) {
        parts.push(`(tags !~ "${token.value}")`);
      } else {
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
        authorParts.push(`(authors.name !~ "${token.value}" && author_manual !~ "${token.value}")`);
      } else {
        authorParts.push(`(authors.name ?~ "${token.value}" || author_manual ~ "${token.value}")`);
      }
    }

    if (token.type === 'id') {
      if (token.exclude) {
        idParts.push(`(id != "${token.value}")`);
      } else {
        idParts.push(`(id = "${token.value}")`);
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

    if (token.type === 'parts') {
      parts.push(`(pieces ${token.operator} ${token.value})`);
    }

    if (token.type === 'width') {
      parts.push(`(design_width ${token.operator} ${token.value})`);
    }

    if (token.type === 'height') {
      parts.push(`(design_height ${token.operator} ${token.value})`);
    }

    if (token.type === 'filesize') {
      parts.push(`(pattern_file_size ${token.operator} ${token.value})`);
    }
  }

  if (authorParts.length > 0) {
    parts.push(`(${authorParts.join(' || ')})`);
  }

  if (idParts.length > 0) {
    parts.push(`(${idParts.join(' || ')})`);
  }

  return parts.join(' && ');
}
