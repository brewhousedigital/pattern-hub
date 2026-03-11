import React, { useState } from 'react';
import { useGlobalViewData } from '@/data/view';

import {
  Box,
  Typography,
  Chip,
  Rating,
  Button,
  IconButton,
  Divider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Paper,
  Avatar,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import { pocketbaseDomain } from '@/functions/database/authentication-setup.ts';

export const ViewDrawer = () => {
  const { viewData } = useGlobalViewData();

  const tags = viewData?.tags.split(',');

  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(142);
  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(37);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageWidth, setPageWidth] = useState('');
  const [pageHeight, setPageHeight] = useState('');

  const canDownload = pageWidth.trim() !== '' && pageHeight.trim() !== '';

  const handleFavorite = () => {
    setFavorited((prev) => !prev);
    setFavoriteCount((prev) => (favorited ? prev - 1 : prev + 1));
  };

  const handleDone = () => {
    setDone((prev) => !prev);
    setDoneCount((prev) => (done ? prev - 1 : prev + 1));
  };

  const handleOrientationChange = (_: React.MouseEvent<HTMLElement>, val: 'portrait' | 'landscape' | null) => {
    if (val) setOrientation(val);
  };

  // Mock data
  const pattern = {
    title: 'Cathedral Rose',
    description:
      'An intricate rose window design inspired by Gothic cathedral architecture. Features a twelve-petal central bloom surrounded by radiating lancet panes, with decorative corner trefoils in complementary jewel tones. Ideal for transom windows or decorative panels.',
    id: 'PAT-00847',
    tags: ['rose window', 'gothic', 'geometric', 'symmetrical', 'advanced', 'cathedral'],
    rating: 4.3,
    ratingCount: 89,
    lineWidth: '3mm',
    width: '24 in',
    height: '24 in',
    author: 'Eleanor Voss',
    uploadedBy: 'mglass_studio',
  };

  return (
    <Box
      sx={{
        minHeight: '95svh',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, py: 3, position: 'relative', zIndex: 1 }}>
        {/* ── Navigation Bar ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 4,
            pb: 2.5,
            borderBottom: `1px solid ${alpha('#C8A96E', 0.2)}`,
          }}
        >
          <Button
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: '0.85rem !important' }} />}
            variant="outlined"
            onClick={() => {}}
            sx={{
              borderColor: alpha('#C8A96E', 0.35),
              color: 'primary.main',
              px: 2.5,
              py: 0.75,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: alpha('#C8A96E', 0.07),
              },
            }}
          >
            Previous
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', letterSpacing: '0.12em', textTransform: 'uppercase' }}
            >
              Pattern Browser
            </Typography>
          </Box>

          <Button
            endIcon={<ArrowForwardIosIcon sx={{ fontSize: '0.85rem !important' }} />}
            variant="outlined"
            onClick={() => {}}
            sx={{
              borderColor: alpha('#C8A96E', 0.35),
              color: 'primary.main',
              px: 2.5,
              py: 0.75,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: alpha('#C8A96E', 0.07),
              },
            }}
          >
            Next
          </Button>
        </Box>

        {/* ── Main Content Grid ── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' },
            gap: 4,
            alignItems: 'start',
          }}
        >
          {/* ── LEFT COLUMN ── */}
          <Box>
            {/* SVG Viewer */}
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#0C0A07',
                border: `1px solid ${alpha('#C8A96E', 0.2)}`,
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative',
                mb: 3,
                '&::before': {
                  content: '""',
                  display: 'block',
                  paddingTop: '100%',
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                }}
              >
                <Box sx={{ p: 2 }}>
                  <img
                    src={`${pocketbaseDomain}/api/files/${viewData?.collectionId}/${viewData?.id}/${viewData?.pattern_file}`}
                    alt={`pattern template for ${viewData?.name}`}
                    style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                  />
                </Box>
              </Box>
            </Paper>

            {/* ── PDF Download Section ── */}
            <Paper
              elevation={0}
              sx={{
                bgcolor: 'background.paper',
                border: `1px solid ${alpha('#C8A96E', 0.18)}`,
                borderRadius: 1,
                p: 3,
              }}
            >
              {/* Decorative header line */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ height: '1px', flex: 1, bgcolor: alpha('#C8A96E', 0.2) }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'primary.main',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                  }}
                >
                  Export Pattern
                </Typography>
                <Box sx={{ height: '1px', flex: 1, bgcolor: alpha('#C8A96E', 0.2) }} />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto auto' },
                  gap: 2,
                  alignItems: 'flex-end',
                }}
              >
                <Box>
                  <SectionLabel>Page Width</SectionLabel>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="e.g. 8.5 in"
                    value={pageWidth}
                    onChange={(e) => setPageWidth(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: alpha('#C8A96E', 0.3) },
                        '&:hover fieldset': { borderColor: alpha('#C8A96E', 0.5) },
                        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                      },
                      '& input': { color: 'text.primary' },
                    }}
                  />
                </Box>

                <Box>
                  <SectionLabel>Page Height</SectionLabel>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="e.g. 11 in"
                    value={pageHeight}
                    onChange={(e) => setPageHeight(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: alpha('#C8A96E', 0.3) },
                        '&:hover fieldset': { borderColor: alpha('#C8A96E', 0.5) },
                        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                      },
                      '& input': { color: 'text.primary' },
                    }}
                  />
                </Box>

                <Box>
                  <SectionLabel>Orientation</SectionLabel>
                  <ToggleButtonGroup
                    value={orientation}
                    exclusive
                    onChange={handleOrientationChange}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        borderColor: alpha('#C8A96E', 0.3),
                        color: 'text.secondary',
                        px: 1.5,
                        '&.Mui-selected': {
                          bgcolor: alpha('#C8A96E', 0.15),
                          color: 'primary.main',
                          borderColor: alpha('#C8A96E', 0.5),
                          '&:hover': { bgcolor: alpha('#C8A96E', 0.2) },
                        },
                        '&:hover': { bgcolor: alpha('#C8A96E', 0.07) },
                      },
                    }}
                  >
                    <ToggleButton value="portrait">
                      <Tooltip title="Portrait">
                        <CropPortraitIcon fontSize="small" />
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="landscape">
                      <Tooltip title="Landscape">
                        <CropLandscapeIcon fontSize="small" />
                      </Tooltip>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Button
                  variant="contained"
                  disabled={!canDownload}
                  startIcon={<DownloadIcon />}
                  onClick={() => {}}
                  sx={{
                    bgcolor: canDownload ? 'primary.main' : undefined,
                    color: canDownload ? '#0F0D0B' : undefined,
                    fontWeight: 700,
                    px: 3,
                    height: 40,
                    '&:hover': {
                      bgcolor: '#DDB97E',
                    },
                    '&.Mui-disabled': {
                      bgcolor: alpha('#C8A96E', 0.12),
                      color: alpha('#C8A96E', 0.3),
                    },
                  }}
                >
                  Download PDF
                </Button>
              </Box>

              {!canDownload && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1.5, display: 'block' }}>
                  Enter page dimensions to enable export.
                </Typography>
              )}
            </Paper>
          </Box>

          {/* ── RIGHT COLUMN ── */}
          <Box>
            {/* Title & ID */}
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

            {/* Description */}
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2.5 }}>
              {viewData?.description}
            </Typography>

            <ThinDivider />

            {/* Engagement Row */}
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

            {/* Rating */}
            <Box sx={{ mb: 2.5 }}>
              <SectionLabel>Community Rating</SectionLabel>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Rating
                  value={userRating ?? pattern.rating}
                  precision={0.5}
                  onChange={(_, val) => setUserRating(val)}
                  sx={{
                    '& .MuiRating-iconFilled': { color: 'primary.main' },
                    '& .MuiRating-iconHover': { color: '#DDB97E' },
                    '& .MuiRating-iconEmpty': { color: alpha('#C8A96E', 0.25) },
                  }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {pattern.rating} · {pattern.ratingCount} ratings
                </Typography>
              </Box>
              {userRating && (
                <Typography variant="caption" sx={{ color: 'secondary.main', mt: 0.5, display: 'block' }}>
                  You rated this {userRating} stars
                </Typography>
              )}
            </Box>

            <ThinDivider />

            {/* Specs */}
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
            </Box>

            <ThinDivider />

            {/* People */}
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

            {/* Tags */}
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
                      /*'&:hover': {
                        bgcolor: alpha('#C8A96E', 0.08),
                        borderColor: alpha('#C8A96E', 0.45),
                        color: 'primary.main',
                      },*/
                      //cursor: 'pointer',
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

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="caption"
    sx={{
      color: 'primary.main',
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      fontSize: '0.68rem',
      display: 'block',
      mb: 0.5,
    }}
  >
    {children}
  </Typography>
);

const MetaRow = ({ label, value, unit }: { label: string; value?: string | number; unit?: string }) => (
  <Box sx={{ mb: 1.5 }}>
    <SectionLabel>{label}</SectionLabel>
    <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.4 }}>
      {value} {unit}
    </Typography>
  </Box>
);

const ThinDivider = () => (
  <Divider
    sx={{
      borderColor: alpha('#C8A96E', 0.18),
      my: 2.5,
    }}
  />
);
