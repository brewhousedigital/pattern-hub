import React from 'react';
import { enqueueSnackbar } from 'notistack';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useGlobalAuthData } from '@/data/auth-data';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useQueryGetAllAuthors } from '@/functions/database/authors';
import { useQueryGetAllUploadedBy } from '@/functions/database/uploaded-by';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader.tsx';
import { FancyAutocomplete } from '@/components/FancyAutocomplete';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
  useQueryGetAllPatternsByPagination,
  useMutationEditPattern,
  useMutationDeletePattern,
} from '@/functions/database/patterns';
import { sanitizeSvgFile } from '@/functions/utilities/sanitize-svg';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';

import {
  Box,
  Button,
  Dialog,
  Divider,
  MenuItem,
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

type TypeModalMode = 'edit' | 'add';

type TypeEditModalProps = TypePatternResponse & {
  mode?: TypeModalMode;
};

export const AdminEditPatternModal = (props: TypeEditModalProps) => {
  const { authData } = useGlobalAuthData();

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
  /*const {
    isPending: isPendingUploadedBy,
    isError: isErrorUploadedBy,
    data: allUploadedByData,
    refetch: refetchUploadedBy,
  } = useQueryGetAllUploadedBy();*/

  const isLoading = isPendingTags || isPendingAuthors;
  const isError = isErrorTags || isErrorAuthors;

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
  const [lineWidthUnit, setLineWidthUnit] = React.useState(String(props?.line_width_unit) || 'in');
  const [designWidth, setDesignWidth] = React.useState(String(props?.design_width) || '0');
  const [designWidthUnit, setDesignWidthUnit] = React.useState(String(props?.design_width_unit) || 'in');
  const [designHeight, setDesignHeight] = React.useState(String(props?.design_height) || '0');
  const [designHeightUnit, setDesignHeightUnit] = React.useState(String(props?.design_height_unit) || 'in');

  // Tags
  const [tagValue, setTagValue] = React.useState<string[] | undefined>(props?.tags?.split(',') || []);
  const [autoCompleteInputValue, setAutoCompleteInputValue] = React.useState('');

  // Authors
  const [authorValue, setAuthorValue] = React.useState<string[] | undefined>(props?.authors?.split(',') || []);
  const [authorAutoCompleteInputValue, setAuthorAutoCompleteInputValue] = React.useState('');

  // Uploaded By
  /*const [uploadedByValue, setUploadedByValue] = React.useState<string[] | undefined>(
    props?.uploaded_by?.split(',') || [],
  );*/
  //const [uploadedByAutoCompleteInputValue, setUploadedByAutoCompleteInputValue] = React.useState('');

  const [file, setFile] = React.useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFormReset = () => {
    setName('');
    setDescription('');
    setPieces('1');
    setLineWidth('0');
    setLineWidthUnit('in');
    setDesignWidth('0');
    setDesignWidthUnit('in');
    setDesignHeight('0');
    setDesignHeightUnit('in');
    setTagValue([]);
    setAutoCompleteInputValue('');
    setAuthorValue([]);
    setAuthorAutoCompleteInputValue('');
    //setUploadedByValue([]);
    //setUploadedByAutoCompleteInputValue('');
    handleFileDelete();
  };

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
      const filteredTags = tagValue?.filter((item) => item !== 'undefined') || [];
      const filteredAuthors = authorValue?.filter((item) => item !== 'undefined') || [];
      //const filteredUploadedBy = uploadedByValue?.filter((item) => item !== 'undefined') || [];

      const payload: TypePatternCreatePayload = {
        name,
        description,
        pieces: pieces && pieces !== 'undefined' ? pieces : '0',
        line_width: lineWidth && lineWidth !== 'undefined' ? lineWidth : '0',
        design_width: designWidth && designWidth !== 'undefined' ? designWidth : '0',
        design_height: designHeight && designHeight !== 'undefined' ? designHeight : '0',
        tags: filteredTags?.join(',')?.toLowerCase() || '',
        authors: filteredAuthors?.join(',')?.toLowerCase() || '',
        //uploaded_by: filteredUploadedBy?.join(',')?.toLowerCase() || '',
        uploaded_by: authData?.name || 'Missing Name',
        line_width_unit: lineWidthUnit && lineWidthUnit !== 'undefined' ? lineWidthUnit : 'in',
        design_width_unit: designWidthUnit && designWidthUnit !== 'undefined' ? designWidthUnit : 'in',
        design_height_unit: designHeightUnit && designHeightUnit !== 'undefined' ? designHeightUnit : 'in',
      };

      if (props?.id) {
        payload.id = props.id;
      }

      if (file && previewUrl) {
        payload.pattern_file = await sanitizeSvgFile(file);
      }

      await savePattern.mutateAsync(payload);
      await refetchPatterns();
      await refetchTags();
      await refetchAuthors();
      //await refetchUploadedBy();
      handleClose();

      // Make sure to clear out the modal on save
      if (props.mode === 'add') {
        handleFormReset();
      }
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
            <TextField
              fullWidth
              variant="filled"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={name?.length > 100 ? `Name is too long: ${name?.length}/100` : `${name?.length}/100`}
              error={name?.length > 100}
            />

            <TextField
              multiline
              fullWidth
              variant="filled"
              minRows={2}
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              helperText={
                description?.length > 1000
                  ? `Description is too long: ${description?.length}/1000`
                  : `${description?.length}/1000`
              }
              error={description?.length > 1000}
            />

            <Typography>
              Description supports{' '}
              <a href="https://www.markdownguide.org/cheat-sheet/" target="_blank">
                Markdown
              </a>
            </Typography>

            <Divider />

            {file && previewUrl ? (
              <Grid container>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2 }}>
                    <Typography>Old</Typography>

                    {props.pattern_file ? (
                      <img
                        src={generatePbImage(props)}
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
                    src={generatePbImage(props)}
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

            <Divider />

            <TextField
              fullWidth
              variant="filled"
              label="Pieces"
              type="number"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
            />

            <Grid container spacing={2}>
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

              <UnitOfMeasurementSelect label="Line Width Unit" value={lineWidthUnit} onChange={setLineWidthUnit} />
            </Grid>

            <Grid container spacing={2}>
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

              <UnitOfMeasurementSelect
                label="Design Width Unit"
                value={designWidthUnit}
                onChange={setDesignWidthUnit}
              />
            </Grid>

            <Grid container spacing={2}>
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

              <UnitOfMeasurementSelect
                label="Design Height Unit"
                value={designHeightUnit}
                onChange={setDesignHeightUnit}
              />
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

            {/*<FancyAutocomplete
              label="Uploaded By"
              data={allUploadedByData}
              value={uploadedByValue}
              onChange={setUploadedByValue}
              inputValue={uploadedByAutoCompleteInputValue}
              onInputChange={setUploadedByAutoCompleteInputValue}
            />*/}

            {/*<Typography variant="body2">Total Uploaded By Used: {allUploadedByData?.length}/500</Typography>*/}

            <Divider />
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

const unitOfMeasurementOptions = ['in', 'cm', 'mm'];

type TypeUnitOfMeasurementSelectProps = {
  value: string;
  onChange: (newValue: string) => void;
  label: string;
};

const UnitOfMeasurementSelect = (props: TypeUnitOfMeasurementSelectProps) => {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <TextField
        fullWidth
        select
        variant="filled"
        label={props.label}
        type="number"
        value={props.value && props.value !== 'undefined' ? props.value : 'in'}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {unitOfMeasurementOptions.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  );
};
