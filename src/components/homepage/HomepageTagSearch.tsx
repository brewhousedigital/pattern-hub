import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuerySearchTags } from '@/functions/database/tags';
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
  onSelectTag: (tag: string) => void;
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

  const { data: tagResults = [], isFetching } = useQuerySearchTags(debouncedValue, isDropdownOpen);

  const showDropdown = isDropdownOpen && tagResults.length > 0;

  const selectTag = useCallback(
    (item: TypeReadOnlyDatabaseItem) => {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      onSelectTag(item.tag);
    },
    [onSelectTag],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (showDropdown) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, tagResults.length - 1));
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
          selectTag(tagResults[highlightedIndex]);
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
    [showDropdown, highlightedIndex, tagResults, selectTag, onSubmit],
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
          items={tagResults}
          isFetching={isFetching}
          searchTerm={value}
          highlightedIndex={highlightedIndex}
          onItemHover={setHighlightedIndex}
          onItemSelect={selectTag}
        />
      )}
    </Box>
  );
};
