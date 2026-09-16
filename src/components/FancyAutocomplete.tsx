import React from 'react';
import { useQueries } from '@tanstack/react-query';
import { Autocomplete, Chip, TextField, Tooltip, type AutocompleteValueOrFreeSoloValueMapping } from '@mui/material';
import { getUserByIdOptions } from '@/functions/database/users';

type FancyAutocompleteProps = {
  label: string;
  data: any[];
  value: string[] | undefined;
  onChange: (newValue: string[]) => void;
  inputValue: string;
  onInputChange: (newInputValue: string) => void;
  freeSolo?: boolean;
  /**
   * Set of tag names that were auto-added as ancestors of a primary tag.
   * These chips are rendered as outlined + dimmed with a ↑ prefix to indicate
   * they are inherited and not directly chosen.
   */
  inheritedValues?: Set<string>;
  /** Shows a loading spinner inside the dropdown while fetching. */
  loading?: boolean;
  /**
   * Disables MUI's built-in client-side filter and sets context-aware
   * noOptionsText. Use when options come from a server-side search query.
   */
  serverSide?: boolean;
  disabled?: boolean;
  /**
   * Given a selected chip's value, returns a border color to render around
   * it (e.g. its tags_v2 Type's color), or undefined for the default,
   * uncolored border. Generic like `inheritedValues` above - this component
   * stays domain-agnostic, so the caller (PatternTagsField.tsx) owns
   * resolving a tag name to its Type's color.
   */
  getChipBorderColor?: (option: string) => string | undefined;
};

// Collapses internal whitespace too, not just casing - matches the
// canonical tag-normalization rule (normalizeTagName in
// src/functions/utilities/normalize-tag.ts) so this duplicate check catches
// "Sea Creature" vs "Sea  Creature" (doubled space) as the same value, not
// two distinct ones that both end up identical once saved. Kept as its own
// local copy rather than importing normalizeTagName directly - this is a
// generic Autocomplete component, not tag-specific, and shouldn't depend on
// a tag-domain database utility for what is, for this component, just a
// duplicate-detection rule.
const normalizeTag = (tag: string) => tag.trim().toLowerCase().replace(/\s+/g, ' ');

export const FancyAutocomplete = (props: FancyAutocompleteProps) => {
  // Set (not cleared) when the user tries to commit a freeSolo tag that
  // already exists (case-insensitively) in `value`. Shown as helper text and
  // auto-dismissed so it doesn't linger once the user moves on.
  const [duplicateTag, setDuplicateTag] = React.useState<string | null>(null);
  const duplicateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    return () => clearTimeout(duplicateTimeoutRef.current);
  }, []);

  const clearDuplicateWarning = () => {
    clearTimeout(duplicateTimeoutRef.current);
    setDuplicateTag(null);
  };

  return (
    <Autocomplete
      multiple
      disableClearable
      filterSelectedOptions
      fullWidth
      disabled={props.disabled}
      id={`tags-filled-${props.label}`}
      options={props.data?.map((option) => option.tag)}
      getOptionLabel={(option) => String(option)}
      freeSolo={props.freeSolo}
      filterOptions={props.serverSide ? (x) => x : undefined}
      loading={props.loading}
      loadingText="Searching…"
      noOptionsText={props.serverSide ? (props.inputValue ? 'No tags found' : 'Type to search tags') : undefined}
      value={props.value}
      onChange={(event: any, newValue: string[]) => {
        clearDuplicateWarning();
        props.onChange(newValue);
      }}
      slotProps={{
        popper: {
          placement: 'top',
          popperOptions: {
            modifiers: [
              {
                name: 'flip',
                enabled: false,
              },
            ],
          },
        },
      }}
      inputValue={props.inputValue}
      onInputChange={(event, newInputValue) => {
        if (duplicateTag !== null) clearDuplicateWarning();
        props.onInputChange(newInputValue);
      }}
      renderValue={(value: readonly string[], getItemProps) =>
        value.map((option: string, index: number) => {
          const { key, ...itemProps } = getItemProps({ index });
          const isInherited = props.inheritedValues?.has(option) ?? false;
          const borderColor = props.getChipBorderColor?.(option);
          const chip = (
            <Chip
              variant={isInherited ? 'outlined' : 'filled'}
              label={isInherited ? `↑ ${option}` : option}
              key={key}
              sx={{
                ...(isInherited ? { opacity: 0.65, fontStyle: 'italic' } : undefined),
                ...(borderColor ? { border: '2px solid', borderColor } : undefined),
              }}
              {...itemProps}
            />
          );
          return isInherited ? (
            <Tooltip key={key} title={`Auto-added parent tag`} placement="top">
              {chip}
            </Tooltip>
          ) : (
            chip
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          variant="filled"
          label={props.label}
          error={duplicateTag !== null}
          helperText={duplicateTag ? `"${duplicateTag}" is already added` : undefined}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps?.htmlInput,
              onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key !== 'Enter') return;
                const typed = props.inputValue.trim();
                const isDuplicate =
                  typed !== '' && (props.value ?? []).some((tag) => normalizeTag(tag) === normalizeTag(typed));
                if (!isDuplicate) return;
                // MUI's own root-level Enter handler (attached via getRootProps,
                // not on this input) only dedupes freeSolo entries on exact
                // string equality - "Dog" would slip through as a second tag
                // alongside "dog". Stop it from ever seeing this keydown so our
                // case-insensitive check is the one that decides.
                event.preventDefault();
                event.stopPropagation();
                setDuplicateTag(typed);
                clearTimeout(duplicateTimeoutRef.current);
                duplicateTimeoutRef.current = setTimeout(() => setDuplicateTag(null), 3000);
              },
            },
          }}
        />
      )}
    />
  );
};

