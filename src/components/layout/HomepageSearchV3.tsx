import React, { useRef, useState, useCallback, useMemo, useEffect, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { type Token, SORT_OPTIONS, type SortValue } from '@/functions/utilities/search-v2';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import {
  useQuerySearchTags,
  useQuerySearchTagsV2,
  useQueryGetAllTagsV2,
  tagNeedsArtistSuffix,
} from '@/functions/database/tags';
import { useQuerySearchAuthors } from '@/functions/database/authors';
import { isDefaultTagType, isAuthorDisplayType } from '@/functions/utilities/group-tags-by-type';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { SearchResultsDropdown } from '@/components/layout/SearchResultsDropdown';
import { AdvancedSearchModal } from '@/components/layout/AdvancedSearchModal';

import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';
import SortIcon from '@mui/icons-material/Sort';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';

import { Box, Button, Chip, InputBase, IconButton, MenuItem, Paper, Select, Tooltip } from '@mui/material';

type TypeReadOnlyDatabaseItem = {
  id: string;
  tag: string;
  count: number;
};

// Prefixes that switch the data source or suppress the dropdown entirely
type PrefixMode = 'tag' | 'author' | 'suppress';

type TypColorEnum = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const TOKEN_STYLES: Record<Token['type'], { color: TypColorEnum; icon: React.ReactElement }> = {
  text: { color: 'default', icon: <SearchIcon fontSize="small" /> },
  tag: { color: 'success', icon: <LabelIcon fontSize="small" /> },
  author: { color: 'info', icon: <PersonIcon fontSize="small" /> },
  id: { color: 'info', icon: <PersonIcon fontSize="small" /> },
  title: { color: 'secondary', icon: <PersonIcon fontSize="small" /> },
  description: { color: 'secondary', icon: <PersonIcon fontSize="small" /> },
  parts: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  width: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  height: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  filesize: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  width_in: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  height_in: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  width_cm: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
  height_cm: { color: 'warning', icon: <FilterListRoundedIcon fontSize="small" /> },
};

// customColor, when present, is a Type's own free-text CSS color - Chip's
// `color` prop only accepts this fixed MUI palette enum, not an arbitrary
// hex, so the render side switches to sx-based bg/text styling instead of
// the `color` prop whenever this is set.
function getTokenStyle(
  token: Token,
  tagColorByName: Map<string, string>,
  authorColorByName: Map<string, string>,
): { color: TypColorEnum; icon: React.ReactElement; customColor?: string } {
  if ('exclude' in token && token.exclude) return { color: 'error' as const, icon: TOKEN_STYLES[token.type].icon };
  const base = TOKEN_STYLES[token.type];
  if (token.type === 'tag') {
    const customColor = tagColorByName.get(token.value.toLowerCase());
    if (customColor) return { ...base, customColor };
  }
  if (token.type === 'author') {
    const customColor = authorColorByName.get(token.value.toLowerCase());
    if (customColor) return { ...base, customColor };
  }
  return base;
}

function getTokenLabel(token: Token): string {
  // Numeric filters
  if (token.type === 'parts') return `parts${token.operator}${token.value}`;
  if (token.type === 'width') return `width${token.operator}${token.value}`;
  if (token.type === 'height') return `height${token.operator}${token.value}`;
  if (token.type === 'filesize') return `filesize${token.operator}${token.value}`;
  if (token.type === 'width_in') return `width_in${token.operator}${token.value}`;
  if (token.type === 'height_in') return `height_in${token.operator}${token.value}`;
  if (token.type === 'width_cm') return `width_cm${token.operator}${token.value}`;
  if (token.type === 'height_cm') return `height_cm${token.operator}${token.value}`;

  // Custom string prefix filters
  if (token.type === 'author') return `${token.exclude ? '-' : ''}author:${token.value}`;
  if (token.type === 'id') return `${token.exclude ? '-' : ''}id:${token.value}`;
  if (token.type === 'title') return `${token.exclude ? '-' : ''}title:${token.value}`;
  if (token.type === 'description') return `${token.exclude ? '-' : ''}description:${token.value}`;

  // Default tag / text search
  return token.exclude ? `-${token.value}` : token.value;
}

function getTokenTooltip(token: Token): string {
  // Numeric filters
  if (token.type === 'parts') return `Parts ${token.operator} ${token.value}`;
  if (token.type === 'width') return `Width ${token.operator} ${token.value}`;
  if (token.type === 'height') return `Height ${token.operator} ${token.value}`;
  if (token.type === 'filesize') return `File size in Bytes ${token.operator} ${token.value}`;
  if (token.type === 'width_in') return `Width (in) ${token.operator} ${token.value}`;
  if (token.type === 'height_in') return `Height (in) ${token.operator} ${token.value}`;
  if (token.type === 'width_cm') return `Width (cm) ${token.operator} ${token.value}`;
  if (token.type === 'height_cm') return `Height (cm) ${token.operator} ${token.value}`;

  // Custom string prefix filters
  if (token.type === 'author')
    return token.exclude ? `Excluding author "${token.value}"` : `Filtering by author "${token.value}"`;
  if (token.type === 'id') return token.exclude ? `Excluding ID "${token.value}"` : `Filtering by ID "${token.value}"`;
  if (token.type === 'title')
    return token.exclude ? `Excluding title "${token.value}"` : `Filtering by title "${token.value}"`;
  if (token.type === 'description')
    return token.exclude ? `Excluding description "${token.value}"` : `Filtering by description "${token.value}"`;

  // Default tag / text search
  return token.exclude ? `Excluding "${token.value}"` : `Searching for "${token.value}"`;
}

/**
 * Detects the current input mode based on the typed prefix.
 * Returns the mode and the search term stripped of the prefix.
 *
 * Adding a new prefix in the future (e.g. "title:") only requires
 * adding a new entry to PREFIX_MAP below.
 */
const PREFIX_MAP: Record<string, PrefixMode> = {
  'author:': 'author',
  'id:': 'suppress',
  'title:': 'suppress',
  'description:': 'suppress',
  parts: 'suppress',
  pieces: 'suppress',
  width: 'suppress',
  height: 'suppress',
  filesize: 'suppress',
  width_in: 'suppress',
  height_in: 'suppress',
  width_cm: 'suppress',
  height_cm: 'suppress',
};

function detectPrefixMode(input: string): { mode: PrefixMode; searchTerm: string; negated: boolean } {
  // Strip a leading "-" (negative search, e.g. "-author:Clay" or "-cat") up
  // front so every check below matches on the bare prefix - callers get
  // `negated` back separately to re-apply it when committing the token.
  const negated = input.startsWith('-');
  const bare = negated ? input.slice(1) : input;
  const lower = bare.toLowerCase();

  for (const [prefix, mode] of Object.entries(PREFIX_MAP)) {
    if (lower.startsWith(prefix)) {
      const searchTerm = bare.slice(lower.indexOf(prefix) + prefix.length);
      return { mode, searchTerm, negated };
    }
    // User is mid-typing a known prefix (e.g. "auth" or "-auth") - suppress
    // the dropdown so we don't show tag results while they're still typing.
    if (prefix.startsWith(lower) && lower.length > 0) {
      return { mode: 'suppress', searchTerm: '', negated };
    }
  }

  // No known prefix - plain tag/text search. `bare` already has any leading
  // "-" stripped, so a negative tag search (e.g. "-cat") still looks up
  // "cat" in the tags collection instead of always coming back empty.
  return { mode: 'tag', searchTerm: bare, negated };
}

type TokenizedSearchBarProps = {
  placeholder?: string;
  sx?: object;
};

export const HomepageSearchV3 = ({
  placeholder = 'Search by tags like "animal" and press enter, or click a tag in the sidebar',
  sx,
}: TokenizedSearchBarProps) => {
  const { tokens, addRawInput, removeToken, removeLastToken, clearTokens, sort, setSort } = usePatternSearch();

  // Colors a tag/author chip by its Type, when one has a color set - resolved
  // by name the same way the server itself resolves a bare tag: token, so
  // the chip's color always matches what's actually being searched instead
  // of some other same-named row.
  const { data: tagsV2 = [] } = useQueryGetAllTagsV2();
  const tagColorByName = useMemo(() => {
    // Same "prefer General when a name has more than one row" rule used
    // everywhere else a bare name resolves to a specific tags_v2 row
    // (tagIdByName in main.pb.js, resolveOrCreateTagV2Row) - a General row
    // (or one with no Type at all) intentionally carries no color, so a
    // name that resolves to General shows no accent here either, even if
    // some other same-named row (e.g. an Author-typed one) has one set.
    const preferred = new Map<string, (typeof tagsV2)[number]>();
    for (const row of tagsV2) {
      const norm = row.tag.toLowerCase();
      const existing = preferred.get(norm);
      if (!existing || isDefaultTagType(row.expand?.type ?? null)) preferred.set(norm, row);
    }
    const colors = new Map<string, string>();
    for (const [norm, row] of preferred) {
      const type = row.expand?.type ?? null;
      if (!isDefaultTagType(type) && type?.color) colors.set(norm, type.color);
    }
    return colors;
  }, [tagsV2]);
  const authorTagColorByName = useMemo(() => {
    const colors = new Map<string, string>();
    for (const row of tagsV2) {
      const type = row.expand?.type ?? null;
      if (isAuthorDisplayType(type) && type?.color) colors.set(row.tag.toLowerCase(), type.color);
    }
    return colors;
  }, [tagsV2]);

  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressNextFocusRef = useRef(false);

  const { mode, searchTerm, negated } = useMemo(() => detectPrefixMode(inputValue), [inputValue]);

  // No debounce delay when the field is empty so the top-100 list appears immediately on focus.
  const debouncedSearchTerm = useDebounce(searchTerm, searchTerm ? 600 : 0);

  const { data: tagResults = [], isFetching: tagsFetching } = useQuerySearchTags(
    debouncedSearchTerm,
    isDropdownOpen && mode === 'tag' && searchTerm.length === 0,
  );
  // `tags` (the view above) groups by
  // string, so two tags_v2 rows sharing a name - e.g. the General "autumn"
  // season tag and the Author-type "autumn" - can only ever appear as one
  // collapsed row there, with no way to tell which one it was. Once there
  // is an actual term to search for, tagsV2Results (queried straight off
  // tags_v2, not an aggregate view) takes over, so a search for "autumn"
  // can show both as distinct, correctly labelled options - see
  // artistSuffixTagIds/tagLabel below. The empty-term "top 100 by usage"
  // default above keeps using the view - tags_v2 has no usage-count column
  // of its own to rank by, and nothing has been typed yet to disambiguate.
  const { data: tagsV2Results = [], isFetching: tagsV2Fetching } = useQuerySearchTagsV2(
    debouncedSearchTerm,
    isDropdownOpen && mode === 'tag' && searchTerm.length > 0,
  );
  const { data: authorResults = [], isFetching: authorsFetching } = useQuerySearchAuthors(
    debouncedSearchTerm,
    isDropdownOpen && mode === 'author',
  );

  // Which of tagsV2Results' rows need the "(artist)" display suffix - see
  // tagNeedsArtistSuffix's own doc comment. Only ever populated alongside
  // tagsV2Results itself (searchTerm non-empty, tag mode), so an empty Set
  // is correct, not just a safe fallback, whenever the view-backed top-100
  // default is what's actually showing.
  const artistSuffixTagIds = useMemo(
    () => new Set(tagsV2Results.filter(tagNeedsArtistSuffix).map((t) => t.id)),
    [tagsV2Results],
  );

  const tagDropdownItems: TypeReadOnlyDatabaseItem[] = useMemo(
    () =>
      searchTerm.length > 0
        ? tagsV2Results.map((t): TypeReadOnlyDatabaseItem => ({ id: t.id, tag: t.tag, count: 0 }))
        : tagResults,
    [searchTerm, tagsV2Results, tagResults],
  );

  const dropdownItems: TypeReadOnlyDatabaseItem[] = useMemo(
    () => (mode === 'suppress' ? [] : mode === 'author' ? authorResults : tagDropdownItems),
    [mode, authorResults, tagDropdownItems],
  );
  const isFetchingDropdown = tagsFetching || tagsV2Fetching || authorsFetching;

  // Labels a dropdown row for display only - onItemSelect/commitDropdownItem
  // below still read the real item.tag, never this string. Only passed for
  // tag mode; author-mode rows have no equivalent ambiguity to label.
  const tagLabel = useCallback(
    (item: TypeReadOnlyDatabaseItem) => (artistSuffixTagIds.has(item.id) ? `${item.tag} (artist)` : item.tag),
    [artistSuffixTagIds],
  );

  const showDropdown = isDropdownOpen && dropdownItems.length > 0;

  const commitInput = useCallback(
    (overrideValue?: string) => {
      const trimmed = (overrideValue ?? inputValue).trim();
      if (!trimmed) return;
      addRawInput(trimmed);
      setInputValue('');
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    },
    [inputValue, addRawInput],
  );

  /**
   * Commit a dropdown item. For author mode, prepend "author:" so
   * parseRawInput produces the correct token type. Re-applies a leading "-"
   * when the user was typing a negative search (e.g. "-author:Clay" or
   * "-cat") so picking an item from the dropdown doesn't flip it positive.
   * Extend this for future prefix modes (e.g. title:) here.
   */
  const commitDropdownItem = useCallback(
    (item: TypeReadOnlyDatabaseItem) => {
      const excludePrefix = negated ? '-' : '';
      // An Author-typed "autumn"
      // committed as a plain tag token would resolve ambiguously
      // server-side (buildPatternFilters' tagIdByName defaults a bare name
      // to the General row when one exists). Committing it as an author:
      // token instead reuses the existing, already-precise
      // authorTagIdByName resolution path, keyed off this exact tag's own
      // name - the same row tagLabel just labelled it by, so the resulting
      // chip still means what the picked option showed.
      const isArtistTag = mode === 'tag' && artistSuffixTagIds.has(item.id);
      const modePrefix = mode === 'author' || isArtistTag ? 'author:' : '';
      commitInput(`${excludePrefix}${modePrefix}${item.tag}`);
      inputRef.current?.focus();
    },
    [mode, negated, commitInput, artistSuffixTagIds],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Arrow navigation inside dropdown
      if (showDropdown) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, dropdownItems.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, -1));
          return;
        }
      }

      switch (e.key) {
        case 'Enter': {
          e.preventDefault();
          if (showDropdown && highlightedIndex >= 0) {
            commitDropdownItem(dropdownItems[highlightedIndex]);
          } else {
            commitInput();
          }
          break;
        }

        case 'Backspace': {
          if (inputValue === '') {
            e.preventDefault();
            removeLastToken();
          }
          break;
        }

        case 'Escape': {
          if (isDropdownOpen) {
            setIsDropdownOpen(false);
          } else {
            setInputValue('');
            inputRef.current?.blur();
          }
          break;
        }
      }
    },
    [
      inputValue,
      showDropdown,
      highlightedIndex,
      dropdownItems,
      commitInput,
      commitDropdownItem,
      removeLastToken,
      isDropdownOpen,
    ],
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

  const handleBarClick = useCallback(() => {
    inputRef.current?.focus();
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

  const hasContent = tokens.length > 0 || inputValue.length > 0;

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'center' },
        gap: 0.75,
        ...sx,
      }}
    >
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Paper
          elevation={0}
          variant="outlined"
          onClick={handleBarClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
            px: 1.5,
            py: 0.75,
            cursor: 'text',
            borderRadius: showDropdown ? '16px 16px 0 0' : 8,
            borderBottomColor: showDropdown ? 'transparent' : undefined,
            '&:focus-within': {
              borderColor: 'primary.main',
            },
          }}
        >
          <SearchIcon fontSize="small" sx={{ color: 'text.disabled', mr: 0.5, flexShrink: 0 }} />

          {tokens.map((token, index) => {
            const { color, customColor } = getTokenStyle(token, tagColorByName, authorTagColorByName);
            return (
              <Tooltip key={index} title={getTokenTooltip(token)} arrow>
                <Chip
                  size="small"
                  label={getTokenLabel(token)}
                  color={customColor ? undefined : color}
                  onDelete={() => removeToken(index)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    maxWidth: 200,
                    ...(customColor
                      ? {
                          bgcolor: customColor,
                          color: '#fff',
                          '& .MuiChip-deleteIcon': {
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': { color: '#fff' },
                          },
                        }
                      : {}),
                  }}
                />
              </Tooltip>
            );
          })}

          <InputBase
            inputRef={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsDropdownOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={tokens.length === 0 ? placeholder : ''}
            inputProps={{ 'aria-label': 'Search patterns' }}
            sx={{
              minHeight: 30,
              flex: 1,
              minWidth: 120,
              '& input': { p: 0, fontSize: '0.875rem' },
            }}
          />

          {hasContent && (
            <Tooltip title="Clear search" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  clearTokens();
                  setInputValue('');
                  inputRef.current?.focus();
                }}
                sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }}
                aria-label="Clear search"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdvancedSearchOpen(true);
            }}
            startIcon={<ManageSearchRoundedIcon fontSize="small" />}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              ml: hasContent ? 0 : 'auto',
              flexShrink: 0,
              color: 'text.disabled',
              textTransform: 'none',
              fontSize: '0.75rem',
              lineHeight: 1.2,
              minWidth: 'auto',
              px: 1,
              py: 0.25,
              '& .MuiButton-startIcon': { mr: 0.5 },
            }}
          >
            Advanced Search
          </Button>

          <Tooltip title="Advanced search" arrow>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setIsAdvancedSearchOpen(true);
              }}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                ml: hasContent ? 0 : 'auto',
                flexShrink: 0,
                color: 'text.disabled',
              }}
              aria-label="Advanced search"
            >
              <ManageSearchRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Search help" arrow>
            <IconButton
              size="small"
              component={Link}
              to="/wiki/site-functions/search"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              sx={{ flexShrink: 0, color: 'text.disabled' }}
              aria-label="Search help"
            >
              <HelpOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>

        {showDropdown && (
          <SearchResultsDropdown
            dropdownRef={dropdownRef}
            label={mode === 'author' ? 'Authors' : 'Tags'}
            items={dropdownItems}
            isFetching={isFetchingDropdown}
            searchTerm={searchTerm}
            highlightedIndex={highlightedIndex}
            onItemHover={setHighlightedIndex}
            onItemSelect={commitDropdownItem}
            getLabel={mode === 'tag' ? tagLabel : undefined}
          />
        )}

        <AdvancedSearchModal
          open={isAdvancedSearchOpen}
          onClose={() => setIsAdvancedSearchOpen(false)}
          onApply={addRawInput}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <SortIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        <Select
          size="small"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          variant="standard"
          disableUnderline
          sx={{ fontSize: '0.8rem', color: 'text.secondary', '& .MuiSelect-select': { py: 0 } }}
        >
          {SORT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8rem' }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
};
