import React, { useRef, useState, useCallback, useMemo, useEffect, type KeyboardEvent } from 'react';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import { type Token } from '@/functions/utilities/search-v2';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useQueryGetAllAuthors } from '@/functions/database/authors';

import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';

import {
  Box,
  Chip,
  InputBase,
  IconButton,
  Paper,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  //ListItemSecondaryAction,
  Typography,
  Divider,
} from '@mui/material';

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
  title: { color: 'secondary', icon: <PersonIcon fontSize="small" /> },
  description: { color: 'secondary', icon: <PersonIcon fontSize="small" /> },
};

function getTokenStyle(token: Token) {
  if (token.exclude) return { color: 'error' as const, icon: TOKEN_STYLES[token.type].icon };
  return TOKEN_STYLES[token.type];
}

function getTokenLabel(token: Token): string {
  if (token.type === 'author') return `author:${token.value}`;
  if (token.type === 'title') return `title:${token.value}`;
  if (token.type === 'description') return `description:${token.value}`;
  if (token.exclude) return `-${token.value}`;
  return token.value;
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
  'title:': 'suppress',
  'description:': 'suppress',
};

function detectPrefixMode(input: string): { mode: PrefixMode; searchTerm: string } {
  const lower = input.toLowerCase();

  for (const [prefix, mode] of Object.entries(PREFIX_MAP)) {
    if (lower.startsWith(prefix) || lower.startsWith(`-${prefix}`)) {
      const searchTerm = input.slice(input.toLowerCase().indexOf(prefix) + prefix.length);
      return { mode, searchTerm };
    }
    // User is mid-typing a known prefix (e.g. "auth") — suppress dropdown
    // so we don't show tag results while they're still typing the prefix
    if (prefix.startsWith(lower) && lower.length > 0) {
      return { mode: 'suppress', searchTerm: '' };
    }
  }

  return { mode: 'tag', searchTerm: input };
}

const FUSE_OPTIONS: IFuseOptions<TypeReadOnlyDatabaseItem> = {
  keys: ['tag'],
  threshold: 0.35, // tighter than default — feels more precise
  minMatchCharLength: 1,
  shouldSort: true,
};

type TokenizedSearchBarProps = {
  placeholder?: string;
  sx?: object;
};

export const HomepageSearchV3 = ({
  placeholder = 'Search by tags like "animal" and press enter, or click a tag in the sidebar',
  sx,
}: TokenizedSearchBarProps) => {
  const { tokens, addRawInput, removeToken, removeLastToken, clearTokens } = usePatternSearch();

  const { data: arrayOfTags } = useQueryGetAllTags();
  const { data: arrayOfAuthors } = useQueryGetAllAuthors();

  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { mode, searchTerm } = useMemo(() => detectPrefixMode(inputValue), [inputValue]);

  /**
   * Pick the correct data source based on prefix mode.
   * Sorted by count descending before being handed to Fuse.
   */
  const dataSource = useMemo((): TypeReadOnlyDatabaseItem[] => {
    let raw: TypeReadOnlyDatabaseItem[] | undefined = [];

    if (mode === 'author') {
      raw = arrayOfAuthors;
    } else {
      raw = arrayOfTags;
    }

    if (!raw) return [];

    return [...raw].sort((a, b) => b.count - a.count);
  }, [mode, arrayOfTags, arrayOfAuthors]);

  const fuse = useMemo(() => new Fuse(dataSource, FUSE_OPTIONS), [dataSource]);

  const dropdownItems = useMemo((): TypeReadOnlyDatabaseItem[] => {
    if (mode === 'suppress') return [];

    // No search term yet — show full sorted list
    if (!searchTerm.trim()) return dataSource;

    return fuse.search(searchTerm).map((r) => r.item);
  }, [mode, searchTerm, dataSource, fuse]);

  const showDropdown = isDropdownOpen && dropdownItems.length > 0;

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [dropdownItems]);

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
  function commitDropdownItem(item: TypeReadOnlyDatabaseItem) {
    const prefix = mode === 'author' ? 'author:' : '';
    commitInput(`${prefix}${item.tag}`);
    inputRef.current?.focus();
  }

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBarClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => {
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
    <Box ref={containerRef} sx={{ position: 'relative', ...sx }}>
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
          borderRadius: showDropdown ? '8px 8px 0 0' : 2,
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
            <Tooltip
              key={index}
              title={
                token.exclude
                  ? `Excluding "${token.value}"`
                  : token.type === 'author'
                    ? `Filtering by author "${token.value}"`
                    : token.type === 'tag'
                      ? `Filtering by tag "${token.value}"`
                      : `Searching for "${token.value}"`
              }
              arrow
            >
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
      </Paper>

      {showDropdown && (
        <Paper
          ref={dropdownRef}
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1300,
            maxHeight: 500,
            overflowY: 'auto',
            borderRadius: '0 0 8px 8px',
            border: '1px solid',
            borderColor: 'primary.main',
            borderTop: 'none',
          }}
        >
          {/* Context label */}
          <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              {mode === 'author' ? 'Authors' : 'Tags'} — {dropdownItems.length} result
              {dropdownItems.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          <Divider />

          <List dense disablePadding>
            {dropdownItems.map((item, index) => (
              <ListItemButton
                key={item.id}
                selected={index === highlightedIndex}
                onMouseDown={(e) => {
                  // Prevent input blur from firing before click
                  e.preventDefault();
                  commitDropdownItem(item);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemText primary={item.tag} primaryTypographyProps={{ fontSize: '0.875rem' }} />

                {/*<ListItemSecondaryAction>
                  <Typography
                    variant="caption"
                    sx={{
                      color: index === highlightedIndex ? 'primary.contrastText' : 'text.disabled',
                    }}
                  >
                    {item.count.toLocaleString()}
                  </Typography>
                </ListItemSecondaryAction>*/}
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};
