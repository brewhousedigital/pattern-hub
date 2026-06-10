import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  useQueryGetUserFollowedCollections,
  useMutationDismissCollectionNotification,
  type TypeFollowedCollectionResponse,
} from '@/functions/database/collections';

import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { Badge, Box, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';

export const NotificationBell = () => {
  const { authData } = useGlobalAuthData();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { data: followedCollections = [], refetch } = useQueryGetUserFollowedCollections(authData?.id || '');
  const dismissNotification = useMutationDismissCollectionNotification();
  const navigate = useNavigate();

  // Collections whose updated timestamp is newer than last_checked_updated
  const updates = followedCollections.filter((f) => {
    const collectionUpdated = f.expand?.collection_id?.updated;
    if (!collectionUpdated) return false;
    return new Date(collectionUpdated) > new Date(f.last_checked_updated);
  });

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (followRecord: TypeFollowedCollectionResponse) => {
    handleClose();
    const collectionUpdated = followRecord.expand?.collection_id?.updated;
    if (collectionUpdated) {
      try {
        await dismissNotification.mutateAsync({
          followRecordId: followRecord.id,
          collectionUpdated,
        });
        await refetch();
      } catch {
        // Silent - navigation still proceeds
      }
    }
    void navigate({
      to: '/profile/collections/$collectionId',
      params: { collectionId: followRecord.collection_id },
    });
  };

  const menuItemStyles = {
    padding: '12px 20px',
    maxWidth: 320,
  };

  // Don't render the bell at all if user isn't logged in
  if (!authData) return null;

  return (
    <>
      <IconButton
        onClick={handleOpen}
        aria-controls={open ? 'notification-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Badge badgeContent={updates.length} color="error" max={9}>
          {updates.length > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        id="notification-menu"
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{
          '& .MuiPaper-root': { borderRadius: 2, minWidth: 280 },
          '& .MuiList-root': { paddingTop: 0, paddingBottom: 0 },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Notifications
          </Typography>
          {updates.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {updates.length} collection{updates.length !== 1 ? 's' : ''} updated
            </Typography>
          )}
        </Box>

        {updates.length === 0 ? (
          <MenuItem sx={menuItemStyles} disabled>
            <Typography variant="body2" color="text.secondary">
              No new notifications
            </Typography>
          </MenuItem>
        ) : (
          updates.map((followRecord) => {
            const col = followRecord.expand?.collection_id;
            const ownerName = col?.expand?.owner_id?.name;

            return (
              <MenuItem
                key={followRecord.id}
                onClick={() => handleNotificationClick(followRecord)}
                sx={{ ...menuItemStyles, alignItems: 'flex-start' }}
              >
                <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                  <BookmarksOutlinedIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                      {col?.name ?? 'Collection'}
                    </Typography>
                    <FiberManualRecordIcon sx={{ fontSize: 8, color: 'primary.main', flexShrink: 0 }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {ownerName ? `by ${ownerName} · ` : ''}Updated with new patterns
                  </Typography>
                </Box>
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
};
