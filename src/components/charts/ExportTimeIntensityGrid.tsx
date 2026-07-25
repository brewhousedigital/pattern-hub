import type { ReactNode } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { StatCardShell } from '@/components/charts/StatCardShell';
import { EmptyChartNotice } from '@/components/charts/EmptyChartNotice';
import { sequentialStep } from '@/components/charts/chart-colors';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type ExportTimeIntensityGridProps = {
  title: string;
  icon: ReactNode;
  /** length 24, index = UTC hour, trailing 7 days */
  hourCounts: number[];
  /** length 7, index 0 = Sunday, trailing 7 days */
  weekdayCounts: number[];
};

// The stored breakdown is bucketed by UTC hour (computed server-side, where
// "local" has no single meaning). Rotate it to whichever hour bucket that UTC
// hour actually lands on for the person looking at the chart - local = UTC +
// offsetHours, so a count recorded at UTC hour H belongs in local bucket
// (H + offsetHours) mod 24. Timezones with a half-hour offset (India, etc.)
// round to the nearest hour bucket - this is a "roughly when" chart, not a
// precise instrument, so splitting counts across two buckets isn't worth it.
const rotateHourCountsToLocal = (utcHourCounts: number[]): number[] => {
  const offsetHours = Math.round(-new Date().getTimezoneOffset() / 60);
  const local = new Array(24).fill(0);
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const localHour = (((utcHour + offsetHours) % 24) + 24) % 24;
    local[localHour] += utcHourCounts[utcHour] ?? 0;
  }
  return local;
};

const getLocalTimezoneLabel = (): string => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

const IntensityStrip = ({ counts, labels }: { counts: number[]; labels: string[] }) => {
  const max = Math.max(1, ...counts);
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {counts.map((count, i) => (
        <Tooltip key={labels[i]} title={`${labels[i]}: ${count.toLocaleString()} export${count === 1 ? '' : 's'}`}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              height: 28,
              borderRadius: 0.75,
              backgroundColor: count === 0 ? 'action.hover' : sequentialStep(0.15 + 0.85 * (count / max)),
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};

// Hand-built CSS-grid intensity strips (GitHub-contributions-style) for "when
// are people more likely to export" - MUI X Charts' Heatmap component is
// Pro-only (confirmed: no Heatmap export exists in the installed community
// package), so this is genuinely hand-rolled rather than a chart-library
// wrapper. Two independent 1D distributions (hour-of-day, day-of-week), not a
// single 2D grid - the schema stores each as its own marginal breakdown, and
// combining them into a synthetic joint hour*weekday matrix would fabricate a
// correlation the data doesn't actually establish.
export const ExportTimeIntensityGrid = ({ title, icon, hourCounts, weekdayCounts }: ExportTimeIntensityGridProps) => {
  const hasData = hourCounts.some((c) => c > 0) || weekdayCounts.some((c) => c > 0);

  if (!hasData) {
    return (
      <StatCardShell title={title} icon={icon}>
        <EmptyChartNotice />
      </StatCardShell>
    );
  }

  // Only the admin page uses this card, and /space-command renders client-only
  // (ssr: false) - so this always reflects the actual viewer's browser
  // timezone, never a server default, with no hydration-mismatch risk.
  const localHourCounts = rotateHourCountsToLocal(hourCounts);
  const tzLabel = getLocalTimezoneLabel();

  return (
    <StatCardShell title={title} icon={icon}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        By hour of day{tzLabel ? ` (${tzLabel})` : ' (your local time)'}
      </Typography>
      <IntensityStrip counts={localHourCounts} labels={HOUR_LABELS} />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 0.75 }}>
        By day of week
      </Typography>
      <IntensityStrip counts={weekdayCounts} labels={WEEKDAY_LABELS} />
    </StatCardShell>
  );
};
