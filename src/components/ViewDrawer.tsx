import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useGlobalIsViewOpen, useGlobalViewData } from '@/data/view';
import { MetaRow, ThinDivider, SectionLabel } from '@/components/ViewHelpers';
import { ExportPatternForPrintV2 } from '@/components/ExportPatternForPrintV2';
import { ExportPatternToDownload } from '@/components/ExportPatternToDownload';
import { createPrettyDate } from '@/functions/utilities/dates';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import {
  useMutationFavoritePattern,
  useMutationRemoveFavoritePattern,
  useQueryGetPatternFavoriteStatus,
} from '@/functions/database/favorites';
import {
  useMutationMarkDonePattern,
  useMutationRemoveMarkDonePattern,
  useQueryGetPatternDoneStatus,
} from '@/functions/database/marked-done';
import {
  useQueryGetPatternRating,
  useMutationCreatePatternRating,
  useMutationUpdatePatternRating,
  useMutationRemovePatternRating,
  type TypeRatingPayload,
  useQueryGetCommunityRatingByPatternId,
} from '@/functions/database/ratings';
import { useMutationCreateComplaint } from '@/functions/database/complaints';

import { alpha } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

import {
  Alert,
  Box,
  Typography,
  Chip,
  Rating,
  Button,
  IconButton,
  Paper,
  Stack,
  Grid,
  Collapse,
  TextField,
} from '@mui/material';

type ViewDrawerProps = {
  hideNavigation?: boolean;
};

