import { Link, useMatch, useRouterState } from '@tanstack/react-router';
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
  // IMPORTANT: these flags must come from the COMMITTED route matches, not
  // useRouterState().location - the pending location flips to the destination
  // the moment navigation starts, BEFORE the view transition snapshots the old
  // page. Deriving from the pathname made the header logo mount (carrying the
  // `site-logo` name) while the homepage hero still held the same name -
  // "Unexpected duplicate view-transition-name" aborts the whole animation.
  // useMatch reads committed matches, which only swap inside the transition's
  // DOM-update callback.

  // On the homepage the hero owns the brand: the header logo hides and the
  // hero wordmark carries the `site-logo` view-transition name instead, so
  // searching morphs the brand up into this slot. The nav is centered on the
  // homepage and slides into its usual spot via the `site-nav` name.
  const isHomepage = !!useMatch({ from: '/', shouldThrow: false });

  // The tag sidebar (and its mobile toggle) belongs to the /pattern browse page
  const showTagMobileSidebar = !!useMatch({ from: '/pattern/', shouldThrow: false });

  const { handleOpenMobileSidebar } = useGlobalIsSidebarOpen();

  // Profile pages (view/edit/collections) sit directly on the page background,
  // so the header needs its own backdrop there to stay legible - everywhere
  // else it stays transparent.
  const { location } = useRouterState();
  const isProfilePage = location.pathname.startsWith('/profile');

  return (
    <Box component="header" sx={[navbarStyles, isProfilePage && profileNavbarStyles]}>
      <Box
        sx={{
          gridArea: 'logo',
          display: 'flex',
          alignItems: 'center',
          minWidth: { md: 225 },
          ...(isHomepage ? {} : { viewTransitionName: 'site-logo' }),
        }}
      >
        {!isHomepage ? <Logo /> : <Box />}
      </Box>

      <Box sx={{ gridArea: 'links', viewTransitionName: 'site-nav', maxWidth: 700, mx: isHomepage ? 'auto' : '' }}>
        <ExtraLinks centered={isHomepage} />
      </Box>

      <Stack
        direction="row"
        sx={{
          gridArea: 'icons',
          textAlign: 'right',
          gap: { xs: 1, md: 2 },
          alignItems: 'center',
          justifyContent: 'flex-end',
          minWidth: { md: 225 },
        }}
      >
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

const ExtraLinks = ({ centered = false }: { centered?: boolean }) => {
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
      sx={{ flexWrap: 'wrap', justifyContent: centered ? 'center' : { xs: 'center', md: 'flex-start' } }}
    >
      <MuiLink component={Link} to="/" sx={activeLinkStyles('/')}>
        Home
      </MuiLink>

      <MuiLink component={Link} to="/pattern" sx={activeLinkStyles('/pattern')}>
        Patterns
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
  minHeight: 58,
};

const profileNavbarStyles = {
  backgroundColor: 'rgb(244, 247, 245)',
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
