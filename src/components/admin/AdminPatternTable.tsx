import React from 'react';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';

import { type TypePatternResponse, useQueryGetAllPatternsByPaginationAdmin } from '@/functions/database/patterns';
import { AdminEditPatternModal } from '@/components/admin/AdminEditPatternModal';

import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { Box, Menu, MenuItem, InputAdornment, TextField, Stack, Typography, Tooltip, styled } from '@mui/material';

import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  Toolbar,
  ToolbarButton,
  ExportCsv,
  ExportPrint,
  QuickFilter,
  QuickFilterControl,
  QuickFilterClear,
  QuickFilterTrigger,
} from '@mui/x-data-grid';

export const AdminPatternTable = () => {
  const [rows, setRows] = React.useState<TypePatternResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);

  const { paginationModel, setPaginationModel } = useGlobalAdminPagination();

  const { setFilterModel, searchResult } = useGlobalAdminFilter();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, data } = useQueryGetAllPatternsByPaginationAdmin(
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

  const columns: GridColDef<TypePatternResponse>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'name',
      headerName: 'Name',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 150,
    },
    {
      field: 'description',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Description',
      flex: 1,
    },
    {
      field: 'tags',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Tags',
      flex: 1,
      valueFormatter: (value?: string[]) => {
        if (value == null) {
          return 'None';
        }
        return value;
      },
    },
    {
      field: 'pattern_file',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Pattern',
      width: 100,
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => {
        const filePath = generatePbImage(params.row);

        return (
          <Box sx={{ p: 2 }}>
            <Tooltip
              placement="left-start"
              arrow
              title={
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <FileDownloadIcon />
                  <>Download</>
                </Stack>
              }
            >
              <a href={filePath} download style={{ display: 'block' }}>
                <img
                  src={filePath}
                  alt={`pattern template for ${params.row.name}`}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                />
              </a>
            </Tooltip>
          </Box>
        );
      },
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
      renderCell: (params) => <AdminEditPatternModal mode="edit" {...params.row} />,
    },
  ];

  return (
    <Box sx={{ height: 'calc(100svh - 150px)', width: '100%' }}>
      <DataGrid
        loading={isPending || isFetching}
        rows={rows ?? []}
        columns={columns}
        slots={{ toolbar: CustomToolbar }}
        showToolbar
        pageSizeOptions={[25]}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        rowCount={totalRows}
        sortingMode="server"
        filterMode="server"
        paginationMode="server"
        onPaginationModelChange={(newPaginationModel) => {
          // fetch data from server
          setPaginationModel({
            ...newPaginationModel,
            // Pocktbase starts at page 1, not 0, so we have to manually increment
            page: newPaginationModel.page + 1,
          });
        }}
        onFilterModelChange={(newFilterModel) => {
          // fetch data from server
          setFilterModel(newFilterModel);
        }}
        //getRowHeight={() => 'auto'}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 25,
            },
          },
          columns: {
            columnVisibilityModel: {
              id: false,
            },
          },
        }}
      />
    </Box>
  );
};

function CustomToolbar() {
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const exportMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Toolbar>
      <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
        List of Patterns
      </Typography>

      <AdminEditPatternModal
        mode="add"
        collectionId={''}
        collectionName={''}
        id={''}
        name={''}
        description={''}
        difficulty={''}
        authors={['']}
        uploaded_by={''}
        tags={['']}
        pattern_file={''}
        pieces={0}
        design_width={0}
        design_height={0}
        line_width={0}
        design_width_unit={''}
        design_height_unit={''}
        line_width_unit={''}
        created={''}
        updated={''}
      />

      <Menu
        id="export-menu"
        // eslint-disable-next-line react-hooks/refs
        anchorEl={exportMenuTriggerRef.current}
        open={exportMenuOpen}
        onClose={() => setExportMenuOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: {
            'aria-labelledby': 'export-menu-trigger',
          },
        }}
      >
        <ExportPrint render={<MenuItem />} onClick={() => setExportMenuOpen(false)}>
          Print
        </ExportPrint>

        <ExportCsv render={<MenuItem />} onClick={() => setExportMenuOpen(false)}>
          Download as CSV
        </ExportCsv>
      </Menu>

      <StyledQuickFilter>
        <QuickFilterTrigger
          render={(triggerProps, state) => (
            <Tooltip title="Search" enterDelay={0}>
              <StyledToolbarButton
                {...triggerProps}
                ownerState={{ expanded: state.expanded }}
                color="default"
                aria-disabled={state.expanded}
              >
                <SearchIcon fontSize="small" />
              </StyledToolbarButton>
            </Tooltip>
          )}
        />
        <QuickFilterControl
          render={({ ref, ...controlProps }, state) => (
            <StyledTextField
              {...controlProps}
              ownerState={{ expanded: state.expanded }}
              inputRef={ref}
              aria-label="Search"
              placeholder="Search..."
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: state.value ? (
                    <InputAdornment position="end">
                      <QuickFilterClear
                        edge="end"
                        size="small"
                        aria-label="Clear search"
                        material={{ sx: { marginRight: -0.75 } }}
                      >
                        <CancelIcon fontSize="small" />
                      </QuickFilterClear>
                    </InputAdornment>
                  ) : null,
                  ...controlProps.slotProps?.input,
                },
                ...controlProps.slotProps,
              }}
            />
          )}
        />
      </StyledQuickFilter>
    </Toolbar>
  );
}

type OwnerState = {
  expanded: boolean;
};

const StyledQuickFilter = styled(QuickFilter)({
  display: 'grid',
  alignItems: 'center',
});

const StyledToolbarButton = styled(ToolbarButton)<{ ownerState: OwnerState }>(({ theme, ownerState }) => ({
  gridArea: '1 / 1',
  width: 'min-content',
  height: 'min-content',
  zIndex: 1,
  opacity: ownerState.expanded ? 0 : 1,
  pointerEvents: ownerState.expanded ? 'none' : 'auto',
  transition: theme.transitions.create(['opacity']),
}));

const StyledTextField = styled(TextField)<{
  ownerState: OwnerState;
}>(({ theme, ownerState }) => ({
  gridArea: '1 / 1',
  overflowX: 'clip',
  width: ownerState.expanded ? 260 : 'var(--trigger-width)',
  opacity: ownerState.expanded ? 1 : 0,
  transition: theme.transitions.create(['width', 'opacity']),
}));
