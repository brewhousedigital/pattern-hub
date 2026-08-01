import type { ReactNode } from 'react';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';

import { StatTile } from '@/components/charts/StatTile';
import { TrendChartCard } from '@/components/charts/TrendChartCard';
import { BreakdownPieCard } from '@/components/charts/BreakdownPieCard';
import { RadarComparisonCard } from '@/components/charts/RadarComparisonCard';
import { ExportTimeIntensityGrid } from '@/components/charts/ExportTimeIntensityGrid';
import { TopExportedPatternsCard } from '@/components/charts/TopExportedPatternsCard';
import { MonthlyTopExportsCard } from '@/components/admin/database-stats/MonthlyTopExportsCard';
import {
  computeExportsPerPattern,
  computeGrowthSeries,
  computeMarkedDoneIntensity,
  computeVelocityComparison,
  type TypeDatabaseStatsSnapshot,
  type TypeStatsBucket,
} from '@/functions/database/database-stats';

export type TypeDatabaseStatsCardDefinition = {
  id: string;
  title: string;
  gridSize: { xs: number; sm?: number; md?: number };
  render: () => ReactNode;
};

const toPoints = (buckets: TypeStatsBucket[], getter: (s: TypeDatabaseStatsSnapshot) => number) =>
  buckets.map((b) => ({ label: b.label, value: getter(b.snapshot) }));

const signedDelta = (delta: number, noun: string): { label: string; direction: 'up' | 'down' | 'neutral' } => {
  if (delta === 0) return { label: 'No change this week', direction: 'neutral' };
  const sign = delta > 0 ? '+' : '';
  return { label: `${sign}${delta.toLocaleString()} ${noun} this week`, direction: delta > 0 ? 'up' : 'down' };
};

const STAT_SIZE = { xs: 12, sm: 6, md: 3 };
const CHART_SIZE = { xs: 12, sm: 6, md: 6 };
const FULL_SIZE = { xs: 12, sm: 12, md: 12 };

/**
 * Wires the reusable presentational components from src/components/charts/*
 * to specific slices of the (already period/year-bucketed) snapshot data.
 * Nothing here touches localStorage or @dnd-kit - this is pure data-to-JSX,
 * consumed by DatabaseStatsGrid which layers ordering/visibility/drag on top.
 */
