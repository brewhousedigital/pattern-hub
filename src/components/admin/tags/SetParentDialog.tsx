import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import {
  useQueryAdminTagStatsPaginated,
  getDescendants,
  setTagParent,
  clearTagParent,
  type TypeTagHierarchyRecord,
} from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

interface SetParentDialogProps {
  open: boolean;
  /** The tag whose parent is being set (from the tags view). */
  tag: TypeReadOnlyDatabaseItem | null;
  /** Current hierarchy records - used for descendants guard and current-parent lookup. */
  hierarchy: TypeTagHierarchyRecord[];
  onClose: () => void;
  onSaved: () => void;
}

export function SetParentDialog({ open, tag, hierarchy, onClose, onSaved }: SetParentDialogProps) {
  const [selectedParent, setSelectedParent] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 400);
  const { log } = useAdminLogger();

  // Current parent from the hierarchy table
  const currentParent = useMemo(
    () => (tag ? (hierarchy.find((h) => h.tag === tag.tag)?.parent_tag ?? undefined) : undefined),
    [tag, hierarchy],
  );

  // Fetch tags matching the search text (server-side, no 500-item cap)
  const { data: searchData, isFetching: searchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  // Options: search results minus self + descendants (circular-ref guard)
  const options = useMemo(() => {
    if (!tag) return [];
    const descendants = new Set(getDescendants(tag.tag, hierarchy));
    return (searchData?.items ?? [])
      .map((item) => String(item.tag))
      .filter((name) => name !== tag.tag && !descendants.has(name));
  }, [tag, searchData, hierarchy]);

  // Pre-fill with current parent when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedParent(currentParent);
      setInputValue(currentParent ?? '');
      setError(null);
    }
  }, [open, currentParent]);

  const handleSave = async () => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      if (selectedParent) {
        await setTagParent(tag.tag, selectedParent);
        log({
          action: 'Tag Parent Set',
          entity_type: 'Tag',
          entity_id: tag.tag,
          entity_name: tag.tag,
          changes: { parent: { from: currentParent ?? null, to: selectedParent } },
          metadata: {},
        });
      } else {
        await clearTagParent(tag.tag);
        log({
          action: 'Tag Parent Cleared',
          entity_type: 'Tag',
          entity_id: tag.tag,
          entity_name: tag.tag,
          changes: { parent: { from: currentParent ?? null, to: null } },
          metadata: {},
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountTreeOutlinedIcon color="primary" fontSize="small" />
        Set Parent for "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {currentParent && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Current parent: <strong>{currentParent}</strong>
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ py: 2 }}>
          <Autocomplete
            options={options}
            disableClearable
            value={selectedParent}
            onChange={(_, v) => setSelectedParent(v)}
            inputValue={inputValue}
            onInputChange={(_, v) => setInputValue(v)}
            getOptionLabel={(option) => String(option)}
            filterOptions={(x) => x}
            loading={searchFetching}
            loadingText="Searching…"
            noOptionsText={debouncedSearch ? 'No tags found' : 'Type to search tags'}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Parent tag (leave blank to make this a root tag)"
                size="small"
                placeholder="Search tags…"
              />
            )}
            sx={{ mt: 0.5 }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Descendants of "{tag?.tag}" are excluded to prevent circular references.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {currentParent && (
          <Button
            color="warning"
            onClick={async () => {
              setSelectedParent(undefined);
              setSaving(true);
              setError(null);
              try {
                await clearTagParent(tag!.tag);
                log({
                  action: 'Tag Parent Cleared',
                  entity_type: 'Tag',
                  entity_id: tag!.tag,
                  entity_name: tag!.tag,
                  changes: { parent: { from: currentParent ?? null, to: null } },
                  metadata: {},
                });
                onSaved();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            Clear Parent
          </Button>
        )}
        <Button onClick={handleSave} variant="contained" loading={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
