import React, { useState } from 'react';
import type { TypeViewData } from '@/functions/types/types.ts';
import { SectionLabel } from '@/components/ViewHelpers';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';

import {
  useMutationCreatePatternRating,
  useMutationUpdatePatternRating,
  type TypeRatingPayload,
} from '@/functions/database/ratings';

import {
  useMutationCreatePatternDifficultyRating,
  useMutationUpdatePatternDifficultyRating,
  type TypeDifficultyRatingPayload,
} from '@/functions/database/difficulty_ratings';

import {
  useQueryGetPatternDrawerData,
  useInvalidateDrawerData,
} from '@/functions/database/pattern-drawer-data';

import { alpha } from '@mui/material/styles';
import { Box, Typography, Rating, Chip, Stack } from '@mui/material';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import { CollapsibleCard } from '@/components/cards/CollapsibleCard';

// ─── Difficulty helpers ────────────────────────────────────────────────────────

const toScale10 = (v: number) => Math.round(v * 2);
const toRatingVal = (d: number) => d / 2;

type DifficultyInfo = { label: string; color: 'success' | 'warning' | 'error'; hex: string };

function getDifficultyInfo(d: number): DifficultyInfo {
  if (d <= 3) return { label: 'Beginner', color: 'success', hex: '#4caf50' };
  if (d <= 6) return { label: 'Intermediate', color: 'warning', hex: '#ff9800' };
  return { label: 'Expert', color: 'error', hex: '#f44336' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PatternRatingsContainer = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [userStarRating, setUserStarRating] = useState<number | null>(0);
  const [diffHover, setDiffHover] = useState(-1);

  const patternId = viewData?.id || '';
  const userId = authData?.id || '';

  const { data: drawerData } = useQueryGetPatternDrawerData(patternId, userId);
  const invalidateDrawerData = useInvalidateDrawerData(patternId, userId);

  const userRatingData = drawerData?.userRating ?? null;
  const communityRatingData = drawerData?.communityRating ?? null;
  const userDifficultyData = drawerData?.userDifficulty ?? null;
  const communityDifficultyData = drawerData?.communityDifficulty ?? null;

  const createRating = useMutationCreatePatternRating();
  const updateRating = useMutationUpdatePatternRating();
  const createDifficulty = useMutationCreatePatternDifficultyRating();
  const updateDifficulty = useMutationUpdatePatternDifficultyRating();

  React.useEffect(() => {
    setUserStarRating(userRatingData ? userRatingData.rating : 0);
  }, [userRatingData]);

  const userDifficultyVal = userDifficultyData?.rating ? toRatingVal(userDifficultyData.rating) : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStarChange = async (_e: any, val: number | null) => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can rate patterns', { variant: 'error' });
      return;
    }
    try {
      const payload: TypeRatingPayload = {
        pattern_id: patternId,
        owner_id: userId,
        rating: val || 3,
        rating_notes: '',
      };
      if (userRatingData) {
        payload.id = userRatingData.id;
        await updateRating.mutateAsync(payload);
      } else {
        await createRating.mutateAsync(payload);
      }
      setUserStarRating(val);
      await invalidateDrawerData();
    } catch {
      enqueueSnackbar("Oops... couldn't rate this pattern right now. Try again in a few minutes.", {
        variant: 'error',
      });
    }
  };

  const handleDifficultyChange = async (_e: React.SyntheticEvent, val: number | null) => {
    if (val === null) return;
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before rating difficulty', { variant: 'error' });
      return;
    }
    try {
      const payload: TypeDifficultyRatingPayload = {
        pattern_id: patternId,
        owner_id: userId,
        rating: toScale10(val),
      };
      if (userDifficultyData) {
        payload.id = userDifficultyData.id;
        await updateDifficulty.mutateAsync(payload);
      } else {
        await createDifficulty.mutateAsync(payload);
      }
      await invalidateDrawerData();
    } catch {
      enqueueSnackbar("Couldn't save your difficulty rating. Try again in a few minutes.", { variant: 'error' });
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────

  const hasCommunityRating = (communityRatingData?.total_ratings ?? 0) > 0;

  const hasCommunityDifficulty = (communityDifficultyData?.total_ratings ?? 0) > 0;
  const communityDifficultyInfo = hasCommunityDifficulty
    ? getDifficultyInfo(communityDifficultyData!.average_rating)
    : null;

  const activeDiffVal = diffHover !== -1 ? diffHover : (userDifficultyVal ?? 0);
  const activeDiffInfo = activeDiffVal > 0 ? getDifficultyInfo(toScale10(activeDiffVal)) : null;
  const activeDiffLabel =
    diffHover !== -1
      ? getDifficultyInfo(toScale10(diffHover)).label
      : userDifficultyVal
        ? getDifficultyInfo(toScale10(userDifficultyVal)).label
        : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* ── Community Rating ──────────────────────────────── */}
      <SectionLabel>Community Rating</SectionLabel>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, justifyContent: 'space-between' }}>
        <Rating
          readOnly
          precision={0.1}
          value={communityRatingData?.average_rating || 0}
          sx={{
            '& .MuiRating-iconFilled': { color: 'primary.main' },
            '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.5) },
          }}
        />
        {hasCommunityRating && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {communityRatingData!.average_rating.toFixed(1)} stars · {communityRatingData!.total_ratings} ratings
          </Typography>
        )}
      </Box>

      {/* ── Community Difficulty ──────────────────────────── */}
      <SectionLabel>Community Difficulty</SectionLabel>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, justifyContent: 'space-between' }}>
        {communityDifficultyInfo && communityDifficultyData ? (
          <>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
              <Rating
                readOnly
                precision={0.1}
                value={toRatingVal(communityDifficultyData.average_rating)}
                icon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                emptyIcon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                sx={{
                  '& .MuiRating-iconFilled': { color: communityDifficultyInfo.hex },
                  '& .MuiRating-iconEmpty': { color: alpha(communityDifficultyInfo.hex, 0.22) },
                }}
              />
              <Chip label={communityDifficultyInfo.label} color={communityDifficultyInfo.color} size="small" />
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {communityDifficultyData.total_ratings} rating{communityDifficultyData.total_ratings !== 1 ? 's' : ''}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            No ratings yet
          </Typography>
        )}
      </Box>

      {/* ── User rating sections (collapsible) ────────────── */}
      {authData && (
        <CollapsibleCard title="Give this a rating">
          <SectionLabel>Your Rating</SectionLabel>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Rating
              precision={1}
              value={userStarRating}
              onChange={handleStarChange}
              sx={{
                '& .MuiRating-iconFilled': { color: 'primary.main' },
                '& .MuiRating-iconHover': { color: '#DDB97E' },
                '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.5) },
              }}
            />
          </Box>

          <SectionLabel>Your Difficulty</SectionLabel>

          <Box sx={{ mb: 0 }}>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1.5}>
              <Rating
                precision={0.5}
                value={userDifficultyVal}
                onChange={handleDifficultyChange}
                onChangeActive={(_, newHover) => setDiffHover(newHover)}
                getLabelText={(value) => {
                  const d = toScale10(value);
                  return `${d}/10 — ${getDifficultyInfo(d).label}`;
                }}
                icon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                emptyIcon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                sx={{
                  '& .MuiRating-iconFilled': { color: activeDiffInfo?.hex ?? 'primary.main' },
                  '& .MuiRating-iconHover': { color: activeDiffInfo?.hex ?? 'primary.main' },
                  '& .MuiRating-iconEmpty': { color: alpha('#888888', 0.35) },
                }}
              />
              {activeDiffLabel && (
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: activeDiffInfo?.hex ?? 'text.secondary', minWidth: 90 }}
                >
                  {activeDiffLabel}
                </Typography>
              )}
            </Stack>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
              Easy to Hard
            </Typography>
          </Box>
        </CollapsibleCard>
      )}
    </Box>
  );
};
