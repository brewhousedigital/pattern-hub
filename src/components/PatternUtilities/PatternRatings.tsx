import React, { useState } from 'react';
import type { TypeViewData } from '@/functions/types/types.ts';
import { SectionLabel } from '@/components/ViewHelpers';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import {
  useQueryGetPatternRating,
  useMutationCreatePatternRating,
  useMutationUpdatePatternRating,
  type TypeRatingPayload,
  useQueryGetCommunityRatingByPatternId,
} from '@/functions/database/ratings';

import { alpha } from '@mui/material/styles';

import { Box, Typography, Rating } from '@mui/material';

export const PatternRatings = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [userRating, setUserRating] = useState<number | null>(0);

  const { isPending, isError, data, refetch } = useQueryGetPatternRating(viewData?.id || '');

  const createRating = useMutationCreatePatternRating();
  const updateRating = useMutationUpdatePatternRating();

  const {
    isPending: isPendingCommunityRating,
    isError: isErrorCommunityRating,
    data: communityRating,
    refetch: refetchCommunityRating,
  } = useQueryGetCommunityRatingByPatternId(viewData?.id || '');

  React.useEffect(() => {
    if (data) {
      setUserRating(data.rating);
    } else {
      setUserRating(0);
    }
  }, [data]);

  const handleChange = async (_e: any, val: number | null) => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can rate patterns', { variant: 'error' });
      return;
    }

    try {
      const payload: TypeRatingPayload = {
        pattern_id: viewData?.id || '',
        owner_id: authData?.id || '',
        rating: val || 3,
        rating_notes: '',
      };

      // If there's already a rating, we need to update instead of create, and we need to include the record ID for the update
      if (data) {
        payload.id = data.id;
        await updateRating.mutateAsync(payload);
      } else {
        await createRating.mutateAsync(payload);
      }

      await refetch();
      await refetchCommunityRating();

      setUserRating(val);
    } catch (error) {
      enqueueSnackbar("Oops... couldn't rate this pattern right now. Try again in a few minutes.", {
        variant: 'error',
      });
    }
  };

  return (
    <Box sx={{ mb: 2.5 }}>
      <SectionLabel>Community Rating</SectionLabel>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Rating
          disabled
          precision={0.1}
          value={communityRating?.average_rating || 0}
          sx={{
            '& .MuiRating-iconFilled': { color: 'primary.main' },
            '& .MuiRating-iconHover': { color: '#DDB97E' },
            '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.5) },
          }}
        />
        {communityRating?.total_ratings || 0 > 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {communityRating?.average_rating} star{(communityRating?.average_rating || 0) > 1 ? 's' : ''} ·{' '}
            {communityRating?.total_ratings} ratings
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This pattern hasn't been rated yet
          </Typography>
        )}
      </Box>

      {authData && (
        <>
          <SectionLabel>Your Rating</SectionLabel>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Rating
              precision={1}
              value={userRating}
              onChange={handleChange}
              sx={{
                '& .MuiRating-iconFilled': { color: 'primary.main' },
                '& .MuiRating-iconHover': { color: '#DDB97E' },
                '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.5) },
              }}
            />
          </Box>
        </>
      )}
    </Box>
  );
};
