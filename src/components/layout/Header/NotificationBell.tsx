import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

import NotificationsIcon from '@mui/icons-material/Notifications';

import { IconButton, ListItemIcon, Menu, MenuItem } from '@mui/material';

export const NotificationBell = () => {
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
        aria-controls={open ? 'notification-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        sx={{ mr: 1 }}
      >
        <NotificationsIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        id="notification-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{ '& .MuiPaper-root': { borderRadius: 2 }, '& .MuiList-root': { paddingTop: 0, paddingBottom: 0 } }}
      >
        <MenuItem sx={menuItemStyles}>No new notifications</MenuItem>
      </Menu>
    </>
  );
};
