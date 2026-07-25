import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueSnackbar } from 'notistack';
import { generateSEO } from '@/functions/utilities/seo';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { createPrettyDate } from '@/functions/utilities/dates';
import {
  bucketSnapshotsByPeriod,
  filterBucketsByYear,
  getAvailableYears,
  STATS_PERIODS,
  useMutationTriggerDatabaseStatsSnapshot,
  useQueryGetDatabaseStatsHistory,
  type TypeDatabaseStatsSnapshot,
  type TypeStatsPeriod,
} from '@/functions/database/database-stats';
import { buildDatabaseStatsCardRegistry } from '@/components/admin/database-stats/DatabaseStatsCardRegistry';
import { DatabaseStatsGrid } from '@/components/admin/database-stats/DatabaseStatsGrid';

import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

import {
  Alert,
  Box,
  Button,
  IconButton,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';

export const Route = createFileRoute('/space-command/database-stats')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Database Stats - Admin', '', match.pathname),
});

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canView = checkAccess(EnumLevelsAdmin.DB_STATS_AR);
  const canCreate = checkAccess(EnumLevelsAdmin.DB_STATS_AC);

  const { log } = useAdminLogger();
  const { data, isPending, isError, error, refetch } = useQueryGetDatabaseStatsHistory();
  const triggerSnapshot = useMutationTriggerDatabaseStatsSnapshot();

  const [period, setPeriod] = React.useState<TypeStatsPeriod>('weekly');
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);

  const snapshots = data ?? [];
  const years = getAvailableYears(snapshots);

  // Default (and re-sync if the stored selection no longer exists) to the
  // most recent year - this is what makes 2027, 2028, ... show up on their
  // own as snapshots accumulate, with nothing hardcoded here.
  React.useEffect(() => {
    if (years.length === 0) return;
    if (selectedYear === null || !years.includes(selectedYear)) {
      setSelectedYear(years[years.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.join(',')]);

  const allBuckets = bucketSnapshotsByPeriod(snapshots, period);
  const displayedBuckets =
    period === 'yearly' || selectedYear === null ? allBuckets : filterBucketsByYear(allBuckets, selectedYear);

  const latest = displayedBuckets[displayedBuckets.length - 1]?.snapshot;

  const cards = latest ? buildDatabaseStatsCardRegistry(displayedBuckets, latest) : [];

  const handleRunSnapshot = async () => {
    try {
      await triggerSnapshot.mutateAsync();
      log({
        action: 'Database Stats Snapshot Triggered',
        entity_type: 'Database Stats',
        entity_id: '',
        entity_name: '',
        changes: {},
        metadata: {},
      });
      enqueueSnackbar('Snapshot recorded.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to run snapshot.', { variant: 'error' });
    }
  };

  const historyColumns: GridColDef<TypeDatabaseStatsSnapshot>[] = [
    {
      field: 'created',
      headerName: 'Snapshot Date',
      width: 170,
      renderCell: ({ row }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {createPrettyDate(row.created)}
        </Typography>
      ),
    },
    { field: 'total_patterns', headerName: 'Patterns', width: 100 },
    { field: 'total_tags', headerName: 'Tags', width: 90 },
    { field: 'total_users', headerName: 'Users', width: 90 },
    { field: 'total_marked_done', headerName: 'Marked Done', width: 120 },
    { field: 'total_exports', headerName: 'Exports', width: 100 },
    { field: 'total_user_submissions', headerName: 'Submissions', width: 120 },
    { field: 'total_site_visits', headerName: 'Site Visits', width: 110 },
  ];

  return (
    <>
      <AdminHeaderContainer
        title="Database Stats"
        subtitle="Weekly snapshots of site-wide metrics, charted over time."
        actionNode={
          <Tooltip title="Refresh">
            <Button startIcon={<RefreshRoundedIcon />} onClick={() => void refetch()} sx={{ mr: canCreate ? 1 : 0 }}>
              Refresh Data
            </Button>
          </Tooltip>
        }
        //action={canCreate ? handleRunSnapshot : undefined}
        //actionText="Run Snapshot Now"
        //actionIcon={<PlayArrowRoundedIcon />}
        //actionLoading={triggerSnapshot.isPending}
      />

      {!canView ? (
        <Alert severity="error" sx={{ m: 3 }}>
          You do not have permission to view database stats.
        </Alert>
      ) : (
        <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
          {snapshots.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                p: 5,
                border: '1.5px dashed',
                borderColor: 'divider',
                borderRadius: 3,
              }}
            >
              <InsightsRoundedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>No snapshots yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: canCreate ? 2 : 0 }}>
                The weekly cron hasn't run yet.
                {canCreate ? ' Record the first one now to start building history.' : ''}
              </Typography>
              {canCreate && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={handleRunSnapshot}
                  loading={triggerSnapshot.isPending}
                >
                  Run Snapshot Now
                </Button>
              )}
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  mb: 2.5,
                }}
              >
                {period === 'yearly' || years.length <= 1 ? (
                  <span />
                ) : (
                  <Tabs
                    value={selectedYear !== null && years.includes(selectedYear) ? selectedYear : false}
                    onChange={(_, value) => setSelectedYear(value)}
                    sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
                  >
                    {years.map((y) => (
                      <Tab key={y} value={y} label={String(y)} />
                    ))}
                  </Tabs>
                )}

                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={period}
                  onChange={(_, next) => next && setPeriod(next)}
                  sx={{ ml: 'auto' }}
                >
                  {STATS_PERIODS.map((p) => (
                    <ToggleButton key={p.value} value={p.value} sx={{ px: 1.5 }}>
                      {p.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              <DatabaseStatsGrid cards={cards} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 4, mb: 1.5 }}>
                Snapshot History
              </Typography>
              <DataGrid
                rows={snapshots}
                columns={historyColumns}
                initialState={{
                  sorting: { sortModel: [{ field: 'created', sort: 'desc' }] },
                  pagination: { paginationModel: { pageSize: 10 } },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              />
            </>
          )}
        </AdminCardWrapper>
      )}
    </>
  );
}
