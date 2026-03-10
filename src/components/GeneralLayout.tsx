import React from 'react';
import type { TypeComponentWithChildrenProps } from '../functions/types/types';
import { useNavigate, Link } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAuth } from '@/data/auth-data';
import { authSignOut } from '@/functions/database/authentication';

import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DisplaySettingsRoundedIcon from '@mui/icons-material/DisplaySettingsRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import { Avatar, Divider, Box, Typography, Menu, IconButton, MenuItem, ListItemIcon } from '@mui/material';

export const GeneralLayout = (props: TypeComponentWithChildrenProps) => {
  const logoStyles = {
    textAlign: 'center',
    WebkitTextStroke: '2px #222',
    textStroke: '2px #222',
    mb: 2,
  };

  const gradientStyles = {
    background: 'linear-gradient(to right, #FD8D35, #EE5F0D)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };

  return (
    <Box>
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Typography variant="h1" sx={logoStyles}>
          <Typography variant="h1" component="span" sx={gradientStyles}>
            Pattern
          </Typography>{' '}
          Hub
        </Typography>
      </Link>

      <ProfileButton />

      <Box>{props.children}</Box>
    </Box>
  );
};

const authenticatedMenuItems = [
  {
    label: 'Home',
    icon: <DashboardRoundedIcon />,
    onClick: (navigateTo: ReturnType<typeof useNavigate>) => {
      navigateTo({ to: '/' });
    },
  },
  {
    label: 'Profile',
    icon: <PersonRoundedIcon />,
    onClick: () => {},
    disabled: true,
  },
  {
    label: 'Favorites',
    icon: <StarRateRoundedIcon />,
    onClick: () => {},
    disabled: true,
  },
  {
    label: 'Want to Make',
    icon: <FavoriteRoundedIcon />,
    onClick: () => {},
    disabled: true,
  },
  {
    label: 'Completed',
    icon: <DoneRoundedIcon />,
    onClick: () => {},
    disabled: true,
  },
  {
    label: 'Settings',
    icon: <Settings />,
    onClick: () => {},
    disabled: true,
  },
  /*{
    label: 'Admin Panel',
    icon: <DisplaySettingsRoundedIcon />,
    onClick: (navigateTo: ReturnType<typeof useNavigate>) => {
      navigateTo({ to: '/space-command' });
    },
  },*/
  {
    label: 'Logout',
    icon: <Logout />,
    onClick: () => {
      authSignOut();
    },
  },
];

const unauthenticatedMenuItems = [
  {
    label: 'Log In',
    icon: <PersonRoundedIcon />,
    onClick: (navigateTo: ReturnType<typeof useNavigate>) => {
      navigateTo({ to: '/login' });
    },
  },
  {
    label: 'Register an Account',
    icon: <HowToRegRoundedIcon />,
    onClick: (navigateTo: ReturnType<typeof useNavigate>) => {
      navigateTo({ to: '/register' });
    },
  },
];

const ProfileButton = () => {
  const { authData } = useGlobalAuthData();

  // Check if the user is logged in on load
  useRefreshAuth();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const menuItemStyles = {
    padding: '18px 24px',
  };

  const navigateTo = useNavigate();

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{ position: 'absolute', top: 16, right: 16 }}
        aria-controls={open ? 'account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{ '& .MuiPaper-root': { borderRadius: 6 }, '& .MuiList-root': { paddingTop: 0, paddingBottom: 0 } }}
      >
        {authData &&
          authenticatedMenuItems.map((item) => (
            <MenuItem key={item.label} onClick={() => item.onClick(navigateTo)} sx={menuItemStyles}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              {item.label}
            </MenuItem>
          ))}

        {!authData &&
          unauthenticatedMenuItems.map((item) => (
            <MenuItem key={item.label} onClick={() => item.onClick(navigateTo)} sx={menuItemStyles}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              {item.label}
            </MenuItem>
          ))}
      </Menu>
    </>
  );
};
