import React from 'react';
import { enqueueSnackbar } from 'notistack';
import { generatePbImage, generatePbImageExternalFile } from '@/functions/utilities/generate-pb-image';
import { useGlobalAuthData } from '@/data/auth-data';
import { useQueryAdminTagStats, useQueryGetAllTags } from '@/functions/database/tags';
import { useQueryGetAllManualAuthors } from '@/functions/database/authors';
import { useQueryGetAllUploadedBy } from '@/functions/database/uploaded-by';
import { useQueryUsersByPagination } from '@/functions/database/users';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader.tsx';
import { FancyAutocomplete, FancyAutocompleteAuthors } from '@/components/FancyAutocomplete';
import { generateOpengraphImage } from '@/functions/utilities/generate-opengraph-image';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
  useQueryGetAllPatternsByPaginationAdmin,
  useMutationEditPattern,
  useMutationDeletePattern,
} from '@/functions/database/patterns';
import { sanitizeSvgFile } from '@/functions/utilities/sanitize-svg';
import { pocketbase } from '@/functions/database/authentication-setup.ts';

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
  Tab,
  Tabs,
} from '@mui/material';

import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

type TypeModalMode = 'edit' | 'add';

type TypeEditModalProps = TypePatternResponse & {
  mode?: TypeModalMode;
};

