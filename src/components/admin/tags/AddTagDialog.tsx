import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import { pocketbase } from '@/functions/database/authentication-setup';
import {
  escapeTagFilterValue,
  uniqueSlugFor,
  type TypeTagV2Record,
  type TypeTagTypeRecord,
} from '@/functions/database/tags';
import { useQueryAdminUsersPaginated, useQueryGetUserById } from '@/functions/database/users';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';
import { slugifyTag } from '@/functions/utilities/slugify-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';

// Creates a standalone tags_v2 row - a tag with a name, Type, and
// Definition, but no pattern attached yet. TagMetadataDialog can also
// create a missing tags_v2 row, but only for a name that already came from
// a tag_usage grid row (a tag at least one pattern already carries). This
// dialog is the only entry point for a tag with zero patterns, so it
// collects the name itself instead of receiving one.
//
// A tag created here has zero patterns, so it will not appear in the "All
// Tags" grid above: that grid reads the tag_usage view, which is an inner
// join from patterns.tag_refs to tags_v2 (see useQueryAdminTagStatsPaginated
// in src/functions/database/tags.ts) and only lists a tag at least one
// pattern carries. The row is still real the moment it is created - every
// other tags_v2 reader (search dropdowns, the tag graph, pattern tag entry)
// can find and use it right away.

interface AddTagDialogProps {
  open: boolean;
  tagTypes: TypeTagTypeRecord[];
  onClose: () => void;
  onSaved: () => void;
}

export function AddTagDialog({ open, tagTypes, onClose, onSaved }: AddTagDialogProps) {
  const [tagName, setTagName] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [definition, setDefinition] = useState('');
  const [disambiguationNote, setDisambiguationNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Account linking, shown only when Type is "Author" - same admin-only
  // linking tool TagMetadataDialog offers when editing an existing tag.
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const debouncedUserSearch = useDebounce(userSearchInput, 400);
  const { data: userSearchData, isFetching: userSearchFetching } = useQueryAdminUsersPaginated({
    page: 0,
    pageSize: 20,
    search: debouncedUserSearch,
    verifiedFilter: 'all',
    bannedFilter: 'all',
  });
  const { data: linkedUserDetail } = useQueryGetUserById(selectedUserId || undefined);

  const selectedType = tagTypes.find((t) => t.id === selectedTypeId) ?? null;
  const isAuthorType = selectedType?.name === 'Author';
  const selectedUserOption =
    (userSearchData?.items ?? []).find((u) => u.id === selectedUserId) ??
    (linkedUserDetail && linkedUserDetail.id === selectedUserId ? linkedUserDetail : null);

  // Reset to a blank form every time the dialog opens - unlike
  // TagMetadataDialog there is no existingRecord to prefill from.
  useEffect(() => {
    if (open) {
      setTagName('');
      setSelectedTypeId('');
      setDefinition('');
      setDisambiguationNote('');
      setSelectedUserId('');
      setUserSearchInput('');
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    const normalized = normalizeTagName(tagName);
    if (!normalized) {
      setError('Enter a tag name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Uniqueness is on (tag, type), not tag alone - the same name can
      // exist once per type (e.g. "autumn" as both a General and an Author
      // tag). Match that scoping here, the same way
      // resolveOrCreateTagV2Row/TagMetadataDialog do, instead of a bare
      // name lookup that would block a legitimate second type.
      const conflict = await pocketbase
        .collection('tags_v2')
        .getFirstListItem<TypeTagV2Record>(
          `tag = "${escapeTagFilterValue(normalized)}" && type = "${escapeTagFilterValue(selectedTypeId)}"`,
        )
        .catch(() => null);
      if (conflict) {
        setError(`A ${selectedType?.name ?? 'General'} tag named "${normalized}" already exists.`);
        setSaving(false);
        return;
      }

      if (isAuthorType && selectedUserId) {
        const userConflict = await pocketbase
          .collection('tags_v2')
          .getFirstListItem<TypeTagV2Record>(`linked_user = "${escapeTagFilterValue(selectedUserId)}"`)
          .catch(() => null);
        if (userConflict) {
          setError(`This account is already linked to the tag "${userConflict.tag}". Unlink it there first.`);
          setSaving(false);
          return;
        }
      }

      const baseSlug = slugifyTag(normalized);
      if (!baseSlug) {
        setError(`"${normalized}" has no letters or numbers. Enter a different name.`);
        setSaving(false);
        return;
      }
      const slug = await uniqueSlugFor(baseSlug, '');

      const payload = {
        tag: normalized,
        slug,
        previous_slugs: [],
        type: selectedTypeId,
        definition,
        disambiguation_note: disambiguationNote,
        linked_user: isAuthorType ? selectedUserId : '',
      };
      await pocketbase.collection('tags_v2').create(payload);

      log({
        action: 'Tag Created',
        entity_type: 'Tag',
        entity_id: normalized,
        entity_name: normalized,
        changes: {
          tag: { from: null, to: normalized },
          type: { from: null, to: selectedTypeId || null },
          definition: { from: null, to: definition },
          disambiguation_note: { from: null, to: disambiguationNote },
          linked_user: { from: null, to: payload.linked_user || null },
        },
        metadata: { created_standalone: true },
      });
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
        <AddCircleOutlineIcon color="primary" fontSize="small" />
        Add Tag
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          This tag will have no patterns yet. It will not appear in the list below until a pattern uses it. You can
          still find and select it anywhere tags are used.
        </Alert>

        <Box sx={{ py: 1 }}>
          <TextField
            label="Tag name"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            required
          />
        </Box>

        <Box sx={{ py: 1 }}>
          <Autocomplete
            options={tagTypes}
            value={selectedType}
            onChange={(_, v) => setSelectedTypeId(v?.id ?? '')}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Type" size="small" placeholder="General (default - leave blank)" />
            )}
          />
        </Box>

        {isAuthorType && (
          <Box sx={{ py: 1 }}>
            <Autocomplete
              options={userSearchData?.items ?? []}
              value={selectedUserOption}
              onChange={(_, v) => setSelectedUserId(v?.id ?? '')}
              getOptionLabel={(option) => option.name || option.email || option.id}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={userSearchFetching}
              filterOptions={(x) => x}
              inputValue={userSearchInput}
              onInputChange={(_, v) => setUserSearchInput(v)}
              noOptionsText={userSearchInput ? 'No accounts found' : 'Type to search accounts'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Linked account"
                  size="small"
                  placeholder="Search by name or email"
                  helperText="Sends this author's page to the account's real profile. Leave blank for an author with no account."
                />
              )}
            />
          </Box>
        )}

        <Box sx={{ py: 1 }}>
          <TextField
            label="Disambiguation note"
            placeholder={'e.g. "the center of a flower" for a tag like eye (flower)'}
            value={disambiguationNote}
            onChange={(e) => setDisambiguationNote(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>

        <Box sx={{ py: 1 }}>
          <GenericMarkdownEditor
            content={definition}
            setContent={setDefinition}
            label="Definition"
            minRows={6}
            maxRows={20}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" loading={saving} disabled={!tagName.trim()}>
          Create Tag
        </Button>
      </DialogActions>
    </Dialog>
  );
}
