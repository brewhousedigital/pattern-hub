import { Link } from '@tanstack/react-router';
import { HeaderProfileMenu } from '@/components/HeaderProfileMenu';
import { useGlobalReadyToSearch, useGlobalSearch } from '@/data/search';
import { HomepageSearch } from '@/components/HomepageSearch';
import { PRIMARY_COLOR } from '@/data/constants';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';

import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import { Box, Stack, Typography, Link as MuiLink, IconButton, useTheme, useMediaQuery } from '@mui/material';

export const Header = () => {
  const { resetSearchTerm } = useGlobalSearch();
  const { resetReadyToSearchTerm } = useGlobalReadyToSearch();

  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { handleOpenMobileSidebar } = useGlobalIsSidebarOpen();

  const handleReturnHome = () => {
    resetSearchTerm();
    resetReadyToSearchTerm();
  };

  // Mobile view
  if (!isMediumSizeAndUp) {
    return (
      <Box sx={mobileNavbarContainerStyles}>
        <Box sx={mobileNavbarStyles}>
          <Link to="/" style={logoLinkStyles} onClick={handleReturnHome}>
            <Typography component="h1" sx={logoStyles}>
              Pattern Hub
            </Typography>
          </Link>

          <HeaderProfileMenu />

          <IconButton onClick={handleOpenMobileSidebar}>
            <MenuOpenRoundedIcon />
          </IconButton>
        </Box>

        <Box sx={{ mb: 2 }}>
          <ExtraLinks />
        </Box>

        <HomepageSearch />
      </Box>
    );
  }

  return (
    <Box sx={navbarStyles}>
      <Link to="/" style={logoLinkStyles} onClick={handleReturnHome}>
        <Typography component="h1" sx={logoStyles}>
          Pattern Hub
        </Typography>
      </Link>

      <ExtraLinks />

      <HomepageSearch />

      <HeaderProfileMenu />
    </Box>
  );
};

const ExtraLinks = () => {
  return (
    <Stack direction="row" spacing={2}>
      <MuiLink component={Link} to="/" sx={subLinkStyles}>
        Home
      </MuiLink>

      <MuiLink component={Link} to="/" sx={subLinkStyles}>
        Collections
      </MuiLink>

      <MuiLink component={Link} to="/" sx={subLinkStyles}>
        Guides
      </MuiLink>

      <MuiLink component={Link} to="/" sx={subLinkStyles}>
        FAQ
      </MuiLink>
    </Stack>
  );
};

const navbarStyles = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr 1fr auto',
  gap: 4,
  alignItems: 'center',
  paddingX: 2,
  paddingY: 2,
};

const mobileNavbarContainerStyles = {
  paddingX: 2,
  mb: 2,
};

const mobileNavbarStyles = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  gap: 4,
  alignItems: 'center',
};

const logoLinkStyles = {
  textDecoration: 'none',
  color: PRIMARY_COLOR,
};

const logoStyles = {
  fontSize: 28,
  fontWeight: 700,
  textDecoration: 'none',
};

const subLinkStyles = {
  color: '#222',
  textDecoration: 'none',
  fontWeight: 500,
  '&:hover': {
    color: PRIMARY_COLOR,
    textDecoration: 'underline',
  },
  '&:focus': {
    color: PRIMARY_COLOR,
    textDecoration: 'underline',
  },
};
