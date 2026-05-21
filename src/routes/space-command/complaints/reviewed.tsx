import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { createPrettyDate } from '@/functions/utilities/dates';
import {
  useQueryGetReviewedComplaintsByPagination,
  type TypeComplaintsResponse,
} from '@/functions/database/complaints.ts';
import {
  useQueryGetReviewedContentReportsByPagination,
  type TypeContentReportResponse,
  CONTENT_TYPE_META,
} from '@/functions/database/content-reports.ts';
import { AdminComplaintsModal } from '@/components/admin/AdminComplaintsModal.tsx';
import { AdminContentReportModal } from '@/components/admin/AdminContentReportModal.tsx';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer.tsx';
import {
  useGlobalAdminFilterComplaints,
  useGlobalAdminPaginationComplaints,
  useGlobalAdminFilterContentReports,
  useGlobalAdminPaginationContentReports,
} from '@/data/admin-global-state';
import { useDebounce } from '@/functions/hooks/useDebounce';

import { Box, Button, Chip, Tab, Tabs, Typography } from '@mui/material';

import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { enqueueSnackbar } from 'notistack';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/complaints/reviewed')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Reviewed Reports - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <Box>
      <AdminHeaderContainer title="Reviewed Reports" />

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Pattern Reports" />
        <Tab label="Content Reports" />
      </Tabs>

      {activeTab === 0 && <PatternReportsGrid />}
      {activeTab === 1 && <ContentReportsGrid />}
    </Box>
  );
}

// ─── Pattern reports grid ─────────────────────────────────────────────────────

function PatternReportsGrid() {
  const [rows, setRows] = React.useState<TypeComplaintsResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);

  const { paginationModel, setPaginationModel } = useGlobalAdminPaginationComplaints();
  const { setFilterModel, searchResult } = useGlobalAdminFilterComplaints();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, data, refetch } = useQueryGetReviewedComplaintsByPagination(
    debouncedSearchTerm,
    paginationModel.page,
  );

  React.useEffect(() => {
    if (data) {
      setRows(data.items);
      setTotalRows(data.totalItems);
    } else {
      setRows([]);
    }
  }, [data]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TypeComplaintsResponse | null>(null);

  function openReview(complaint: TypeComplaintsResponse) {
    setSelected(complaint);
    setDialogOpen(true);
  }

  const handleModalClose = async () => {
    try {
      setDialogOpen(false);
      await refetch();
    } catch {
      enqueueSnackbar('Something went wrong updating this complaint… Try again in a few minutes', { variant: 'error' });
    }
  };

  const columns: GridColDef<TypeComplaintsResponse>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'pattern',
      headerName: 'Image',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 85,
      renderCell: (params) => {
        const pattern = params.row.expand?.pattern_id;
        const thumbUrl = generatePbImage(pattern);
        return (
          <img
            loading="lazy"
            src={thumbUrl}
            alt="pattern"
            style={{ width: 75, height: 75, aspectRatio: '1/1' }}
          />
        );
      },
    },
    {
      field: 'patternName',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Pattern Name',
      width: 200,
      renderCell: (params) => {
        const pattern = params.row.expand?.pattern_id;
        return (
          <>
            <a href={`/pattern/${pattern?.id}`} target="_blank">
              <Typography sx={{ fontWeight: 500 }}>{pattern?.name}</Typography>
            </a>
            <Typography variant="body2">{pattern?.id}</Typography>
          </>
        );
      },
    },
    { field: 'category', disableColumnMenu: true, headerName: 'Category', flex: 1, sortable: false, filterable: false },
    { field: 'reason', disableColumnMenu: true, headerName: 'Reason', flex: 1, sortable: false, filterable: false },
    {
      field: 'email',
      headerName: 'Email',
      disableColumnMenu: true,
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const user = params.row.expand?.owner_id;
        return (
          <>
            <Typography sx={{ fontWeight: 500 }}>{params.value}</Typography>
            <Typography variant="body2">User: {user?.id ? user.id : 'No Auth'}</Typography>
          </>
        );
      },
    },
    {
      field: 'reviewedBy',
      headerName: 'Reviewed By',
      disableColumnMenu: true,
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => params.row.expand?.reviewed_by?.name,
    },
    {
      field: 'created',
      headerName: 'Created',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => (value ? createPrettyDate(value) : ''),
    },
    {
      field: 'updated',
      headerName: 'Updated',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => (value ? createPrettyDate(value) : ''),
    },
    {
      field: 'actions',
      type: 'actions',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      renderCell: (params) => (
        <Button size="small" variant="contained" color="success" onClick={() => openReview(params.row)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataGrid
        columns={columns}
        loading={isPending || isFetching}
        rows={rows ?? []}
        showToolbar
        pageSizeOptions={[25]}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        rowCount={totalRows}
        sortingMode="server"
        filterMode="server"
        paginationMode="server"
        onPaginationModelChange={(newModel) =>
          setPaginationModel({ ...newModel, page: newModel.page + 1 })
        }
        onFilterModelChange={(newFilterModel) => setFilterModel(newFilterModel)}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          columns: { columnVisibilityModel: { id: false } },
        }}
      />

      <AdminComplaintsModal
        open={dialogOpen}
        onClose={handleModalClose}
        complaint={selected}
        key={selected?.id || ''}
      />
    </>
  );
}

