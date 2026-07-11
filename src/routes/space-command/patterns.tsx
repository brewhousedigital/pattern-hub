import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import dayjs from 'dayjs';
import { useDebounce } from '@/functions/hooks/useDebounce';
import {
  generatePbImageSVG,
  generatePbImageExternalFile,
  generatePbImageOpenGraph,
} from '@/functions/utilities/generate-pb-image';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';
import { type TypePatternResponse, useQueryGetAllPatternsByPaginationAdmin } from '@/functions/database/patterns';
import { AdminEditPatternModal } from '@/components/admin/AdminEditPatternModal';
import {
  AdminPatternTableHowToSearch,
  OpenAdminPatternTableHowToSearchButton,
} from '@/components/admin/AdminPatternTableHowToSearch';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';

import {
  Box,
  Chip,
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
  type GridSortModel,
  Toolbar,
  ToolbarButton,
  ExportCsv,
  ExportPrint,
  QuickFilter,
  QuickFilterControl,
  QuickFilterClear,
  QuickFilterTrigger,
} from '@mui/x-data-grid';

// ─── Quick actions ────────────────────────────────────────────────────────────
// Toolbar toggles for common admin QA lookups. Each maps to a PocketBase filter
// clause, and the active set round-trips through the `quick` URL param
// (comma-joined) so a filtered view can be bookmarked or shared.
const QUICK_ACTIONS = [
  { id: 'no-layers', label: 'No Layers', filter: 'has_layers = false' },
  { id: 'draft', label: 'Draft', filter: 'is_draft = true' },
  { id: 'no-tags', label: 'No Tags', filter: 'tag_count = 0' },
  // No authors of either kind: linked user accounts (relation) or manual names.
  // NOTE: `:length` only behaves on arrayable fields (relation/select/file) -
  // on the author_manual JSON field an empty [] still reports length > 0, so
  // emptiness must be tested by direct equality instead.
  {
    id: 'no-authors',
    label: 'No Authors',
    filter: "(authors:length = 0 && (author_manual = '[]' || author_manual = null || author_manual = ''))",
  },
] as const;

type QuickActionId = (typeof QUICK_ACTIONS)[number]['id'];

const isQuickActionId = (value: string): value is QuickActionId => QUICK_ACTIONS.some((a) => a.id === value);

// ─── Server-side sorting ──────────────────────────────────────────────────────
// Grid column → PocketBase sort field. File-name columns (external, share
// image) sort as strings, which groups empty vs present - i.e. an
// exists/doesn't-exist sort.
const SORTABLE_FIELDS: Record<string, string> = {
  name: 'name',
  is_draft: 'is_draft',
  pattern_file_external: 'pattern_file_external',
  opengraph_image: 'opengraph_image',
};

const DEFAULT_SORT = '-created';

function sortModelToPbSort(model: GridSortModel): string {
  const entry = model[0];
  const field = entry ? SORTABLE_FIELDS[entry.field] : undefined;
  if (!entry || !field) return DEFAULT_SORT;
  // Tiebreak equal values (e.g. all the empty externals) by newest first
  return `${entry.sort === 'desc' ? '-' : ''}${field},${DEFAULT_SORT}`;
}

export const Route = createFileRoute('/space-command/patterns')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    filter: typeof search.filter === 'string' ? search.filter : undefined,
    // Kept as a comma-joined string (not an array) because the app's custom
    // URL search serializer only round-trips arrays for its own known keys.
    quick:
      typeof search.quick === 'string'
        ? search.quick.split(',').filter(isQuickActionId).join(',') || undefined
        : undefined,
  }),
  head: ({ match }) => generateSEO('Patterns - Admin', '', match.pathname),
});

