import { useMutation, useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { pocketbase, pocketbaseDomain, queryClient } from '@/functions/database/authentication-setup';
import { useAuthorizationHeaders } from '@/functions/database/useAuthorizationHeaders';
import { parsePbDate } from '@/functions/utilities/dates';

// ─── Types ──────────────────────────────────────────────────────────────────

// Mirrors the `database_stats_snapshots` PocketBase collection - one row per
// weekly cron run (see pb_hooks/main.pb.js `computeDatabaseStatsSnapshot`).
export type TypeDatabaseStatsSnapshot = {
  id: string;
  created: string;
  total_patterns: number;
  published_patterns: number;
  draft_patterns: number;
  total_tags: number;
  total_users: number;
  verified_users: number;
  artist_users: number;
  total_marked_done: number;
  total_exports: number;
  total_user_submissions: number;
  total_pattern_sets: number;
  total_store_locations: number;
  total_site_visits: number;
  new_users_7d: number;
  new_patterns_7d: number;
  new_exports_7d: number;
  new_marked_done_7d: number;
  new_user_submissions_7d: number;
  avg_pattern_rating: number;
  avg_pattern_difficulty: number;
  exports_by_hour_7d: number[];
  exports_by_weekday_7d: number[];
  exports_by_file_type_7d: Record<string, number>;
  exports_by_flow_7d: Record<string, number>;
};

// The curated, non-sensitive projection /api/public-database-stats-history
// returns for the /community page.
export type TypePublicDatabaseStatsSnapshot = {
  created: string;
  total_patterns: number;
  total_users: number;
  total_tags: number;
};

export type TypeStatsPeriod = 'daily' | 'monthly' | 'quarterly' | 'yearly';

export const STATS_PERIODS: { value: TypeStatsPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

// A snapshot rolled up to one point on a chart: `snapshot` carries the latest
// (most accurate) cumulative totals for the period, `periodTotals` sums the
// rolling-7d velocity fields across every snapshot that landed in the period.
export type TypeStatsBucket = {
  key: string;
  label: string;
  date: Dayjs;
  snapshot: TypeDatabaseStatsSnapshot;
  periodTotals: {
    new_users: number;
    new_patterns: number;
    new_exports: number;
    new_marked_done: number;
    new_user_submissions: number;
  };
};

// ─── Queries / mutations ────────────────────────────────────────────────────

export const DATABASE_STATS_QUERY_KEY = ['DatabaseStatsHistory'] as const;
export const PUBLIC_DATABASE_STATS_QUERY_KEY = ['PublicDatabaseStatsHistory'] as const;

// Admin, full history. The collection's List rule already restricts reads to
// admins, so this goes straight through the client SDK - no custom route needed.
// Deduped to one snapshot per calendar day here, at the fetch boundary, so
// every downstream consumer (charts, the Snapshot History table) sees a clean
// series without having to know the primary/backup cron setup exists.
export const useQueryGetDatabaseStatsHistory = () => {
  return useQuery({
    queryKey: DATABASE_STATS_QUERY_KEY,
    queryFn: async (): Promise<TypeDatabaseStatsSnapshot[]> => {
      const records = await pocketbase
        .collection('database_stats_snapshots')
        .getFullList<TypeDatabaseStatsSnapshot>({ sort: 'created' });
      return dedupeSnapshotsByDay(records);
    },
  });
};

// Public, unauthenticated. Powers the /community page's growth charts.
export const useQueryGetPublicDatabaseStatsHistory = () => {
  return useQuery({
    queryKey: PUBLIC_DATABASE_STATS_QUERY_KEY,
    queryFn: async (): Promise<TypePublicDatabaseStatsSnapshot[]> => {
      const res = await fetch(`${pocketbaseDomain}/api/public-database-stats-history`);
      if (!res.ok) throw new Error('Failed to load stats history');
      const data = await res.json();
      return data.items ?? [];
    },
  });
};

// "Run snapshot now" - gate the calling button with checkAccess(DB_STATS_AC).
export const useMutationTriggerDatabaseStatsSnapshot = () => {
  const authHeaders = useAuthorizationHeaders('POST');
  return useMutation({
    mutationFn: async (): Promise<{ ok: boolean; id: string }> => {
      const res = await fetch(`${pocketbaseDomain}/api/admin-run-database-stats-snapshot`, authHeaders);
      if (!res.ok) throw new Error('Failed to run snapshot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATABASE_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_DATABASE_STATS_QUERY_KEY });
    },
  });
};

// ─── Pure utilities (no React - reused by both admin and community charts) ──

const getBucketKey = (date: Dayjs, period: TypeStatsPeriod): string => {
  switch (period) {
    case 'daily':
      return date.format('YYYY-MM-DD');
    case 'monthly':
      return date.format('YYYY-MM');
    case 'quarterly':
      return `${date.year()}-Q${Math.floor(date.month() / 3) + 1}`;
    case 'yearly':
      return String(date.year());
  }
};

const formatBucketLabel = (date: Dayjs, period: TypeStatsPeriod): string => {
  switch (period) {
    case 'daily':
      return date.format('MMM D');
    case 'monthly':
      return date.format('MMM YYYY');
    case 'quarterly':
      return `Q${Math.floor(date.month() / 3) + 1} ${date.year()}`;
    case 'yearly':
      return String(date.year());
  }
};

const sumField = <T>(group: T[], getter: (item: T) => number): number =>
  group.reduce((sum, item) => sum + getter(item), 0);

// Groups any date-stamped items into period buckets, keeping every item in
// the bucket alongside the chronologically-last one. Shared by the admin
// bucketing (needs the full group, to sum the _7d velocity fields) and the
// public/community bucketing (only ever needs the latest snapshot) below -
// the grouping algorithm itself doesn't care which snapshot shape it's given.
const groupByPeriod = <T extends { created: string }>(
  items: T[],
  period: TypeStatsPeriod,
): { key: string; label: string; date: Dayjs; latest: T; group: T[] }[] => {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const date = parsePbDate(item.created);
    const key = getBucketKey(date, period);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const result = Array.from(groups.entries()).map(([key, group]) => {
    const latest = group[group.length - 1];
    const date = parsePbDate(latest.created);
    return { key, label: formatBucketLabel(date, period), date, latest, group };
  });

  return result.sort((a, b) => a.date.valueOf() - b.date.valueOf());
};

// The primary cron can occasionally miss its run entirely (e.g. the
// PocketBase host being briefly offline) with no way to retry once the
// window's passed, so a backup cron fires a bit later the same day to fill
// the gap. On a normal day both succeed and the table ends up with 2 rows for
// one calendar day. Duplicates are left in the table itself on purpose -
// better a duplicate than a silent gap - but every chart/aggregate should
// only ever see one point per day: the later of the two, since it reflects
// the more complete same-day picture (and is the *only* one recorded on a day
// the primary failed and the backup caught it).
export const dedupeSnapshotsByDay = (snapshots: TypeDatabaseStatsSnapshot[]): TypeDatabaseStatsSnapshot[] =>
  groupByPeriod(snapshots, 'daily').map((bucket) => bucket.latest);

/**
 * Rolls raw (daily) snapshots up to the requested period. `daily` returns
 * one bucket per snapshot; `monthly`/`quarterly`/`yearly` group snapshots by
 * period, keeping the *last* snapshot's cumulative totals (most accurate
 * point-in-time state) while summing the rolling-7d fields across the group
 * (an approximation of "new X this period" from daily deltas). Callers should
 * dedupe with dedupeSnapshotsByDay first - otherwise a duplicate day's _7d
 * fields get summed twice into whatever period bucket it falls in.
 */
export const bucketSnapshotsByPeriod = (
  snapshots: TypeDatabaseStatsSnapshot[],
  period: TypeStatsPeriod,
): TypeStatsBucket[] =>
  groupByPeriod(snapshots, period).map(({ key, label, date, latest, group }) => ({
    key,
    label,
    date,
    snapshot: latest,
    periodTotals: {
      new_users: sumField(group, (s) => s.new_users_7d),
      new_patterns: sumField(group, (s) => s.new_patterns_7d),
      new_exports: sumField(group, (s) => s.new_exports_7d),
      new_marked_done: sumField(group, (s) => s.new_marked_done_7d),
      new_user_submissions: sumField(group, (s) => s.new_user_submissions_7d),
    },
  }));

export type TypePublicStatsBucket = {
  key: string;
  label: string;
  date: Dayjs;
  snapshot: TypePublicDatabaseStatsSnapshot;
};

// Same rollup, for the narrower public projection the /community page gets -
// no _7d fields exist on that type, so there's no periodTotals to compute.
export const bucketPublicStatsByPeriod = (
  snapshots: TypePublicDatabaseStatsSnapshot[],
  period: TypeStatsPeriod,
): TypePublicStatsBucket[] =>
  groupByPeriod(snapshots, period).map(({ key, label, date, latest }) => ({ key, label, date, snapshot: latest }));

// Distinct years present in the snapshot history, ascending - this is how a
// year picker grows on its own (2027, 2028, ...) as snapshots accumulate,
// with no hardcoded list to maintain.
export const getAvailableYears = (snapshots: TypeDatabaseStatsSnapshot[]): number[] => {
  const years = new Set<number>();
  for (const snapshot of snapshots) {
    years.add(parsePbDate(snapshot.created).year());
  }
  return Array.from(years).sort((a, b) => a - b);
};

export const filterBucketsByYear = (buckets: TypeStatsBucket[], year: number): TypeStatsBucket[] =>
  buckets.filter((bucket) => bucket.date.year() === year);

// null when there's no prior value to compare against (first bucket) or the
// baseline was 0 (a percentage against a zero baseline is undefined, not infinite).
export const computeGrowthPercent = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

export type TypeChartPoint = { label: string; value: number | null };

// Point-over-point growth %, for the explicitly-requested "user growth over
// time" card. Generic over the snapshot shape so both the admin bucket type
// (TypeStatsBucket) and the public/community one (TypePublicStatsBucket) can
// share this - the community page's charts are the same components/logic as
// admin's, just fed the curated public projection instead.
export const computeGrowthSeries = <T>(
  buckets: { label: string; snapshot: T }[],
  valueGetter: (snapshot: T) => number,
): TypeChartPoint[] => {
  return buckets.map((bucket, i) => {
    if (i === 0) return { label: bucket.label, value: null };
    const previous = valueGetter(buckets[i - 1].snapshot);
    const current = valueGetter(bucket.snapshot);
    return { label: bucket.label, value: computeGrowthPercent(current, previous) };
  });
};

export type TypeVelocityMetric = { key: string; label: string; current: number; previous: number };

// This-week-vs-last-week comparison across the five _7d velocity fields, for
// the Growth-Velocity radar card. Needs at least 2 buckets.
export const computeVelocityComparison = (buckets: TypeStatsBucket[]): TypeVelocityMetric[] => {
  const latest = buckets[buckets.length - 1];
  const prior = buckets[buckets.length - 2];
  if (!latest || !prior) return [];

  return [
    {
      key: 'new_users',
      label: 'New Users',
      current: latest.periodTotals.new_users,
      previous: prior.periodTotals.new_users,
    },
    {
      key: 'new_patterns',
      label: 'New Patterns',
      current: latest.periodTotals.new_patterns,
      previous: prior.periodTotals.new_patterns,
    },
    {
      key: 'new_exports',
      label: 'Exports',
      current: latest.periodTotals.new_exports,
      previous: prior.periodTotals.new_exports,
    },
    {
      key: 'new_marked_done',
      label: 'Marked Done',
      current: latest.periodTotals.new_marked_done,
      previous: prior.periodTotals.new_marked_done,
    },
    {
      key: 'new_user_submissions',
      label: 'Submissions',
      current: latest.periodTotals.new_user_submissions,
      previous: prior.periodTotals.new_user_submissions,
    },
  ];
};

// Framed as an intensity ratio, not a "completion rate" - the numerator counts
// done-*events* (user_marked_done rows), not distinct patterns, so it can
// exceed the denominator.
export const computeMarkedDoneIntensity = (snapshot: TypeDatabaseStatsSnapshot): number =>
  snapshot.published_patterns > 0 ? snapshot.total_marked_done / snapshot.published_patterns : 0;

export const computeExportsPerPattern = (snapshot: TypeDatabaseStatsSnapshot): number =>
  snapshot.published_patterns > 0 ? snapshot.total_exports / snapshot.published_patterns : 0;
