import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import {
  useQuerySearchTags,
  useQuerySearchTagsV2,
  tagNeedsArtistSuffix,
  escapeTagFilterValue,
  type TypeTagV2Record,
} from '@/functions/database/tags';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

type BlockedEntry = { tag: string; refId: string };
type TagSearchItem = { id: string; tag: string };

// Reuses the same tag-search query + debounce timing as the homepage search bar
// (HomepageSearchV3) so results here match what's actually searchable.
//
// R3.5 follow-up (see TAG_RELATIONAL_REFACTOR_NOTES.md): blocked_tags alone
// - a plain string list - can't distinguish two tags_v2 rows sharing a name
// (e.g. the General "autumn" season tag and the Author-type "autumn"),
// exactly the same limitation the search bars and admin tag-entry field had.
// Unlike admin tag-entry (which filters Author-typed tags out entirely -
// they're meant to be derived, never picked there), blocking someone's work
// by their author tag is a legitimate, direct thing a user might want, so
// this labels the distinction instead of hiding either option.
export const BlockedTagsSection = ({ customization, setCust, onReset }: SectionCustProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // blocked_tag_refs is a parallel array to blocked_tags, same length/index
  // by design - padded/truncated defensively here rather than trusted as-is,
  // since a user who blocked tags before this field existed (or any other
  // drift) would otherwise have a shorter refs array. A padded '' entry just
  // means that one falls back to name-based resolution server-side, same as
  // every blocked tag did before this feature existed.
  const entries: BlockedEntry[] = useMemo(
    () => customization.blocked_tags.map((tag, i) => ({ tag, refId: customization.blocked_tag_refs[i] ?? '' })),
    [customization.blocked_tags, customization.blocked_tag_refs],
  );

  // Which currently-blocked refIds are Author-typed - independent of the
  // search state below, so an already-blocked chip still shows "(artist)"
  // correctly even when the user isn't actively searching for it right now.
  // Small and targeted - only ever queries the handful of ids actually
  // blocked, not the whole tags_v2 table.
  const nonEmptyRefIds = useMemo(() => [...new Set(entries.map((e) => e.refId).filter(Boolean))], [entries]);
  const { data: blockedArtistRefIds = new Set<string>() } = useQuery({
    queryKey: ['BlockedTagRefTypes', nonEmptyRefIds],
    queryFn: async (): Promise<Set<string>> => {
      const filter = nonEmptyRefIds.map((id) => `id = "${escapeTagFilterValue(id)}"`).join(' || ');
      const rows = await pocketbase.collection('tags_v2').getFullList<TypeTagV2Record>({ filter, expand: 'type' });
      return new Set(rows.filter(tagNeedsArtistSuffix).map((r) => r.id));
    },
    enabled: nonEmptyRefIds.length > 0,
    placeholderData: (prev) => prev,
  });

  // No debounce delay when the field is empty, matching HomepageSearchV3.
  const debouncedSearchTerm = useDebounce(inputValue, inputValue ? 600 : 0);
  const isSearching = debouncedSearchTerm.trim() !== '';
  const { data: tagViewResults = [], isFetching: tagViewFetching } = useQuerySearchTags(
    debouncedSearchTerm,
    isDropdownOpen && !isSearching,
  );
  // Same hybrid HomepageSearchV3.tsx's tag dropdown uses, for the same
  // reason - the view above groups by string, so it can never show two
  // tags_v2 rows sharing a name as distinct results. Once there's an actual
  // term to search for, tagsV2Results - queried straight off tags_v2, not
  // an aggregate view - takes over, so both can show up labelled distinctly.
  const { data: tagsV2Results = [], isFetching: tagsV2Fetching } = useQuerySearchTagsV2(
    debouncedSearchTerm,
    isDropdownOpen && isSearching,
  );

  const searchArtistSuffixIds = useMemo(
    () => new Set(tagsV2Results.filter(tagNeedsArtistSuffix).map((t) => t.id)),
    [tagsV2Results],
  );
  const itemLabel = (item: TagSearchItem) => (searchArtistSuffixIds.has(item.id) ? `${item.tag} (artist)` : item.tag);

  const isFetching = isSearching ? tagsV2Fetching : tagViewFetching;
  const searchItems: TagSearchItem[] = isSearching ? tagsV2Results : tagViewResults;

  // An option is already blocked if its specific id matches a blocked
  // entry's refId, OR (for an entry with no refId - a pre-refs or free-solo
  // block) its name matches a blocked entry with no refId. This is what
  // lets "autumn" (season) and "autumn" (artist) be blocked independently -
  // a name-only comparison would have conflated them the same way the
  // admin tag field's old dropdown did.
  const blockedByRef = new Set(entries.filter((e) => e.refId).map((e) => e.refId));
  const blockedNameOnly = new Set(entries.filter((e) => !e.refId).map((e) => e.tag.toLowerCase()));
  const dropdownItems = searchItems.filter(
    (item) => !blockedByRef.has(item.id) && !blockedNameOnly.has(item.tag.toLowerCase()),
  );
  const showDropdown = isDropdownOpen && dropdownItems.length > 0;

  function addBlockedTag(tag: string, refId: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (refId ? blockedByRef.has(refId) : blockedNameOnly.has(trimmed.toLowerCase())) return;
    setCust('blocked_tags', [...customization.blocked_tags, trimmed]);
    setCust('blocked_tag_refs', [...entries.map((e) => e.refId), refId]);
    setInputValue('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  }

  function removeBlockedTag(index: number) {
    setCust(
      'blocked_tags',
      customization.blocked_tags.filter((_, i) => i !== index),
    );
    setCust(
      'blocked_tag_refs',
      entries.filter((_, i) => i !== index).map((e) => e.refId),
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
        const item = dropdownItems[highlightedIndex];
        addBlockedTag(item.tag, item.id);
      } else if (inputValue.trim()) {
        // Free-solo: no specific tags_v2 row was ever shown/picked, so no id
        // to capture - falls back to name-based resolution server-side,
        // same as every blocked tag did before this feature existed.
        addBlockedTag(inputValue, '');
      }
    }
  }

  return (
    <SectionCard elevation={0}>
      <SectionHeader title="Blocked Tags" onReset={onReset} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Patterns tagged with any of these are silently excluded from your homepage browsing and search results.
      </Typography>

      {entries.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {entries.map((entry, index) => (
            <Chip
              key={`${entry.tag}-${entry.refId || index}`}
              label={entry.refId && blockedArtistRefIds.has(entry.refId) ? `${entry.tag} (artist)` : entry.tag}
              size="small"
              color="error"
              variant="outlined"
              onDelete={() => removeBlockedTag(index)}
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
                    addBlockedTag(item.tag, item.id);
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
                  <ListItemText primary={itemLabel(item)} slotProps={{ primary: { sx: { fontSize: '0.875rem' } } }} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </SectionCard>
  );
};
