import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import { Box, IconButton, InputBase, MenuItem, Paper, Select, Typography } from '@mui/material';
import { BROWSE_SORT_OPTIONS, type BrowseSortValue } from './browse-sort';

type BrowseSearchBarProps = {
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  totalCount: number;
  resultCount: number;
  sortValue: BrowseSortValue;
  onSortChange: (v: BrowseSortValue) => void;
};

export const BrowseSearchBar = ({
  title,
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
        {resultCount} of {totalCount} {resultCount === 1 ? 'result' : 'results'} in {title}
      </Typography>
    )}
  </Box>
);
