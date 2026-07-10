import { Link, useRouterState } from '@tanstack/react-router';
import { HeaderProfileMenu } from '@/components/layout/HeaderProfileMenu.tsx';
import { PRIMARY_COLOR } from '@/data/constants';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { useGlobalIsViewOpen } from '@/data/view';
import { subLinkStyles } from '@/components/layout/Header/sublink-styles';
import { NotificationBell } from '@/components/layout/Header/NotificationBell';

import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import { Box, Stack, Typography, Link as MuiLink, IconButton } from '@mui/material';

// One responsive grid instead of a useMediaQuery branch: the media query is
// false during SSR/first render, which made the header paint in its mobile
// layout (links below the logo) and pop into the desktop layout after
// hydration. CSS grid areas let the server render the right layout directly.
export const Header = () => {
  // Only render the tag sidebar toggle on the homepage
  const { location } = useRouterState();
  const showTagMobileSidebar = location.pathname === '/';

  const { handleOpenMobileSidebar } = useGlobalIsSidebarOpen();

  return (
    <Box component="header" sx={navbarStyles}>
      <Box sx={{ gridArea: 'logo', display: 'flex', alignItems: 'center' }}>
        <Logo />
      </Box>

      <Box sx={{ gridArea: 'links' }}>
        <ExtraLinks />
      </Box>

      <Stack direction="row" sx={{ gridArea: 'icons', textAlign: 'right', gap: { xs: 1, md: 2 }, alignItems: 'center' }}>
        <NotificationBell />

        <HeaderProfileMenu />

        {showTagMobileSidebar && (
          <IconButton onClick={handleOpenMobileSidebar} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
            <MenuOpenRoundedIcon />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
};

export const Logo = () => {
  const { handleCloseView } = useGlobalIsViewOpen();

  const handleReturnHome = () => {
    handleCloseView();
  };

  return (
    <Link to="/" style={logoLinkStyles} onClick={handleReturnHome}>
      <Typography component="div" sx={logoStyles}>
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
    <Stack
      component="nav"
      direction="row"
      spacing={2.5}
      sx={{ flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}
    >
      <MuiLink component={Link} to="/" sx={activeLinkStyles('/')}>
        Home
      </MuiLink>

      <MuiLink component={Link} to="/news" sx={activeLinkStyles('/news')}>
        News
      </MuiLink>

      <MuiLink component={Link} to="/help/faq" sx={activeLinkStyles('/help/faq')}>
        FAQ
      </MuiLink>

      <MuiLink component={Link} to="/wiki" sx={activeLinkStyles('/wiki')}>
        Wiki
      </MuiLink>

      <MuiLink component={Link} to="/sets" sx={activeLinkStyles('/sets')}>
        Sets
      </MuiLink>

      {/*<MuiLink component={Link} to="/guides" sx={activeLinkStyles('/guides')}>
        Guides
      </MuiLink>*/}

      {/*<MuiLink component={Link} to="/store-locator" sx={activeLinkStyles('/store-locator')}>
        Store Locator
      </MuiLink>*/}
    </Stack>
  );
};

const navbarStyles = {
  backgroundColor: 'rgb(244, 247, 245)',
  display: 'grid',
  gridTemplateAreas: {
    xs: '"logo icons" "links links"',
    md: '"logo links icons"',
  },
  gridTemplateColumns: {
    xs: '1fr auto',
    md: 'auto 1fr auto',
  },
  alignItems: 'center',
  columnGap: { xs: 1, md: 4 },
  rowGap: { xs: 2, md: 0 },
  paddingX: 2,
  paddingTop: { xs: 0.5, md: 1 },
  paddingBottom: { xs: 4, md: 1 },
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
