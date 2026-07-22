import React, { useState } from 'react';
import type { TypeViewData } from '@/functions/types/types.ts';
import { SectionLabel } from '@/components/ViewHelpers';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';

import {
  useMutationCreatePatternRating,
  useMutationUpdatePatternRating,
  useMutationRemovePatternRating,
  type TypeRatingPayload,
} from '@/functions/database/ratings';

import {
  useMutationCreatePatternDifficultyRating,
  useMutationUpdatePatternDifficultyRating,
  useMutationDeletePatternDifficultyRating,
  type TypeDifficultyRatingPayload,
} from '@/functions/database/difficulty_ratings';

import { useQueryGetPatternDrawerData, useInvalidateDrawerData } from '@/functions/database/pattern-drawer-data';

import { alpha } from '@mui/material/styles';
import { Box, Button, Typography, Rating, Chip, Stack, useMediaQuery } from '@mui/material';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import { CollapsibleCard } from '@/components/cards/CollapsibleCard';
import { getDifficultyInfo, toScale10, toRatingValue as toRatingVal } from '@/functions/utilities/difficulty';

// ─── Component ────────────────────────────────────────────────────────────────

export const PatternRatingsContainer = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [userStarRating, setUserStarRating] = useState<number | null>(0);
  const [diffHover, setDiffHover] = useState(-1);

  // Half-star precision relies on hover preview to place a tap accurately - fine with a
  // mouse, a guessing game with a fingertip. Coarsen to whole steps for touch input;
  // checking pointer precision rather than viewport width so a touch-capable laptop
  // with a trackpad (fine pointer) still gets the desktop behavior.
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');

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
  const removeRating = useMutationRemovePatternRating();
  const createDifficulty = useMutationCreatePatternDifficultyRating();
  const updateDifficulty = useMutationUpdatePatternDifficultyRating();
  const deleteDifficulty = useMutationDeletePatternDifficultyRating();

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

  const handleClearRating = async () => {
    if (!userRatingData) return;
    try {
      await removeRating.mutateAsync(userRatingData.id);
      setUserStarRating(0);
      await invalidateDrawerData();
    } catch {
      enqueueSnackbar("Couldn't remove your rating. Try again in a few minutes.", { variant: 'error' });
    }
  };

  const handleClearDifficulty = async () => {
    if (!userDifficultyData) return;
    try {
      await deleteDifficulty.mutateAsync(userDifficultyData.id);
      await invalidateDrawerData();
    } catch {
      enqueueSnackbar("Couldn't remove your difficulty rating. Try again in a few minutes.", { variant: 'error' });
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

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 2.5 }}>
            <Rating
              precision={1}
              size={isCoarsePointer ? 'large' : 'medium'}
              value={userStarRating}
              onChange={handleStarChange}
              sx={{
                fontSize: isCoarsePointer ? '2.5rem' : undefined,
                '& .MuiRating-iconFilled': { color: 'primary.main' },
                '& .MuiRating-iconHover': { color: '#DDB97E' },
                '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.5) },
              }}
            />
            {userRatingData && (
              <Button
                size="small"
                color="error"
                variant="text"
                onClick={handleClearRating}
                loading={removeRating.isPending}
                sx={{ minWidth: 0, px: 1, fontSize: '0.75rem' }}
              >
                Clear
              </Button>
            )}
          </Box>

          <SectionLabel>Your Difficulty</SectionLabel>

          <Box sx={{ mb: 0 }}>
            <Stack
              direction={isCoarsePointer ? 'column' : 'row'}
              sx={{ alignItems: isCoarsePointer ? 'flex-start' : 'center', justifyContent: 'space-between' }}
              spacing={isCoarsePointer ? 0.75 : 1.5}
            >
              <Rating
                precision={isCoarsePointer ? 1 : 0.5}
                size={isCoarsePointer ? 'large' : 'medium'}
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
                  fontSize: isCoarsePointer ? '2.5rem' : undefined,
                  '& .MuiRating-iconFilled': { color: activeDiffInfo?.hex ?? 'primary.main' },
                  '& .MuiRating-iconHover': { color: activeDiffInfo?.hex ?? 'primary.main' },
                  '& .MuiRating-iconEmpty': { color: alpha('#888888', 0.35) },
                }}
              />

              {activeDiffLabel && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: activeDiffInfo?.hex ?? 'text.secondary',
                    minWidth: isCoarsePointer ? undefined : 90,
                    textAlign: isCoarsePointer ? 'left' : 'right',
                  }}
                >
                  {activeDiffLabel}
                </Typography>
              )}
            </Stack>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color="text.disabled">
                Easy to Hard
              </Typography>

              {userDifficultyData && (
                <Button
                  size="small"
                  color="error"
                  variant="text"
                  onClick={handleClearDifficulty}
                  loading={deleteDifficulty.isPending}
                  sx={{ minWidth: 0, px: 1, fontSize: '0.75rem', ml: 'auto' }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Box>
        </CollapsibleCard>
      )}
    </Box>
  );
};
