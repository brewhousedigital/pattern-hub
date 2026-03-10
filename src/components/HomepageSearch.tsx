import React from 'react';
import { useGlobalSearch, useGlobalReadyToSearch } from '@/data/search';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { BORDER_CSS } from '@/data/constants';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import { Box, Container, IconButton, Stack, TextField, useMediaQuery, useTheme } from '@mui/material';

export const HomepageSearch = () => {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { searchTerm, setSearchTerm, resetSearchTerm } = useGlobalSearch();
  const { resetReadyToSearchTerm } = useGlobalReadyToSearch();

  const { handleOpenMobileSidebar } = useGlobalIsSidebarOpen();

  const handleClearSearch = () => {
    resetSearchTerm();
    resetReadyToSearchTerm();
  };

  return (
    <Box sx={{ borderBottom: BORDER_CSS, pb: 3.75 }}>
      <Container>
        <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
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

          {!isMediumSizeAndUp && (
            <IconButton onClick={handleOpenMobileSidebar}>
              <MenuOpenRoundedIcon />
            </IconButton>
          )}
        </Stack>
      </Container>
    </Box>
  );
};
