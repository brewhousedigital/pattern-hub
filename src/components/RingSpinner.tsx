import { Box, type SxProps, type Theme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';

// Turns with a transform only. The browser runs a transform animation off the
// main thread, so the full ring keeps turning while a slow React render (for
// example, the View Drawer opening or closing) blocks the main thread. MUI's
// CircularProgress animates its SVG stroke on the main thread, so it freezes
// as a partial arc in that situation.
const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

type RingSpinnerProps = {
  /** Outer diameter in px. */
  size?: number;
  /** Ring width in px. */
  thickness?: number;
  /** Accessible name. Omit it when the spinner is decorative (for example, inside a button that has its own label). */
  label?: string;
  sx?: SxProps<Theme>;
};

export const RingSpinner = ({ size = 44, thickness = 4, label, sx }: RingSpinnerProps) => (
  <Box
    {...(label ? { role: 'progressbar', 'aria-label': label } : { 'aria-hidden': true })}
    sx={[
      {
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        border: `${thickness}px solid`,
        borderColor: (t) => alpha(t.palette.primary.main, 0.2),
        borderTopColor: 'primary.main',
        animation: `${spin} 0.8s linear infinite`,
        willChange: 'transform',
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  />
);
