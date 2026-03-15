import React from 'react';
import { useGlobalSearch, useGlobalReadyToSearch } from '@/data/search';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { IconButton, TextField } from '@mui/material';

export const HomepageSearch = () => {
  const { searchTerm, setSearchTerm, resetSearchTerm } = useGlobalSearch();
  const { resetReadyToSearchTerm } = useGlobalReadyToSearch();

  const handleClearSearch = () => {
    resetSearchTerm();
    resetReadyToSearchTerm();
  };

  return (
    <TextField
      id="homepage-search"
      fullWidth
      aria-label="Search for a Pattern"
      placeholder="Search for a pattern name, or description"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      slotProps={{
        input: {
          startAdornment: <SearchRoundedIcon />,
          endAdornment: (
            <IconButton
              type="button"
              onClick={handleClearSearch}
              sx={{ transition: 'opacity 300ms', opacity: searchTerm.length > 0 ? 1 : 0 }}
            >
              <CloseRoundedIcon />
            </IconButton>
          ),
        },
      }}
      variant="outlined"
    />
  );
};
