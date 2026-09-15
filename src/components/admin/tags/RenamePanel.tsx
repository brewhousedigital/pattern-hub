import { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, Button, Paper, TextField, Typography } from '@mui/material';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import type { TypeTagStat } from '@/functions/database/tags';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';
import { useGlobalIsFetchingPatterns } from '@/functions/database/tags-admin/useGlobalIsFetchingPatterns';

interface RenamePanelProps {
  tagStats: TypeTagStat[];
  onRename: (from: string, to: string) => void;
  /**
   * Set by the tags table's own Rename action (seeded from TagColumns) to
   * seed this panel with the clicked row's tag and bring it into view. A
   * fresh object every time, even re-clicking the same row's tag twice in
   * a row, so the effect below always re-fires instead of silently no-op'ing
   * on an unchanged string.
   */
  prefill: { tag: string; nonce: number } | null;
}

// No separate Merge flow anymore - renaming to a name that already exists
// under the same Type now merges the two automatically (syncSatelliteTablesForOp
// detects the (tag, type) collision and repoints everything at the existing
// row instead of failing). The one thing a dedicated Merge UI could do that
// this can't is deliberately fold two DIFFERENT-typed same-named tags
// together - that's not auto-detected on purpose, since keeping a
// same-named-different-typed pair apart is what Types exist for. That's
// rare enough, and arguably against the point of Types, that it isn't worth
// a whole second flow - do it by hand in the database if it's ever needed.
export function RenamePanel({ tagStats, onRename, prefill }: RenamePanelProps) {
  const [fromTag, setFromTag] = useState('');
  const [toTag, setToTag] = useState('');
  const { isFetchingPatterns } = useGlobalIsFetchingPatterns();
  const paperRef = useRef<HTMLDivElement>(null);
  const toTagInputRef = useRef<HTMLInputElement>(null);

  // Scrolls this panel into view and focuses "new tag name" - "current tag
  // name" arrives already filled in, so that's the field the admin
  // actually needs next. A short delay before focusing rather than doing
  // it immediately: the input is already mounted (this panel never
  // unmounts), so nothing async is actually being waited on - it's purely
  // to avoid fighting the browser's own focus/scroll handling mid-scroll.
  useEffect(() => {
    if (!prefill) return;
    setFromTag(prefill.tag);
    setToTag('');
    paperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => toTagInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [prefill]);

  // Compared via normalizeTagName, not raw .trim(), on both counts: tagStats
  // entries are already canonically-cased (the tags view lowercases them),
  // so a case-different typed value would otherwise never match an existing
  // tag; and a "rename" that's only a casing/whitespace difference from the
  // original must be blocked here, not just detected downstream - it's the
  // exact input that corrupts patterns/tags_v2 consistency and wipes the
  // implied-tags graph if allowed through (found via code review).
  const fromExists = tagStats.some((t) => t.tag === normalizeTagName(fromTag));
  const toExists = tagStats.some((t) => t.tag === normalizeTagName(toTag));
  // Named separately from canSubmit below so the same-tag case can get its
  // own helper text instead of silently disabling the button with no
  // explanation - the gap this UI fix closes. syncSatelliteTablesForOp also
  // guards this same case server-side, as defense in depth, not because
  // this UI lets it through today.
  const sameTag = fromTag.trim() !== '' && toTag.trim() !== '' && normalizeTagName(fromTag) === normalizeTagName(toTag);
  const canSubmit = fromTag.trim() && toTag.trim() && !sameTag && fromExists;
  const tagOptions = useMemo(() => tagStats.map((t) => t.tag), [tagStats]);

  return (
    <Paper ref={paperRef} variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <DriveFileRenameOutlineIcon color="action" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Rename Tag
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Current tag name"
          value={fromTag}
          onChange={(e) => setFromTag(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          error={fromTag.trim() !== '' && !fromExists}
          helperText={fromTag.trim() !== '' && !fromExists ? 'Tag not found' : ' '}
        />

        <Box sx={{ pt: 1, color: 'text.secondary', fontSize: 20 }}>→</Box>

        {/* freeSolo - a rename target doesn't have to already exist, this
            is purely to help pick an existing one without mistyping it. */}
        <Autocomplete
          freeSolo
          options={tagOptions}
          value={toTag}
          onInputChange={(_, v) => setToTag(v)}
          sx={{ flex: 1 }}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={toTagInputRef}
              label="New tag name"
              size="small"
              error={sameTag}
              helperText={
                sameTag
                  ? 'Same as the current name'
                  : toExists
                    ? `A tag named "${toTag.trim()}" already exists - if it's the same Type, this merges into it instead of creating a duplicate.`
                    : ' '
              }
            />
          )}
        />

        <Button
          loading={isFetchingPatterns}
          variant="contained"
          onClick={() => onRename(fromTag.trim(), toTag.trim())}
          disabled={!canSubmit}
          startIcon={<DriveFileRenameOutlineIcon />}
          sx={{ mt: 0.25 }}
        >
          Rename
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Replaces the tag name across all patterns. Child relationships in the hierarchy are keyed on tag name - rename
        will update them automatically.
      </Typography>
    </Paper>
  );
}
