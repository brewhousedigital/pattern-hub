import React, { Suspense } from 'react';
import { Link } from '@tanstack/react-router';
import { ExportPatternForPrintV3 } from '@/components/PatternExport/ExportPatternForPrintV3';
import { ExportPatternForSVG } from '@/components/PatternExport/ExportPatternForSVG';
import { ExportPatternForImage } from '@/components/PatternExport/ExportPatternForImage';
import { createPrettyDate } from '@/functions/utilities/dates';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternDrawerTopNavigation } from '@/components/PatternUtilities/PatternDrawerTopNavigation';
import { PatternReportIssue } from '@/components/PatternUtilities/PatternReportIssue';
import { PatternSaveContainer } from '@/components/PatternUtilities/PatternSaveContainer';
import { PatternRatings } from '@/components/PatternUtilities/PatternRatings';
import { ViewDrawerPatternSidebar } from '@/components/layout/Sidebar';
import { type TypePatternResponse } from '@/functions/database/patterns.ts';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useGlobalIsViewOpen } from '@/data/view';
import { copyToClipboard } from '@/functions/utilities/copy-to-clipboard';
import type { TypeViewData } from '@/functions/types/types';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { CollapsibleCard } from '@/components/cards/CollapsibleCard';
import { PatternViewer3DLazy } from '@/components/PatternViewer3D';
import { formatByteSize } from '@/functions/utilities/math';

import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { Box, Typography, Container, Button, Tooltip, Grid, Skeleton, Stack, Tab, Tabs } from '@mui/material';

type ViewDrawerProps = {
  viewData: TypePatternResponse | undefined;
  handleClose?: () => void;
};

export const ViewDrawer = (props: ViewDrawerProps) => {
  const viewData = props.viewData;

  const { handleOpenView, handleCloseView } = useGlobalIsViewOpen();

  const { patternId, exportTab, setExportTab } = usePatternSearch();

  const svgImageUrl = generatePbImage(viewData);

  const handleCopyId = async () => {
    await copyToClipboard(viewData?.id || '');
  };

  React.useEffect(() => {
    if (patternId) {
      handleOpenView();
    } else {
      handleCloseView();
    }
  }, [patternId]);

  return (
    <Box sx={{ backgroundColor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
        <PatternDrawerTopNavigation handleClose={props.handleClose} />

        <Grid container spacing={2}>
          <Grid
            size={{ xs: 12, lg: 'auto' }}
            order={{ xs: 3, lg: 1 }}
            sx={{
              width: { lg: 250 },
              flexShrink: 0,
            }}
          >
            <ViewDrawerPatternSidebar tagList={viewData?.tags || []} handleClose={props.handleClose} />
          </Grid>

          <Grid
            size={{ xs: 12, lg: 'grow' }}
            order={{ xs: 1, lg: 2 }}
            sx={{
              minWidth: 0, // allows shrinking below content width
            }}
          >
            <BorderedCard>
              {viewData?.pattern_file_external ? (
                <img
                  loading="lazy"
                  src={svgImageUrl}
                  alt={`pattern template for ${viewData?.name}`}
                  style={{ width: '100%', height: 'auto', borderRadius: 16, display: 'block' }}
                />
              ) : (
                <>
                  <img
                    loading="lazy"
                    src={svgImageUrl}
                    alt={`pattern template for ${viewData?.name}`}
                    style={{ width: '100%', height: 'auto', aspectRatio: '1/1', display: 'block' }}
                  />

                  <PatternLegendCard viewData={viewData} />
                </>
              )}
            </BorderedCard>

            {!viewData?.pattern_file_external && (
              <PatternInstructions viewData={viewData} key={'instructions' + viewData?.id} />
            )}

            {!viewData?.pattern_file_external && (
              <BorderedCard>
                <Tabs
                  value={exportTab}
                  onChange={(_, v) => setExportTab(v)}
                  sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab label="Print Pattern" value="print" />
                  <Tab label="Export SVG" value="svg" />
                  <Tab label="Export Image" value="image" />
                </Tabs>

                {exportTab === 'print' && <ExportPatternForPrintV3 viewData={viewData} />}
                {exportTab === 'svg' && <ExportPatternForSVG viewData={viewData} />}
                {exportTab === 'image' && <ExportPatternForImage viewData={viewData} />}
              </BorderedCard>
            )}

            {!viewData?.pattern_file_external && (
              <CollapsibleCard title="Color Planner" key={'3d-' + viewData?.id}>
                <Suspense fallback={<Skeleton variant="rounded" height={500} sx={{ borderRadius: 2 }} />}>
                  <PatternViewer3DLazy viewData={viewData} />
                </Suspense>
              </CollapsibleCard>
            )}
          </Grid>

          <Grid
            size={{ xs: 12, lg: 'auto' }}
            order={{ xs: 2, lg: 3 }}
            sx={{
              width: { lg: 300 },
              flexShrink: 0,
            }}
          >
            <Box>
              {/* ── Name & ID ─────────────────────────────────────── */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="h3"
                  sx={{
                    wordBreak: 'break-word',
                    fontSize: { xs: '1.5rem', sm: '2.4rem' },
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: 'text.primary',
                    mb: 0.5,
                  }}
                >
                  {viewData?.name}
                </Typography>

                <Tooltip title="Copy ID" arrow>
                  <Typography
                    onClick={handleCopyId}
                    variant="caption"
                    sx={{ color: 'text.disabled', letterSpacing: '0.08em', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    {viewData?.id}
                  </Typography>
                </Tooltip>
              </Box>

              <Box sx={{ mb: 3 }}>
                <PatternSaveContainer viewData={viewData} />
              </Box>

              {viewData?.pattern_file_external && (
                <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    endIcon={<LaunchRoundedIcon />}
                    component="a"
                    href={viewData?.pattern_file_external_link}
                    target="_blank"
                  >
                    View This Pattern
                  </Button>
                </Box>
              )}

              {viewData?.description && (
                <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
                  <MarkdownWrapper>{viewData.description}</MarkdownWrapper>
                </Box>
              )}

              <PatternRatings viewData={viewData} />

              {/* ── Details ───────────────────────────────────────── */}
              <PanelSectionTitle>Details</PanelSectionTitle>

              <CompactRow label="Width">
                {viewData?.design_width != null ? `${viewData.design_width}${viewData.design_width_unit ?? ''}` : '—'}
              </CompactRow>

              <CompactRow label="Height">
                {viewData?.design_height != null
                  ? `${viewData.design_height}${viewData.design_height_unit ?? ''}`
                  : '—'}
              </CompactRow>

              <CompactRow label="Line Width">
                {viewData?.line_width != null ? `${viewData.line_width}${viewData.line_width_unit ?? ''}` : '—'}
              </CompactRow>

              <CompactRow label="Pieces">{viewData?.pieces?.toLocaleString() ?? '—'}</CompactRow>

              {/* ── Attribution ───────────────────────────────────── */}
              <PanelSectionTitle>Attribution</PanelSectionTitle>

              <CompactRow label="Designed by">
                <Stack direction="row" divider={<>·</>} sx={{ flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
                  {viewData?.expand?.authors?.map((author, index) => {
                    return (
                      <Link key={`designed-by-${index}`} to="/profile" search={{ id: author.id }}>
                        <Typography sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 500 }}>
                          {author.name || 'Not Listed'}
                        </Typography>
                      </Link>
                    );
                  })}

                  {viewData?.author_manual?.map((author, i) => (
                    <Typography key={`manual-${i}`} sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 500 }}>
                      {author || 'Not Listed'}
                    </Typography>
                  ))}
                </Stack>
              </CompactRow>

              <CompactRow label="Design Date">{createPrettyDate(viewData?.design_date || '') || '—'}</CompactRow>
              <CompactRow label="Uploaded by">{viewData?.uploaded_by || 'Not Listed'}</CompactRow>
              <CompactRow label="Added on">{createPrettyDate(viewData?.created || '') || '—'}</CompactRow>
              <CompactRow label="Last updated">{createPrettyDate(viewData?.updated || '') || '—'}</CompactRow>

              {viewData?.pattern_file_size ? (
                <CompactRow label="File size">{formatByteSize(viewData?.pattern_file_size)}</CompactRow>
              ) : (
                <></>
              )}

              <Box sx={{ px: 1, pt: 2, pb: 1 }}>
                <PatternReportIssue viewData={viewData} key={patternId} />
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

// ─── Right-panel compact layout helpers ──────────────────────────────────────

/** Overline section heading matching the left sidebar category style. */
const PanelSectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="overline"
    sx={{
      display: 'block',
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: 'text.disabled',
      px: 1,
      pt: 2,
      pb: 0.5,
    }}
  >
    {children}
  </Typography>
);

/** Inline label / value row matching the left sidebar item density. */
const CompactRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 1,
      px: 1,
      py: 0.4,
      borderRadius: 1,
      '&:hover': { backgroundColor: 'action.hover' },
    }}
  >
    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500, flexShrink: 0 }}>
      {label}
    </Typography>
    <Box sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 500, textAlign: 'right' }}>{children}</Box>
  </Box>
);

