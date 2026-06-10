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

import { Box, Typography, ToggleButtonGroup, ToggleButton, Chip } from '@mui/material';

function getDifficultyLabel(avg: number): { label: string; color: 'success' | 'warning' | 'error' } {
  if (avg < 4) return { label: 'Beginner', color: 'success' };
  if (avg < 7) return { label: 'Intermediate', color: 'warning' };
  return { label: 'Expert', color: 'error' };
}

function getButtonColor(n: number): string {
  if (n <= 3) return 'success.main';
  if (n <= 6) return 'warning.main';
  return 'error.main';
}

export const PatternDifficultyRating = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [userRating, setUserRating] = useState<number | null>(null);

  const { data, refetch } = useQueryGetPatternDifficultyRating(viewData?.id || '');
  const { data: communityRating, refetch: refetchCommunityRating } =
    useQueryGetCommunityDifficultyRatingByPatternId(viewData?.id || '');

  const createRating = useMutationCreatePatternDifficultyRating();
  const updateRating = useMutationUpdatePatternDifficultyRating();

  React.useEffect(() => {
    setUserRating(data ? data.rating : null);
  }, [data]);

  const handleChange = async (_e: React.MouseEvent<HTMLElement>, val: number | null) => {
    if (val === null) return;

    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before rating difficulty', { variant: 'error' });
      return;
    }

    try {
      const payload: TypeDifficultyRatingPayload = {
        pattern_id: viewData?.id || '',
        owner_id: authData?.id || '',
        rating: val,
      };

      if (data) {
        payload.id = data.id;
        await updateRating.mutateAsync(payload);
      } else {
        await createRating.mutateAsync(payload);
      }

      await refetch();
      await refetchCommunityRating();
      setUserRating(val);
    } catch {
      enqueueSnackbar("Couldn't save your difficulty rating. Try again in a few minutes.", { variant: 'error' });
    }
  };

  const hasCommunityData = communityRating && (communityRating.total_ratings ?? 0) > 0;
  const difficulty = hasCommunityData ? getDifficultyLabel(communityRating.average_rating) : null;

  return (
    <Box>
      <SectionLabel>Community Difficulty</SectionLabel>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, justifyContent: 'space-between' }}>
        {difficulty && communityRating ? (
          <>
            <Chip label={difficulty.label} color={difficulty.color} size="small" />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              avg {communityRating.average_rating.toFixed(1)} · {communityRating.total_ratings} rating
              {communityRating.total_ratings !== 1 ? 's' : ''}
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
            <ToggleButtonGroup
              value={userRating}
              exclusive
              onChange={handleChange}
              size="small"
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                '& .MuiToggleButtonGroup-grouped': {
                  borderRadius: '6px !important',
                  border: '1px solid !important',
                  borderColor: 'divider !important',
                  mx: 0,
                },
              }}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <ToggleButton
                  key={n}
                  value={n}
                  sx={{
                    minWidth: 32,
                    px: 1,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    '&.Mui-selected': {
                      color: 'white',
                      backgroundColor: getButtonColor(n),
                      borderColor: `${getButtonColor(n)} !important`,
                      '&:hover': { backgroundColor: getButtonColor(n) },
                    },
                  }}
                >
                  {n}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
              1 = Easiest &nbsp;·&nbsp; 10 = Hardest
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};
