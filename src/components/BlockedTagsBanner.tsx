import React from 'react';
import { Link } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { useSessionUnblockedTags } from '@/data/blocked-tags-session';
import { Box, Button, ButtonBase, Divider, FormControlLabel, Popover, Stack, Switch, Typography } from '@mui/material';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

// Lets a logged-in user know their blocked-tags list is silently filtering
// homepage results. Clicking opens a dropdown where each blocked tag can be
// temporarily toggled for the current session only (sessionStorage-backed -
// resets when the browser is closed; the profile's permanent list is never
// modified). Users with no blocked tags get a short explainer + CTA instead.
export const BlockedTagsBanner = () => {
  const { authData } = useGlobalAuthData();
  const { isUnblocked, toggleTag, unblockAll, reblockAll } = useSessionUnblockedTags();

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const blockedTags = authData?.blocked_tags ?? [];
  const blockedCount = blockedTags.length;
  const activeCount = blockedTags.filter((tag) => !isUnblocked(tag)).length;
  const allEnabled = activeCount === blockedCount;

  // Blocked tags are a logged-in feature - nothing to show or explain otherwise
  if (!authData) return null;

  const label =
    blockedCount === 0
      ? 'Blocked tags'
      : activeCount === blockedCount
        ? `Hiding ${blockedCount} blocked tag${blockedCount !== 1 ? 's' : ''}`
        : `Hiding ${activeCount} of ${blockedCount} blocked tags`;

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 0,
          px: 2,
          py: 0.25,
          opacity: 0.7,
          borderRadius: 1,
          '&:hover': { opacity: 1 },
        }}
      >
        <VisibilityOffRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />

        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>

        <ExpandMoreRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      </ButtonBase>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: 2, width: 280, p: 2 } } }}
      >
        {blockedCount > 0 ? (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Temporarily enable or disable your blocked tags.
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={allEnabled}
                  onChange={() => (allEnabled ? unblockAll(blockedTags) : reblockAll())}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {allEnabled ? 'Disable all' : 'Enable all'}
                </Typography>
              }
              sx={{ ml: 0 }}
            />

            <Divider />

            <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
              <Stack spacing={0}>
                {blockedTags.map((tag) => (
                  <FormControlLabel
                    key={tag}
                    control={<Switch size="small" checked={!isUnblocked(tag)} onChange={() => toggleTag(tag)} />}
                    label={
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }} noWrap>
                        {tag}
                      </Typography>
                    }
                    sx={{ ml: 0, minWidth: 0 }}
                  />
                ))}
              </Stack>
            </Box>

            <Divider />

            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
              <Link
                to="/profile/edit"
                search={{ tab: 'general' }}
                style={{ color: 'inherit' }}
                onClick={() => setAnchorEl(null)}
              >
                Manage blocked tags
              </Link>
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              You can block certain tags to hide patterns you'd rather not see in your search results. Blocked tags are
              filtered out silently, and you can pause them here any time.
            </Typography>

            <Link
              to="/profile/edit"
              search={{ tab: 'general' }}
              style={{ textDecoration: 'none' }}
              onClick={() => setAnchorEl(null)}
            >
              <Button size="small" variant="contained" fullWidth>
                Customize your experience
              </Button>
            </Link>
          </Stack>
        )}
      </Popover>
    </>
  );
};
