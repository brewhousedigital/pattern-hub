import type { ReactNode } from 'react';
import { alpha } from '@mui/material/styles';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { Box, Chip, Typography } from '@mui/material';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { CHART_PRIMARY, STATUS_NEGATIVE, STATUS_POSITIVE } from '@/components/charts/chart-colors';

export type StatTileProps = {
  title: string;
  icon: ReactNode;
  value: number;
  formatValue?: (value: number) => string;
  /** e.g. "+42 this week". Omit to hide the delta chip entirely. */
  deltaLabel?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  /** Optional trailing mini trend, oldest-to-newest. */
  sparklineData?: number[];
};

export const StatTile = ({
  title,
  icon,
  value,
  formatValue = (v) => v.toLocaleString(),
  deltaLabel,
  deltaDirection = 'neutral',
  sparklineData,
}: StatTileProps) => {
  const deltaColor = deltaDirection === 'up' ? STATUS_POSITIVE : deltaDirection === 'down' ? STATUS_NEGATIVE : null;

  return (
    <StatCardShell title={title} icon={icon}>
      <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.75 }}>
        {formatValue(value)}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 32 }}>
        {deltaLabel ? (
          <Chip
            label={deltaLabel}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              fontWeight: 600,
              color: deltaColor ?? 'text.secondary',
              backgroundColor: deltaColor ? alpha(deltaColor, 0.1) : 'action.hover',
            }}
          />
        ) : (
          <span />
        )}
        {sparklineData && sparklineData.length > 1 && (
          <Box sx={{ width: 72, height: 32, flexShrink: 0 }}>
            <SparkLineChart data={sparklineData} height={32} width={72} color={CHART_PRIMARY} showHighlight />
          </Box>
        )}
      </Box>
    </StatCardShell>
  );
};
