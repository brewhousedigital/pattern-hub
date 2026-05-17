import { Link, useRouterState } from '@tanstack/react-router';
import { HeaderProfileMenu } from '@/components/layout/HeaderProfileMenu.tsx';
import { PRIMARY_COLOR } from '@/data/constants';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { useGlobalIsViewOpen } from '@/data/view';
import { subLinkStyles } from '@/components/layout/Header/sublink-styles';
import { NotificationBell } from '@/components/layout/Header/NotificationBell';

import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import { Box, Stack, Typography, Link as MuiLink, IconButton, useTheme, useMediaQuery } from '@mui/material';

export const Header = () => {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  // Only render the tag sidebar on the homepage
  const { location } = useRouterState();
  const showTagMobileSidebar = location.pathname === '/';

  const { handleOpenMobileSidebar } = useGlobalIsSidebarOpen();

  // Mobile view
  if (!isMediumSizeAndUp) {
    return (
      <Box sx={mobileNavbarContainerStyles}>
        <Box sx={showTagMobileSidebar ? [mobileNavbarStyles, mobileHomepageNavbarStyles] : mobileNavbarStyles}>
          <Logo />

          <NotificationBell />
          <HeaderProfileMenu />

          {showTagMobileSidebar && (
            <IconButton onClick={handleOpenMobileSidebar}>
              <MenuOpenRoundedIcon />
            </IconButton>
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <ExtraLinks />
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box sx={navbarStyles}>
        <Logo />

        <ExtraLinks />

        <Box sx={{ textAlign: 'right' }}>
          <NotificationBell />

          <HeaderProfileMenu />
        </Box>
      </Box>
    </>
  );
};

export const Logo = () => {
  const { handleCloseView } = useGlobalIsViewOpen();

  const handleReturnHome = () => {
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

      {/*<MuiLink component={Link} to="/collections" sx={subLinkStyles}>
        Collections
      </MuiLink>*/}

      {/*<MuiLink component={Link} to="/guides" sx={subLinkStyles}>
        Guides
      </MuiLink>*/}

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
  paddingY: 1,
};

const mobileNavbarContainerStyles = {
  paddingX: 2,
  mb: 2,
};

const mobileNavbarStyles = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 4,
  alignItems: 'center',
};

const mobileHomepageNavbarStyles = {
  gridTemplateColumns: '1fr auto auto',
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
