import React from 'react';
import { useDebounce } from '@/functions/hooks/useDebounce';
import {
  generatePbImageSVG,
  generatePbImageExternalFile,
  generatePbImageOpenGraph,
} from '@/functions/utilities/generate-pb-image';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';

import { type TypePatternResponse, useQueryGetAllPatternsByPaginationAdmin } from '@/functions/database/patterns';
import { AdminEditPatternModal } from '@/components/admin/AdminEditPatternModal';
import { AdminPatternInstructionsModal } from '@/components/admin/AdminPatternInstructionsModal';

import VerticalSplitRoundedIcon from '@mui/icons-material/VerticalSplitRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import {
  Box,
  Menu,
  MenuItem,
  InputAdornment,
  TextField,
  Stack,
  Typography,
  Tooltip,
  styled,
  Button,
  IconButton,
} from '@mui/material';

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
import dayjs from 'dayjs';

export const AdminPatternTable = () => {
  const { paginationModel, setPaginationModel } = useGlobalAdminPagination();

  const { setFilterModel, searchResult } = useGlobalAdminFilter();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, data, refetch } = useQueryGetAllPatternsByPaginationAdmin(
    debouncedSearchTerm,
    paginationModel.page,
  );

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
        const filePath = generatePbImageSVG(params.row);

        if (params.value) {
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
        }

        return '';
      },
    },
    {
      field: 'pattern_file_external',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'External',
      width: 100,
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => {
        const filePath = generatePbImageExternalFile(params.row);

        if (params.value) {
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
                <a href={filePath} download target="_blank" style={{ display: 'block' }}>
                  <img
                    src={filePath}
                    alt={`pattern template for ${params.row.name}`}
                    style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                  />
                </a>
              </Tooltip>
            </Box>
          );
        }

        return '';
      },
    },
    {
      field: 'pattern_file_external_link',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Ext Link',
      width: 120,
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => {
        if (params.value) {
          return (
            <Button component="a" target="_blank" href={params.value} endIcon={<LaunchRoundedIcon />}>
              Link
            </Button>
          );
        }

        return '';
      },
    },
    {
      field: 'opengraph_image',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Share Image',
      width: 100,
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => {
        const filePath = generatePbImageOpenGraph(params.row);

        if (params.value) {
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
                <a href={filePath} download target="_blank" style={{ display: 'block' }}>
                  <img
                    src={filePath}
                    alt={`pattern template for ${params.row.name}`}
                    style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                  />
                </a>
              </Tooltip>
            </Box>
          );
        }

        return '';
      },
    },
    {
      field: 'actions',
      type: 'actions',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Actions',
      width: 120,
      cellClassName: 'actions',
      renderCell: (params) => {
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <AdminEditPatternModal mode="edit" callback={refetch} {...params.row} />
            {/*<AdminPatternInstructionsModal callback={refetch} {...params.row} />*/}
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ height: 'calc(100svh - 150px)', width: '100%' }}>
      <DataGrid
        loading={isPending || isFetching}
        rows={data?.items ?? []}
        columns={columns}
        slots={{ toolbar: CustomToolbar }}
        showToolbar
        pageSizeOptions={[25]}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        rowCount={data?.totalItems || 0}
        sortingMode="server"
        filterMode="server"
        paginationMode="server"
        onPaginationModelChange={(newPaginationModel) => {
          // fetch data from server
          setPaginationModel({
            ...newPaginationModel,
            // Pocketbase starts at page 1, not 0, so we have to manually increment
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
        authors={[]}
        author_manual={[]}
        uploaded_by={''}
        tags={[]}
        pattern_file={''}
        pattern_file_external={''}
        pattern_file_external_link={''}
        opengraph_image={''}
        pieces={0}
        design_width={0}
        design_height={0}
        line_width={0}
        design_width_unit={''}
        design_height_unit={''}
        line_width_unit={''}
        created={''}
        updated={''}
        pattern_key_reference_list={[]}
        instructions={''}
        design_date={dayjs()}
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