export const ViewDrawer = (props: ViewDrawerProps) => {
  const { viewData, viewAllPatternData, setViewData } = useGlobalViewData();

  const { handleCloseView } = useGlobalIsViewOpen();

  const tags = viewData?.tags.split(',');

  // On modal load, see if this is index 0 or the last object so we can disable/enable prev and next
  const patternListLength = viewAllPatternData?.length || 0;
  const thisPatternIndex = viewAllPatternData?.findIndex((item) => item.id === viewData?.id);

  const navigate = useNavigate();

  const isFirstItem = thisPatternIndex === 0;
  const isLastItem = thisPatternIndex === patternListLength - 1;

  const svgImageUrl = generatePbImage(viewData);

  const handlePrev = () => {
    const prevIndex = Number(thisPatternIndex || 0) - 1;
    modalNavigation(prevIndex);
  };

  const handleNext = () => {
    const nextIndex = Number(thisPatternIndex || 0) + 1;
    modalNavigation(nextIndex);
  };

  const modalNavigation = (index: number) => {
    const newPattern = viewAllPatternData?.[index];
    setViewData(newPattern);

    navigate({
      to: '/',
      search: (prev) => ({ ...prev, view: newPattern?.id }),
    }).then();
  };

  return (
    <Box sx={{ backgroundColor: 'background.default' }}>
      <Box sx={{ maxWidth: 1500, mx: 'auto', px: { xs: 2, md: 4 }, py: 3, position: 'relative', zIndex: 1 }}>
        {!props.hideNavigation && (
          <Box
            sx={{
              display: { xs: 'grid', md: 'flex' },
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 4,
              pb: 2.5,
              borderBottom: `1px solid ${alpha('#C8A96E', 0.2)}`,
            }}
          >
            <Box sx={{ order: { xs: 1, md: 1 } }}>
              <Button
                startIcon={<ArrowBackIosNewIcon fontSize="inherit" />}
                variant="outlined"
                disabled={isFirstItem}
                size="small"
                onClick={handlePrev}
              >
                Previous
              </Button>
            </Box>

            <Box sx={{ order: { xs: 3, md: 2 } }}>
              <Button
                startIcon={<OpenInNewRoundedIcon />}
                component={Link}
                variant="outlined"
                size="small"
                to={`/pattern/${viewData?.id}`}
              >
                View Standalone
              </Button>
            </Box>

            <Box sx={{ order: { xs: 4, md: 3 }, textAlign: 'right' }}>
              <Button startIcon={<CloseIcon />} variant="outlined" size="small" onClick={handleCloseView}>
                Close Window
              </Button>
            </Box>

            <Box sx={{ order: { xs: 2, md: 4 }, textAlign: 'right' }}>
              <Button
                disabled={isLastItem}
                endIcon={<ArrowForwardIosIcon fontSize="inherit" />}
                variant="outlined"
                size="small"
                onClick={handleNext}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 500px' },
            gap: 4,
            alignItems: 'start',
          }}
        >
          <Box>
            <Box
              sx={{
                backgroundColor: '#fff',
                //border: `1px solid ${alpha('#C8A96E', 0.2)}`,
                border: (theme) => `2px solid ${theme.palette.primary.main}`,
                borderRadius: 6,
                mb: 3,
                p: 2,
              }}
            >
              <img
                src={svgImageUrl}
                alt={`pattern template for ${viewData?.name}`}
                style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
              />
            </Box>

            <ExportPatternToDownload />

            <ExportPatternForPrintV2 />
          </Box>

          <Box>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
                <Typography
                  variant="h3"
                  sx={{
                    wordBreak: 'break-word',
                    fontSize: { xs: '2rem', md: '3rem' },
                    lineHeight: 1.1,
                    color: 'text.primary',
                    mb: 0.5,
                  }}
                >
                  {viewData?.name}
                </Typography>
              </Box>

              <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.1em' }}>
                ID: {viewData?.id}
              </Typography>
            </Box>

            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2.5, wordBreak: 'break-word' }}
            >
              {viewData?.description}
            </Typography>

            <ThinDivider />

            <FavoriteAndDone />

            <Ratings />

            <ThinDivider />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                rowGap: 0,
              }}
            >
              <MetaRow label="Width" value={viewData?.design_width} unit={viewData?.design_width_unit} />
              <MetaRow label="Height" value={viewData?.design_height} unit={viewData?.design_height_unit} />
              <MetaRow label="Line Width" value={viewData?.line_width} unit={viewData?.line_width_unit} />
              <MetaRow label="Pieces" value={viewData?.pieces?.toLocaleString()} />
            </Box>

            <ThinDivider />

            <Stack spacing={2} sx={{ mb: 2.5 }}>
              <Box>
                <SectionLabel>Designed by</SectionLabel>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">{viewData?.authors || 'Not Listed'}</Typography>
                </Box>
              </Box>

              <Box>
                <SectionLabel>Uploaded by</SectionLabel>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">{viewData?.uploaded_by || 'Not Listed'}</Typography>
                </Box>
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                rowGap: 0,
              }}
            >
              <MetaRow label="Created On" value={createPrettyDate(viewData?.created || '')} />
              <MetaRow label="Last Update" value={createPrettyDate(viewData?.updated || '')} />
            </Box>

            <ThinDivider />

            <Box>
              <SectionLabel>Tags</SectionLabel>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                {tags?.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: alpha('#C8A96E', 0.25),
                      color: 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            </Box>

            <ThinDivider />

            <ReportAnIssue />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const ReportAnIssue = () => {
  const { viewData } = useGlobalViewData();
  const { authData } = useGlobalAuthData();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [email, setEmail] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (authData && authData?.email) {
      setEmail(authData?.email);
    }
  }, [authData]);

  React.useEffect(() => {
    setIsOpen(false);
    setIsDone(false);
  }, [viewData]);

  const createComplaint = useMutationCreateComplaint();

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (reason.length < 25) {
      enqueueSnackbar('Please make your complaint more descriptive.', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await createComplaint.mutateAsync({
        pattern_id: viewData?.id || '',
        owner_id: authData?.id || '',
        email: email,
        reason: reason,
      });

      setIsOpen(false);
      setIsDone(true);

      setTimeout(() => {
        setReason('');
      }, 1000);
    } catch (error: any) {
      enqueueSnackbar("Couldn't submit your complaint right now. Try again in a few minutes.", { variant: 'error' });
    }

    setIsLoading(false);
  };

  return (
    <>
      <Collapse in={!isDone}>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ReportProblemOutlinedIcon fontSize="small" />}
            size="small"
            onClick={() => {
              setIsOpen(true);
            }}
            color="warning"
          >
            Report an issue
          </Button>
        </Box>
      </Collapse>

      <Collapse in={isOpen}>
        <Stack onSubmit={handleSubmit} gap={2} component="form">
          <TextField variant="filled" label="Contact Email" value={email} onChange={(e) => setEmail(e.target.value)} />

          <TextField
            multiline
            variant="filled"
            label="Reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <Box>
            <Button variant="outlined" type="submit" loading={isLoading}>
              Submit
            </Button>
          </Box>
        </Stack>
      </Collapse>

      <Collapse in={isDone}>
        <Alert severity="info">
          Your issue has been logged. <br />
          We will review it as quickly as possible.
        </Alert>
      </Collapse>
    </>
  );
};

