import { useEffect, useState } from 'react';
import type { NumericOperator } from '@/functions/utilities/search-v2';

import CloseIcon from '@mui/icons-material/Close';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

type FieldOption = {
  // Doubles as the raw search-bar prefix this field commits as (e.g.
  // "height_in>12.7") - must match one of the prefixes parseRawInput() in
  // search-v2.ts understands. "in"/"cm" compare against the precomputed
  // size_width_in/size_height_in/size_width_cm/size_height_cm columns, so
  // they're correct regardless of what unit the pattern was authored in.
  value: 'parts' | 'height_in' | 'width_in' | 'height_cm' | 'width_cm';
  label: string;
};

// Start small - more fields (filesize, pieces breakdowns, etc.) can be added
// here later without touching the rest of the modal.
const FIELD_OPTIONS: FieldOption[] = [
  { value: 'parts', label: 'Parts' },
  { value: 'height_in', label: 'Height (in)' },
  { value: 'width_in', label: 'Width (in)' },
  { value: 'height_cm', label: 'Height (cm)' },
  { value: 'width_cm', label: 'Width (cm)' },
];

const OPERATORS: NumericOperator[] = ['>', '=', '<'];

type AdvancedSearchModalProps = {
  open: boolean;
  onClose: () => void;
  /** Same shape addRawInput() already accepts, e.g. "width>12.7". */
  onApply: (rawInput: string) => void;
};

/**
 * A guided builder for the parts/width/height filters that already work when
 * typed directly into the search bar (see parseRawInput in search-v2.ts).
 * Selecting a field + operator + value and hitting Search just composes the
 * equivalent raw string and hands it to addRawInput - no new search
 * capability is introduced here.
 */
export const AdvancedSearchModal = ({ open, onClose, onApply }: AdvancedSearchModalProps) => {
  const [fieldValue, setFieldValue] = useState(FIELD_OPTIONS[0].value);
  const [operator, setOperator] = useState<NumericOperator>('>');
  const [value, setValue] = useState('');

  // Reset to a clean slate every time the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setFieldValue(FIELD_OPTIONS[0].value);
      setOperator('>');
      setValue('');
    }
  }, [open]);

  const numericValue = parseFloat(value);
  const isValid = value.trim() !== '' && isFinite(numericValue) && numericValue >= 0;

  function handleSearch() {
    if (!isValid) return;
    onApply(`${fieldValue}${operator}${numericValue}`);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' } },
        paper: { sx: { borderRadius: 4 } },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 500 }}>
          Advanced Search
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Build a parts, width, or height filter and add it to the search bar as a chip.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              label="Field"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value as FieldOption['value'])}
            >
              {FIELD_OPTIONS.map((f) => (
                <MenuItem key={f.value} value={f.value}>
                  {f.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              label="Operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as NumericOperator)}
              sx={{ '& .MuiSelect-select': { textAlign: 'center' } }}
            >
              {OPERATORS.map((op) => (
                <MenuItem key={op} value={op} sx={{ justifyContent: 'center' }}>
                  {op}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid) handleSearch();
              }}
              slotProps={{ htmlInput: { min: 0, step: 'any', inputMode: 'decimal' } }}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          component="a"
          href="/wiki/site-functions/search#special-tags"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            fontSize: '0.8rem',
            color: 'primary.main',
            fontWeight: 500,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Learn about Advanced Tags
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSearch} disabled={!isValid}>
            Search
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
