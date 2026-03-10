import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { enqueueSnackbar } from 'notistack';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useQueryGetAllAuthors } from '@/functions/database/authors';
import { useQueryGetAllUploadedBy } from '@/functions/database/uploaded-by';
import { useMutationAuthAdminSignIn, useMutationAuthGetAdmin } from '@/functions/database/authentication';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { FancyAutocomplete } from '@/components/FancyAutocomplete';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
  useQueryGetAllPatternsByPagination,
  useMutationEditPattern,
  useMutationDeletePattern,
} from '@/functions/database/patterns';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import {
  Autocomplete,
  Box,
  Button,
  Badge,
  Chip,
  Container,
  Dialog,
  Divider,
  Menu,
  MenuItem,
  IconButton,
  DialogActions,
  InputAdornment,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Typography,
  Tooltip,
  styled,
  Grid,
} from '@mui/material';

import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  Toolbar,
  ToolbarButton,
  ColumnsPanelTrigger,
  FilterPanelTrigger,
  ExportCsv,
  ExportPrint,
  QuickFilter,
  QuickFilterControl,
  QuickFilterClear,
  QuickFilterTrigger,
} from '@mui/x-data-grid';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoading } = useRefreshAdminAuth();

  const { authData } = useGlobalAuthData();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!authData) {
    return <LoginView />;
  }

  return <AdminPageContent />;
}

const LoginView = () => {
  const signIn = useMutationAuthAdminSignIn();
  const getUser = useMutationAuthGetAdmin();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);

  const { setAuthData } = useGlobalAuthData();

  const handleLogin = async () => {
    setIsLoading(true);

    try {
      const signInData = await signIn.mutateAsync({ email, password });

      // The sign in function doesn't automatically expand data points so we need to call it again to get the full record
      const userData = await getUser.mutateAsync({ userId: signInData.record.id });

      setAuthData(userData);
    } catch (error: any) {
      console.error('Error loading your user data:', error);
      enqueueSnackbar(`Error: ${error.message}`, { variant: 'error' });
    }

    setIsLoading(false);
  };

  return (
    <Container>
      <Typography sx={{ textAlign: 'center', mb: 2 }}>Space Command</Typography>

      <Stack
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 345, mx: 'auto' }}
      >
        <TextField label="Email" fullWidth type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <TextField
          label="Password"
          fullWidth
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button variant="outlined" fullWidth onClick={handleLogin} loading={isLoading}>
          Login
        </Button>
      </Stack>
    </Container>
  );
};

const AdminPageContent = () => {
  const [rows, setRows] = React.useState<TypePatternResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);

  const { paginationModel, setPaginationModel } = useGlobalAdminPagination();

  const { setFilterModel, searchResult } = useGlobalAdminFilter();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, isError, data } = useQueryGetAllPatternsByPagination(
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
        const filePath = `${pocketbaseDomain}/api/files/${params.row.collectionId}/${params.row.id}/${params.row.pattern_file}`;

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
      renderCell: (params) => <EditModal mode="edit" {...params.row} />,
    },
  ];

  return (
    <Container>
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
            console.log('>>>Pagination Change', newPaginationModel);
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
    </Container>
  );
};

type TypeModalMode = 'edit' | 'add';

type TypeEditModalProps = Partial<TypePatternResponse> & {
  mode: TypeModalMode;
};