const FavoriteAndDone = () => {
  const { viewData } = useGlobalViewData();
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data } = useQueryGetPatternFavoriteStatus(viewData?.id || '');

  const favoritePattern = useMutationFavoritePattern();
  const removeFavorite = useMutationRemoveFavoritePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;

  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(37);

  const handleDone = () => {
    setDone((prev) => !prev);
    setDoneCount((prev) => (done ? prev - 1 : prev + 1));
  };

  if (!authData) {
    return (
      <Box sx={{ mb: 2.5 }}>
        <Alert severity="info">Log in to favorite the patterns you like</Alert>
      </Box>
    );
  }

  return (
    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
      <Grid size={{ xs: 6 }}>
        <FavoriteButton />
      </Grid>

      <Grid size={{ xs: 6 }}>
        <MarkAsDoneButton />
      </Grid>
    </Grid>
  );
};

const FavoriteButton = () => {
  const { viewData } = useGlobalViewData();
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data, refetch } = useQueryGetPatternFavoriteStatus(viewData?.id || '');

  const favoritePattern = useMutationFavoritePattern();
  const removeFavorite = useMutationRemoveFavoritePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;

  const [isFavorite, setIsFavorite] = useState(false);

  React.useEffect(() => {
    setIsFavorite(!!data?.id);
  }, [data]);

  const handleFavorite = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can favorite this pattern', { variant: 'error' });
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(data?.id || '');
      } else {
        await favoritePattern.mutateAsync(viewData?.id || '');
      }

      await refetch();

      setIsFavorite((prev) => !prev);
    } catch (error: any) {
      enqueueSnackbar('Something went wrong trying to favorite this pattern. Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Button
      loading={isLoading}
      onClick={handleFavorite}
      size="small"
      disableElevation
      variant={isFavorite ? 'contained' : 'outlined'}
      fullWidth
      startIcon={isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
    >
      Favorite
    </Button>
  );
};

const MarkAsDoneButton = () => {
  const { viewData } = useGlobalViewData();
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data, refetch } = useQueryGetPatternDoneStatus(viewData?.id || '');

  const favoritePattern = useMutationMarkDonePattern();
  const removeFavorite = useMutationRemoveMarkDonePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;

  const [isFavorite, setIsFavorite] = useState(false);

  React.useEffect(() => {
    setIsFavorite(!!data?.id);
  }, [data]);

  const handleFavorite = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can mark this pattern as done', { variant: 'error' });
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(data?.id || '');
      } else {
        await favoritePattern.mutateAsync(viewData?.id || '');
      }

      await refetch();

      setIsFavorite((prev) => !prev);
    } catch (error: any) {
      enqueueSnackbar('Something went wrong trying to favorite this pattern. Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Button
      loading={isLoading}
      onClick={handleFavorite}
      size="small"
      disableElevation
      variant={isFavorite ? 'contained' : 'outlined'}
      fullWidth
      startIcon={isFavorite ? <CheckCircleIcon /> : <CheckCircleOutlineIcon />}
    >
      Mark as Done
    </Button>
  );
};

const Ratings = () => {
  const { viewData } = useGlobalViewData();
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
  console.log('>>>communityRating', communityRating);

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
    </Box>
  );
};
