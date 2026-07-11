import { Box, Typography, Button, Stack } from '@mui/material';
import { keyframes } from '@mui/system';
import { useEffect } from 'react';

const shimmer = keyframes`
  0%, 100% { opacity: 0.55; filter: brightness(1); }
  50%       { opacity: 1;    filter: brightness(1.35) saturate(1.2); }
`;

const flicker = keyframes`
  0%, 100% { opacity: 0.7; }
  25%       { opacity: 1; }
  50%       { opacity: 0.5; }
  75%       { opacity: 0.9; }
`;

const floatUp = keyframes`
  from { transform: translateY(32px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
  50%       { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
`;

// Stained-glass SVG panel
// A hand-composed rose-window–style mosaic. Each <path> is a "glass pane"
// with its own color and shimmer timing. Exported for reuse by NotFoundPage.
export const StainedGlassPanel = () => (
  <Box
    component="svg"
    viewBox="0 0 420 420"
    xmlns="http://www.w3.org/2000/svg"
    sx={{
      width: { xs: 260, sm: 340, md: 420 },
      height: { xs: 260, sm: 340, md: 420 },
      filter: 'drop-shadow(0 8px 48px rgba(0,0,0,0.45))',
      flexShrink: 0,
    }}
  >
    <defs>
      {/* Simulates leading (the black outlines between glass panes) */}
      <filter id="leading">
        <feMorphology operator="erode" radius="1.5" />
      </filter>

      {/* Light-through-glass glow */}
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Radial gradient simulating a light source behind the glass */}
      <radialGradient id="light" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Background */}
    <rect width="420" height="420" fill="#0d1a0d" rx="8" />

    {[
      'M0,0 L140,0 L80,80 L0,80 Z',
      'M280,0 L420,0 L420,80 L340,80 Z',
      'M0,340 L80,340 L0,420 Z',
      'M340,340 L420,340 L420,420 Z',
    ].map((d, i) => (
      <Box
        key={i}
        component="path"
        d={d}
        fill="#134e4a"
        stroke="#0d1a0d"
        strokeWidth="2.5"
        sx={{ animation: `${shimmer} ${3.2 + i * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.4}s` }}
      />
    ))}

    {/* Outer border arch segments – forest green */}
    {[
      'M140,0 L280,0 L260,60 L160,60 Z',
      'M0,80 L80,80 L60,220 L0,200 Z',
      'M340,80 L420,80 L420,200 L360,220 Z',
      'M0,200 L60,220 L80,340 L0,340 Z',
      'M360,220 L420,200 L420,340 L340,340 Z',
      'M80,340 L340,340 L310,400 L110,400 Z',
      'M110,400 L310,400 L280,420 L140,420 Z',
    ].map((d, i) => (
      <Box
        key={i}
        component="path"
        d={d}
        fill="#166534"
        stroke="#0d1a0d"
        strokeWidth="2.5"
        sx={{ animation: `${shimmer} ${2.8 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }}
      />
    ))}

    {/* Mid-ring – sage / light green */}
    {[
      'M160,60 L260,60 L240,130 L180,130 Z',
      'M80,80 L160,60 L140,130 L80,140 Z',
      'M260,60 L340,80 L340,140 L280,130 Z',
      'M60,220 L80,140 L140,130 L130,200 Z',
      'M340,140 L360,220 L290,200 L280,130 Z',
      'M80,340 L130,200 L180,220 L160,320 Z',
      'M290,200 L340,340 L260,320 L240,220 Z',
      'M160,320 L260,320 L240,390 L180,390 Z',
      'M110,400 L160,320 L180,390 Z',
      'M260,320 L310,400 L240,390 Z',
    ].map((d, i) => (
      <Box
        key={i}
        component="path"
        d={d}
        fill="#4ade80"
        stroke="#0d1a0d"
        strokeWidth="2"
        sx={{ animation: `${shimmer} ${2.4 + i * 0.25}s ease-in-out infinite`, animationDelay: `${i * 0.22}s` }}
      />
    ))}

    {[
      'M140,130 L180,130 L170,190 L130,200 Z',
      'M240,130 L280,130 L290,200 L250,190 Z',
      'M180,130 L240,130 L230,200 L190,200 Z',
      'M130,200 L170,190 L180,270 L140,280 Z',
      'M250,190 L290,200 L280,280 L240,270 Z',
      'M170,190 L230,200 L220,270 L180,270 Z',
      'M140,280 L180,270 L170,340 L160,320 Z',
      'M240,270 L280,280 L260,320 L250,340 Z',
      'M180,270 L220,270 L210,340 L190,340 Z',
    ].map((d, i) => (
      <Box
        key={i}
        component="path"
        d={d}
        fill="#fbbf24"
        stroke="#0d1a0d"
        strokeWidth="2"
        sx={{ animation: `${shimmer} ${2 + i * 0.2}s ease-in-out infinite`, animationDelay: `${i * 0.18}s` }}
      />
    ))}

    {/* ── Centre rose – ruby red petals ───────────────────────────── */}
    {[
      // top petal
      'M190,200 L230,200 L210,175 Z',
      // bottom petal
      'M190,270 L210,295 L230,270 Z',
      // left petal
      'M190,200 L165,235 L190,270 Z',
      // right petal
      'M230,200 L255,235 L230,270 Z',
      // diagonal petals
      'M190,200 L175,215 L185,245 Z',
      'M230,200 L245,215 L235,245 Z',
      'M185,245 L195,270 L210,255 Z',
      'M210,255 L225,270 L235,245 Z',
    ].map((d, i) => (
      <Box
        key={i}
        component="path"
        d={d}
        fill="#dc2626"
        stroke="#0d1a0d"
        strokeWidth="1.8"
        sx={{ animation: `${flicker} ${1.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${i * 0.12}s` }}
      />
    ))}

    {/* ── Centre gem ──────────────────────────────────────────────── */}
    <Box
      component="circle"
      cx="210"
      cy="235"
      r="18"
      fill="#fef08a"
      stroke="#0d1a0d"
      strokeWidth="3"
      sx={{ animation: `${flicker} 1.5s ease-in-out infinite` }}
    />
    <Box
      component="circle"
      cx="210"
      cy="235"
      r="9"
      fill="#fff"
      opacity="0.7"
      sx={{ animation: `${flicker} 1.1s ease-in-out infinite` }}
    />

    {/* ── Corner decorative diamonds ───────────────────────────────── */}
    {[
      [80, 80],
      [340, 80],
      [80, 340],
      [340, 340],
    ].map(([cx, cy], i) => (
      <Box
        key={i}
        component="path"
        d={`M${cx},${cy - 18} L${cx + 18},${cy} L${cx},${cy + 18} L${cx - 18},${cy} Z`}
        fill="#86efac"
        stroke="#0d1a0d"
        strokeWidth="2"
        sx={{ animation: `${shimmer} ${2.6 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.25}s` }}
      />
    ))}

    {/* ── Overlay – simulates transmitted light ───────────────────── */}
    <rect width="420" height="420" rx="8" fill="url(#light)" />
  </Box>
);

interface ErrorPageProps {
  error?: Error | null;
  /** Call this to attempt recovery (e.g. reset an error boundary) */
  onReset?: () => void;
}

export default function ErrorPage({ error, onReset }: ErrorPageProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
        // Subtle linen-like texture via repeating gradient
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
        {/* ── Left: stained glass ──────────────────────────────────── */}
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
              color: '#14532d',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 70%, #22c55e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Shattered.
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
            The page you were looking for broke into a thousand glittering pieces.
          </Typography>

          {/* Optional error message */}
          {error?.message && (
            <Box
              sx={{
                borderLeft: '3px solid #4ade80',
                pl: 2,
                py: 0.5,
                backgroundColor: 'rgba(74,222,128,0.08)',
                borderRadius: '0 4px 4px 0',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#15803d',
                  wordBreak: 'break-word',
                }}
              >
                Code Error:
              </Typography>

              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#15803d',
                  wordBreak: 'break-word',
                }}
              >
                {error.message}
              </Typography>
            </Box>
          )}

          {/* Actions */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ pt: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => window.location.reload()}
              sx={{
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'none',
                backgroundColor: '#16a34a',
                color: '#f0fdf4',
                px: 4,
                py: 1.5,
                borderRadius: '2px',
                animation: `${pulse} 2.5s ease-in-out infinite`,
                '&:hover': { backgroundColor: '#15803d' },
              }}
            >
              Try again
            </Button>

            <Button
              variant="outlined"
              size="large"
              onClick={() => { window.location.href = '/'; }}
              sx={{
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'none',
                borderColor: '#16a34a',
                color: '#16a34a',
                px: 4,
                py: 1.5,
                borderRadius: '2px',
                '&:hover': { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: '#15803d' },
              }}
            >
              Go home
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
