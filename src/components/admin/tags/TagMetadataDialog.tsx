import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { pocketbase } from '@/functions/database/authentication-setup';
import {
  escapeTagFilterValue,
  uniqueSlugFor,
  type TypeTagV2Record,
  type TypeTagTypeRecord,
} from '@/functions/database/tags';
import { useQueryAdminUsersPaginated, useQueryGetUserById } from '@/functions/database/users';
import { slugifyTag } from '@/functions/utilities/slugify-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

// Edits a tag's tags_v2 row (Type, Definition, disambiguation note). Most
// tags already have a row by the time an admin opens this, via the
// backfill or the /api/sync-tag-catalog cron - but a just-typed tag that
// hasn't synced yet won't, so this creates one on first save rather than
// assuming it exists.

interface TagMetadataDialogProps {
  open: boolean;
  /** The tag being edited (from the tags view). */
  tag: TypeReadOnlyDatabaseItem | null;
  /** This tag's existing tags_v2 row, if it has one yet. */
  existingRecord: TypeTagV2Record | null;
  tagTypes: TypeTagTypeRecord[];
  onClose: () => void;
  onSaved: () => void;
}

export function TagMetadataDialog({ open, tag, existingRecord, tagTypes, onClose, onSaved }: TagMetadataDialogProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [definition, setDefinition] = useState('');
  const [disambiguationNote, setDisambiguationNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Account linking, shown only when this tag's Type is "Author" - an
  // admin-only linking tool, instead of a self-service "claim my author
  // credit" flow.
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
  // Resolves the currently-linked account's own name/email even when it
  // isn't in the current search result page - e.g. right after the dialog
  // opens, before the admin has typed a search. Mirrors the same
  // fallback-to-a-dedicated-fetch shape FancyAutocompleteAuthors already
  // uses for its own preselected values.
  const { data: linkedUserDetail } = useQueryGetUserById(selectedUserId || undefined);

  const selectedType = tagTypes.find((t) => t.id === selectedTypeId) ?? null;
  const isAuthorType = selectedType?.name === 'Author';
  const selectedUserOption =
    (userSearchData?.items ?? []).find((u) => u.id === selectedUserId) ??
    (linkedUserDetail && linkedUserDetail.id === selectedUserId ? linkedUserDetail : null);

  // Pre-fill from the existing row (if any) whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedTypeId(existingRecord?.type ?? '');
      setDefinition(existingRecord?.definition ?? '');
      setDisambiguationNote(existingRecord?.disambiguation_note ?? '');
      setSelectedUserId(existingRecord?.linked_user ?? '');
      setUserSearchInput('');
      setError(null);
    }
  }, [open, existingRecord]);

  const handleSave = async () => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      // At most one tag may carry a given user's id - enforced here, not as
      // a database constraint. A stale link left over from switching this
      // tag's Type away from Author and back is cleared below by the
      // isAuthorType ? ... : '' fallback, same as it always was for a
      // brand-new pick.
      if (isAuthorType && selectedUserId) {
        const conflict = await pocketbase
          .collection('tags_v2')
          .getFirstListItem<TypeTagV2Record>(
            `linked_user = "${escapeTagFilterValue(selectedUserId)}" && id != "${escapeTagFilterValue(existingRecord?.id ?? '')}"`,
          )
          .catch(() => null);
        if (conflict) {
          setError(`This account is already linked to the tag "${conflict.tag}". Unlink it there first.`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        type: selectedTypeId,
        definition,
        disambiguation_note: disambiguationNote,
        linked_user: isAuthorType ? selectedUserId : '',
      };

      if (existingRecord) {
        await pocketbase.collection('tags_v2').update(existingRecord.id, payload);
      } else {
        const baseSlug = slugifyTag(tag.tag);
        if (!baseSlug) {
          // Matches the "skip and flag for manual review" handling the
          // backfill script and /api/sync-tag-catalog both use for this
          // same edge case, instead of the un-checked raw-string fallback
          // this used to have here (found via code review) - a tag made
          // entirely of punctuation has no safe, uniqueness-checked slug to
          // give it, so
          // this stops short of creating a row rather than guessing one.
          setError(
            `"${tag.tag}" has no letters or numbers, so it can't be given a URL-safe slug. This tag needs to be renamed before it can have a Type or Definition.`,
          );
          setSaving(false);
          return;
        }
        // '' as excludeId is safe here - no real record ever has an empty
        // id, so `id != ""` (inside isSlugTaken) matches every existing row,
        // exactly the "don't exclude anything" behavior a brand-new record
        // needs.
        const slug = await uniqueSlugFor(baseSlug, '');
        await pocketbase.collection('tags_v2').create({ tag: tag.tag, slug, previous_slugs: [], ...payload });
      }

      log({
        action: existingRecord ? 'Tag Metadata Updated' : 'Tag Metadata Created',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: {
          type: { from: existingRecord?.type || null, to: selectedTypeId || null },
          definition: { from: existingRecord?.definition ?? '', to: definition },
          disambiguation_note: { from: existingRecord?.disambiguation_note ?? '', to: disambiguationNote },
          linked_user: { from: existingRecord?.linked_user || null, to: payload.linked_user || null },
        },
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditNoteIcon color="primary" fontSize="small" />
        Edit "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ py: 1 }}>
          <Autocomplete
            options={tagTypes}
            value={tagTypes.find((t) => t.id === selectedTypeId) ?? null}
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
        <Button onClick={handleSave} variant="contained" loading={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
