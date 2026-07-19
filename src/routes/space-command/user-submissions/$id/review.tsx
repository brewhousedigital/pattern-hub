import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useQuerySearchLinkedAuthors, useQuerySearchManualAuthors } from '@/functions/database/authors';
import { FancyAutocomplete, FancyAutocompleteAuthors } from '@/components/FancyAutocomplete';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { SvgDropZone } from '@/components/admin/SvgDropZone';
import { useQueryClient } from '@tanstack/react-query';
import {
  useQueryGetUserSubmissionById,
  useMutationRejectUserSubmission,
  useMutationPublishUserSubmission,
  useMutationAdminReuploadSvg,
  type TypeUserSubmittedPatternResponse,
} from '@/functions/database/user-submissions';
import { useMutationEditPattern, type TypePatternLayersMapItem } from '@/functions/database/patterns';
import {
  sanitizeSvgFile,
  analyzeSvgThreats,
  extractSvgLayerIds,
  type SvgThreat,
} from '@/functions/utilities/sanitize-svg';
import { generateUserSubmissionFileUrl } from '@/functions/utilities/generate-pb-image';

import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';

export const Route = createFileRoute('/space-command/user-submissions/$id/review')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Review Submission - Admin', '', match.pathname),
});

// Highlights <use>, xlink:href, and clip-path occurrences in raw SVG source so
// the admin can spot the exact spots analyzeSvgThreats flags before approving.
// The source is untrusted text, never markup - it's HTML-escaped first, then
// only the escaped, plain-text matches are wrapped in <mark>.
function highlightSvgSource(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/(&lt;use\b[^&]*?(?:&gt;|(?=&lt;))|xlink:href="[^"]*"|clip-path="[^"]*")/g, '<mark>$1</mark>');
}

