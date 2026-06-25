import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';

type BrowseSearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  totalCount: number;
  resultCount: number;
};

export const BrowseSearchBar = ({
  value,
  onChange,
  placeholder = 'Search…',
  totalCount,
  resultCount,
}: BrowseSearchBarProps) => (
  <Box sx={{ mb: 3 }}>
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="small"
      fullWidth
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange('')} edge="end" aria-label="Clear search">
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{ maxWidth: 480 }}
    />
    {value && (
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
        {resultCount} of {totalCount} {resultCount === 1 ? 'result' : 'results'}
      </Typography>
    )}
  </Box>
);
