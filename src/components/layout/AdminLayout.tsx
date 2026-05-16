import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { EnumLevelsAdmin, type TypeLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';

import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import FeedbackIcon from '@mui/icons-material/Feedback';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';

import type { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import {
  Box,
  Badge,
  Drawer,
  styled,
  useTheme,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar as MuiAppBar,
  Chip,
} from '@mui/material';
import { useQueryGetComplaints } from '@/functions/database/complaints.ts';

type SidebarLinkType = {
  label: string;
  href: string;
  icon: React.ReactNode;
  view?: TypeLevelsAdmin;
  secondaryValue?: number;
};

export const AdminLayout = (props: TypeComponentWithChildrenProps) => {
  const { checkAccess } = useCheckAdminAccess();

  const { data: complaintsData } = useQueryGetComplaints();

  const SidebarLinks: SidebarLinkType[] = [
    { label: 'Dashboard', href: '/space-command', icon: <DashboardRoundedIcon /> },
    {
      label: 'Patterns',
      href: '/space-command/patterns',
      icon: <ExtensionRoundedIcon />,
      view: EnumLevelsAdmin.PATTERN_AR,
    },
    {
      label: 'Pattern Key Mgmt',
      href: '/space-command/pattern-key-mgmt',
      icon: <KeyRoundedIcon />,
      view: EnumLevelsAdmin.PATTERN_KEY_MGMT_AR,
    },
    { label: 'divider', href: '/space-command', icon: <ArticleRoundedIcon /> },
    {
      label: 'Reports',
      href: '/space-command/complaints',
      icon: <FeedbackIcon />,
      view: EnumLevelsAdmin.COMPLAINTS_AR,
      secondaryValue: complaintsData?.length,
    },
    { label: 'FAQ', href: '/space-command/faq', icon: <ArticleRoundedIcon />, view: EnumLevelsAdmin.FAQ_AR },
    { label: 'Wiki', href: '/space-command/wiki', icon: <AutoStoriesRoundedIcon />, view: EnumLevelsAdmin.WIKI_AR },
    { label: 'Map Control', href: '/space-command/map', icon: <LocationOnRoundedIcon />, view: EnumLevelsAdmin.MAP_AR },
    { label: 'Tags', href: '/space-command/tags', icon: <LocalOfferRoundedIcon />, view: EnumLevelsAdmin.TAG_AR },
    { label: 'divider', href: '/space-command', icon: <ArticleRoundedIcon /> },
    { label: 'Admins', href: '/space-command/admins', icon: <AutoFixHighIcon />, view: EnumLevelsAdmin.ADMINS_AR },
    { label: 'Users', href: '/space-command/users', icon: <PeopleRoundedIcon />, view: EnumLevelsAdmin.USERS_AR },
  ];

  const location = useLocation();
  const thisRestriction = SidebarLinks.find((link) => link.href === location.pathname);

  const canViewPage = typeof thisRestriction?.view === 'undefined' || checkAccess(thisRestriction?.view || '');

  const theme = useTheme();
  const [open, setOpen] = React.useState(true);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={[
              {
                mr: 2,
              },
              open && { display: 'none' },
            ]}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="h1">
            Pattern Archive - Admin
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>

        <Divider />

        <List>
          {SidebarLinks.map((link, index) => {
            // Always render items marked as true
            const isNotSet = typeof link.view === 'undefined';

            // Always render dividers
            const isDivider = link.label === 'divider';

            // Check the database if the user has the right permission
            const hasAccess = link?.view ? checkAccess(link.view) : false;

            const showSecondaryChip = link?.secondaryValue && link?.secondaryValue > 0;

            if (isDivider) {
              return (
                <ListItem key={`sidebar-link` + index}>
                  <Box sx={{ height: '1px', width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.12)' }} />
                </ListItem>
              );
            }

            if (isNotSet || hasAccess) {
              return (
                <ListItem
                  key={`sidebar-link` + index}
                  disablePadding
                  secondaryAction={
                    showSecondaryChip ? (
                      <Box>
                        <Chip label={link.secondaryValue} size="small" color="error" />
                      </Box>
                    ) : null
                  }
                >
                  <ListItemButton component={Link} to={link.href}>
                    <ListItemIcon sx={{ color: location.pathname === link.href ? 'primary.main' : '' }}>
                      {link.icon}
                    </ListItemIcon>

                    <ListItemText
                      sx={{
                        color: location.pathname === link.href ? 'primary.main' : '',
                        '& .MuiTypography-root': { fontWeight: location.pathname === link.href ? 700 : 400 },
                      }}
                      primary={link.label}
                    />
                  </ListItemButton>
                </ListItem>
              );
            }

            return <React.Fragment key={`sidebar-link` + index}></React.Fragment>;
          })}
        </List>
      </Drawer>

      <Main open={open}>
        <DrawerHeader />

        {canViewPage ? <>{props.children}</> : <>You do not have access to this page</>}
      </Main>
    </Box>
  );
};

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  width: `calc(100% - ${drawerWidth}px)`,
  variants: [
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
      },
    },
  ],
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));
