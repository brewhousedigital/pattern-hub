import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import dayjs from 'dayjs';
import { enqueueSnackbar } from 'notistack';
import { useGlobalAuthData } from '@/data/auth-data';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useQueryClient } from '@tanstack/react-query';
import {
  useQueryGetAllUserSubmissionsByPagination,
  useMutationBeginReview,
  type TypeUserSubmittedPatternResponse,
} from '@/functions/database/user-submissions';
import { generateUserSubmissionFileUrl } from '@/functions/utilities/generate-pb-image';
import { UserSubmissionViewModal } from '@/components/admin/UserSubmissionViewModal';

import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';

import { Box, Chip, Stack, Typography, IconButton, Tooltip, Link as MuiLink, Button } from '@mui/material';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';

export const Route = createFileRoute('/space-command/user-submissions/')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('User Submissions - Admin', '', match.pathname),
});

function RouteComponent() {
  const navigate = useNavigate({ from: '/space-command/user-submissions/' });
  const { checkAccess } = useCheckAdminAccess();
  const { authData } = useGlobalAuthData();
  const queryClient = useQueryClient();

  const [paginationModel, setPaginationModel] = React.useState({ page: 0, pageSize: 25 });
  const [viewingSubmission, setViewingSubmission] = React.useState<TypeUserSubmittedPatternResponse | null>(null);

  const { data, isLoading } = useQueryGetAllUserSubmissionsByPagination(paginationModel.page + 1);
  const beginReview = useMutationBeginReview();

  const canRead = checkAccess(EnumLevelsAdmin.USER_SUBMIT_AR);
  const canUpdate = checkAccess(EnumLevelsAdmin.USER_SUBMIT_AU);

  const handleBeginReview = async (row: TypeUserSubmittedPatternResponse) => {
    if (row.reviewing_admin && row.reviewing_admin !== authData?.id) {
      enqueueSnackbar('Another admin is already reviewing this submission.', { variant: 'warning' });
      return;
    }
    try {
      await beginReview.mutateAsync({ id: row.id, adminId: authData?.id ?? '' });
      queryClient.invalidateQueries({ queryKey: ['GetAllUserSubmissionsByPagination'] });
      navigate({ to: '/space-command/user-submissions/$id/review', params: { id: row.id } });
    } catch {
      enqueueSnackbar('Failed to begin review - please try again.', { variant: 'error' });
    }
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
        <Chip size="small" label={params.row.status} />
      ),
    },
    {
      field: 'reviewing_admin',
      headerName: 'Reviewing Admin',
      width: 160,
      valueGetter: (_value, row) => row.expand?.reviewing_admin?.name ?? '',
    },
    {
      field: 'created',
      headerName: 'Submitted',
      width: 160,
      valueGetter: (_value, row) => dayjs(row.created).format('MMM D, YYYY h:mm A'),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
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
          {canUpdate && (
            <Tooltip title="Begin Review">
              <IconButton size="small" onClick={() => handleBeginReview(params.row)}>
                <PlayArrowRoundedIcon fontSize="small" />
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
          User Submissions
        </Typography>

        <Button
          size="small"
          variant="outlined"
          startIcon={<ArchiveRoundedIcon fontSize="small" />}
          onClick={() => navigate({ to: '/space-command/user-submissions/processed' })}
        >
          Processed Submissions
        </Button>
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
