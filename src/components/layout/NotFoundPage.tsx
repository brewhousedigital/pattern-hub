import { Link } from '@tanstack/react-router';
import { Box, Typography, Button, Stack } from '@mui/material';
import { keyframes } from '@mui/system';
import { StainedGlassPanel } from '@/components/layout/ErrorPage';

const floatUp = keyframes`
  from { transform: translateY(32px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
`;

// 404 page - shares the stained-glass look of ErrorPage, wired up as the
// router's defaultNotFoundComponent (see src/router.tsx). Rendered on the
// server too, so unmatched URLs return real styled HTML with a 404 status.
export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100svh',
        width: '100%',
        backgroundColor: '#f0fdf4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 3, md: 6 },
        py: 6,
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 39px,
            rgba(134,239,172,0.07) 39px,
            rgba(134,239,172,0.07) 40px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 39px,
            rgba(134,239,172,0.07) 39px,
            rgba(134,239,172,0.07) 40px
          )
        `,
      }}
    >
      <Box
        sx={{
          maxWidth: 960,
          width: '100%',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          gap: { xs: 6, md: 10 },
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            animation: `${floatUp} 0.8s cubic-bezier(0.22,1,0.36,1) both`,
          }}
        >
          <StainedGlassPanel />
        </Box>

        <Stack
          spacing={3}
          sx={{
            animation: `${floatUp} 0.9s cubic-bezier(0.22,1,0.36,1) 0.1s both`,
            textAlign: { xs: 'center', md: 'left' },
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '3.5rem', md: '5rem' },
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 70%, #22c55e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: '1.3rem', md: '1.55rem' },
              fontStyle: 'italic',
              color: '#166534',
              lineHeight: 1.5,
              maxWidth: 420,
            }}
          >
            There's no pane at this address. The page may have moved, or the link may be broken.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ pt: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}
          >
            <Button
              component={Link}
              to="/"
              variant="contained"
              size="large"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'none',
                backgroundColor: '#16a34a',
                color: '#f0fdf4',
                px: 4,
                py: 1.5,
                borderRadius: '2px',
                '&:hover': { backgroundColor: '#15803d' },
              }}
            >
              Browse patterns
            </Button>

            <Button
              variant="text"
              size="large"
              onClick={() => window.history.back()}
              sx={{
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'none',
                color: '#4ade80',
                px: 3,
                py: 1.5,
                '&:hover': { backgroundColor: 'rgba(74,222,128,0.08)' },
              }}
            >
              ← Go back
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
