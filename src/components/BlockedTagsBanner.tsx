import React from 'react';
import { Link } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { Box, Typography } from '@mui/material';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';

// Lets a logged-in user know their blocked-tags list is silently filtering
// homepage results, with a quick link back to where they manage it. Kept
// intentionally low-key - a small text line, not a full alert box.
export const BlockedTagsBanner = () => {
  const { authData } = useGlobalAuthData();
  const blockedCount = authData?.blocked_tags?.length ?? 0;

  if (blockedCount === 0) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0, px: 2, opacity: 0.7 }}>
      <VisibilityOffRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />

      <Typography variant="caption" color="text.secondary">
        <Link to="/profile/edit" search={{ tab: 'privacy' }} style={{ color: 'inherit' }}>
          Hiding {blockedCount} blocked tag{blockedCount !== 1 ? 's' : ''}
        </Link>
      </Typography>
    </Box>
  );
};