type FancyAutocompleteAuthorsProps = {
  label: string;
  data: any[];
  value: string[] | undefined;
  onChange: (newValue: string[]) => void;
  inputValue: string;
  onInputChange: (newInputValue: string) => void;
  serverSide?: boolean;
  loading?: boolean;
  freeSolo?: boolean;
};

type TypeFilteredAuthor = {
  label: string;
  id: string;
};

export const FancyAutocompleteAuthors = (props: FancyAutocompleteAuthorsProps) => {
  const filteredData: TypeFilteredAuthor[] =
    props?.data?.map((item) => ({
      label: item.name,
      id: item.id,
    })) || [];

  // filteredData only ever reflects the current search box - the live query
  // term, or an arbitrary "first 25 users alphabetically" page when it's
  // empty - so an already-assigned author whose name doesn't happen to be in
  // that page (the normal case right when the modal opens, or right after
  // picking one clears the search box) had no name to show and fell back to
  // its bare id. Resolving every selected id directly by id fixes that
  // independent of whatever's currently typed. getUserByIdOptions uses
  // getOne (the users collection's View rule, public) rather than getList
  // (its List rule, admin-only) - see authors.ts's useQueryResolveAuthorUserIds
  // for the same List-rule constraint biting a different, search-based query.
  const selectedAuthorQueries = useQueries({ queries: (props.value ?? []).map((id) => getUserByIdOptions(id)) });
  const resolvedNameById = new Map((props.value ?? []).map((id, i) => [id, selectedAuthorQueries[i]?.data?.name]));

  // Derive full objects from stored IDs; fall back to the direct-by-id fetch
  // above, and only to {label: id, id} for a genuine freeSolo entry with no
  // account behind it (or while that fetch is still in flight).
  const selectedOptions: TypeFilteredAuthor[] = (props.value ?? []).map((id) => {
    const fromSearch = filteredData.find((opt) => opt.id === id);
    if (fromSearch) return fromSearch;
    return { label: resolvedNameById.get(id) ?? id, id };
  });

  return (
    <Autocomplete
      multiple
      fullWidth
      disableClearable
      filterSelectedOptions
      freeSolo={props.freeSolo}
      id="author-autocomplete"
      options={filteredData}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      isOptionEqualToValue={(option, value) =>
        typeof option !== 'string' && typeof value !== 'string' && option.id === value.id
      }
      filterOptions={props.serverSide ? (x) => x : undefined}
      loading={props.loading}
      loadingText="Searching…"
      noOptionsText={props.serverSide ? (props.inputValue ? 'No authors found' : 'Type to search authors') : undefined}
      value={selectedOptions}
      onChange={(_, newValue: (TypeFilteredAuthor | string)[]) => {
        props.onChange(newValue.map((v) => (typeof v === 'string' ? v : v.id)));
      }}
      slotProps={{
        popper: {
          placement: 'top',
          popperOptions: {
            modifiers: [{ name: 'flip', enabled: false }],
          },
        },
      }}
      inputValue={props.inputValue}
      onInputChange={(_, newInputValue) => {
        props.onInputChange(newInputValue);
      }}
      renderValue={(value, getItemProps) =>
        value.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          const label = typeof option === 'string' ? option : option.label;
          return <Chip variant="outlined" label={label} key={key} {...itemProps} />;
        })
      }
      renderInput={(params) => <TextField {...params} variant="filled" label={props.label} />}
    />
  );
};
