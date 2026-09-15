import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import {
  useQueryAdminTagStatsPaginated,
  getTagsImplying,
  resolveOrCreateTagV2Row,
  type TypeImpliedTagRecord,
} from '@/functions/database/tags';
import { pocketbase } from '@/functions/database/authentication-setup';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

// Manages implied_tags edges for one tag. Unlike SetParentDialog, a tag can
// have any number of "implies" targets here, so this is an add/remove chip
// list rather than a single Autocomplete value.

interface ImpliedTagsDialogProps {
  open: boolean;
  tag: TypeReadOnlyDatabaseItem | null;
  impliedTags: TypeImpliedTagRecord[];
  onClose: () => void;
  onSaved: () => void;
}

export function ImpliedTagsDialog({ open, tag, impliedTags, onClose, onSaved }: ImpliedTagsDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 400);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Reprimes on open, matching SetParentDialog/TagMetadataDialog - without
  // this, the dialog stays mounted between rows (only `open` toggles), so a
  // leftover search term or error from a previous tag's session would
  // otherwise still be showing the next time this opens for a different tag
  // (found via code review).
  useEffect(() => {
    if (open) {
      setInputValue('');
      setError(null);
    }
  }, [open, tag]);

  const { data: searchData, isFetching: searchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  const outgoing = useMemo(() => (tag ? impliedTags.filter((e) => e.tag === tag.tag) : []), [tag, impliedTags]);
  const incoming = useMemo(() => (tag ? impliedTags.filter((e) => e.implies_tag === tag.tag) : []), [tag, impliedTags]);

  // Excludes self, anything already a direct target, and anything that
  // would create a cycle - a tag that already (even transitively) implies
  // this one, since adding it as a new target here would loop back.
  const options = useMemo(() => {
    if (!tag) return [];
    const alreadyImplied = new Set(outgoing.map((e) => e.implies_tag));
    const wouldCycle = new Set(getTagsImplying(tag.tag, impliedTags));
    return (searchData?.items ?? [])
      .map((item) => String(item.tag))
      .filter((name) => name !== tag.tag && !alreadyImplied.has(name) && !wouldCycle.has(name));
  }, [tag, outgoing, impliedTags, searchData]);

  // target may be a freely-typed string with no tags_v2 row yet - e.g. "bug"
  // has never been used on a published pattern, so it can't appear in
  // `options` (drawn from the tags view, which only lists tags already in
  // use). freeSolo on the Autocomplete below lets an admin commit it anyway;
  // this creates its tags_v2 row (General type, the same default every tag
  // starts with) in the same action, so it isn't left dangling with no
  // catalog identity until some pattern eventually carries it and
  // /api/sync-tag-catalog catches up.
  //
  // A freeSolo commit also bypasses the exclusions `options` normally
  // enforces by simply not listing them (self, already-implied, cycle-
  // causing) - re-checked explicitly here so typing one directly can't slip
  // past them the way selecting one from the dropdown never could.
  const handleAdd = async (rawTarget: string) => {
    if (!tag) return;
    const target = normalizeTagName(rawTarget);
    if (!target) return;
    if (target === tag.tag) {
      setError("A tag can't imply itself.");
      return;
    }
    if (outgoing.some((e) => e.implies_tag === target)) {
      setError(`"${tag.tag}" already implies "${target}".`);
      return;
    }
    if (getTagsImplying(tag.tag, impliedTags).includes(target)) {
      setError(`"${target}" already (directly or indirectly) implies "${tag.tag}" - adding it here would create a cycle.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const targetResolved = await resolveOrCreateTagV2Row(target);
      // The source side (this dialog's own tag) uses tag.id directly, not a
      // re-resolve-by-name. `tag` comes from the admin grid, backed by
      // tag_usage - its id IS the real, stable tags_v2 id for this specific
      // row. Re-resolving by name instead - resolveOrCreateTagV2Row(tag.tag)
      // - would risk landing on a DIFFERENT row than the one this dialog is
      // actually open for, whenever two rows share a name (e.g. "autumn"
      // the season and "autumn" the artist): resolveOrCreateTagV2Row
      // prefers a General-type row when one exists, which is exactly wrong
      // if this dialog is open for a non-General one. A correctness fix,
      // not a performance one - caught while preparing to actually rename
      // a tag whose name collided with another, not from a live report.
      const sourceId = tag.id;

      await pocketbase.collection('implied_tags').create({
        tag: tag.tag,
        implies_tag: target,
        tag_ref: sourceId,
        implies_tag_ref: targetResolved.row.id,
      });
      log({
        action: 'Implied Tag Added',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { implies: { from: null, to: target } },
        metadata: targetResolved.created ? { created_new_tag: target } : {},
      });
      setInputValue('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (edge: TypeImpliedTagRecord) => {
    setSaving(true);
    setError(null);
    try {
      await pocketbase.collection('implied_tags').delete(edge.id);
      log({
        action: 'Implied Tag Removed',
        entity_type: 'Tag',
        entity_id: tag?.tag ?? '',
        entity_name: tag?.tag ?? '',
        changes: { implies: { from: edge.implies_tag, to: null } },
        metadata: {},
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeviceHubIcon color="primary" fontSize="small" />
        Implied Tags for "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          "{tag?.tag}" implies:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2, minHeight: 32 }}>
          {outgoing.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              Nothing yet.
            </Typography>
          )}
          {outgoing.map((edge) => (
            <Chip
              key={edge.id}
              label={edge.implies_tag}
              size="small"
              onDelete={() => handleRemove(edge)}
              disabled={saving}
            />
          ))}
        </Box>

        <Autocomplete
          freeSolo
          options={options}
          value={null}
          onChange={(_, v) => v && handleAdd(v)}
          inputValue={inputValue}
          onInputChange={(_, v) => setInputValue(v)}
          getOptionLabel={(option) => String(option)}
          filterOptions={(x) => x}
          loading={searchFetching}
          loadingText="Searching…"
          noOptionsText={
            debouncedSearch ? `No existing tag matches - press Enter to add "${debouncedSearch}" as a new one` : 'Type to add an implied tag'
          }
          disabled={saving}
          renderInput={(params) => (
            <TextField {...params} label="Add an implied tag" size="small" placeholder="Search tags, or type a new one…" />
          )}
        />

        {incoming.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Implied by:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {incoming.map((edge) => (
                <Chip key={edge.id} label={edge.tag} size="small" variant="outlined" />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Edit these from the other tag's own dialog.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
