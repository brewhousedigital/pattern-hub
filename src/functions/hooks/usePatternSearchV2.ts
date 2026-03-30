import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import {
  buildPocketBaseFilter,
  parseRawInput,
  type PatternSearch,
  patternSearchSchema,
  searchFromTokens,
  type Token,
  tokensFromSearch,
} from '@/functions/utilities/search-v2';

export type UsePatternSearchReturn = {
  // Current state
  tokens: Token[];
  patternId: string | undefined;
  filter: string;

  // Token mutations
  addRawInput: (raw: string) => void;
  addTag: (tag: string, exclude?: boolean) => void;
  addAuthor: (author: string, exclude?: boolean) => void;
  removeToken: (index: number) => void;
  removeLastToken: () => void;
  clearTokens: () => void;

  // Tag toggle — handles add/remove in one call (used by sidebar)
  toggleTag: (tag: string) => void;
  isTagActive: (tag: string) => boolean;

  // Pattern drawer navigation
  setPatternId: (id: string | undefined) => void;
  navigateToPattern: (id: string, resultIds: string[]) => void;
  nextPattern: (resultIds: string[]) => void;
  prevPattern: (resultIds: string[]) => void;
  hasNext: (resultIds: string[]) => boolean;
  hasPrev: (resultIds: string[]) => boolean;
};

export function usePatternSearch(): UsePatternSearchReturn {
  const search = useSearch({ from: '/' }) as PatternSearch;
  const navigate = useNavigate({ from: '/' });

  const tokens = useMemo(() => tokensFromSearch(search), [search]);

  const filter = useMemo(() => buildPocketBaseFilter(tokens), [tokens]);

  const { patternId } = search;

  /**
   * Central navigate helper. All mutations go through here so patternId is
   * always preserved unless explicitly changed, and partial updates are safe.
   */
  function updateSearch(partial: Partial<PatternSearch>) {
    navigate({
      search: (prev) => patternSearchSchema.parse({ ...prev, ...partial }),
    }).then();
  }

  function updateTokens(nextTokens: Token[]) {
    const { q, tags, authors } = searchFromTokens(nextTokens);
    updateSearch({ q, tags, authors });
  }

  /**
   * Parse a raw typed string (e.g. "jumping", "-dog", "author:Clay")
   * and append it to the token list.
   */
  function addRawInput(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const token = parseRawInput(trimmed);
    updateTokens([...tokens, token]);
  }

  /**
   * Add a tag token directly (e.g. from sidebar click).
   * Skips if the tag is already present to avoid duplicates.
   */
  function addTag(tag: string, exclude = false) {
    const alreadyExists = tokens.some((t) => t.type === 'tag' && t.value === tag && t.exclude === exclude);
    if (alreadyExists) return;
    console.log(">>>{ type: 'tag', value: tag, exclude }", { type: 'tag', value: tag, exclude });
    updateTokens([...tokens, { type: 'tag', value: tag, exclude }]);
  }

  /**
   * Add an author token directly.
   * Skips if the author is already present to avoid duplicates.
   */
  function addAuthor(author: string, exclude = false) {
    const alreadyExists = tokens.some((t) => t.type === 'author' && t.value === author && t.exclude === exclude);
    if (alreadyExists) return;
    updateTokens([...tokens, { type: 'author', value: author, exclude }]);
  }

  /** Remove a single token by its index in the token list. */
  function removeToken(index: number) {
    updateTokens(tokens.filter((_, i) => i !== index));
  }

  /** Remove the last token — wired to Backspace on empty input. */
  function removeLastToken() {
    if (tokens.length === 0) return;
    updateTokens(tokens.slice(0, -1));
  }

  /** Wipe all tokens, leaving patternId and other params intact. */
  function clearTokens() {
    updateSearch({ q: '', tags: [], authors: [] });
  }

  // Tag toggle (sidebar)

  /** Returns true if a tag is currently an active (non-excluded) tag token. */
  function isTagActive(tag: string): boolean {
    return tokens.some((t) => t.type === 'tag' && t.value === tag && !t.exclude);
  }

  /**
   * One-call add/remove for sidebar tag buttons.
   * If the tag is active, removes it. Otherwise, adds it.
   */
  function toggleTag(tag: string) {
    if (isTagActive(tag)) {
      updateTokens(tokens.filter((t) => !(t.type === 'tag' && t.value === tag)));
    } else {
      addTag(tag);
    }
  }

  /** Open the drawer for a specific pattern ID. */
  function setPatternId(id: string | undefined) {
    updateSearch({ patternId: id });
  }

  /**
   * Open the drawer for a specific pattern, providing the full ordered result
   * list so prev/next can be computed. This is the primary way to open a
   * pattern from the grid — pass in the flat ordered array of result IDs.
   */
  function navigateToPattern(id: string, resultIds: string[]) {
    // Guard: if the id isn't in the result set, just open it anyway
    void resultIds;
    setPatternId(id);
  }

  /** Move to the next pattern in the result list, wrapping is not applied. */
  function nextPattern(resultIds: string[]) {
    if (!patternId) return;
    const currentIndex = resultIds.indexOf(patternId);
    if (currentIndex === -1 || currentIndex === resultIds.length - 1) return;
    setPatternId(resultIds[currentIndex + 1]);
  }

  /** Move to the previous pattern in the result list. */
  function prevPattern(resultIds: string[]) {
    if (!patternId) return;
    const currentIndex = resultIds.indexOf(patternId);
    if (currentIndex <= 0) return;
    setPatternId(resultIds[currentIndex - 1]);
  }

  /** True if there is a next pattern in the result list. */
  function hasNext(resultIds: string[]): boolean {
    if (!patternId) return false;
    const currentIndex = resultIds.indexOf(patternId);
    return currentIndex !== -1 && currentIndex < resultIds.length - 1;
  }

  /** True if there is a previous pattern in the result list. */
  function hasPrev(resultIds: string[]): boolean {
    if (!patternId) return false;
    const currentIndex = resultIds.indexOf(patternId);
    return currentIndex > 0;
  }

  return {
    tokens,
    patternId,
    filter,
    addRawInput,
    addTag,
    addAuthor,
    removeToken,
    removeLastToken,
    clearTokens,
    toggleTag,
    isTagActive,
    setPatternId,
    navigateToPattern,
    nextPattern,
    prevPattern,
    hasNext,
    hasPrev,
  };
}