export const buildDatabaseStatsCardRegistry = (
  buckets: TypeStatsBucket[],
  latest: TypeDatabaseStatsSnapshot,
): TypeDatabaseStatsCardDefinition[] => [
  {
    id: 'total-patterns-stat',
    title: 'Total Patterns',
    gridSize: STAT_SIZE,
    render: () => {
      const delta = signedDelta(latest.new_patterns_7d, 'patterns');
      return (
        <StatTile
          title="Total Patterns"
          icon={<ExtensionRoundedIcon sx={{ fontSize: 18 }} />}
          value={latest.total_patterns}
          deltaLabel={delta.label}
          deltaDirection={delta.direction}
        />
      );
    },
  },
  {
    id: 'total-patterns-trend',
    title: 'Patterns Over Time',
    gridSize: CHART_SIZE,
    render: () => (
      <TrendChartCard
        title="Patterns Over Time"
        icon={<ExtensionRoundedIcon sx={{ fontSize: 18 }} />}
        points={toPoints(buckets, (s) => s.total_patterns)}
      />
    ),
  },
  {
    id: 'total-site-visits-stat',
    title: 'Site Visits',
    gridSize: STAT_SIZE,
    render: () => (
      <StatTile
        title="Site Visits"
        icon={<VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
        value={latest.total_site_visits}
      />
    ),
  },
  {
    id: 'total-site-visits-trend',
    title: 'Site Visits Over Time',
    gridSize: CHART_SIZE,
    render: () => (
      <TrendChartCard
        title="Site Visits Over Time"
        icon={<VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
        points={toPoints(buckets, (s) => s.total_site_visits)}
      />
    ),
  },
  {
    id: 'total-tags-stat',
    title: 'Total Tags',
    gridSize: STAT_SIZE,
    render: () => (
      <StatTile title="Total Tags" icon={<LocalOfferRoundedIcon sx={{ fontSize: 18 }} />} value={latest.total_tags} />
    ),
  },
  {
    id: 'total-users-stat',
    title: 'Total Users',
    gridSize: STAT_SIZE,
    render: () => {
      const delta = signedDelta(latest.new_users_7d, 'users');
      return (
        <StatTile
          title="Total Users"
          icon={<PeopleRoundedIcon sx={{ fontSize: 18 }} />}
          value={latest.total_users}
          deltaLabel={delta.label}
          deltaDirection={delta.direction}
        />
      );
    },
  },
  {
    id: 'total-users-trend',
    title: 'User Growth',
    gridSize: CHART_SIZE,
    render: () => (
      <TrendChartCard
        title="User Growth"
        icon={<PeopleRoundedIcon sx={{ fontSize: 18 }} />}
        points={toPoints(buckets, (s) => s.total_users)}
      />
    ),
  },
  {
    id: 'user-growth-percent',
    title: 'User Growth %',
    gridSize: CHART_SIZE,
    render: () => (
      <TrendChartCard
        title="User Growth %"
        icon={<TrendingUpRoundedIcon sx={{ fontSize: 18 }} />}
        points={computeGrowthSeries(buckets, (s) => s.total_users)}
        colorMode="status"
        valueFormatter={(v) => (v === null ? 'N/A' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)}
      />
    ),
  },
  {
    id: 'marked-done-stat',
    title: 'Patterns Marked Done',
    gridSize: STAT_SIZE,
    render: () => {
      const delta = signedDelta(latest.new_marked_done_7d, 'marks');
      return (
        <StatTile
          title="Patterns Marked Done"
          icon={<TaskAltRoundedIcon sx={{ fontSize: 18 }} />}
          value={latest.total_marked_done}
          deltaLabel={delta.label}
          deltaDirection={delta.direction}
        />
      );
    },
  },
  {
    id: 'total-exports-stat',
    title: 'Total Exports',
    gridSize: STAT_SIZE,
    render: () => {
      const delta = signedDelta(latest.new_exports_7d, 'exports');
      return (
        <StatTile
          title="Total Exports"
          icon={<FileDownloadRoundedIcon sx={{ fontSize: 18 }} />}
          value={latest.total_exports}
          deltaLabel={delta.label}
          deltaDirection={delta.direction}
        />
      );
    },
  },
  {
    id: 'total-exports-trend',
    title: 'Exports Over Time',
    gridSize: CHART_SIZE,
    render: () => (
      <TrendChartCard
        title="Exports Over Time"
        icon={<FileDownloadRoundedIcon sx={{ fontSize: 18 }} />}
        points={toPoints(buckets, (s) => s.total_exports)}
      />
    ),
  },
  {
    id: 'user-submissions-stat',
    title: 'User-Submitted Patterns',
    gridSize: STAT_SIZE,
    render: () => {
      const delta = signedDelta(latest.new_user_submissions_7d, 'submissions');
      return (
        <StatTile
          title="User-Submitted Patterns"
          icon={<UploadFileRoundedIcon sx={{ fontSize: 18 }} />}
          value={latest.total_user_submissions}
          deltaLabel={delta.label}
          deltaDirection={delta.direction}
        />
      );
    },
  },
  {
    id: 'export-time-grid',
    title: 'Exports By Time',
    gridSize: STAT_SIZE,
    render: () => (
      <ExportTimeIntensityGrid
        title="Exports By Time (trailing 7 days)"
        icon={<AccessTimeRoundedIcon sx={{ fontSize: 18 }} />}
        hourCounts={latest.exports_by_hour_7d}
        weekdayCounts={latest.exports_by_weekday_7d}
      />
    ),
  },
  {
    id: 'export-file-type-pie',
    title: 'Exports By File Type',
    gridSize: CHART_SIZE,
    render: () => (
      <BreakdownPieCard
        title="Exports By File Type"
        icon={<PieChartRoundedIcon sx={{ fontSize: 18 }} />}
        data={latest.exports_by_file_type_7d}
        categoryOrder={['pdf', 'png', 'jpg', 'webp', 'svg']}
        labelFormatter={(k) => k.toUpperCase()}
      />
    ),
  },
  {
    id: 'export-flow-pie',
    title: 'Exports By Purpose',
    gridSize: CHART_SIZE,
    render: () => (
      <BreakdownPieCard
        title="Exports By Purpose"
        icon={<PieChartRoundedIcon sx={{ fontSize: 18 }} />}
        data={latest.exports_by_flow_7d}
        categoryOrder={['cricut', 'craft cutter', 'printing', 'saving for later', 'editing', 'generic']}
        labelFormatter={(k) => k.replace(/\b\w/g, (c) => c.toUpperCase())}
      />
    ),
  },
  {
    id: 'top-exported-patterns-30d',
    title: 'Top Exported Patterns (Trailing 30 Days)',
    gridSize: FULL_SIZE,
    render: () => (
      <TopExportedPatternsCard
        title="Top Exported Patterns (Trailing 30 Days)"
        icon={<EmojiEventsRoundedIcon sx={{ fontSize: 18 }} />}
        patterns={latest.top_exported_patterns_30d}
      />
    ),
  },
  {
    id: 'top-exported-patterns-monthly',
    title: 'Top Exported Patterns (By Month)',
    gridSize: FULL_SIZE,
    render: () => <MonthlyTopExportsCard />,
  },
  {
    id: 'published-draft-pie',
    title: 'Published vs Draft',
    gridSize: CHART_SIZE,
    render: () => (
      <BreakdownPieCard
        title="Published vs Draft"
        icon={<ArticleRoundedIcon sx={{ fontSize: 18 }} />}
        data={{ published: latest.published_patterns, draft: latest.draft_patterns }}
        categoryOrder={['published', 'draft']}
        labelFormatter={(k) => (k === 'published' ? 'Published' : 'Draft')}
      />
    ),
  },
  {
    id: 'verified-users-stat',
    title: 'Verified Users',
    gridSize: STAT_SIZE,
    render: () => (
      <StatTile
        title="Verified Users"
        icon={<VerifiedRoundedIcon sx={{ fontSize: 18 }} />}
        value={latest.verified_users}
      />
    ),
  },
  {
    id: 'artist-users-stat',
    title: 'Artist Accounts',
    gridSize: STAT_SIZE,
    render: () => (
      <StatTile title="Artist Accounts" icon={<BrushRoundedIcon sx={{ fontSize: 18 }} />} value={latest.artist_users} />
    ),
  },
  {
    id: 'pattern-sets-stat',
    title: 'Pattern Sets',
    gridSize: STAT_SIZE,
    render: () => (
      <StatTile
        title="Pattern Sets"
        icon={<StyleRoundedIcon sx={{ fontSize: 18 }} />}
        value={latest.total_pattern_sets}
      />
    ),
  },
  {
    id: 'store-locations-stat',
    title: 'Store Locations',
    gridSize: STAT_SIZE,
    render: () => (
      <StatTile
        title="Store Locations"
        icon={<StoreRoundedIcon sx={{ fontSize: 18 }} />}
        value={latest.total_store_locations}
      />
    ),
  },
];
