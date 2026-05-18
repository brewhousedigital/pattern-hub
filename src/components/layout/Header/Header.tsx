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
  const { location } = useRouterState();

  const activeLinkStyles = (path: string) => {
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    return {
      ...subLinkStyles,
      ...(isActive ? { color: PRIMARY_COLOR, fontWeight: 700, textDecoration: 'none' } : {}),
    };
  };

  return (
    <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
      <MuiLink component={Link} to="/" sx={activeLinkStyles('/')}>
        Home
      </MuiLink>

      {/*<MuiLink component={Link} to="/collections" sx={activeLinkStyles('/collections')}>
        Collections
      </MuiLink>*/}

      {/*<MuiLink component={Link} to="/guides" sx={activeLinkStyles('/guides')}>
        Guides
      </MuiLink>*/}

      <MuiLink component={Link} to="/help/faq" sx={activeLinkStyles('/help/faq')}>
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
  display: 'flex',
  gap: 1,
  alignItems: 'center',
  mb: 2,
};

const mobileHomepageNavbarStyles = {
  gridTemplateColumns: '1fr auto auto',
};

const logoLinkStyles = {
  textDecoration: 'none',
  color: PRIMARY_COLOR,
  marginRight: 'auto',
};

const logoStyles = {
  fontSize: {
    xs: 20,
    md: 28,
  },
  fontWeight: 700,
  textDecoration: 'none',
};
