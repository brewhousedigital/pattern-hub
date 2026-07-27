import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { EmptyChartNotice } from '@/components/charts/EmptyChartNotice';
import { sequentialStep } from '@/components/charts/chart-colors';
import { generatePatternLink } from '@/functions/utilities/generate-pattern-link';

export type TopExportedPatternsCardProps = {
  title: string;
  icon: ReactNode;
  patterns: { pattern_id: string; name: string; count: number }[];
};

// A ranked list, not a stock chart type - MUI X Charts doesn't have a "top N
// leaderboard with clickable rows" primitive, and a horizontal BarChart can't
// make its category labels link out to the pattern. Hand-rolled bars (a
// per-row width percentage) instead, same spirit as the export-time intensity
// grid.
export const TopExportedPatternsCard = ({ title, icon, patterns }: TopExportedPatternsCardProps) => {
  if (patterns.length === 0) {
    return (
      <StatCardShell title={title} icon={icon}>
        <EmptyChartNotice />
      </StatCardShell>
    );
  }

  const max = Math.max(1, ...patterns.map((p) => p.count));

  return (
    <StatCardShell title={title} icon={icon}>
      <Stack spacing={1.25}>
        {patterns.map((pattern, i) => (
          <Box key={pattern.pattern_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Typography
              variant="caption"
              sx={{ width: 16, flexShrink: 0, color: 'text.disabled', fontWeight: 700, textAlign: 'right' }}
            >
              {i + 1}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.375 }}>
                <Typography
                  component="a"
                  href={generatePatternLink(pattern.pattern_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  noWrap
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    textDecoration: 'none',
                    '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                  }}
                >
                  {pattern.name || 'Untitled pattern'}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                >
                  {pattern.count.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ height: 5, borderRadius: 1, backgroundColor: 'action.hover', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    borderRadius: 1,
                    width: `${Math.max(4, (pattern.count / max) * 100)}%`,
                    backgroundColor: sequentialStep(0.25 + 0.75 * (pattern.count / max)),
                  }}
                />
              </Box>
            </Box>
          </Box>
        ))}
      </Stack>
    </StatCardShell>
  );
};
