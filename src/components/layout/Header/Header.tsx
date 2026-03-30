import { Link } from '@tanstack/react-router';
import { HeaderProfileMenu } from '@/components/layout/HeaderProfileMenu.tsx';
import { useGlobalReadyToSearch, useGlobalSearch } from '@/data/search';
import { PRIMARY_COLOR } from '@/data/constants';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { useGlobalIsViewOpen } from '@/data/view';
import { subLinkStyles } from '@/components/layout/Header/sublink-styles';
import { HomepageSearchV2 } from '@/components/layout/HomepageSearchV2';

import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import { Box, Stack, Typography, Link as MuiLink, IconButton, useTheme, useMediaQuery } from '@mui/material';

export const Header = () => {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { handleOpenMobileSidebar } = useGlobalIsSidebarOpen();
  // Mobile view
  if (!isMediumSizeAndUp) {
    return (
      <Box sx={mobileNavbarContainerStyles}>
        <Box sx={mobileNavbarStyles}>
          <Logo />

          <HeaderProfileMenu />

          <IconButton onClick={handleOpenMobileSidebar}>
            <MenuOpenRoundedIcon />
          </IconButton>
        </Box>

        <Box sx={{ mb: 2 }}>
          <ExtraLinks />
        </Box>

        <HomepageSearchV2 />
      </Box>
    );
  }

  return (
    <>
      <Box sx={navbarStyles}>
        <Logo />

        <ExtraLinks />

        <Box sx={{ textAlign: 'right' }}>
          <HeaderProfileMenu />
        </Box>
      </Box>

      <Box sx={{ px: 2, mb: 2 }}>
        <HomepageSearchV2 />
      </Box>
    </>
  );
};

export const Logo = () => {
  const { resetSearchTerm } = useGlobalSearch();
  const { resetReadyToSearchTerm } = useGlobalReadyToSearch();
  const { handleCloseView } = useGlobalIsViewOpen();

  const handleReturnHome = () => {
    resetSearchTerm();
    resetReadyToSearchTerm();
    handleCloseView();
  };

  return (
    <Link to="/" style={logoLinkStyles} onClick={handleReturnHome}>
      <Typography component="h1" sx={logoStyles}>
        Pattern Archive
      </Typography>
    </Link>
  );
};

const ExtraLinks = () => {
  return (
    <Stack direction="row" spacing={2}>
      <MuiLink component={Link} to="/" sx={subLinkStyles}>
        Home
      </MuiLink>

      <MuiLink component={Link} to="/collections" sx={subLinkStyles}>
        Collections
      </MuiLink>

      <MuiLink component={Link} to="/guides" sx={subLinkStyles}>
        Guides
      </MuiLink>

      <MuiLink component={Link} to="/help/faq" sx={subLinkStyles}>
        FAQ
      </MuiLink>
    </Stack>
  );
};

const navbarStyles = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 4,
  alignItems: 'center',
  paddingX: 2,
  paddingY: 0,
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
