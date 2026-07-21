import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import dayjs from 'dayjs';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import {
  useQueryGetProcessedUserSubmissionsByPagination,
  type TypeUserSubmittedPatternResponse,
  type TypeProcessedSubmissionFilter,
} from '@/functions/database/user-submissions';
import { generateUserSubmissionFileUrl } from '@/functions/utilities/generate-pb-image';
import { UserSubmissionViewModal } from '@/components/admin/UserSubmissionViewModal';

import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';

import { Box, Chip, Stack, Typography, IconButton, Tooltip, Link as MuiLink, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';

export const Route = createFileRoute('/space-command/user-submissions/processed')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Processed Submissions - Admin', '', match.pathname),
});

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();

  const [statusFilter, setStatusFilter] = React.useState<TypeProcessedSubmissionFilter>('all');
  const [paginationModel, setPaginationModel] = React.useState({ page: 0, pageSize: 25 });
  const [viewingSubmission, setViewingSubmission] = React.useState<TypeUserSubmittedPatternResponse | null>(null);

  const { data, isLoading } = useQueryGetProcessedUserSubmissionsByPagination(paginationModel.page + 1, statusFilter);

  const canRead = checkAccess(EnumLevelsAdmin.USER_SUBMIT_AR);

  const handleStatusFilterChange = (_event: React.MouseEvent<HTMLElement>, value: TypeProcessedSubmissionFilter | null) => {
    if (!value) return;
    setStatusFilter(value);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const columns: GridColDef<TypeUserSubmittedPatternResponse>[] = [
    {
      field: 'thumbnail',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params: GridRenderCellParams<TypeUserSubmittedPatternResponse>) => (
        <Box
          component="img"
          src={generateUserSubmissionFileUrl(params.row)}
          alt=""
          sx={{ width: 40, height: 40, objectFit: 'contain', my: 'auto' }}
        />
      ),
    },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    {
      field: 'submitter',
      headerName: 'Submitter',
      width: 160,
      renderCell: (params: GridRenderCellParams<TypeUserSubmittedPatternResponse>) => (
        <MuiLink
          href={`/profile/${params.row.submitter}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {params.row.expand?.submitter?.name ?? params.row.submitter}
        </MuiLink>
      ),
    },
    {
      field: 'file_type',
      headerName: 'File Type',
      width: 200,
      renderCell: (params: GridRenderCellParams<TypeUserSubmittedPatternResponse>) => (
        <Chip
          size="small"
          label={params.row.file_type === 'svg' ? 'SVG - ready' : 'WebP - needs tracing'}
          color={params.row.file_type === 'svg' ? 'success' : 'warning'}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params: GridRenderCellParams<TypeUserSubmittedPatternResponse>) => (
        <Chip
          size="small"
          label={params.row.status}
          color={params.row.status === 'published' ? 'success' : params.row.status === 'rejected' ? 'error' : 'default'}
        />
      ),
    },
    {
      field: 'reviewing_admin',
      headerName: 'Reviewing Admin',
      width: 160,
      valueGetter: (_value, row) => row.expand?.reviewing_admin?.name ?? '',
    },
    {
      field: 'updated',
      headerName: 'Processed',
      width: 160,
      valueGetter: (_value, row) => dayjs(row.updated).format('MMM D, YYYY h:mm A'),
    },
    {
      field: 'actions',
      headerName: '',
      width: 70,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<TypeUserSubmittedPatternResponse>) => (
        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {canRead && (
            <Tooltip title="View">
              <IconButton size="small" onClick={() => setViewingSubmission(params.row)}>
                <VisibilityRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Processed Submissions
        </Typography>

        <ToggleButtonGroup size="small" exclusive value={statusFilter} onChange={handleStatusFilterChange}>
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="rejected">Rejected</ToggleButton>
          <ToggleButton value="published">Published</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <DataGrid
        rows={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        paginationMode="server"
        rowCount={data?.totalItems ?? 0}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[25]}
        getRowHeight={() => 56}
        disableRowSelectionOnClick
      />

      {viewingSubmission && (
        <UserSubmissionViewModal submission={viewingSubmission} onClose={() => setViewingSubmission(null)} />
      )}
    </Box>
  );
}
