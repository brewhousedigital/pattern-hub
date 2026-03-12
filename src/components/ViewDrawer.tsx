import React, { useState } from 'react';
import { useGlobalIsViewOpen, useGlobalViewData } from '@/data/view';
import { pocketbaseDomain } from '@/functions/database/authentication-setup.ts';
import { MetaRow, ThinDivider, SectionLabel } from '@/components/ViewHelpers';
import { ExportPatternForPrint } from '@/components/ExportPatternForPrint';
import { ExportPatternForPrintV2 } from '@/components/ExportPatternForPrintV2';
import { ExportPatternToDownload } from '@/components/ExportPatternToDownload';

import { alpha } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { Box, Typography, Chip, Rating, Button, IconButton, Paper, Stack } from '@mui/material';

export const ViewDrawer = () => {
  const { viewData } = useGlobalViewData();

  const { handleCloseView } = useGlobalIsViewOpen();

  const tags = viewData?.tags.split(',');

  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(142);
  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(37);
  const [userRating, setUserRating] = useState<number | null>(null);

  const svgImageUrl = `${pocketbaseDomain}/api/files/${viewData?.collectionId}/${viewData?.id}/${viewData?.pattern_file}`;

  const handleFavorite = () => {
    setFavorited((prev) => !prev);
    setFavoriteCount((prev) => (favorited ? prev - 1 : prev + 1));
  };

  const handleDone = () => {
    setDone((prev) => !prev);
    setDoneCount((prev) => (done ? prev - 1 : prev + 1));
  };

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 1500, mx: 'auto', px: { xs: 2, md: 4 }, py: 3, position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 4,
            pb: 2.5,
            borderBottom: `1px solid ${alpha('#C8A96E', 0.2)}`,
            gap: 1,
          }}
        >
          <Button
            startIcon={<ArrowBackIosNewIcon fontSize="inherit" />}
            variant="outlined"
            size="small"
            onClick={() => {}}
          >
            Previous
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Button variant="outlined" size="small" onClick={handleCloseView}>
              Close Window
            </Button>
          </Box>

          <Button
            endIcon={<ArrowForwardIosIcon fontSize="inherit" />}
            variant="outlined"
            size="small"
            onClick={() => {}}
          >
            Next
          </Button>
        </Box>

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
                bgcolor: '#0C0A07',
                border: `1px solid ${alpha('#C8A96E', 0.2)}`,
                borderRadius: 1,
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
                    fontSize: { xs: '2rem', md: '2.4rem' },
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

            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2.5 }}>
              {viewData?.description}
            </Typography>

            <ThinDivider />

            <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
              {/* Favorite */}
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: favorited ? alpha('#C8A96E', 0.12) : alpha('#ffffff', 0.04),
                  border: `1px solid ${favorited ? alpha('#C8A96E', 0.4) : alpha('#ffffff', 0.1)}`,
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: alpha('#C8A96E', 0.1),
                    borderColor: alpha('#C8A96E', 0.35),
                  },
                }}
                onClick={handleFavorite}
              >
                <IconButton size="small" disableRipple sx={{ p: 0 }}>
                  {favorited ? (
                    <FavoriteIcon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
                  ) : (
                    <FavoriteBorderIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                  )}
                </IconButton>
                <Typography
                  variant="body2"
                  sx={{ color: favorited ? 'primary.main' : 'text.secondary', fontWeight: 700 }}
                >
                  {favoriteCount}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {favorited ? 'Saved' : 'Favorite'}
                </Typography>
              </Paper>

              {/* Done */}
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: done ? alpha('#7B9E8F', 0.12) : alpha('#ffffff', 0.04),
                  border: `1px solid ${done ? alpha('#7B9E8F', 0.4) : alpha('#ffffff', 0.1)}`,
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: alpha('#7B9E8F', 0.1),
                    borderColor: alpha('#7B9E8F', 0.35),
                  },
                }}
                onClick={handleDone}
              >
                <IconButton size="small" disableRipple sx={{ p: 0 }}>
                  {done ? (
                    <CheckCircleIcon sx={{ fontSize: '1.1rem', color: 'secondary.main' }} />
                  ) : (
                    <CheckCircleOutlineIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                  )}
                </IconButton>
                <Typography variant="body2" sx={{ color: done ? 'secondary.main' : 'text.secondary', fontWeight: 700 }}>
                  {doneCount}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {done ? 'Completed' : 'Mark Done'}
                </Typography>
              </Paper>
            </Box>

            <Box sx={{ mb: 2.5 }}>
              <SectionLabel>Community Rating</SectionLabel>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Rating
                  value={userRating ?? 3}
                  precision={0.5}
                  onChange={(_, val) => setUserRating(val)}
                  sx={{
                    '& .MuiRating-iconFilled': { color: 'primary.main' },
                    '& .MuiRating-iconHover': { color: '#DDB97E' },
                    '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.25) },
                  }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  3 · 50 ratings
                </Typography>
              </Box>
              {userRating && (
                <Typography variant="caption" sx={{ color: 'secondary.main', mt: 0.5, display: 'block' }}>
                  You rated this {userRating} stars
                </Typography>
              )}
            </Box>

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

            <Button
              startIcon={<ReportProblemOutlinedIcon fontSize="small" />}
              size="small"
              onClick={() => {}}
              color="warning"
            >
              Report an issue
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
