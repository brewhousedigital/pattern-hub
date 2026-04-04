import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

type FancyAutocompleteProps = {
  label: string;
  data: any[];
  value: string[] | undefined;
  onChange: (newValue: string[]) => void;
  inputValue: string;
  onInputChange: (newInputValue: string) => void;
  freeSolo?: boolean;
};

export const FancyAutocomplete = (props: FancyAutocompleteProps) => {
  return (
    <Autocomplete
      multiple
      filterSelectedOptions
      fullWidth
      id={`tags-filled-${props.label}`}
      options={props.data?.map((option) => option.tag)}
      freeSolo={props.freeSolo}
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
          return <Chip variant="outlined" label={option} key={key} {...itemProps} />;
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

  // Derive full objects from the stored IDs so MUI has what it needs
  const selectedOptions = filteredData.filter((option) => props?.value?.includes(option.id));

  return (
    <Autocomplete<TypeFilteredAuthor, true>
      multiple
      fullWidth
      filterSelectedOptions
      id="author-autocomplete"
      options={filteredData}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      value={selectedOptions}
      onChange={(_, newValue: TypeFilteredAuthor[]) => {
        props.onChange(newValue.map((v) => v.id));
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
      renderValue={(value: TypeFilteredAuthor[], getTagProps) =>
        value.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return <Chip variant="outlined" label={option.label} key={key} {...tagProps} />;
        })
      }
      renderInput={(params) => <TextField {...params} variant="filled" label={props.label} />}
    />
  );
};
