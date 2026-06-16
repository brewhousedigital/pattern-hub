import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useQueryGetAdminLogs, type TypeAdminLog } from '@/functions/database/admin-logs';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { useDebounce } from '@/functions/hooks/useDebounce';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';

import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export const Route = createFileRoute('/space-command/logs')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Audit Log - Admin', '', match.pathname),
  }),
});

const ENTITY_TYPES = [
  'Pattern',
  'Pattern Key',
  'Pattern Key Collection',
  'Tag',
  'Set',
  'Admin User',
  'User',
  'Kanban Column',
  'Kanban Item',
  'Store',
  'FAQ',
  'Wiki Category',
  'Wiki Page',
  'Report',
  'Contact Submission',
  'Content Report',
];

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canView = checkAccess(EnumLevelsAdmin.LOGS_VIEW_AR);

  const [search, setSearch] = React.useState('');
  const [entityType, setEntityType] = React.useState('');
  const [paginationModel, setPaginationModel] = React.useState({ page: 0, pageSize: 25 });
  const [detailLog, setDetailLog] = React.useState<TypeAdminLog | null>(null);

  const debouncedSearch = useDebounce(search, 600);

  const { data, isFetching, refetch } = useQueryGetAdminLogs({
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    search: debouncedSearch,
    entityType,
    adminId: '',
  });

  const columns: GridColDef<TypeAdminLog>[] = [
    {
      field: 'created',
      headerName: 'Timestamp',
      width: 160,
      renderCell: ({ row }) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', lineHeight: 1.4 }}>
          {new Date(row.created).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Typography>
      ),
    },
    {
      field: 'admin_name',
      headerName: 'Admin',
      width: 170,
      renderCell: ({ row }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {row.admin_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.admin_id}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      flex: 1,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {row.action}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'entity_type',
      headerName: 'Area',
      width: 150,
      renderCell: ({ row }) => <Chip label={row.entity_type} size="small" variant="outlined" />,
    },
    {
      field: 'entity_name',
      headerName: 'Record',
      width: 210,
      renderCell: ({ row }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" noWrap>
            {row.entity_name || '—'}
          </Typography>
          {row.entity_id && (
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
              {row.entity_id}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      field: '_details',
      headerName: '',
      width: 48,
      sortable: false,
      renderCell: ({ row }) => {
        const hasContent = Object.keys(row.changes ?? {}).length > 0 || Object.keys(row.metadata ?? {}).length > 0;
        if (!hasContent) return null;
        return (
          <IconButton size="small" onClick={() => setDetailLog(row)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        );
      },
    },
  ];

  return (
    <>
      <AdminHeaderContainer
        title="Audit Log"
        action={() => void refetch()}
        actionText="Refresh Logs"
        actionIcon={<RefreshRoundedIcon />}
        actionLoading={isFetching}
      />

      {/*<HistoryRoundedIcon />*/}

      {!canView ? (
        <Alert severity="error" sx={{ m: 3 }}>
          You do not have permission to view the audit log.
        </Alert>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Search actions, admins, records…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: { xs: '100%', sm: 300 } }}
            />
            <TextField
              select
              size="small"
              label="Filter by area"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPaginationModel((p) => ({ ...p, page: 0 }));
              }}
              sx={{ width: { xs: '100%', sm: 200 } }}
            >
              <MenuItem value="">All areas</MenuItem>
              {ENTITY_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <DataGrid
            rows={data?.items ?? []}
            columns={columns}
            rowCount={data?.totalItems ?? 0}
            loading={isFetching}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={(m) => {
              setPaginationModel(m);
            }}
            pageSizeOptions={[25, 50, 100]}
            disableRowSelectionOnClick
            rowHeight={60}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          />
        </>
      )}

      {/* ── Detail dialog ────────────────────────────────────────────── */}
      <Dialog open={!!detailLog} onClose={() => setDetailLog(null)} maxWidth="sm" fullWidth>
        {detailLog && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {detailLog.action}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {detailLog.entity_type}
                  {detailLog.entity_name ? ` · ${detailLog.entity_name}` : ''}
                  {' · '}
                  {new Date(detailLog.created).toLocaleString()}
                </Typography>
              </Box>
              <IconButton onClick={() => setDetailLog(null)} size="small" sx={{ mt: 0.25 }}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers>
              {Object.keys(detailLog.changes ?? {}).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: 'text.disabled',
                      display: 'block',
                      mb: 1,
                    }}
                  >
                    Changes
                  </Typography>
                  <Stack spacing={0}>
                    {Object.entries(detailLog.changes).map(([field, diff]) => (
                      <Box
                        key={field}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '130px 1fr',
                          gap: 1.5,
                          py: 0.75,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600, alignSelf: 'flex-start', pt: 0.25 }}>
                          {field}
                        </Typography>
                        <Box>
                          {diff.from !== null && diff.from !== undefined && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                color: 'error.main',
                                textDecoration: 'line-through',
                                wordBreak: 'break-all',
                                mb: 0.25,
                              }}
                            >
                              {JSON.stringify(diff.from)}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', color: 'success.main', wordBreak: 'break-all' }}
                          >
                            {JSON.stringify(diff.to)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {Object.keys(detailLog.metadata ?? {}).length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: 'text.disabled',
                      display: 'block',
                      mb: 1,
                    }}
                  >
                    Details
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      bgcolor: 'action.hover',
                      p: 1.5,
                      borderRadius: 1,
                      m: 0,
                    }}
                  >
                    {JSON.stringify(detailLog.metadata, null, 2)}
                  </Box>
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
