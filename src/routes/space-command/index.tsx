import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { enqueueSnackbar } from 'notistack';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useMutationAuthAdminSignIn, useMutationAuthGetAdmin } from '@/functions/database/authentication';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
  useQueryGetAllPatternsByPagination,
  useMutationEditPattern,
} from '@/functions/database/patterns';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  IconButton,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Typography,
  styled,
  Grid,
} from '@mui/material';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoading } = useRefreshAdminAuth();

  const { authData } = useGlobalAuthData();

  if (isLoading) {
    return <>Loading...</>;
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
  const [patternPageNumber, setPatternPageNumber] = React.useState(1);

  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 600);
  const [readyToSearchTerm, setReadyToSearchTerm] = React.useState('');

  React.useEffect(() => {
    setReadyToSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const [rows, setRows] = React.useState<TypePatternResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);
  const [paginationModel, setPaginationModel] = React.useState({
    page: 1,
    pageSize: 5,
  });
  const [filterModel, setFilterModel] = React.useState({ items: [] });

  const { isLoading, isError, data } = useQueryGetAllPatternsByPagination(readyToSearchTerm, paginationModel.page);

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
      renderCell: (params: GridRenderCellParams<TypePatternResponse>) => (
        <Box sx={{ p: 2 }}>
          <img
            src={`${pocketbaseDomain}/api/files/${params.row.collectionId}/${params.row.id}/${params.row.pattern_file}`}
            alt={`pattern template for ${params.row.name}`}
            style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
          />
        </Box>
      ),
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
      renderCell: (params) => <EditModal searchTerm={''} pageNumber={1} {...params.row} />,
    },
  ];

  return (
    <Container>
      <Box sx={{ height: 'calc(100svh - 150px)', width: '100%' }}>
        <DataGrid
          loading={isLoading}
          rows={data?.items ?? []}
          columns={columns}
          showToolbar
          pageSizeOptions={[5]}
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
            console.log('>>>Filter Change', newFilterModel);
          }}
          //getRowHeight={() => 'auto'}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 5,
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

type TypeEditModalProps = TypePatternResponse & {
  searchTerm: string;
  pageNumber: number;
};

const EditModal = (props: TypeEditModalProps) => {
  const { isPending, isError, data: allTagsData, refetch: refetchTags } = useQueryGetAllTags();

  const savePattern = useMutationEditPattern();

  const { refetch: refetchPatterns } = useQueryGetAllPatternsByPagination(props.searchTerm, props.pageNumber);

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

  const [tagValue, setTagValue] = React.useState<string[] | undefined>(props?.tags?.split(',') || []);
  const [autoCompleteInputValue, setAutoCompleteInputValue] = React.useState('');

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
      handleClose();
    } catch (error: any) {
      console.warn('Error', error);
      enqueueSnackbar(`Unable to save... Refresh and try again. Error: ${error?.message}`, { variant: 'error' });
    }

    setIsButtonLoading(false);
  };

  if (isPending) {
    return <>Loading...</>;
  }

  if (isError) {
    return <>Couldn't fetch the tags for some reason. Refresh and try again</>;
  }

  return (
    <>
      <IconButton onClick={handleOpen} size="small">
        <EditRoundedIcon fontSize="inherit" />
      </IconButton>

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

            <Autocomplete
              multiple
              fullWidth
              id="tags-filled"
              options={allTagsData?.map((option) => option.tag)}
              freeSolo
              value={tagValue}
              onChange={(event: any, newValue: string[]) => {
                setTagValue(newValue);
              }}
              inputValue={autoCompleteInputValue}
              onInputChange={(event, newInputValue) => {
                setAutoCompleteInputValue(newInputValue);
              }}
              renderValue={(value: readonly string[], getItemProps) =>
                value.map((option: string, index: number) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return <Chip variant="outlined" label={option} key={key} {...itemProps} />;
                })
              }
              renderInput={(params) => <TextField {...params} variant="filled" label="Tags" />}
            />

            <Typography variant="body2">Total Tags Used: {allTagsData?.length}/500</Typography>

            {file && previewUrl ? (
              <Grid container>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2 }}>
                    <Typography>Old</Typography>

                    <img
                      src={`${pocketbaseDomain}/api/files/${props.collectionId}/${props.id}/${props.pattern_file}`}
                      alt={`pattern template for ${props.name}`}
                      style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                    />
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
                <img
                  src={`${pocketbaseDomain}/api/files/${props.collectionId}/${props.id}/${props.pattern_file}`}
                  alt={`pattern template for ${props.name}`}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                />
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
          <Button onClick={handleClose}>Cancel</Button>
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
