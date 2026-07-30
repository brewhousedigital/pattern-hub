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
import {
  useQueryGetUserSubmissionNotifications,
  useMutationDismissSubmissionNotification,
  type TypeUserSubmissionNotificationResponse,
} from '@/functions/database/user-submissions';
import {
  useQueryGetComplaintNotifications,
  useMutationDismissComplaintNotification,
  type TypeComplaintNotificationResponse,
} from '@/functions/database/complaints';

import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { Badge, Box, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';

type CollectionUpdate = { type: 'collection'; record: TypeFollowedCollectionResponse };
type SetUpdate = { type: 'set'; record: TypeFollowedSetResponse };
type SubmissionUpdate = { type: 'submission'; record: TypeUserSubmissionNotificationResponse };
type ComplaintUpdate = { type: 'complaint'; record: TypeComplaintNotificationResponse };
type AnyUpdate = CollectionUpdate | SetUpdate | SubmissionUpdate | ComplaintUpdate;

export const NotificationBell = () => {
  const { authData } = useGlobalAuthData();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { data: followedCollections = [], refetch: refetchCollections } = useQueryGetUserFollowedCollections(
    authData?.id || '',
  );
  const { data: followedSets = [], refetch: refetchSets } = useQueryGetUserFollowedSets(authData?.id || '');
  const { data: submissionNotifications = [], refetch: refetchSubmissions } = useQueryGetUserSubmissionNotifications(
    authData?.id || '',
  );
  const { data: complaintNotifications = [], refetch: refetchComplaints } = useQueryGetComplaintNotifications(
    authData?.id || '',
  );

  const dismissCollectionNotification = useMutationDismissCollectionNotification();
  const dismissSetNotification = useMutationDismissSetNotification();
  const dismissSubmissionNotification = useMutationDismissSubmissionNotification();
  const dismissComplaintNotification = useMutationDismissComplaintNotification();
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

  // Every row here is an unread notification - dismissing one deletes it
  // outright (see useMutationDismissSubmissionNotification), so unlike the
  // collection/set follows above there's no timestamp filter to apply.
  const submissionUpdates: AnyUpdate[] = submissionNotifications.map((record) => ({ type: 'submission', record }));

  const complaintUpdates: AnyUpdate[] = complaintNotifications.map((record) => ({ type: 'complaint', record }));

  const updates: AnyUpdate[] = [...collectionUpdates, ...setUpdates, ...submissionUpdates, ...complaintUpdates];

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
    } else if (update.type === 'set') {
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
    } else if (update.type === 'submission') {
      const resultingPatternId = update.record.expand?.submission?.resulting_pattern;
      try {
        await dismissSubmissionNotification.mutateAsync(update.record.id);
        await refetchSubmissions();
        if (update.record.status === 'published' && resultingPatternId) {
          void navigate({ to: '/pattern/$patternId', params: { patternId: resultingPatternId } });
        } else {
          void navigate({ to: '/profile/submissions' });
        }
      } catch {
        // Silent — badge will reappear on next mount if dismiss failed
      }
    } else {
      const patternId = update.record.expand?.complaint?.pattern_id;
      try {
        await dismissComplaintNotification.mutateAsync(update.record.id);
        await refetchComplaints();
        if (patternId) {
          void navigate({ to: '/pattern/$patternId', params: { patternId } });
        }
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
            } else if (update.type === 'set') {
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
            } else if (update.type === 'submission') {
              const submission = update.record.expand?.submission;
              const isPublished = update.record.status === 'published';
              return (
                <MenuItem
                  key={update.record.id}
                  onClick={() => handleNotificationClick(update)}
                  sx={{ ...menuItemStyles, alignItems: 'flex-start' }}
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                    {isPublished ? (
                      <CheckCircleRoundedIcon fontSize="small" color="success" />
                    ) : (
                      <CancelRoundedIcon fontSize="small" color="error" />
                    )}
                  </ListItemIcon>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.3, fontWeight: 600 }}>
                        {submission?.name ?? 'Your submission'}
                      </Typography>
                      <FiberManualRecordIcon sx={{ fontSize: 8, color: 'primary.main', flexShrink: 0 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {isPublished
                        ? 'Approved — now live'
                        : update.record.reason
                          ? `Rejected: ${update.record.reason}`
                          : 'Rejected'}
                    </Typography>
                  </Box>
                </MenuItem>
              );
            } else {
              const pattern = update.record.expand?.complaint?.expand?.pattern_id;
              return (
                <MenuItem
                  key={update.record.id}
                  onClick={() => handleNotificationClick(update)}
                  sx={{ ...menuItemStyles, alignItems: 'flex-start' }}
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                    <CheckCircleRoundedIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.3, fontWeight: 600 }}>
                        {pattern?.name ?? 'Your report'}
                      </Typography>
                      <FiberManualRecordIcon sx={{ fontSize: 8, color: 'primary.main', flexShrink: 0 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {update.record.reason ? `Resolved: ${update.record.reason}` : 'Resolved'}
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