export const AdminEditPatternModal = (props: TypeEditModalProps) => {
  const { authData } = useGlobalAuthData();

  const [tabValue, setTabValue] = React.useState('1');

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.PATTERN_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.PATTERN_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.PATTERN_AD);

  const {
    isPending: isPendingTags,
    isError: isErrorTags,
    data: allTagsData,
    refetch: refetchTags,
  } = useQueryGetAllTags();
  const {
    isPending: isPendingManualAuthors,
    isError: isErrorManualAuthors,
    data: allManualAuthorsData,
    refetch: refetchManualAuthors,
  } = useQueryGetAllManualAuthors();
  /*const {
    isPending: isPendingUploadedBy,
    isError: isErrorUploadedBy,
    data: allUploadedByData,
    refetch: refetchUploadedBy,
  } = useQueryGetAllUploadedBy();*/

  const { refetch: refetchTagManagementStats } = useQueryAdminTagStats();

  const { searchResult } = useGlobalAdminFilter();
  const { paginationModel } = useGlobalAdminPagination();

  const savePattern = useMutationEditPattern();
  const deletePattern = useMutationDeletePattern();

  const { refetch: refetchPatterns } = useQueryGetAllPatternsByPaginationAdmin(searchResult, paginationModel.page);

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
  const [tagValue, setTagValue] = React.useState<string[] | undefined>(props?.tags || []);
  const [autoCompleteInputValue, setAutoCompleteInputValue] = React.useState('');

  // Authors
  const [authorValue, setAuthorValue] = React.useState<string[] | undefined>(props?.authors || []);
  const [authorAutoCompleteInputValue, setAuthorAutoCompleteInputValue] = React.useState('');

  // Debounce the author search for the API
  const debouncedAuthorSearch = useDebounce(authorAutoCompleteInputValue, 750);

  // Manual Authors
  const [manualAuthorValue, setManualAuthorValue] = React.useState<string[] | undefined>(props?.author_manual || []);
  const [manualAuthorAutoCompleteInputValue, setManualAuthorAutoCompleteInputValue] = React.useState('');

  // Query the authors table with the debounced value
  const {
    isPending: isPendingAuthorData,
    isError: isErrorAuthorData,
    data: authorData,
  } = useQueryUsersByPagination(1, debouncedAuthorSearch);

  // Uploaded By
  /*const [uploadedByValue, setUploadedByValue] = React.useState<string[] | undefined>(
    props?.uploaded_by?.split(',') || [],
  );*/
  //const [uploadedByAutoCompleteInputValue, setUploadedByAutoCompleteInputValue] = React.useState('');

  const isLoading = isPendingTags || isPendingManualAuthors || isPendingAuthorData;
  const isError = isErrorTags || isErrorManualAuthors || isErrorAuthorData;

  // SVG Upload
  const [file, setFile] = React.useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // External file upload
  const [externalFile, setExternalFile] = React.useState<File | undefined>();
  const [previewExternalUrl, setPreviewExternalUrl] = React.useState<string | null>(null);
  const externalFileInputRef = React.useRef<HTMLInputElement>(null);
  const [externalFileLink, setExternalFileLink] = React.useState(props?.pattern_file_external_link || '');

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
    setManualAuthorValue([]);
    setManualAuthorAutoCompleteInputValue('');
    //setUploadedByValue([]);
    //setUploadedByAutoCompleteInputValue('');
    handleFileDelete();
    handleExternalFileDelete();
    setExternalFileLink('');
  };

  // Clean up the URL when component unmounts or new file is selected
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, isOpen]);

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

  const handleExternalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      if (!file.type.includes('webp')) {
        alert('Please upload an SVG file');
        return;
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewExternalUrl(url);

      setExternalFile(file);
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

  const handleExternalFileDelete = () => {
    // Revoke the object URL to free memory
    if (previewExternalUrl) {
      URL.revokeObjectURL(previewExternalUrl);
    }

    // Clear state
    setPreviewExternalUrl(null);
    setExternalFile(undefined);

    // Reset the file input
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsButtonLoading(true);

    try {
      const filteredTags = tagValue?.filter((item) => item !== 'undefined')?.map((item) => item?.toLowerCase()) || [];

      const filteredAuthors = authorValue || [];

      const filteredManualAuthors =
        manualAuthorValue?.filter((item) => item !== 'undefined')?.map((item) => item?.toLowerCase()) || [];

      //const filteredUploadedBy = uploadedByValue?.filter((item) => item !== 'undefined') || [];

      const payload: TypePatternCreatePayload = {
        name,
        description,
        pieces: pieces && pieces !== 'undefined' ? pieces : '0',
        line_width: lineWidth && lineWidth !== 'undefined' ? lineWidth : '0',
        design_width: designWidth && designWidth !== 'undefined' ? designWidth : '0',
        design_height: designHeight && designHeight !== 'undefined' ? designHeight : '0',
        tags: filteredTags?.sort() || [],
        authors: filteredAuthors || [],
        author_manual: filteredManualAuthors || [],
        line_width_unit: lineWidthUnit && lineWidthUnit !== 'undefined' ? lineWidthUnit : 'in',
        design_width_unit: designWidthUnit && designWidthUnit !== 'undefined' ? designWidthUnit : 'in',
        design_height_unit: designHeightUnit && designHeightUnit !== 'undefined' ? designHeightUnit : 'in',
      };

      // If a pattern has already been uploaded, don't reset the `uploaded_by` property
      if (!props?.uploaded_by) {
        payload.uploaded_by = authData?.name || 'Missing Name';
      }

      // This will determine if it's a POST or a PUT
      if (props?.id) {
        payload.id = props.id;
      }

      // Will attach a file if a new one exists
      if (file && previewUrl) {
        payload.pattern_file = await sanitizeSvgFile(file);
      }

      // Will attach a file if a new one exists
      if (externalFile && previewExternalUrl) {
        payload.pattern_file_external = externalFile;
      }

      // Updates the link if it was changed
      if (externalFileLink) {
        payload.pattern_file_external_link = externalFileLink;
      }

      const savedPattern = await savePattern.mutateAsync(payload);

      // Generate the opengraph image and save it back to pocketbase
      if (file && previewUrl) {
        try {
          const svgUrl = generatePbImage(savedPattern);
          const ogImage = await generateOpengraphImage({ type: 'svg', url: svgUrl }, name);

          await pocketbase.collection('patterns').update(savedPattern.id, {
            opengraph_image: ogImage,
          });
        } catch (err) {
          // Non-fatal — pattern is saved, OG image just won't exist yet
          console.warn('OG image generation failed', err);
        }
      }

      if (externalFile && previewExternalUrl) {
        try {
          const fileUrl = generatePbImageExternalFile(savedPattern);
          const ogImage = await generateOpengraphImage({ type: 'webp', url: fileUrl }, name);
          console.log('>>>ogImage', ogImage);

          await pocketbase.collection('patterns').update(savedPattern.id, {
            opengraph_image: ogImage,
          });
        } catch (err) {
          // Non-fatal: pattern is saved, OG image just won't exist yet
          console.warn('OG image generation failed', err);
        }
      }

      await refetchPatterns();
      await refetchTags();
      await refetchManualAuthors();
      //await refetchUploadedBy();
      await refetchTagManagementStats();
      handleClose();

      // Make sure to clear out the modal on save
      if (props.mode === 'add') {
        handleFormReset();
      } else {
        handleFileDelete();
        handleExternalFileDelete();
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
        <Button disabled={!canAdd} onClick={handleOpen} startIcon={<AddRoundedIcon />}>
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

            <Box sx={{ width: '100%', typography: 'body1' }}>
              <TabContext value={tabValue}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <TabList onChange={handleTabChange} aria-label="Pattern upload type">
                    <Tab label="Upload SVG" value="1" />
                    <Tab label="External Pattern" value="2" />
                  </TabList>
                </Box>

                <TabPanel value="1">
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
                    fullWidth
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
                </TabPanel>

                <TabPanel value="2">
                  {externalFile && previewExternalUrl ? (
                    <Grid container>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Box sx={{ p: 2 }}>
                          <Typography>Old</Typography>

                          {props.pattern_file_external ? (
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
                            <IconButton size="small" onClick={handleExternalFileDelete}>
                              <DeleteRoundedIcon fontSize="inherit" />
                            </IconButton>
                          </Box>

                          <Typography>New</Typography>

                          <img
                            src={previewExternalUrl}
                            alt={`New external pattern template for ${props.name}`}
                            style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  ) : (
                    <Box sx={{ p: 2 }}>
                      {props.pattern_file_external ? (
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

                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="External Pattern Link"
                      variant="filled"
                      fullWidth
                      value={externalFileLink}
                      onChange={(e) => setExternalFileLink(e.target.value)}
                    />
                  </Box>

                  <Button
                    fullWidth
                    component="label"
                    role={undefined}
                    variant="contained"
                    tabIndex={-1}
                    startIcon={<CloudUploadRoundedIcon />}
                  >
                    Upload WebP Image
                    <VisuallyHiddenInput
                      type="file"
                      ref={externalFileInputRef}
                      accept=".webp,image/webp"
                      onChange={handleExternalFileChange}
                    />
                  </Button>
                </TabPanel>
              </TabContext>
            </Box>

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
              freeSolo
              data={allTagsData}
              value={tagValue}
              onChange={setTagValue}
              inputValue={autoCompleteInputValue}
              onInputChange={setAutoCompleteInputValue}
            />

            <Typography variant="body2">Total Tags Used: {allTagsData?.length}/500</Typography>

            <FancyAutocompleteAuthors
              label="Author"
              data={authorData?.items || []}
              value={authorValue}
              onChange={setAuthorValue}
              inputValue={authorAutoCompleteInputValue}
              onInputChange={setAuthorAutoCompleteInputValue}
            />

            <FancyAutocomplete
              label="Manual Author"
              data={allManualAuthorsData}
              value={manualAuthorValue}
              freeSolo
              onChange={setManualAuthorValue}
              inputValue={manualAuthorAutoCompleteInputValue}
              onInputChange={setManualAuthorAutoCompleteInputValue}
            />

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
            disabled={!canDelete}
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

          <Button disabled={!canEdit} onClick={handleSave} loading={isButtonLoading} variant="contained">
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
