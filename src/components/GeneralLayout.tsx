import React from 'react';
import type { TypeComponentWithChildrenProps } from '../functions/types/types';
import { useNavigate } from '@tanstack/react-router';
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
      <Typography variant="h1" sx={logoStyles}>
        <Typography variant="h1" component="span" sx={gradientStyles}>
          Pattern
        </Typography>{' '}
        Hub
      </Typography>

      <ProfileButton />

      <Box>{props.children}</Box>
    </Box>
  );
};

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
        {authData ? (
          <>
            <MenuItem
              onClick={() => {
                navigateTo({ to: '/' });
              }}
              sx={menuItemStyles}
            >
              <ListItemIcon>
                <DashboardRoundedIcon />
              </ListItemIcon>
              Home
            </MenuItem>

            <MenuItem onClick={handleClose} sx={menuItemStyles} disabled>
              <ListItemIcon>
                <PersonRoundedIcon />
              </ListItemIcon>
              Profile
            </MenuItem>

            <MenuItem onClick={handleClose} sx={menuItemStyles} disabled>
              <ListItemIcon>
                <StarRateRoundedIcon />
              </ListItemIcon>
              Favorites
            </MenuItem>

            <MenuItem onClick={handleClose} sx={menuItemStyles} disabled>
              <ListItemIcon>
                <FavoriteRoundedIcon />
              </ListItemIcon>{' '}
              Want to Make
            </MenuItem>

            <MenuItem onClick={handleClose} sx={menuItemStyles} disabled>
              <ListItemIcon>
                <DoneRoundedIcon />
              </ListItemIcon>
              Completed
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleClose} sx={menuItemStyles} disabled>
              <ListItemIcon>
                <Settings />
              </ListItemIcon>
              Settings
            </MenuItem>

            <Divider />

            <MenuItem
              onClick={() => {
                navigateTo({ to: '/space-command' });
              }}
              sx={menuItemStyles}
            >
              <ListItemIcon>
                <DisplaySettingsRoundedIcon />
              </ListItemIcon>
              Admin Panel
            </MenuItem>

            <Divider />

            <MenuItem
              onClick={() => {
                authSignOut();
              }}
              sx={menuItemStyles}
            >
              <ListItemIcon>
                <Logout />
              </ListItemIcon>
              Logout
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem
              onClick={() => {
                navigateTo({ to: '/login' });
              }}
              sx={menuItemStyles}
            >
              <ListItemIcon>
                <PersonRoundedIcon />
              </ListItemIcon>
              Log In
            </MenuItem>

            <MenuItem
              onClick={() => {
                navigateTo({ to: '/register' });
              }}
              sx={menuItemStyles}
            >
              <ListItemIcon>
                <HowToRegRoundedIcon />
              </ListItemIcon>
              Register an Account
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};
