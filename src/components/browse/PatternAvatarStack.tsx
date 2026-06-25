import { Box, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import type { TypePatternResponse } from '@/functions/database/patterns';

type PatternAvatarStackProps = {
  /** Pre-sliced list of patterns to show (already limited to PREVIEW_LIMIT by caller). */
  patterns: TypePatternResponse[];
  /** Total pattern count in the set/collection — used to compute the +N overflow. */
  totalCount: number;
  accentColor?: string;
  size?: number;
  overlap?: number;
};

export const PatternAvatarStack = ({
  patterns,
  totalCount,
  accentColor = '#1976d2',
  size = 56,
  overlap = 14,
}: PatternAvatarStackProps) => {
  if (patterns.length === 0) return null;
  const overflow = totalCount - patterns.length;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {patterns.map((p, i) => (
        <Tooltip key={p.id} title={p.name} arrow placement="top">
          <Box
            sx={{
              position: 'relative',
              zIndex: patterns.length - i,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundImage: `url("${generatePbImage(p)}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: alpha(accentColor, 0.1),
              border: '3px solid',
              borderColor: 'background.paper',
              ml: i === 0 ? 0 : `-${overlap}px`,
              transition: 'transform 0.15s',
              '&:hover': {
                transform: 'scale(1.12) translateY(-4px)',
                zIndex: patterns.length + 1,
              },
            }}
          />
        </Tooltip>
      ))}

      {overflow > 0 && (
        <Box
          sx={{
            position: 'relative',
            zIndex: 0,
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: alpha(accentColor, 0.12),
            border: '3px solid',
            borderColor: 'background.paper',
            ml: `-${overlap}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: size < 40 ? '0.56rem' : '0.72rem',
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1,
            }}
          >
            +{overflow}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