const EditModal = (props: TypeEditModalProps) => {
  console.log('>>>props', props);

  const {
    isPending: isPendingTags,
    isError: isErrorTags,
    data: allTagsData,
    refetch: refetchTags,
  } = useQueryGetAllTags();
  const {
    isPending: isPendingAuthors,
    isError: isErrorAuthors,
    data: allAuthorsData,
    refetch: refetchAuthors,
  } = useQueryGetAllAuthors();
  const {
    isPending: isPendingUploadedBy,
    isError: isErrorUploadedBy,
    data: allUploadedByData,
    refetch: refetchUploadedBy,
  } = useQueryGetAllUploadedBy();

  const isLoading = isPendingTags || isPendingAuthors || isPendingUploadedBy;
  const isError = isErrorTags || isErrorAuthors || isErrorUploadedBy;

  const { searchResult } = useGlobalAdminFilter();
  const { paginationModel } = useGlobalAdminPagination();

  const savePattern = useMutationEditPattern();
  const deletePattern = useMutationDeletePattern();

  const { refetch: refetchPatterns } = useQueryGetAllPatternsByPagination(searchResult, paginationModel.page);

  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const [isButtonLoading, setIsButtonLoading] = React.useState(false);

  const [name, setName] = React.useState(props?.name || '');
  const [description, setDescription] = React.useState(props?.description || '');

  const [pieces, setPieces] = React.useState(String(props?.pieces) || '1');
  const [lineWidth, setLineWidth] = React.useState(String(props?.line_width) || '0');
  const [designWidth, setDesignWidth] = React.useState(String(props?.design_width) || '0');
  const [designHeight, setDesignHeight] = React.useState(String(props?.design_height) || '0');

  // Tags
  const [tagValue, setTagValue] = React.useState<string[] | undefined>(props?.tags?.split(',') || []);
  const [autoCompleteInputValue, setAutoCompleteInputValue] = React.useState('');

  // Authors
  const [authorValue, setAuthorValue] = React.useState<string[] | undefined>(props?.authors?.split(',') || []);
  const [authorAutoCompleteInputValue, setAuthorAutoCompleteInputValue] = React.useState('');

  // Uploaded By
  const [uploadedByValue, setUploadedByValue] = React.useState<string[] | undefined>(
    props?.uploaded_by?.split(',') || [],
  );
  const [uploadedByAutoCompleteInputValue, setUploadedByAutoCompleteInputValue] = React.useState('');

  const [file, setFile] = React.useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Clean up the URL when component unmounts or new file is selected
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      if (!file.type.includes('svg')) {
        alert('Please upload an SVG file');
        return;
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      setFile(file);
    }
  };

  const handleFileDelete = () => {
    // Revoke the object URL to free memory
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    // Clear state
    setPreviewUrl(null);
    setFile(undefined);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsButtonLoading(true);

    try {
      const payload: TypePatternCreatePayload = {
        name,
        description,
        pieces,
        line_width: lineWidth,
        design_width: designWidth,
        design_height: designHeight,
        tags: tagValue?.join(',') || '',
        authors: authorValue?.join(',') || '',
        uploaded_by: uploadedByValue?.join(',') || '',
      };

      if (props?.id) {
        payload.id = props.id;
      }

      if (file && previewUrl) {
        payload.pattern_file = file;
      }

      await savePattern.mutateAsync(payload);
      await refetchPatterns();
      await refetchTags();
      await refetchAuthors();
      await refetchUploadedBy();
      handleClose();
    } catch (error: any) {
      console.warn('Error', error);
      enqueueSnackbar(`Unable to save... Refresh and try again. Error: ${error?.message}`, { variant: 'error' });
    }

    setIsButtonLoading(false);
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this pattern? This action cannot be undone.');

    if (!confirmDelete) {
      return;
    }

    setIsButtonLoading(true);

    try {
      await deletePattern.mutateAsync(props.id!);
      await refetchPatterns();
      handleClose();
    } catch (error: any) {
      console.warn('Error', error);
      enqueueSnackbar(`Unable to delete... Refresh and try again. Error: ${error?.message}`, { variant: 'error' });
    }

    setIsButtonLoading(false);
  };

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isError) {
    return <>Couldn't fetch the tags for some reason. Refresh and try again</>;
  }

  return (
    <>
      {props.mode === 'edit' ? (
        <IconButton onClick={handleOpen} size="small">
          <EditRoundedIcon fontSize="inherit" />
        </IconButton>
      ) : (
        <Button onClick={handleOpen} startIcon={<AddRoundedIcon />}>
          Add Pattern
        </Button>
      )}

      <Dialog
        fullWidth
        open={isOpen}
        onClose={handleClose}
        aria-labelledby="edit-item-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="edit-item-title">Editing {props.name}</DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ py: 2 }}>
            <TextField fullWidth variant="filled" label="Name" value={name} onChange={(e) => setName(e.target.value)} />

            <TextField
              multiline
              fullWidth
              variant="filled"
              minRows={2}
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  variant="filled"
                  label="Pieces"
                  type="number"
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  variant="filled"
                  label="Line Width"
                  type="number"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  variant="filled"
                  label="Design Width"
                  type="number"
                  value={designWidth}
                  onChange={(e) => setDesignWidth(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  variant="filled"
                  label="Design Height"
                  type="number"
                  value={designHeight}
                  onChange={(e) => setDesignHeight(e.target.value)}
                />
              </Grid>
            </Grid>

            <Divider />

            <FancyAutocomplete
              label="Tags"
              data={allTagsData}
              value={tagValue}
              onChange={setTagValue}
              inputValue={autoCompleteInputValue}
              onInputChange={setAutoCompleteInputValue}
            />

            <Typography variant="body2">Total Tags Used: {allTagsData?.length}/500</Typography>

            <FancyAutocomplete
              label="Author"
              data={allAuthorsData}
              value={authorValue}
              onChange={setAuthorValue}
              inputValue={authorAutoCompleteInputValue}
              onInputChange={setAuthorAutoCompleteInputValue}
            />

            <Typography variant="body2">Total Authors Used: {allAuthorsData?.length}/500</Typography>

            <FancyAutocomplete
              label="Uploaded By"
              data={allUploadedByData}
              value={uploadedByValue}
              onChange={setUploadedByValue}
              inputValue={uploadedByAutoCompleteInputValue}
              onInputChange={setUploadedByAutoCompleteInputValue}
            />

            <Typography variant="body2">Total Uploaded By Used: {allUploadedByData?.length}/500</Typography>

            <Divider />

            {file && previewUrl ? (
              <Grid container>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2 }}>
                    <Typography>Old</Typography>

                    {props.pattern_file ? (
                      <img
                        src={`${pocketbaseDomain}/api/files/${props.collectionId}/${props.id}/${props.pattern_file}`}
                        alt={`pattern template for ${props.name}`}
                        style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                      />
                    ) : (
                      <Typography sx={{ border: '1px solid #eee', p: 4 }}>None</Typography>
                    )}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2, position: 'relative' }}>
                    <Box sx={{ position: 'absolute', top: 0, right: 0 }}>
                      <IconButton size="small" onClick={handleFileDelete}>
                        <DeleteRoundedIcon fontSize="inherit" />
                      </IconButton>
                    </Box>

                    <Typography>New</Typography>

                    <img
                      src={previewUrl}
                      alt={`New pattern template for ${props.name}`}
                      style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Box sx={{ p: 2 }}>
                {props.pattern_file ? (
                  <img
                    src={`${pocketbaseDomain}/api/files/${props.collectionId}/${props.id}/${props.pattern_file}`}
                    alt={`pattern template for ${props.name}`}
                    style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                  />
                ) : (
                  <Typography sx={{ border: '1px solid #eee', p: 4 }}>Add an image to see a preview</Typography>
                )}
              </Box>
            )}

            <Button
              component="label"
              role={undefined}
              variant="contained"
              tabIndex={-1}
              startIcon={<CloudUploadRoundedIcon />}
            >
              Upload SVG
              <VisuallyHiddenInput
                type="file"
                ref={fileInputRef}
                accept=".svg,image/svg+xml"
                onChange={handleFileChange}
              />
            </Button>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            color="error"
            variant="contained"
            sx={{ mr: 'auto' }}
            loading={isButtonLoading}
            onClick={handleDelete}
          >
            Delete
          </Button>

          <Button onClick={handleClose} loading={isButtonLoading}>
            Cancel
          </Button>

          <Button onClick={handleSave} loading={isButtonLoading} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

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

function CustomToolbar() {
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const exportMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Toolbar>
      <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
        List of Patterns
      </Typography>

      {/*<Tooltip title="Columns">
        <ColumnsPanelTrigger render={<ToolbarButton />}>
          <ViewColumnIcon fontSize="small" />
        </ColumnsPanelTrigger>
      </Tooltip>*/}

      {/*<Tooltip title="Filters">
        <FilterPanelTrigger
          render={(props, state) => (
            <ToolbarButton {...props} color="default">
              <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                <FilterListIcon fontSize="small" />
              </Badge>
            </ToolbarButton>
          )}
        />
      </Tooltip>*/}

      {/*<Divider orientation="vertical" variant="middle" flexItem sx={{ mx: 0.5 }} />*/}

      {/*<Tooltip title="Export">
        <ToolbarButton
          ref={exportMenuTriggerRef}
          id="export-menu-trigger"
          aria-controls="export-menu"
          aria-haspopup="true"
          aria-expanded={exportMenuOpen ? 'true' : undefined}
          onClick={() => setExportMenuOpen(true)}
        >
          <FileDownloadIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>*/}

      {/*<Button startIcon={<AddRoundedIcon />}>Add Pattern</Button>*/}

      <EditModal mode="add" />

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
