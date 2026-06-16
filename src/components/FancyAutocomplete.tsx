import React from 'react';
import { Autocomplete, Chip, TextField, Tooltip, type AutocompleteValueOrFreeSoloValueMapping } from '@mui/material';

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
};

export const FancyAutocomplete = (props: FancyAutocompleteProps) => {
  return (
    <Autocomplete
      multiple
      disableClearable
      filterSelectedOptions
      fullWidth
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
        props.onInputChange(newInputValue);
      }}
      renderValue={(value: readonly string[], getItemProps) =>
        value.map((option: string, index: number) => {
          const { key, ...itemProps } = getItemProps({ index });
          const isInherited = props.inheritedValues?.has(option) ?? false;
          const chip = (
            <Chip
              variant={isInherited ? 'outlined' : 'filled'}
              label={isInherited ? `↑ ${option}` : option}
              key={key}
              sx={isInherited ? { opacity: 0.65, fontStyle: 'italic' } : undefined}
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
      renderInput={(params) => <TextField {...params} variant="filled" label={props.label} />}
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

  // Derive full objects from stored IDs; fall back to {label: id, id} for free-solo entries
  const selectedOptions: TypeFilteredAuthor[] = (props.value ?? []).map(
    (id) => filteredData.find((opt) => opt.id === id) ?? { label: id, id },
  );

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
