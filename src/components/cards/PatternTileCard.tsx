import { Link } from '@tanstack/react-router';
import { alpha } from '@mui/material/styles';
import { Box, Card, Chip, Typography } from '@mui/material';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import type { TypePatternResponse } from '@/functions/database/patterns';

type Props = {
  pattern: TypePatternResponse;
  patternIdArray: string[];
};

export function PatternTileCard({ pattern, patternIdArray }: Props) {
  const linkedAuthors = pattern.expand?.authors?.map((a) => a.name).filter(Boolean) ?? [];
  const manualAuthors = pattern.author_manual?.filter(Boolean) ?? [];
  const authors = [...linkedAuthors, ...manualAuthors].join(', ');

  return (
    <Link
      to="/"
      search={{ id: patternIdArray, patternId: pattern.id }}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <Card
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 4,
          overflow: 'hidden',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, 0.14)}`,
            borderColor: 'transparent',
          },
        }}
      >
        {/* Thumbnail */}
        <Box sx={{ p: 1.5, pb: 0, position: 'relative' }}>
          {pattern.pattern_file_external ? (
            <>
              <Box
                sx={{
                  aspectRatio: '1/1',
                  borderRadius: 3,
                  backgroundImage: `url("${generatePbImage(pattern)}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <Chip
                label="External"
                color="primary"
                size="small"
                sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 600, border: '2px solid #fff' }}
              />
            </>
          ) : (
            <img
              loading="lazy"
              src={generatePbImage(pattern)}
              alt={`pattern template for ${pattern.name}`}
              style={{ width: '100%', height: 'auto', aspectRatio: '1/1', display: 'block' }}
            />
          )}
        </Box>

        {/* Info */}
        <Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
          <Typography
            fontSize={13}
            fontWeight={600}
            lineHeight={1.3}
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {pattern.name}
          </Typography>
          {authors && (
            <Typography fontSize={11} color="text.secondary" mt={0.25} noWrap>
              {authors}
            </Typography>
          )}
        </Box>
      </Card>
    </Link>
  );
}
