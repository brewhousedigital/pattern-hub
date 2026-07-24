import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { EmptyChartNotice } from '@/components/charts/EmptyChartNotice';
import { CHART_PRIMARY, STATUS_NEGATIVE, STATUS_NEUTRAL, STATUS_POSITIVE } from '@/components/charts/chart-colors';
import type { TypeChartPoint } from '@/functions/database/database-stats';

export type TrendChartCardProps = {
  title: string;
  icon: ReactNode;
  points: TypeChartPoint[];
  /** 'status' colors the series green/red/gray by the trend of its most recent value (for valenced metrics like growth %). */
  colorMode?: 'sequential' | 'status';
  valueFormatter?: (value: number | null) => string;
  seriesLabel?: string;
  defaultChartType?: 'bar' | 'line';
  height?: number;
};

// The time-series workhorse: a bar/line toggle over the same dataset/series
// shape (BarChart and LineChart share ChartsContainerProps, so this is a
// plain conditional render, no "mixed" chart API needed). Covers both plain
// growth trends and the explicitly-requested "user growth %" card via
// colorMode='status'. Presentational only - admin and community both use this
// directly.
export const TrendChartCard = ({
  title,
  icon,
  points,
  colorMode = 'sequential',
  valueFormatter,
  seriesLabel = title,
  defaultChartType = 'line',
  height = 180,
}: TrendChartCardProps) => {
  const [chartType, setChartType] = useState<'bar' | 'line'>(defaultChartType);

  const action = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={chartType}
      onChange={(_, next) => next && setChartType(next)}
      sx={{ height: 26, '& .MuiToggleButton-root': { px: 0.75, py: 0.25 } }}
    >
      <ToggleButton value="line" aria-label="Line chart">
        <ShowChartRoundedIcon sx={{ fontSize: 14 }} />
      </ToggleButton>
      <ToggleButton value="bar" aria-label="Bar chart">
        <BarChartRoundedIcon sx={{ fontSize: 14 }} />
      </ToggleButton>
    </ToggleButtonGroup>
  );

  if (points.length === 0) {
    return (
      <StatCardShell title={title} icon={icon} action={action}>
        <EmptyChartNotice />
      </StatCardShell>
    );
  }

  const resolvedColor = ((): string => {
    if (colorMode !== 'status') return CHART_PRIMARY;
    const lastKnown = [...points].reverse().find((p) => p.value !== null)?.value ?? null;
    if (lastKnown === null || lastKnown === 0) return STATUS_NEUTRAL;
    return lastKnown > 0 ? STATUS_POSITIVE : STATUS_NEGATIVE;
  })();

  const dataset = points.map((p) => ({ label: p.label, value: p.value }));
  const series = [
    {
      dataKey: 'value',
      label: seriesLabel,
      color: resolvedColor,
      valueFormatter: valueFormatter ? (value: number | null) => valueFormatter(value) : undefined,
    },
  ];
  const xAxis = [{ scaleType: 'band' as const, dataKey: 'label' }];
  const margin = { left: 40, right: 12, top: 16, bottom: 28 };

  return (
    <StatCardShell title={title} icon={icon} action={action}>
      {chartType === 'line' ? (
        <LineChart
          dataset={dataset}
          series={series}
          xAxis={xAxis}
          height={height}
          margin={margin}
          grid={{ horizontal: true }}
        />
      ) : (
        <BarChart
          dataset={dataset}
          series={series}
          xAxis={xAxis}
          height={height}
          margin={margin}
          grid={{ horizontal: true }}
        />
      )}
    </StatCardShell>
  );
};
