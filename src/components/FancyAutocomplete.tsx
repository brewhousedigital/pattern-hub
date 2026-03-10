import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

type FancyAutocompleteProps = {
  label: string;
  data: any[];
  value: string[] | undefined;
  onChange: (newValue: string[]) => void;
  inputValue: string;
  onInputChange: (newInputValue: string) => void;
};

export const FancyAutocomplete = (props: FancyAutocompleteProps) => {
  return (
    <Autocomplete
      multiple
      fullWidth
      id="tags-filled"
      options={props.data?.map((option) => option.tag)}
      freeSolo
      value={props.value}
      onChange={(event: any, newValue: string[]) => {
        props.onChange(newValue);
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
