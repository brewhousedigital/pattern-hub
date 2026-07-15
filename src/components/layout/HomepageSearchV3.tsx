import React, { useRef, useState, useCallback, useMemo, useEffect, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { type Token, SORT_OPTIONS, type SortValue } from '@/functions/utilities/search-v2';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useQuerySearchTags } from '@/functions/database/tags';
import { useQuerySearchAuthors } from '@/functions/database/authors';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { SearchResultsDropdown } from '@/components/layout/SearchResultsDropdown';

import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';
import SortIcon from '@mui/icons-material/Sort';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';

import { Box, Chip, InputBase, IconButton, MenuItem, Paper, Select, Tooltip } from '@mui/material';

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
};

function getTokenStyle(token: Token) {
  if ('exclude' in token && token.exclude) return { color: 'error' as const, icon: TOKEN_STYLES[token.type].icon };
  return TOKEN_STYLES[token.type];
}

function getTokenLabel(token: Token): string {
  // Numeric filters
  if (token.type === 'parts') return `parts${token.operator}${token.value}`;
  if (token.type === 'width') return `width${token.operator}${token.value}`;
  if (token.type === 'height') return `height${token.operator}${token.value}`;
  if (token.type === 'filesize') return `filesize${token.operator}${token.value}`;

  // Custom string prefix filters
  if (token.type === 'author') return `author:${token.value}`;
  if (token.type === 'id') return `id:${token.value}`;
  if (token.type === 'title') return `title:${token.value}`;
  if (token.type === 'description') return `description:${token.value}`;

  // Default tag / text search
  return token.exclude ? `-${token.value}` : token.value;
}

function getTokenTooltip(token: Token): string {
  // Numeric filters
  if (token.type === 'parts') return `Parts ${token.operator} ${token.value}`;
  if (token.type === 'width') return `Width ${token.operator} ${token.value}`;
  if (token.type === 'height') return `Height ${token.operator} ${token.value}`;
  if (token.type === 'filesize') return `File size in Bytes ${token.operator} ${token.value}`;

  // Custom string prefix filters
  if (token.type === 'author') return `Filtering by author "${token.value}"`;
  if (token.type === 'id') return `Filtering by ID "${token.value}"`;
  if (token.type === 'title') return `Filtering by title "${token.value}"`;
  if (token.type === 'description') return `Filtering by description "${token.value}"`;

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
};

function detectPrefixMode(input: string): { mode: PrefixMode; searchTerm: string } {
  const lower = input.toLowerCase();

  for (const [prefix, mode] of Object.entries(PREFIX_MAP)) {
    if (lower.startsWith(prefix) || lower.startsWith(`-${prefix}`)) {
      const searchTerm = input.slice(input.toLowerCase().indexOf(prefix) + prefix.length);
      return { mode, searchTerm };
    }
    // User is mid-typing a known prefix (e.g. "auth") - suppress dropdown
    // so we don't show tag results while they're still typing the prefix
    if (prefix.startsWith(lower) && lower.length > 0) {
      return { mode: 'suppress', searchTerm: '' };
    }
  }

  return { mode: 'tag', searchTerm: input };
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

  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressNextFocusRef = useRef(false);

  const { mode, searchTerm } = useMemo(() => detectPrefixMode(inputValue), [inputValue]);

  // No debounce delay when the field is empty so the top-100 list appears immediately on focus.
  const debouncedSearchTerm = useDebounce(searchTerm, searchTerm ? 600 : 0);

  const { data: tagResults = [], isFetching: tagsFetching } = useQuerySearchTags(
    debouncedSearchTerm,
    isDropdownOpen && mode === 'tag',
  );
  const { data: authorResults = [], isFetching: authorsFetching } = useQuerySearchAuthors(
    debouncedSearchTerm,
    isDropdownOpen && mode === 'author',
  );

  const dropdownItems: TypeReadOnlyDatabaseItem[] = useMemo(
    () => (mode === 'suppress' ? [] : mode === 'author' ? authorResults : tagResults),
    [mode, authorResults, tagResults],
  );
  const isFetchingDropdown = tagsFetching || authorsFetching;

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
   * parseRawInput produces the correct token type.
   * Extend this for future prefix modes (e.g. title:) here.
   */
  const commitDropdownItem = useCallback(
    (item: TypeReadOnlyDatabaseItem) => {
      const prefix = mode === 'author' ? 'author:' : '';
      commitInput(`${prefix}${item.tag}`);
      inputRef.current?.focus();
    },
    [mode, commitInput],
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
            const { color } = getTokenStyle(token);
            return (
              <Tooltip key={index} title={getTokenTooltip(token)} arrow>
                <Chip
                  size="small"
                  label={getTokenLabel(token)}
                  color={color}
                  onDelete={() => removeToken(index)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ maxWidth: 200 }}
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

          <Tooltip title="Search help" arrow>
            <IconButton
              size="small"
              component={Link}
              to="/wiki/site-functions/search"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              sx={{ ml: hasContent ? 0 : 'auto', flexShrink: 0, color: 'text.disabled' }}
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
          />
        )}
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