function RouteComponent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: submission, isLoading } = useQueryGetUserSubmissionById(id);

  const [codeApproved, setCodeApproved] = React.useState(false);
  const [rawSvgText, setRawSvgText] = React.useState('');
  const [svgThreats, setSvgThreats] = React.useState<SvgThreat[]>([]);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [pieces, setPieces] = React.useState('1');
  const [designWidth, setDesignWidth] = React.useState('0');
  const [designHeight, setDesignHeight] = React.useState('0');
  const [lineWidth, setLineWidth] = React.useState('0');
  const [tagValue, setTagValue] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [authorValue, setAuthorValue] = React.useState<string[]>([]);
  const [authorInput, setAuthorInput] = React.useState('');
  const [manualAuthorValue, setManualAuthorValue] = React.useState<string[]>([]);
  const [manualAuthorInput, setManualAuthorInput] = React.useState('');
  const [layersMap, setLayersMap] = React.useState<TypePatternLayersMapItem[]>([]);

  const debouncedAuthorSearch = useDebounce(authorInput, 300);
  const { data: authorData, isFetching: authorFetching } = useQuerySearchLinkedAuthors(debouncedAuthorSearch);
  const debouncedManualAuthorSearch = useDebounce(manualAuthorInput, 300);
  const { data: manualAuthorData, isFetching: manualAuthorFetching } =
    useQuerySearchManualAuthors(debouncedManualAuthorSearch);

  const editPattern = useMutationEditPattern();
  const publishSubmission = useMutationPublishUserSubmission();
  const rejectSubmission = useMutationRejectUserSubmission();
  const adminReupload = useMutationAdminReuploadSvg();

  const [isSaving, setIsSaving] = React.useState(false);
  const [isReuploading, setIsReuploading] = React.useState(false);

  // Prefill from the submission once it loads
  React.useEffect(() => {
    if (!submission) return;
    setName(submission.name);
    setDescription(submission.description ?? '');
    setInstructions(submission.instructions ?? '');
    setSourceUrl(submission.source_url ?? '');
    setPieces(String(submission.pieces ?? 1));
    setDesignWidth(String(submission.design_width ?? 0));
    setDesignHeight(String(submission.design_height ?? 0));
    setLineWidth(String(submission.line_width ?? 0));
    setTagValue(submission.tags ?? []);
    setManualAuthorValue(submission.author_manual_name ? [submission.author_manual_name] : []);
    setAuthorValue(submission.is_author ? [submission.submitter] : []);
    setLayersMap(submission.layers_map ?? []);
    setCodeApproved(false);
  }, [submission?.id, submission?.file_type, submission?.admin_reupload_file]);

  // For SVG submissions, fetch the (already-sanitized) source so it can be shown
  // for review, and re-run the client-side threat scan for display purposes.
  // The server already sanitized it at submit time - this is a second look, not
  // the enforcement point.
  React.useEffect(() => {
    if (!submission || submission.file_type !== 'svg') {
      setRawSvgText('');
      setSvgThreats([]);
      return;
    }
    fetch(generateUserSubmissionFileUrl(submission))
      .then((res) => res.text())
      .then((text) => {
        setRawSvgText(text);
        setSvgThreats(analyzeSvgThreats(text));
      })
      .catch(() => enqueueSnackbar('Failed to load the SVG source for review.', { variant: 'error' }));
  }, [submission?.id, submission?.admin_reupload_file]);

  if (isLoading || !submission) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeStep = submission.file_type === 'svg' && !codeApproved ? 0 : 1;

  const handleReupload = async (file: File) => {
    setIsReuploading(true);
    try {
      const clean = await sanitizeSvgFile(file);
      const raw = await clean.text();
      const newLayerIds = extractSvgLayerIds(raw);
      const newLayersMap: TypePatternLayersMapItem[] = newLayerIds.map((layerName) => ({
        layerName,
        mappedName: '',
        isVisible: true,
      }));
      await adminReupload.mutateAsync({ id: submission.id, file: clean, layersMap: newLayersMap });
      queryClient.invalidateQueries({ queryKey: ['GetUserSubmissionById', submission.id] });
      enqueueSnackbar('Re-uploaded SVG saved. Review its code before continuing.', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Failed to process the re-uploaded SVG.', { variant: 'error' });
    } finally {
      setIsReuploading(false);
    }
  };

  const handleReject = async () => {
    await rejectSubmission.mutateAsync(submission.id);
    enqueueSnackbar('Submission rejected.', { variant: 'info' });
    navigate({ to: '/space-command/user-submissions' });
  };

  const handlePublish = async () => {
    if (submission.file_type !== 'svg') {
      enqueueSnackbar('This submission still needs to be traced into an SVG and re-uploaded before publishing.', {
        variant: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const fileUrl = generateUserSubmissionFileUrl(submission);
      const blob = await fetch(fileUrl).then((r) => r.blob());
      const patternFile = new File([blob], `${name || submission.name}.svg`, { type: 'image/svg+xml' });

      const newPattern = await editPattern.mutateAsync({
        name,
        description,
        instructions,
        source_url: sourceUrl,
        tags: tagValue,
        authors: authorValue,
        author_manual: manualAuthorValue,
        pieces,
        design_width: designWidth,
        design_height: designHeight,
        line_width: lineWidth,
        design_width_unit: submission.design_width_unit,
        design_height_unit: submission.design_height_unit,
        line_width_unit: submission.line_width_unit,
        pattern_file: patternFile,
        pattern_key_reference_list: submission.pattern_key_reference_list,
        has_layers: layersMap.length > 0,
        layers_map: layersMap,
        is_draft: false,
      });

      await publishSubmission.mutateAsync({ id: submission.id, resultingPatternId: newPattern.id });
      enqueueSnackbar('Pattern published!', { variant: 'success' });
      navigate({ to: '/space-command/user-submissions' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Failed to publish this pattern.', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Review Submission: {submission.name}
      </Typography>

      {submission.file_type === 'svg' && (
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>Review SVG Code</StepLabel>
          </Step>
          <Step>
            <StepLabel>Pattern Details</StepLabel>
          </Step>
        </Stepper>
      )}

      {submission.file_type === 'svg' && !codeApproved && (
        <Stack sx={{ gap: 2 }}>
          <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
            SVGs can contain malicious code. Review every highlighted section below - especially{' '}
            <code>&lt;use&gt;</code>, <code>xlink:href</code>, and <code>clip-path</code> - before approving.
          </Alert>

          {svgThreats.length > 0 && (
            <Stack sx={{ gap: 1 }}>
              {svgThreats.map((t) => (
                <Alert key={t.id} severity={t.severity === 'high' ? 'error' : 'warning'}>
                  <strong>{t.title}:</strong> {t.detail}
                </Alert>
              ))}
            </Stack>
          )}

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              maxHeight: 400,
              overflow: 'auto',
              backgroundColor: 'grey.900',
              '& mark': { backgroundColor: 'warning.main', color: 'black' },
            }}
          >
            <Box
              component="pre"
              sx={{ color: 'grey.100', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0 }}
              dangerouslySetInnerHTML={{ __html: highlightSvgSource(rawSvgText) }}
            />
          </Paper>

          <Button
            variant="contained"
            color="warning"
            startIcon={<CheckRoundedIcon />}
            onClick={() => setCodeApproved(true)}
            disabled={!rawSvgText}
          >
            I've reviewed this code and approve it
          </Button>
        </Stack>
      )}

      {(submission.file_type !== 'svg' || codeApproved) && (
        <Stack sx={{ gap: 2.5 }}>
          {submission.file_type !== 'svg' && (
            <Alert severity="warning">
              This was submitted as an image, not an SVG. Download it, trace it into an SVG in your design tool, then
              re-upload it below to enable layer mode and continue the review.
              <Box sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  component="a"
                  href={generateUserSubmissionFileUrl(submission)}
                  download
                >
                  Download image
                </Button>
              </Box>
            </Alert>
          )}

          {submission.file_type !== 'svg' && (
            <SvgDropZone
              accept=".svg,image/svg+xml"
              acceptLabel="Traced SVG replacement"
              label="Re-upload the traced SVG"
              onFile={handleReupload}
              isLoading={isReuploading}
            />
          )}

          {submission.file_type === 'svg' && (
            <Box
              component="img"
              src={generateUserSubmissionFileUrl(submission)}
              alt={submission.name}
              sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', backgroundColor: 'grey.50', borderRadius: 1 }}
            />
          )}

          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          <GenericMarkdownEditor content={description} setContent={setDescription} characterLimit={2000} minRows={2} />
          <GenericMarkdownEditor
            content={instructions}
            setContent={setInstructions}
            characterLimit={10000}
            minRows={2}
          />

          {!submission.is_author && (submission.source_url || submission.source_notes) && (
            <Alert severity="info">
              <strong>Submitter's provenance notes</strong>
              {submission.source_notes && (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {submission.source_notes}
                </Typography>
              )}
            </Alert>
          )}

          <TextField label="Source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} fullWidth />

          <Stack direction="row" sx={{ gap: 2 }}>
            <TextField label="Pieces" type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} />
            <TextField
              label={`Width (${submission.design_width_unit})`}
              type="number"
              value={designWidth}
              onChange={(e) => setDesignWidth(e.target.value)}
            />
            <TextField
              label={`Height (${submission.design_height_unit})`}
              type="number"
              value={designHeight}
              onChange={(e) => setDesignHeight(e.target.value)}
            />
            <TextField
              label={`Line width (${submission.line_width_unit})`}
              type="number"
              value={lineWidth}
              onChange={(e) => setLineWidth(e.target.value)}
            />
          </Stack>

          <FancyAutocomplete
            label="Tags"
            freeSolo
            data={[]}
            value={tagValue}
            onChange={setTagValue}
            inputValue={tagInput}
            onInputChange={setTagInput}
          />

          <FancyAutocompleteAuthors
            label="Author"
            serverSide
            freeSolo
            loading={authorFetching}
            data={authorData ?? []}
            value={authorValue}
            onChange={setAuthorValue}
            inputValue={authorInput}
            onInputChange={setAuthorInput}
          />

          <FancyAutocomplete
            label="Manual Author"
            serverSide
            freeSolo
            loading={manualAuthorFetching}
            data={manualAuthorData ?? []}
            value={manualAuthorValue}
            onChange={setManualAuthorValue}
            inputValue={manualAuthorInput}
            onInputChange={setManualAuthorInput}
          />

          {layersMap.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Layers
              </Typography>
              {layersMap.map((layer, index) => (
                <Stack key={layer.layerName} direction="row" sx={{ gap: 2, alignItems: 'center' }}>
                  <Chip size="small" label={layer.layerName} sx={{ minWidth: 120 }} />
                  <TextField
                    size="small"
                    label="Mapped name"
                    value={layer.mappedName}
                    onChange={(e) => {
                      const next = [...layersMap];
                      next[index] = { ...layer, mappedName: e.target.value };
                      setLayersMap(next);
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={layer.isVisible}
                        onChange={(e) => {
                          const next = [...layersMap];
                          next[index] = { ...layer, isVisible: e.target.checked };
                          setLayersMap(next);
                        }}
                      />
                    }
                    label="Visible"
                  />
                </Stack>
              ))}
            </>
          )}

          {submission.pattern_key_reference_list?.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Pattern Keys
              </Typography>
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                {submission.pattern_key_reference_list.map((k) => (
                  <Chip key={k.name} size="small" label={k.name} />
                ))}
                {submission.custom_pattern_key_requested && (
                  <Chip size="small" color="warning" label="Custom key requested" />
                )}
              </Stack>
            </>
          )}

          <Stack direction="row" sx={{ gap: 1.5, justifyContent: 'flex-end', mt: 2 }}>
            <Button color="error" variant="outlined" onClick={handleReject} disabled={isSaving}>
              Reject
            </Button>
            <Button
              variant="contained"
              onClick={handlePublish}
              disabled={isSaving || submission.file_type !== 'svg'}
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Save and Publish
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
