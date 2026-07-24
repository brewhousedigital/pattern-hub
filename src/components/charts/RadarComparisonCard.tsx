import type { ReactNode } from 'react';
import { RadarChart } from '@mui/x-charts/RadarChart';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { EmptyChartNotice } from '@/components/charts/EmptyChartNotice';
import { CHART_PRIMARY, STATUS_NEUTRAL } from '@/components/charts/chart-colors';
import type { TypeVelocityMetric } from '@/functions/database/database-stats';

export type RadarComparisonCardProps = {
  title: string;
  icon: ReactNode;
  metrics: TypeVelocityMetric[];
  currentLabel?: string;
  previousLabel?: string;
  height?: number;
};

// This-period-vs-previous-period comparison across the velocity metrics.
// Framed as emphasis (current = brand green + filled, previous = de-emphasized
// gray outline) rather than two arbitrary categorical hues, since "current vs.
// context" - not identity - is what the comparison is about. Each axis is a
// different metric with a very different raw scale, so RadarChart's own
// per-axis domain (computed from the series data) keeps the comparison honest
// rather than forcing every metric onto one shared scale.
export const RadarComparisonCard = ({
  title,
  icon,
  metrics,
  currentLabel = 'This period',
  previousLabel = 'Previous period',
  height = 260,
}: RadarComparisonCardProps) => {
  if (metrics.length === 0) {
    return (
      <StatCardShell title={title} icon={icon}>
        <EmptyChartNotice message="Need at least 2 snapshots to compare" />
      </StatCardShell>
    );
  }

  return (
    <StatCardShell title={title} icon={icon}>
      <RadarChart
        height={height}
        radar={{ metrics: metrics.map((m) => m.label) }}
        series={[
          { label: previousLabel, data: metrics.map((m) => m.previous), color: STATUS_NEUTRAL },
          { label: currentLabel, data: metrics.map((m) => m.current), color: CHART_PRIMARY, fillArea: true },
        ]}
      />
    </StatCardShell>
  );
};
