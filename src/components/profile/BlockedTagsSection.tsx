import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Chip,
  IconButton,
  InputBase,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ClearIcon from '@mui/icons-material/Clear';
import { useQuerySearchTags } from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

// Reuses the same tag-search query + debounce timing as the homepage search bar
// (HomepageSearchV3) so results here match what's actually searchable.
export const BlockedTagsSection = ({ customization, setCust, onReset }: SectionCustProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // No debounce delay when the field is empty, matching HomepageSearchV3.
  const debouncedSearchTerm = useDebounce(inputValue, inputValue ? 600 : 0);
  const { data: tagResults = [], isFetching } = useQuerySearchTags(debouncedSearchTerm, isDropdownOpen);

  const blockedLower = new Set(customization.blocked_tags.map((t) => t.toLowerCase()));
  const dropdownItems = tagResults.filter((item) => !blockedLower.has(item.tag.toLowerCase()));
  const showDropdown = isDropdownOpen && dropdownItems.length > 0;

  function addBlockedTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || blockedLower.has(trimmed.toLowerCase())) return;
    setCust('blocked_tags', [...customization.blocked_tags, trimmed]);
    setInputValue('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  }

  function removeBlockedTag(tag: string) {
    setCust(
      'blocked_tags',
      customization.blocked_tags.filter((t) => t !== tag),
    );
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && highlightedIndex >= 0) {
        addBlockedTag(dropdownItems[highlightedIndex].tag);
      } else if (inputValue.trim()) {
        addBlockedTag(inputValue);
      }
    }
  }

  return (
    <SectionCard elevation={0}>
      <SectionHeader title="Blocked Tags" onReset={onReset} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Patterns tagged with any of these are silently excluded from your homepage browsing and search results.
      </Typography>

      {customization.blocked_tags.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {customization.blocked_tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color="error"
              variant="outlined"
              onDelete={() => removeBlockedTag(tag)}
              sx={{ borderRadius: 2 }}
            />
          ))}
        </Stack>
      )}

      <Box ref={containerRef} sx={{ position: 'relative' }}>
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.75,
            borderRadius: showDropdown ? '8px 8px 0 0' : 2,
            borderBottomColor: showDropdown ? 'transparent' : undefined,
            '&:focus-within': { borderColor: 'primary.main' },
          }}
        >
          <BlockRoundedIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
          <InputBase
            inputRef={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsDropdownOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder='Search for a tag to block, e.g. "spider"'
            inputProps={{ 'aria-label': 'Search for a tag to block' }}
            fullWidth
            sx={{ '& input': { fontSize: '0.875rem' } }}
          />
          {inputValue && (
            <IconButton
              size="small"
              onClick={() => {
                setInputValue('');
                inputRef.current?.focus();
              }}
              aria-label="Clear"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
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
              zIndex: 10,
              maxHeight: 260,
              overflowY: 'auto',
              borderRadius: '0 0 8px 8px',
              border: '1px solid',
              borderColor: 'primary.main',
              borderTop: 'none',
            }}
          >
            {isFetching && <LinearProgress sx={{ height: 2 }} />}
            <List dense disablePadding>
              {dropdownItems.map((item, index) => (
                <ListItemButton
                  key={item.id}
                  selected={index === highlightedIndex}
                  onMouseDown={(e) => {
                    // Prevent input blur from firing before click.
                    e.preventDefault();
                    addBlockedTag(item.tag);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { backgroundColor: 'primary.dark' },
                    },
                  }}
                >
                  <ListItemText primary={item.tag} slotProps={{ primary: { sx: { fontSize: '0.875rem' } } }} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </SectionCard>
  );
};
