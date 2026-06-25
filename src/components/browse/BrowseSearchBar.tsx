import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import { Box, IconButton, InputBase, MenuItem, Paper, Select, Typography } from '@mui/material';
import type { TypePatternResponse } from '@/functions/database/patterns';

export const BROWSE_SORT_OPTIONS = [
  { value: '-created', label: 'Last added' },
  { value: 'created', label: 'First added' },
  { value: '-design_date', label: 'Newest design' },
  { value: 'design_date', label: 'Oldest design' },
  { value: '-updated', label: 'Recently updated' },
  { value: 'updated', label: 'Oldest updated' },
  { value: 'name', label: 'A → Z' },
  { value: '-name', label: 'Z → A' },
  { value: '-pieces', label: 'Most pieces' },
  { value: 'pieces', label: 'Fewest pieces' },
  { value: '-design_height', label: 'Tallest' },
  { value: '-design_width', label: 'Widest' },
] as const;

export type BrowseSortValue = (typeof BROWSE_SORT_OPTIONS)[number]['value'];

export function applyBrowseSort(patterns: TypePatternResponse[], sort: BrowseSortValue): TypePatternResponse[] {
  const desc = sort.startsWith('-');
  const field = (desc ? sort.slice(1) : sort) as keyof TypePatternResponse;
  return [...patterns].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const aEmpty = av == null || av === '';
    const bEmpty = bv == null || bv === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const cmp =
      (av as string | number) < (bv as string | number)
        ? -1
        : (av as string | number) > (bv as string | number)
          ? 1
          : 0;
    return desc ? -cmp : cmp;
  });
}

type BrowseSearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  totalCount: number;
  resultCount: number;
  sortValue: BrowseSortValue;
  onSortChange: (v: BrowseSortValue) => void;
};

export const BrowseSearchBar = ({
  value,
  onChange,
  placeholder = 'Search…',
  totalCount,
  resultCount,
  sortValue,
  onSortChange,
}: BrowseSearchBarProps) => (
  <Box sx={{ mb: 3 }}>
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'center',
        gap: 0.75,
      }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 2,
          py: 1.75,
          flex: 1,
          maxWidth: 480,
          borderRadius: 8,
          cursor: 'text',
          '&:focus-within': { borderColor: 'primary.main' },
        }}
      >
        <SearchRoundedIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />

        <InputBase
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          sx={{ flex: 1, '& input': { p: 0, fontSize: '0.875rem' } }}
          inputProps={{ 'aria-label': 'Search patterns' }}
        />

        {value && (
          <IconButton
            size="small"
            onClick={() => onChange('')}
            aria-label="Clear search"
            sx={{ color: 'text.disabled', flexShrink: 0 }}
          >
            <ClearRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
        <SortRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        <Select
          size="small"
          value={sortValue}
          onChange={(e) => onSortChange(e.target.value as BrowseSortValue)}
          variant="standard"
          disableUnderline
          sx={{ fontSize: '0.8rem', color: 'text.secondary', '& .MuiSelect-select': { py: 0 } }}
        >
          {BROWSE_SORT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8rem' }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>

    {value && (
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
        {resultCount} of {totalCount} {resultCount === 1 ? 'result' : 'results'}
      </Typography>
    )}
  </Box>
);
