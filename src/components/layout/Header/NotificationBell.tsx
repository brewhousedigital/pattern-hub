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
import CloseIcon from '@mui/icons-material/Close';

import { Badge, Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';

type CollectionUpdate = { type: 'collection'; record: TypeFollowedCollectionResponse };
type SetUpdate = { type: 'set'; record: TypeFollowedSetResponse };
type SubmissionUpdate = { type: 'submission'; record: TypeUserSubmissionNotificationResponse };
type ComplaintUpdate = { type: 'complaint'; record: TypeComplaintNotificationResponse };
type AnyUpdate = CollectionUpdate | SetUpdate | SubmissionUpdate | ComplaintUpdate;

// Collection/set updates aren't rows with their own "created" moment - the
// notification-worthy event is the followed collection/set itself changing,
// so that's the timestamp used for sorting (falls back to the follow record's
// own `created` only if expand somehow came back empty; in practice the
// collectionUpdates/setUpdates filters above already guarantee this is set).
function getUpdateTimestamp(update: AnyUpdate): string {
  if (update.type === 'collection') return update.record.expand?.collection_id?.updated ?? update.record.created;
  if (update.type === 'set') return update.record.expand?.set_id?.updated ?? update.record.created;
  return update.record.created;
}

export const NotificationBell = () => {
  const { authData } = useGlobalAuthData();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isClearingAll, setIsClearingAll] = React.useState(false);
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

  // Most-recently-created first, across all four sources - a plain concat
  // would otherwise just group by type (all collection updates, then all
  // set updates, ...) regardless of when each actually happened.
  const updates: AnyUpdate[] = [...collectionUpdates, ...setUpdates, ...submissionUpdates, ...complaintUpdates].sort(
    (a, b) => new Date(getUpdateTimestamp(b)).getTime() - new Date(getUpdateTimestamp(a)).getTime(),
  );

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  /**
   * Dismisses a single notification - deletes the row for submission/complaint
   * notifications, or bumps the collection/set follow's last_checked_updated
   * marker forward. Shared by the per-row Clear button (refetch: true, no
   * navigation) and Clear All (refetch: false, batched into one refetch round
   * afterward via refetchAll). Silently swallows failures, same as the
   * original per-type handling this was extracted from - a failed dismiss
   * just means the notification reappears on next mount.
   */
  const dismissUpdate = async (update: AnyUpdate, { refetch = true }: { refetch?: boolean } = {}): Promise<boolean> => {
    try {
      if (update.type === 'collection') {
        const collectionUpdated = update.record.expand?.collection_id?.updated;
        if (!collectionUpdated) return false;
        await dismissCollectionNotification.mutateAsync({
          followRecordId: update.record.id,
          collectionUpdated,
        });
        if (refetch) await refetchCollections();
      } else if (update.type === 'set') {
        const setUpdated = update.record.expand?.set_id?.updated;
        if (!setUpdated) return false;
        await dismissSetNotification.mutateAsync({
          followRecordId: update.record.id,
          setUpdated,
        });
        if (refetch) await refetchSets();
      } else if (update.type === 'submission') {
        await dismissSubmissionNotification.mutateAsync(update.record.id);
        if (refetch) await refetchSubmissions();
      } else {
        await dismissComplaintNotification.mutateAsync(update.record.id);
        if (refetch) await refetchComplaints();
      }
      return true;
    } catch {
      // Silent — badge will reappear on next mount if dismiss failed
      return false;
    }
  };

  const handleNotificationClick = async (update: AnyUpdate) => {
    handleClose();
    const dismissed = await dismissUpdate(update);
    if (!dismissed) return;

    if (update.type === 'collection') {
      void navigate({
        to: '/profile/collections/$collectionId',
        params: { collectionId: update.record.collection_id },
      });
    } else if (update.type === 'set') {
      void navigate({ to: '/sets/$setId', params: { setId: update.record.set_id } });
    } else if (update.type === 'submission') {
      const resultingPatternId = update.record.expand?.submission?.resulting_pattern;
      if (update.record.status === 'published' && resultingPatternId) {
        void navigate({ to: '/pattern/$patternId', params: { patternId: resultingPatternId } });
      } else {
        void navigate({ to: '/profile/submissions' });
      }
    } else {
      const patternId = update.record.expand?.complaint?.pattern_id;
      if (patternId) {
        void navigate({ to: '/pattern/$patternId', params: { patternId } });
      }
    }
  };

  // Per-row Clear button - dismiss only, no navigation. stopPropagation keeps
  // the click from also bubbling to the MenuItem's own onClick (which navigates).
  const handleDismissClick = (e: React.MouseEvent, update: AnyUpdate) => {
    e.stopPropagation();
    void dismissUpdate(update);
  };

  const handleClearAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsClearingAll(true);
    try {
      await Promise.allSettled(updates.map((update) => dismissUpdate(update, { refetch: false })));
      await Promise.all([refetchCollections(), refetchSets(), refetchSubmissions(), refetchComplaints()]);
    } finally {
      setIsClearingAll(false);
    }
  };

  const menuItemStyles = {
    padding: '12px 20px',
    maxWidth: 320,
  };

  const dismissButtonSx = {
    ml: 'auto',
    mt: -0.5,
    mr: -1,
    flexShrink: 0,
    color: 'text.disabled',
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
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Notifications
            </Typography>
            {updates.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {updates.length} update{updates.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>
          {updates.length > 0 && (
            <Button
              size="small"
              onClick={handleClearAll}
              disabled={isClearingAll}
              sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 0, flexShrink: 0, py: 0.25 }}
            >
              {isClearingAll ? 'Clearing…' : 'Clear all'}
            </Button>
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
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                  <IconButton
                    size="small"
                    onClick={(e) => handleDismissClick(e, update)}
                    sx={dismissButtonSx}
                    aria-label="Dismiss notification"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
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
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                  <IconButton
                    size="small"
                    onClick={(e) => handleDismissClick(e, update)}
                    sx={dismissButtonSx}
                    aria-label="Dismiss notification"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
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
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                  <IconButton
                    size="small"
                    onClick={(e) => handleDismissClick(e, update)}
                    sx={dismissButtonSx}
                    aria-label="Dismiss notification"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
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
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                  <IconButton
                    size="small"
                    onClick={(e) => handleDismissClick(e, update)}
                    sx={dismissButtonSx}
                    aria-label="Dismiss notification"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </MenuItem>
              );
            }
          })
        )}
      </Menu>
    </>
  );
};
