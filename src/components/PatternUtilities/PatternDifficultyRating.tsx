import React, { useState } from 'react';
import type { TypeViewData } from '@/functions/types/types.ts';
import { SectionLabel } from '@/components/ViewHelpers';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import {
  useQueryGetPatternDifficultyRating,
  useQueryGetCommunityDifficultyRatingByPatternId,
  useMutationCreatePatternDifficultyRating,
  useMutationUpdatePatternDifficultyRating,
  type TypeDifficultyRatingPayload,
} from '@/functions/database/difficulty_ratings';

import { alpha } from '@mui/material/styles';
import { Box, Typography, Rating, Chip, Stack } from '@mui/material';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';

// Rating component uses 0.5–5 with precision 0.5 → 10 possible values.
// Stored in PocketBase as 1–10.
const toScale10 = (v: number) => Math.round(v * 2);
const toRatingVal = (d: number) => d / 2;

type DifficultyInfo = { label: string; color: 'success' | 'warning' | 'error'; hex: string };

function getDifficultyInfo(d: number): DifficultyInfo {
  if (d <= 3) return { label: 'Beginner', color: 'success', hex: '#4caf50' };
  if (d <= 6) return { label: 'Intermediate', color: 'warning', hex: '#ff9800' };
  return { label: 'Expert', color: 'error', hex: '#f44336' };
}

export const PatternDifficultyRating = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [hover, setHover] = useState(-1);

  const { data, refetch } = useQueryGetPatternDifficultyRating(viewData?.id || '');
  const { data: communityRating, refetch: refetchCommunityRating } = useQueryGetCommunityDifficultyRatingByPatternId(
    viewData?.id || '',
  );

  const createRating = useMutationCreatePatternDifficultyRating();
  const updateRating = useMutationUpdatePatternDifficultyRating();

  // Stored as 1–10, shown as 0.5–5
  const userRatingVal = data?.rating ? toRatingVal(data.rating) : null;
  console.log('>>>data', data);
  console.log('>>>userRatingVal', userRatingVal);

  const handleChange = async (_e: React.SyntheticEvent, val: number | null) => {
    if (val === null) return;

    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before rating difficulty', { variant: 'error' });
      return;
    }

    try {
      const payload: TypeDifficultyRatingPayload = {
        pattern_id: viewData?.id || '',
        owner_id: authData?.id || '',
        rating: toScale10(val),
      };

      if (data) {
        payload.id = data.id;
        await updateRating.mutateAsync(payload);
      } else {
        await createRating.mutateAsync(payload);
      }

      await refetch();
      await refetchCommunityRating();
    } catch {
      enqueueSnackbar("Couldn't save your difficulty rating. Try again in a few minutes.", { variant: 'error' });
    }
  };

  const hasCommunityData = communityRating && (communityRating.total_ratings ?? 0) > 0;
  const communityInfo = hasCommunityData ? getDifficultyInfo(communityRating.average_rating) : null;

  // Color tracks hovered value → saved value → none
  const activeVal = hover !== -1 ? hover : (userRatingVal ?? 0);
  const activeInfo = activeVal > 0 ? getDifficultyInfo(toScale10(activeVal)) : null;

  // Label shown next to user rating (during hover or when saved)
  const activeLabel =
    hover !== -1
      ? getDifficultyInfo(toScale10(hover)).label
      : userRatingVal
        ? getDifficultyInfo(toScale10(userRatingVal)).label
        : null;

  return (
    <Box>
      <SectionLabel>Community Difficulty</SectionLabel>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, justifyContent: 'space-between' }}>
        {communityInfo && communityRating ? (
          <>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Rating
                readOnly
                precision={0.1}
                value={toRatingVal(communityRating.average_rating)}
                icon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                emptyIcon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                sx={{
                  '& .MuiRating-iconFilled': { color: communityInfo.hex },
                  '& .MuiRating-iconEmpty': { color: alpha(communityInfo.hex, 0.22) },
                }}
              />
              <Chip label={communityInfo.label} color={communityInfo.color} size="small" />
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {communityRating.total_ratings} rating{communityRating.total_ratings !== 1 ? 's' : ''}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            No ratings yet
          </Typography>
        )}
      </Box>

      {authData && (
        <>
          <SectionLabel>Your Difficulty</SectionLabel>

          <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Rating
                precision={0.5}
                value={userRatingVal}
                onChange={handleChange}
                onChangeActive={(_, newHover) => setHover(newHover)}
                getLabelText={(value) => {
                  const d = toScale10(value);
                  return `${d}/10 — ${getDifficultyInfo(d).label}`;
                }}
                icon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                emptyIcon={<BrokenImageOutlinedIcon fontSize="inherit" />}
                sx={{
                  '& .MuiRating-iconFilled': { color: activeInfo?.hex ?? 'primary.main' },
                  '& .MuiRating-iconHover': { color: activeInfo?.hex ?? 'primary.main' },
                  '& .MuiRating-iconEmpty': { color: alpha('#888888', 0.35) },
                }}
              />
              {activeLabel && (
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: activeInfo?.hex ?? 'text.secondary', minWidth: 90 }}
                >
                  {activeLabel}
                </Typography>
              )}
            </Stack>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
              Easy to Hard
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};