// ─── Content reports grid ─────────────────────────────────────────────────────

function ContentReportsGrid() {
  const [rows, setRows] = React.useState<TypeContentReportResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);

  const { paginationModel, setPaginationModel } = useGlobalAdminPaginationContentReports();
  const { setFilterModel, searchResult } = useGlobalAdminFilterContentReports();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, data, refetch } = useQueryGetReviewedContentReportsByPagination(
    debouncedSearchTerm,
    paginationModel.page,
  );

  React.useEffect(() => {
    if (data) {
      setRows(data.items);
      setTotalRows(data.totalItems);
    } else {
      setRows([]);
    }
  }, [data]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TypeContentReportResponse | null>(null);

  function openReview(report: TypeContentReportResponse) {
    setSelected(report);
    setDialogOpen(true);
  }

  const handleModalClose = async () => {
    try {
      setDialogOpen(false);
      await refetch();
    } catch {
      enqueueSnackbar('Something went wrong updating this report… Try again in a few minutes', { variant: 'error' });
    }
  };

  const columns: GridColDef<TypeContentReportResponse>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'content_type',
      headerName: 'Type',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 130,
      renderCell: (params) => {
        const meta = CONTENT_TYPE_META[params.value] ?? { label: params.value, color: 'default' as const };
        return <Chip label={meta.label} color={meta.color} size="small" sx={{ fontSize: 11 }} />;
      },
    },
    {
      field: 'content_name',
      headerName: 'Content',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 200,
      renderCell: (params) => (
        <>
          <Typography sx={{ fontWeight: 500, fontSize: 13 }}>{params.value || '—'}</Typography>
          <Typography variant="body2" fontFamily="monospace" color="text.disabled">
            {params.row.content_id}
          </Typography>
        </>
      ),
    },
    { field: 'category', disableColumnMenu: true, headerName: 'Category', flex: 1, sortable: false, filterable: false },
    { field: 'reason', disableColumnMenu: true, headerName: 'Reason', flex: 1, sortable: false, filterable: false },
    {
      field: 'email',
      headerName: 'Email',
      disableColumnMenu: true,
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const user = params.row.expand?.owner_id;
        return (
          <>
            <Typography sx={{ fontWeight: 500 }}>{params.value}</Typography>
            <Typography variant="body2">User: {user?.id ? user.id : 'No Auth'}</Typography>
          </>
        );
      },
    },
    {
      field: 'reviewedBy',
      headerName: 'Reviewed By',
      disableColumnMenu: true,
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => params.row.expand?.reviewed_by?.name,
    },
    {
      field: 'created',
      headerName: 'Created',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => (value ? createPrettyDate(value) : ''),
    },
    {
      field: 'updated',
      headerName: 'Updated',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => (value ? createPrettyDate(value) : ''),
    },
    {
      field: 'actions',
      type: 'actions',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      renderCell: (params) => (
        <Button size="small" variant="contained" color="success" onClick={() => openReview(params.row)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataGrid
        columns={columns}
        loading={isPending || isFetching}
        rows={rows ?? []}
        showToolbar
        pageSizeOptions={[25]}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        rowCount={totalRows}
        sortingMode="server"
        filterMode="server"
        paginationMode="server"
        onPaginationModelChange={(newModel) =>
          setPaginationModel({ ...newModel, page: newModel.page + 1 })
        }
        onFilterModelChange={(newFilterModel) => setFilterModel(newFilterModel)}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          columns: { columnVisibilityModel: { id: false } },
        }}
      />

      <AdminContentReportModal
        open={dialogOpen}
        onClose={handleModalClose}
        report={selected}
        key={selected?.id || 'content'}
      />
    </>
  );
}
