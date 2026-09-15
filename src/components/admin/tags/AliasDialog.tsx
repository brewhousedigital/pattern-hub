import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  useQueryAdminTagStatsPaginated,
  findTagV2Record,
  resolveOrCreateTagV2Row,
  type TypeTagAliasRecord,
} from '@/functions/database/tags';
import { pocketbase } from '@/functions/database/authentication-setup';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

// Manages this tag's own alias status: whether it's itself an alias of
// some other, root tag, and which other
// tags (if any) are aliased to it.

interface AliasDialogProps {
  open: boolean;
  tag: TypeReadOnlyDatabaseItem | null;
  aliases: TypeTagAliasRecord[];
  onClose: () => void;
  onSaved: () => void;
}

export function AliasDialog({ open, tag, aliases, onClose, onSaved }: AliasDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 400);
  // A second, separate field: a brand-new alias string that should resolve
  // TO this tag - "orca" pointing at "killer whale", say, where "orca" is
  // never expected to be tagged on a pattern directly, only searched for.
  // Deliberately a plain string, not a search-backed Autocomplete like the
  // one above - the normal case here is typing something that does NOT
  // already exist, so suggesting existing tags would be the wrong prompt.
  const [newAliasInput, setNewAliasInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Reprimes on open, matching SetParentDialog/TagMetadataDialog - see the
  // identical note on ImpliedTagsDialog.
  useEffect(() => {
    if (open) {
      setInputValue('');
      setNewAliasInput('');
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

  // Is this tag itself registered as an alias of some other tag?
  const ownAlias = useMemo(() => (tag ? aliases.find((a) => a.alias === tag.tag) : undefined), [tag, aliases]);
  // What other tags alias to this one as their root?
  const pointingHere = useMemo(() => (tag ? aliases.filter((a) => a.target_tag === tag.tag) : []), [tag, aliases]);

  // Excludes self, and anything already registered as an alias of something
  // else - resolveTagAlias only resolves one hop, so a target must always
  // be a root, non-aliased tag (this dialog's own doc comment states that
  // invariant; nothing was previously enforcing it). This also rules out a
  // 2-node cycle (X aliased to Y, then Y aliased back to X): X would only
  // be excluded here in the first place because X already has its own
  // alias row (found via code review).
  const options = useMemo(() => {
    if (!tag) return [];
    const alreadyAliased = new Set(aliases.map((a) => a.alias));
    return (searchData?.items ?? [])
      .map((item) => String(item.tag))
      .filter((name) => name !== tag.tag && !alreadyAliased.has(name));
  }, [tag, searchData, aliases]);

  const handleSetAlias = async (target: string) => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      // target_tag_ref is written alongside target_tag. alias itself never
      // gets a ref field, deliberately.
      const targetResolved = await resolveOrCreateTagV2Row(target);
      if (ownAlias) {
        await pocketbase
          .collection('tag_aliases')
          .update(ownAlias.id, { target_tag: target, target_tag_ref: targetResolved.row.id });
      } else {
        await pocketbase
          .collection('tag_aliases')
          .create({ alias: tag.tag, target_tag: target, target_tag_ref: targetResolved.row.id });
      }
      log({
        action: 'Tag Alias Set',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { alias_of: { from: ownAlias?.target_tag ?? null, to: target } },
        metadata: {},
      });
      setInputValue('');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClearAlias = async () => {
    if (!ownAlias || !tag) return;
    setSaving(true);
    setError(null);
    try {
      await pocketbase.collection('tag_aliases').delete(ownAlias.id);
      log({
        action: 'Tag Alias Cleared',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { alias_of: { from: ownAlias.target_tag, to: null } },
        metadata: {},
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Adds a brand-new alias pointing at this tag - see the newAliasInput
  // comment above for why this is a separate field from the search box.
  // "orca" never needs its own tags_v2 row or its own place in the main
  // admin grid; it exists purely as a redirect, the same way a tag_aliases
  // row already works for a spelling variant.
  const handleAddIncomingAlias = async () => {
    if (!tag) return;
    const alias = normalizeTagName(newAliasInput);
    if (!alias) return;
    if (alias === tag.tag) {
      setError("A tag can't be an alias of itself.");
      return;
    }
    const asAlias = aliases.find((a) => a.alias === alias);
    if (asAlias) {
      setError(`"${alias}" is already an alias of "${asAlias.target_tag}". Remove that first if you want to repoint it here.`);
      return;
    }
    if (aliases.some((a) => a.target_tag === alias)) {
      // Alias resolution is single-hop by design (see resolveTagAlias in
      // src/functions/database/tags.ts) - chaining through "alias" here
      // would silently break resolution for whatever already points at it.
      setError(`"${alias}" already has aliases of its own pointing at it - aliasing it to "${tag.tag}" would chain two hops, which this system doesn't resolve.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // An alias must never shadow a tag with its own real identity - if
      // "orca" already exists as its own tags_v2 row, aliasing it away
      // here would silently hide that, and any pattern already tagged
      // "orca" directly would drift out of sync with search (which would
      // now resolve "orca" to this tag instead). Merging is the right tool
      // for folding one real, in-use tag into another - point the admin
      // there instead of guessing.
      const existingTagRow = await findTagV2Record(alias);
      if (existingTagRow) {
        setError(`"${alias}" already exists as its own tag. Use Rename instead if you want to fold it into "${tag.tag}" - renaming to a name that already exists merges the two.`);
        setSaving(false);
        return;
      }

      // target_tag_ref is this dialog's own tag (the alias's target) -
      // alias itself stays ref-less, deliberately (an alias like "orca" is
      // allowed to have no tags_v2 row of its own). Uses tag.id directly,
      // not a re-resolve-by-name - same reasoning as
      // ImpliedTagsDialog.handleAdd's own sourceId: `tag` comes from the
      // admin grid (tag_usage-backed), whose id is already the real,
      // specific tags_v2 id for this row - re-resolving by name could land
      // on a different row once two rows can share a name.
      const targetId = tag.id;

      await pocketbase.collection('tag_aliases').create({ alias, target_tag: tag.tag, target_tag_ref: targetId });
      log({
        action: 'Tag Alias Added',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { new_alias: { from: null, to: alias } },
        metadata: {},
      });
      setNewAliasInput('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Removes one alias that points at this tag. This is the only place an
  // alias like "orca" can be removed from at all, since it may have no
  // tags_v2 row and so no row of its own in the main admin grid to open a
  // dialog from.
  const handleRemoveIncomingAlias = async (edge: TypeTagAliasRecord) => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      await pocketbase.collection('tag_aliases').delete(edge.id);
      log({
        action: 'Tag Alias Removed',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { removed_alias: { from: edge.alias, to: null } },
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
        <SwapHorizIcon color="primary" fontSize="small" />
        Alias for "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {ownAlias && (
          <Alert severity="info" sx={{ mb: 2 }}>
            "{tag?.tag}" is currently an alias of <strong>{ownAlias.target_tag}</strong>. Setting a new root below
            replaces this; anyone who types "{tag?.tag}" resolves to whatever root you set here.
          </Alert>
        )}

        <Box sx={{ py: 2 }}>
          <Autocomplete
            options={options}
            value={null}
            onChange={(_, v) => v && handleSetAlias(v)}
            inputValue={inputValue}
            onInputChange={(_, v) => setInputValue(v)}
            getOptionLabel={(option) => String(option)}
            filterOptions={(x) => x}
            loading={searchFetching}
            loadingText="Searching…"
            noOptionsText={debouncedSearch ? 'No tags found' : 'Type to search for a root tag'}
            disabled={saving}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ownAlias ? 'Change the root tag' : 'Make this tag an alias of…'}
                size="small"
                placeholder="Search tags…"
              />
            )}
          />
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Aliases that resolve to "{tag?.tag}":
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5, minHeight: 32 }}>
          {pointingHere.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              None yet.
            </Typography>
          )}
          {pointingHere.map((a) => (
            <Chip
              key={a.id}
              label={a.alias}
              size="small"
              variant="outlined"
              onDelete={() => handleRemoveIncomingAlias(a)}
              disabled={saving}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Add an alias that resolves here"
            placeholder='e.g. "orca" - does not need to exist as its own tag'
            size="small"
            fullWidth
            value={newAliasInput}
            disabled={saving}
            onChange={(e) => setNewAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddIncomingAlias();
              }
            }}
          />
          <Button onClick={handleAddIncomingAlias} disabled={saving || !newAliasInput.trim()} sx={{ flexShrink: 0 }}>
            Add
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        {ownAlias && (
          <Button color="warning" onClick={handleClearAlias} disabled={saving}>
            Clear Alias
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
