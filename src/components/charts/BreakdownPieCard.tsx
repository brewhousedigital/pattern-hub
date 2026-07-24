import type { ReactNode } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { EmptyChartNotice } from '@/components/charts/EmptyChartNotice';
import { CATEGORICAL_PALETTE } from '@/components/charts/chart-colors';

export type BreakdownPieCardProps = {
  title: string;
  icon: ReactNode;
  /** Category -> count, e.g. { pdf: 12, png: 4 }. Zero-count categories are dropped before charting. */
  data: Record<string, number>;
  /** Fixed label order - determines color assignment (identity, never re-cycled by rank). Falls back to Object.keys(data). */
  categoryOrder?: string[];
  labelFormatter?: (key: string) => string;
  height?: number;
};

// Pie/donut wrapper for the file-type and flow breakdowns. Categories are
// colored in a fixed order from CATEGORICAL_PALETTE, keyed by identity so a
// category keeps its color even if others drop to zero.
export const BreakdownPieCard = ({
  title,
  icon,
  data,
  categoryOrder,
  labelFormatter = (key) => key,
  height = 200,
}: BreakdownPieCardProps) => {
  const order = categoryOrder ?? Object.keys(data);

  const series = order
    .map((key, i) => ({
      id: key,
      label: labelFormatter(key),
      value: data[key] ?? 0,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    }))
    .filter((slice) => slice.value > 0);

  if (series.length === 0) {
    return (
      <StatCardShell title={title} icon={icon}>
        <EmptyChartNotice />
      </StatCardShell>
    );
  }

  return (
    <StatCardShell title={title} icon={icon}>
      <PieChart
        series={[{ data: series, innerRadius: 30, paddingAngle: 1, cornerRadius: 3 }]}
        height={height}
        slotProps={{ legend: { direction: 'vertical', position: { vertical: 'middle', horizontal: 'end' } } }}
      />
    </StatCardShell>
  );
};