function RouteComponent() {
  const navigate = useNavigate({ from: '/space-command/patterns' });
  const { paginationModel, setPaginationModel } = useGlobalAdminPagination();

  const { setFilterModel, searchResult } = useGlobalAdminFilter();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { filter: urlFilter, quick } = Route.useSearch();
  const activeQuickIds = quick ? quick.split(',') : [];
  const quickClauses = QUICK_ACTIONS.filter((a) => activeQuickIds.includes(a.id)).map((a) => a.filter);
  const combinedFilter = [urlFilter, debouncedSearchTerm, ...quickClauses].filter(Boolean).join(' && ');

  const [sortModel, setSortModel] = React.useState<GridSortModel>([]);

  const { isPending, isFetching, data, refetch } = useQueryGetAllPatternsByPaginationAdmin(
    combinedFilter,
    paginationModel.page,
    sortModelToPbSort(sortModel),
  );

  const columns: GridColDef<TypePatternResponse>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'name',
      headerName: 'Name',
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      width: 150,
    },
    {
      field: 'is_draft',
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Draft',
      width: 60,
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => {
        if (!params.value) return '';
        return (
          <Box sx={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Tooltip title="Draft">
              <VisibilityOffRoundedIcon fontSize="small" color="warning" />
            </Tooltip>
          </Box>
        );
      },
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
                    loading="lazy"
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
      sortable: true,
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
                    loading="lazy"
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
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Share Image',
      width: 100,
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => {
        const filePath = generatePbImageOpenGraph(params.row);

        if (params.value) {
          return (
            <Box sx={{ textAlign: 'center' }}>
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
                <IconButton component="a" href={filePath} download target="_blank">
                  <CheckRoundedIcon color="success" />
                </IconButton>
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
    <Stack direction="row" sx={{ gap: 2 }}>
      <Box sx={{ height: 'calc(100svh - 150px)', width: 'calc(100% - 500px)', flex: 3 }}>
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
            setFilterModel(newFilterModel);
            if (urlFilter) {
              navigate({ search: (prev) => ({ ...prev, filter: undefined }), replace: true });
            }
          }}
          sortModel={sortModel}
          onSortModelChange={(newSortModel) => {
            setSortModel(newSortModel);
            // Sorted result set is re-ordered server-side - restart at page 1
            setPaginationModel((prev) => ({ ...prev, page: 1 }));
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
            filter: urlFilter ? { filterModel: { items: [], quickFilterValues: [urlFilter] } } : undefined,
          }}
        />
      </Box>

      <AdminPatternTableHowToSearch />
    </Stack>
  );
}

// Quick-action toggle chips. Reads/writes the route's `quick` search param so
// the active filters live in the URL (shareable, survives reloads).
function QuickActionChips() {
  const navigate = useNavigate({ from: '/space-command/patterns' });
  const { quick } = Route.useSearch();
  const { setPaginationModel } = useGlobalAdminPagination();

  const active = new Set(quick ? quick.split(',') : []);

  const toggle = (id: QuickActionId) => {
    const next = new Set(active);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    // The filtered result set may have fewer pages - jump back to the first
    setPaginationModel((prev) => ({ ...prev, page: 1 }));

    navigate({
      search: (prev) => ({ ...prev, quick: next.size > 0 ? [...next].join(',') : undefined }),
      replace: true,
    });
  };

  return (
    <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      {QUICK_ACTIONS.map((action) => {
        const isActive = active.has(action.id);
        return (
          <Chip
            key={action.id}
            label={action.label}
            size="small"
            clickable
            color={isActive ? 'primary' : 'default'}
            variant={isActive ? 'filled' : 'outlined'}
            onClick={() => toggle(action.id)}
            onDelete={isActive ? () => toggle(action.id) : undefined}
          />
        );
      })}
    </Stack>
  );
}

function CustomToolbar() {
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const exportMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Toolbar>
      <Stack direction="row" sx={{ width: '100%', alignItems: 'center', gap: 3 }}>
        <Typography sx={{ fontWeight: 'medium', mx: 0.5 }}>
          List of Patterns
        </Typography>

        <Box sx={{ flex: 1, mr: 'auto' }}>
          <QuickActionChips />
        </Box>

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
          has_layers={false}
          layers_map={[]}
          is_draft={false}
        />

        <OpenAdminPatternTableHowToSearchButton />

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
      </Stack>
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
