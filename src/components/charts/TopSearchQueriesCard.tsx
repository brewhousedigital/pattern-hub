import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { EmptyChartNotice } from '@/components/charts/EmptyChartNotice';
import { sequentialStep } from '@/components/charts/chart-colors';

export type TopSearchQueriesCardProps = {
  title: string;
  icon: ReactNode;
  queries: { id: string; query: string; count: number }[];
  emptyMessage?: string;
};

// Same hand-rolled ranked-list treatment as TopExportedPatternsCard, minus the
// clickable-link row - a search that matched nothing has no pattern to link to.
export const TopSearchQueriesCard = ({ title, icon, queries, emptyMessage }: TopSearchQueriesCardProps) => {
  if (queries.length === 0) {
    return (
      <StatCardShell title={title} icon={icon}>
        <EmptyChartNotice message={emptyMessage} />
      </StatCardShell>
    );
  }

  const max = Math.max(1, ...queries.map((q) => q.count));

  return (
    <StatCardShell title={title} icon={icon}>
      <Stack spacing={1.25}>
        {queries.map((q, i) => (
          <Box key={q.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Typography
              variant="caption"
              sx={{ width: 16, flexShrink: 0, color: 'text.disabled', fontWeight: 700, textAlign: 'right' }}
            >
              {i + 1}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.375 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}
                >
                  {q.query}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                >
                  {q.count.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ height: 5, borderRadius: 1, backgroundColor: 'action.hover', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    borderRadius: 1,
                    width: `${Math.max(4, (q.count / max) * 100)}%`,
                    backgroundColor: sequentialStep(0.25 + 0.75 * (q.count / max)),
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
