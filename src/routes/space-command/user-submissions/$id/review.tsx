import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';
import { SvgDropZone } from '@/components/admin/SvgDropZone';
import {
  PatternDetailsForm,
  type PatternDetailsFormHandle,
  type TypePatternDetailsFormValues,
} from '@/components/admin/PatternDetailsForm';
import { useQueryClient } from '@tanstack/react-query';
import {
  useQueryGetUserSubmissionById,
  useMutationRejectUserSubmission,
  useMutationPublishUserSubmission,
  useMutationAdminReuploadSvg,
  type TypeUserSubmittedPatternResponse,
} from '@/functions/database/user-submissions';
import { useMutationEditPattern, type TypePatternLayersMapItem } from '@/functions/database/patterns';
import { ADMIN_TAG_STATS_QUERY_KEY } from '@/functions/database/tags';
import {
  sanitizeSvgFile,
  analyzeSvgThreats,
  extractSvgLayerIds,
  type SvgThreat,
} from '@/functions/utilities/sanitize-svg';
import { generateUserSubmissionFileUrl } from '@/functions/utilities/generate-pb-image';
import dayjs from 'dayjs';

import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
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

  const formRef = React.useRef<PatternDetailsFormHandle>(null);

  const editPattern = useMutationEditPattern();
  const publishSubmission = useMutationPublishUserSubmission();
  const rejectSubmission = useMutationRejectUserSubmission();
  const adminReupload = useMutationAdminReuploadSvg();

  const [isSaving, setIsSaving] = React.useState(false);
  const [isReuploading, setIsReuploading] = React.useState(false);

  // Reset back to the code-review gate whenever a different submission loads.
  // A reupload does NOT reset this: if the admin is already past the gate (either
  // because they approved this submission's SVG, or because it was never svg to
  // begin with), swapping the file shouldn't send them back to step 1 - codeApproved
  // simply stays false until explicitly approved. A raster submission's first-ever
  // SVG upload still lands on the code-review gate naturally, since codeApproved
  // was never set true for it (that step doesn't render until file_type is svg).
  React.useEffect(() => {
    if (!submission) return;
    setCodeApproved(false);
  }, [submission?.id]);

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

  const initialValues: TypePatternDetailsFormValues = {
    name: submission.name,
    description: submission.description ?? '',
    instructions: submission.instructions ?? '',
    sourceUrl: submission.source_url ?? '',
    designDate: submission.design_date ? dayjs(submission.design_date) : null,
    pieces: String(submission.pieces ?? 1),
    designWidth: String(submission.design_width ?? 0),
    designWidthUnit: submission.design_width_unit || 'in',
    designHeight: String(submission.design_height ?? 0),
    designHeightUnit: submission.design_height_unit || 'in',
    lineWidth: String(submission.line_width ?? 0),
    lineWidthUnit: submission.line_width_unit || 'in',
    tags: submission.tags ?? [],
    authors: submission.is_author ? [submission.submitter] : [],
    authorManual: submission.author_manual_name ? [submission.author_manual_name] : [],
    hasLayers: submission.has_layers ?? false,
    layersMap: submission.layers_map ?? [],
    patternKeys: submission.pattern_key_reference_list ?? [],
    isDraft: false,
  };

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
    queryClient.invalidateQueries({ queryKey: ['GetAllUserSubmissionsByPagination'] });
    queryClient.invalidateQueries({ queryKey: ['GetProcessedUserSubmissionsByPagination'] });
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

    const values = formRef.current?.getPayload();
    if (!values) return;

    setIsSaving(true);
    try {
      const fileUrl = generateUserSubmissionFileUrl(submission);
      const blob = await fetch(fileUrl).then((r) => r.blob());
      const patternFile = new File([blob], `${values.name || submission.name}.svg`, { type: 'image/svg+xml' });

      const newPattern = await editPattern.mutateAsync({
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        source_url: values.sourceUrl,
        design_date: values.designDate,
        tags: values.tags,
        authors: values.authors,
        author_manual: values.authorManual,
        pieces: values.pieces,
        design_width: values.designWidth,
        design_height: values.designHeight,
        line_width: values.lineWidth,
        design_width_unit: values.designWidthUnit,
        design_height_unit: values.designHeightUnit,
        line_width_unit: values.lineWidthUnit,
        pattern_file: patternFile,
        pattern_key_reference_list: values.patternKeys,
        has_layers: values.hasLayers,
        layers_map: values.hasLayers ? values.layersMap : [],
        is_draft: false,
      });

      await publishSubmission.mutateAsync({ id: submission.id, resultingPatternId: newPattern.id });

      // So the Space Command Patterns table (and its tag stats) reflect the
      // newly-published pattern immediately instead of showing stale cached data.
      await queryClient.invalidateQueries({ queryKey: ['GetAllPatternsByPaginationAdmin'] });
      await queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['GetAllUserSubmissionsByPagination'] });
      await queryClient.invalidateQueries({ queryKey: ['GetProcessedUserSubmissionsByPagination'] });

      enqueueSnackbar('Pattern published!', { variant: 'success' });
      navigate({ to: '/space-command/user-submissions' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Failed to publish this pattern.', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 1536, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
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
          <>
            <PatternDetailsForm
              key={`${submission.id}:${submission.admin_reupload_file ?? ''}`}
              ref={formRef}
              initialValues={initialValues}
              previewImageUrl={generateUserSubmissionFileUrl(submission)}
              previewLayout="inline"
              variant="filled"
              resetKey={submission.id}
              showDraftToggle={false}
            >
              {/* ── Working file: always-available download + SVG upload/replace ── */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 1.5,
                  backgroundColor: 'action.hover',
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Working file
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {submission.file_type === 'svg'
                      ? 'The SVG currently being reviewed.'
                      : 'The originally submitted image - download it, trace it into an SVG in your design tool, then upload the SVG below.'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  component="a"
                  href={generateUserSubmissionFileUrl(submission)}
                  download
                  startIcon={<DownloadRoundedIcon />}
                  sx={{ flexShrink: 0 }}
                >
                  Download {submission.file_type === 'svg' ? 'SVG' : 'image'}
                </Button>
              </Paper>

              {submission.file_type !== 'svg' && (
                <Alert severity="warning">
                  This was submitted as an image, not an SVG. Trace it into an SVG in your design tool, then upload it
                  below to enable layer mode and continue the review.
                </Alert>
              )}

              <SvgDropZone
                accept=".svg,image/svg+xml"
                acceptLabel={submission.file_type === 'svg' ? 'Replacement SVG' : 'Traced SVG replacement'}
                label={submission.file_type === 'svg' ? 'Upload a replacement SVG' : 'Re-upload the traced SVG'}
                onFile={handleReupload}
                isLoading={isReuploading}
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

              {submission.custom_pattern_key_requested && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  The submitter noted this pattern uses a custom key not listed below.
                </Alert>
              )}
            </PatternDetailsForm>

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
          </>
        )}
      </Paper>
    </Box>
  );
}
