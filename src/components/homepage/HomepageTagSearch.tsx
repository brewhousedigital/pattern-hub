import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQuerySearchTags, useQuerySearchTagsV2, tagNeedsArtistSuffix } from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { SearchResultsDropdown } from '@/components/layout/SearchResultsDropdown';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

import SearchIcon from '@mui/icons-material/Search';
import { Box, InputAdornment, TextField } from '@mui/material';
import { alpha } from '@mui/material/styles';

type HomepageTagSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /**
   * Tag Relational Refactor, R3.5 follow-up (see
   * TAG_RELATIONAL_REFACTOR_NOTES.md): `kind` tells the caller which /pattern
   * search param to navigate with - 'author' for a tag that was labelled
   * "(artist)" in the dropdown (an Author-typed tags_v2 row), 'tag'
   * otherwise. Mirrors HomepageSearchV3.tsx's author: token commit - the
   * same underlying ambiguity (a bare name defaults to the General row),
   * the same fix, adapted to this component's plain-string callback instead
   * of a token.
   */
  onSelectTag: (tag: string, kind: 'tag' | 'author') => void;
  placeholder?: string;
};

/**
 * The homepage's simple search bar, with a tag-only autocomplete dropdown
 * bolted on. This is a separate component from HomepageSearchV3 (the /pattern
 * search bar) because that one drives its dropdown off tokenized route
 * state - here the input is just plain text and clicking a tag navigates
 * straight to /pattern instead of adding a token. Only the dropdown's visual
 * container (SearchResultsDropdown) is shared between the two.
 */
export const HomepageTagSearch = ({ value, onChange, onSubmit, onSelectTag, placeholder }: HomepageTagSearchProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suppressNextFocusRef = useRef(false);

  // No debounce delay when the field is empty so the top-100 list appears immediately on focus.
  const debouncedValue = useDebounce(value, value ? 600 : 0);

  const { data: tagResults = [], isFetching: tagsFetching } = useQuerySearchTags(
    debouncedValue,
    isDropdownOpen && value.length === 0,
  );
  // Tag Relational Refactor, R3.5 follow-up (see TAG_RELATIONAL_REFACTOR_NOTES.md):
  // same hybrid HomepageSearchV3.tsx's tag dropdown uses, for the same reason
  // - `tags` (the view above) groups by string, so it can only ever show one
  // collapsed row for two tags_v2 rows sharing a name (e.g. the General
  // "autumn" season tag and the Author-type "autumn"). Once there's an
  // actual term to search for, tagsV2Results - queried straight off tags_v2,
  // not an aggregate view - takes over, so both show up as distinct,
  // correctly labelled options. The empty-term "top 100 by usage" default
  // above keeps using the view, same reasoning as HomepageSearchV3.tsx: no
  // usage-count column on tags_v2 to rank by, and nothing typed yet to
  // disambiguate.
  const { data: tagsV2Results = [], isFetching: tagsV2Fetching } = useQuerySearchTagsV2(
    debouncedValue,
    isDropdownOpen && value.length > 0,
  );

  // Which of tagsV2Results' rows need the "(artist)" display suffix - see
  // tagNeedsArtistSuffix's own doc comment. Only ever populated alongside
  // tagsV2Results itself (value non-empty), so an empty Set is correct, not
  // just a safe fallback, whenever the view-backed top-100 default is what's
  // actually showing.
  const artistSuffixTagIds = useMemo(
    () => new Set(tagsV2Results.filter(tagNeedsArtistSuffix).map((t) => t.id)),
    [tagsV2Results],
  );

  const tagResultItems: TypeReadOnlyDatabaseItem[] = useMemo(
    () =>
      value.length > 0
        ? tagsV2Results.map((t): TypeReadOnlyDatabaseItem => ({ id: t.id, tag: t.tag, count: 0 }))
        : tagResults,
    [value, tagsV2Results, tagResults],
  );
  const isFetching = tagsFetching || tagsV2Fetching;

  // Labels a dropdown row for display only - selectTag below still reads the
  // real item.tag, never this string.
  const tagLabel = useCallback(
    (item: TypeReadOnlyDatabaseItem) => (artistSuffixTagIds.has(item.id) ? `${item.tag} (artist)` : item.tag),
    [artistSuffixTagIds],
  );

  const showDropdown = isDropdownOpen && tagResultItems.length > 0;

  const selectTag = useCallback(
    (item: TypeReadOnlyDatabaseItem) => {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      // See onSelectTag's own doc comment above: an Author-typed pick must
      // navigate via the authors= param, not tags=, or /pattern would
      // default a bare "autumn" back to the General (season) row - the same
      // ambiguity HomepageSearchV3.tsx's author: token commit exists to
      // avoid, here expressed as a URL param instead of a token.
      onSelectTag(item.tag, artistSuffixTagIds.has(item.id) ? 'author' : 'tag');
    },
    [onSelectTag, artistSuffixTagIds],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (showDropdown) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, tagResultItems.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, -1));
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (showDropdown && highlightedIndex >= 0) {
          selectTag(tagResultItems[highlightedIndex]);
        } else {
          setIsDropdownOpen(false);
          onSubmit();
        }
        return;
      }

      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    },
    [showDropdown, highlightedIndex, tagResultItems, selectTag, onSubmit],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleWindowBlur() {
      suppressNextFocusRef.current = true;
      setIsDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const handleFocus = useCallback(() => {
    if (suppressNextFocusRef.current) {
      suppressNextFocusRef.current = false;
      return;
    }
    setIsDropdownOpen(true);
  }, []);

  // On blur, delay closing so a dropdown item click can fire first
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setIsDropdownOpen(false);
      }
    }, 150);
  }, []);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <TextField
        fullWidth
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsDropdownOpen(true);
          setHighlightedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: showDropdown ? '24px 24px 0 0' : 999,
              backgroundColor: '#fff',
              px: 2.5,
              py: 0.5,
              boxShadow: (t) => `0 2px 12px ${alpha(t.palette.common.black, 0.08)}`,
              '&:hover, &.Mui-focused': {
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.common.black, 0.14)}`,
              },
              '& fieldset': { border: 'none' },
            },
          },
        }}
      />

      {showDropdown && (
        <SearchResultsDropdown
          dropdownRef={dropdownRef}
          label="Tags"
          items={tagResultItems}
          isFetching={isFetching}
          searchTerm={value}
          highlightedIndex={highlightedIndex}
          onItemHover={setHighlightedIndex}
          onItemSelect={selectTag}
          getLabel={tagLabel}
        />
      )}
    </Box>
  );
};
