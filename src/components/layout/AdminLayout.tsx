import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { EnumLevelsAdmin, type TypeLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { useQueryGetAdminNavBadges } from '@/functions/database/admin-dashboard-data';

import { alpha } from '@mui/material/styles';

import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import FeedbackIcon from '@mui/icons-material/Feedback';
import MailRoundedIcon from '@mui/icons-material/MailRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';

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
  Tooltip,
} from '@mui/material';

type SidebarLinkType = {
  label: string;
  href: string;
  icon: React.ReactNode;
  view?: TypeLevelsAdmin;
  badge?: number;
};

type NavGroup = {
  groupLabel: string;
  links: SidebarLinkType[];
};

export const AdminLayout = (props: TypeComponentWithChildrenProps) => {
  const { checkAccess } = useCheckAdminAccess();

  const { data: badgesData } = useQueryGetAdminNavBadges();

  const reportsTotal = (badgesData?.complaints || 0) + (badgesData?.contentReports || 0);

  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Overview',
      links: [
        { label: 'Dashboard', href: '/space-command', icon: <DashboardRoundedIcon fontSize="small" /> },
        {
          label: 'Patterns',
          href: '/space-command/patterns',
          icon: <ExtensionRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.PATTERN_AR,
        },
        {
          label: 'Pattern Keys',
          href: '/space-command/pattern-key-mgmt',
          icon: <KeyRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.PATTERN_KEY_MGMT_AR,
        },
        {
          label: 'User Submissions',
          href: '/space-command/user-submissions',
          icon: <UploadFileRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.USER_SUBMIT_AR,
        },
      ],
    },
    {
      groupLabel: 'Community',
      links: [
        {
          label: 'Reports',
          href: '/space-command/complaints',
          icon: <FeedbackIcon fontSize="small" />,
          view: EnumLevelsAdmin.COMPLAINTS_AR,
          badge: reportsTotal,
        },
        {
          label: 'Contact',
          href: '/space-command/contact',
          icon: <MailRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.CONTACT_AR,
          badge: badgesData?.contactSubmissions,
        },
        {
          label: 'FAQ',
          href: '/space-command/faq',
          icon: <ArticleRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.FAQ_AR,
        },
        {
          label: 'Wiki',
          href: '/space-command/wiki',
          icon: <AutoStoriesRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.WIKI_AR,
        },
        {
          label: 'Store Locator',
          href: '/space-command/store-locator',
          icon: <LocationOnRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.STORE_LOC_AR,
        },
        {
          label: 'Tags',
          href: '/space-command/tags',
          icon: <LocalOfferRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.TAG_AR,
        },
        {
          label: 'Sets',
          href: '/space-command/sets',
          icon: <StyleRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.SETS_AR,
        },
        {
          label: 'Manual Authors',
          href: '/space-command/manual-authors',
          icon: <PersonRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.MANUAL_AUTHOR_AR,
        },
      ],
    },
    {
      groupLabel: 'Tools',
      links: [
        {
          label: 'Project Planning',
          href: '/space-command/kanban',
          icon: <ViewKanbanRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.KANBAN_AR,
        },
      ],
    },
    {
      groupLabel: 'Management',
      links: [
        {
          label: 'Admins',
          href: '/space-command/admins',
          icon: <AutoFixHighIcon fontSize="small" />,
          view: EnumLevelsAdmin.ADMINS_AR,
        },
        {
          label: 'Users',
          href: '/space-command/users',
          icon: <PeopleRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.USERS_AR,
        },
        {
          label: 'Audit Log',
          href: '/space-command/logs',
          icon: <HistoryRoundedIcon fontSize="small" />,
          view: EnumLevelsAdmin.LOGS_VIEW_AR,
        },
      ],
    },
  ];

  const location = useLocation();
  const allLinks = navGroups.flatMap((g) => g.links);
  const thisRestriction = allLinks.find((link) => link.href === location.pathname);
  const canViewPage = typeof thisRestriction?.view === 'undefined' || checkAccess(thisRestriction?.view || '');
  const currentPageLabel = allLinks.find((l) => l.href === location.pathname)?.label ?? 'Admin';

  const theme = useTheme();
  const [open, setOpen] = React.useState(true);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'grey.50' }}>
      <AppBar position="fixed" open={open}>
        <Toolbar sx={{ minHeight: '56px !important' }}>
          <IconButton
            aria-label="open drawer"
            onClick={() => setOpen(true)}
            edge="start"
            size="small"
            sx={[{ mr: 1.5, color: 'text.secondary' }, open && { display: 'none' }]}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" color="text.primary" noWrap sx={{ fontWeight: 600 }}>
            {currentPageLabel}
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
            border: 'none',
            borderRight: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        {/* Brand header */}
        <Box
          sx={{
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 56,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                backgroundColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AutoFixHighIcon sx={{ fontSize: 16, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.primary" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                Pattern Archive
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', lineHeight: 1 }} color="text.disabled">
                Admin Panel
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Collapse sidebar">
            <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: 'text.disabled' }}>
              {theme.direction === 'ltr' ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <Divider />

        {/* Navigation groups */}
        <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
          {navGroups.map((group, gi) => {
            const visibleLinks = group.links.filter((link) => {
              const isNotSet = typeof link.view === 'undefined';
              return isNotSet || checkAccess(link.view!);
            });

            if (visibleLinks.length === 0) return null;

            return (
              <Box key={group.groupLabel}>
                <Typography
                  sx={{
                    px: 2.5,
                    pb: 0.5,
                    display: 'block',
                    color: 'text.disabled',
                    fontWeight: 700,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    fontSize: '0.62rem',
                  }}
                >
                  {group.groupLabel}
                </Typography>

                <List dense disablePadding sx={{ px: 1, mb: 0.5 }}>
                  {visibleLinks.map((link) => {
                    const isActive = location.pathname === link.href;
                    const hasBadge = (link.badge ?? 0) > 0;

                    return (
                      <ListItem key={link.href} disablePadding sx={{ mb: 0.25 }}>
                        <ListItemButton
                          component={Link}
                          to={link.href}
                          sx={{
                            borderRadius: 1.5,
                            py: 0.7,
                            px: 1.25,
                            backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                            color: isActive ? 'primary.main' : 'text.secondary',
                            '&:hover': {
                              backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.14) : 'action.hover',
                              color: isActive ? 'primary.main' : 'text.primary',
                            },
                            transition: 'background-color 0.15s, color 0.15s',
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                            <Badge
                              badgeContent={hasBadge ? link.badge : 0}
                              color="error"
                              max={99}
                              sx={{
                                '& .MuiBadge-badge': {
                                  fontSize: '0.6rem',
                                  height: 14,
                                  minWidth: 14,
                                  padding: '0 3px',
                                },
                              }}
                            >
                              {link.icon}
                            </Badge>
                          </ListItemIcon>
                          <ListItemText
                            primary={link.label}
                            sx={{
                              '& .MuiTypography-root': {
                                fontSize: '0.8125rem',
                                fontWeight: isActive ? 600 : 400,
                                color: 'inherit',
                              },
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>

                {gi < navGroups.length - 1 && <Divider sx={{ mx: 2, mt: 0.5, mb: 1.5 }} />}
              </Box>
            );
          })}
        </Box>

        {/* Footer - back to site */}
        <Divider />
        <Box sx={{ p: 1 }}>
          <ListItemButton
            component={Link}
            to="/"
            sx={{
              borderRadius: 1.5,
              py: 0.7,
              px: 1.25,
              color: 'text.disabled',
              '&:hover': { backgroundColor: 'action.hover', color: 'text.secondary' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
              <ArrowBackRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Back to Site"
              sx={{ '& .MuiTypography-root': { fontSize: '0.8125rem', color: 'inherit' } }}
            />
          </ListItemButton>
        </Box>
      </Drawer>

      <Main open={open}>
        <DrawerHeader />
        {canViewPage ? <>{props.children}</> : <>You do not have access to this page</>}
      </Main>
    </Box>
  );
};

// ─── Styled components ────────────────────────────────────────────────────────

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
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: 'none',
  borderBottom: `1px solid ${theme.palette.divider}`,
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
  minHeight: 56,
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));
