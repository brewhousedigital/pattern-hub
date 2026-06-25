import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  useQueryGetUserFollowedCollections,
  useMutationDismissCollectionNotification,
  type TypeFollowedCollectionResponse,
} from '@/functions/database/collections';
import {
  useQueryGetUserFollowedSets,
  useMutationDismissSetNotification,
  type TypeFollowedSetResponse,
} from '@/functions/database/sets';

import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { Badge, Box, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';

type CollectionUpdate = { type: 'collection'; record: TypeFollowedCollectionResponse };
type SetUpdate = { type: 'set'; record: TypeFollowedSetResponse };
type AnyUpdate = CollectionUpdate | SetUpdate;

export const NotificationBell = () => {
  const { authData } = useGlobalAuthData();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { data: followedCollections = [], refetch: refetchCollections } = useQueryGetUserFollowedCollections(
    authData?.id || '',
  );
  const { data: followedSets = [], refetch: refetchSets } = useQueryGetUserFollowedSets(authData?.id || '');

  const dismissCollectionNotification = useMutationDismissCollectionNotification();
  const dismissSetNotification = useMutationDismissSetNotification();
  const navigate = useNavigate();

  const collectionUpdates: AnyUpdate[] = followedCollections
    .filter((f) => {
      const ts = f.expand?.collection_id?.updated;
      return ts && new Date(ts) > new Date(f.last_checked_updated);
    })
    .map((record) => ({ type: 'collection', record }));

  const setUpdates: AnyUpdate[] = followedSets
    .filter((f) => {
      const ts = f.expand?.set_id?.updated;
      return ts && new Date(ts) > new Date(f.last_checked_updated);
    })
    .map((record) => ({ type: 'set', record }));

  const updates: AnyUpdate[] = [...collectionUpdates, ...setUpdates];

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (update: AnyUpdate) => {
    handleClose();

    if (update.type === 'collection') {
      const collectionUpdated = update.record.expand?.collection_id?.updated;
      if (!collectionUpdated) return;
      try {
        await dismissCollectionNotification.mutateAsync({
          followRecordId: update.record.id,
          collectionUpdated,
        });
        await refetchCollections();
        void navigate({
          to: '/profile/collections/$collectionId',
          params: { collectionId: update.record.collection_id },
        });
      } catch {
        // Silent — badge will reappear on next mount if dismiss failed
      }
    } else {
      const setUpdated = update.record.expand?.set_id?.updated;
      if (!setUpdated) return;
      try {
        await dismissSetNotification.mutateAsync({
          followRecordId: update.record.id,
          setUpdated,
        });
        await refetchSets();
        void navigate({
          to: '/sets/$setId',
          params: { setId: update.record.set_id },
        });
      } catch {
        // Silent — badge will reappear on next mount if dismiss failed
      }
    }
  };

  const menuItemStyles = {
    padding: '12px 20px',
    maxWidth: 320,
  };

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
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          {updates.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {updates.length} update{updates.length !== 1 ? 's' : ''}
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
          updates.map((update) => {
            if (update.type === 'collection') {
              const col = update.record.expand?.collection_id;
              const ownerName = col?.expand?.owner_id?.name;
              return (
                <MenuItem
                  key={update.record.id}
                  onClick={() => handleNotificationClick(update)}
                  sx={{ ...menuItemStyles, alignItems: 'flex-start' }}
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                    <BookmarksOutlinedIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.3, fontWeight: 600 }}>
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
            } else {
              const set = update.record.expand?.set_id;
              return (
                <MenuItem
                  key={update.record.id}
                  onClick={() => handleNotificationClick(update)}
                  sx={{ ...menuItemStyles, alignItems: 'flex-start' }}
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                    <StyleRoundedIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.3, fontWeight: 600 }}>
                        {set?.title ?? 'Set'}
                      </Typography>
                      <FiberManualRecordIcon sx={{ fontSize: 8, color: 'primary.main', flexShrink: 0 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Updated with new patterns
                    </Typography>
                  </Box>
                </MenuItem>
              );
            }
          })
        )}
      </Menu>
    </>
  );
};