const PatternLegendCard = ({ viewData }: TypeViewData) => {
  if (!viewData) return null;

  const authorLine = [...(viewData.expand?.authors?.map((a) => a.name) ?? []), ...(viewData.author_manual ?? [])]
    .filter(Boolean)
    .join(', ');

  const sizeLabel = `${viewData.design_width}${viewData.design_width_unit} × ${viewData.design_height}${viewData.design_height_unit}`;
  const lineWidthLabel = `${viewData.line_width}${viewData.line_width_unit}`;
  const dateLabel = createPrettyDate(viewData.design_date || '');

  const stats: [string, string][] = [
    ['Project Size', sizeLabel],
    ['Pieces', (viewData.pieces ?? 0).toLocaleString()],
    ['Line Width', lineWidthLabel],
    ['Design Date', dateLabel],
  ];

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3, mb: 0.25 }}>
        {viewData.name}
      </Typography>

      {authorLine && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          {authorLine}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {stats.map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontSize: '0.72rem' }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.72rem' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {viewData.pattern_key_reference_list && viewData.pattern_key_reference_list.length > 0 && (
        <>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1.25, mb: 1.25 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {viewData.pattern_key_reference_list.map((key, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {key.fullPath && (
                  <img
                    loading="lazy"
                    src={key.fullPath}
                    alt={key.name}
                    style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                  />
                )}
                <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.72rem' }}>
                  {key.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

const PatternInstructions = (props: TypeViewData) => {
  if (!props.viewData?.instructions) return <></>;

  return (
    <CollapsibleCard title="Pattern Instructions">
      <MarkdownWrapper>{props.viewData?.instructions}</MarkdownWrapper>
    </CollapsibleCard>
  );
};
