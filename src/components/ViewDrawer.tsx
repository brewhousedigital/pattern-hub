import React, { useState, Suspense } from 'react';
import { Link } from '@tanstack/react-router';
import { MetaRow, ThinDivider, SectionLabel, DecorativeTitle } from '@/components/ViewHelpers';
import { ExportPatternForPrintV3 } from '@/components/PatternExport/ExportPatternForPrintV3';
import { ExportPatternForSVG } from '@/components/PatternExport/ExportPatternForSVG';
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
import { PatternViewer3DLazy } from '@/components/PatternViewer3D';

import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { Box, Typography, Stack, Container, Button, Tooltip, Chip, Skeleton } from '@mui/material';

type ViewDrawerProps = {
  viewData: TypePatternResponse | undefined;
  handleClose?: () => void;
};

export const ViewDrawer = (props: ViewDrawerProps) => {
  const viewData = props.viewData;

  const { handleOpenView, handleCloseView } = useGlobalIsViewOpen();

  const { patternId } = usePatternSearch();

  const [viewer3DOpen, setViewer3DOpen] = useState(false);

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
      <Container maxWidth={false} sx={{ py: 3, position: 'relative', zIndex: 1 }}>
        <PatternDrawerTopNavigation handleClose={props.handleClose} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '250px 1fr 500px', xl: '250px 750px 500px' },
            gap: 4,
            alignItems: 'start',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ order: { xs: 3, lg: 1 } }}>
            <Box sx={sidebarBlockStyles}>
              <ViewDrawerPatternSidebar tagList={viewData?.tags || []} handleClose={props.handleClose} />
            </Box>
          </Box>

          <Box sx={{ order: { xs: 1, lg: 2 } }}>
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
              <ExportPatternForPrintV3 viewData={viewData} key={'print' + viewData?.id} />
            )}

            {!viewData?.pattern_file_external && <ExportPatternForSVG viewData={viewData} key={'svg' + viewData?.id} />}

            {!viewData?.pattern_file_external && false && (
              <BorderedCard key={'3d-' + viewData?.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Color Planner
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant={viewer3DOpen ? 'contained' : 'outlined'}
                    onClick={() => setViewer3DOpen((v) => !v)}
                    startIcon={<ViewInArIcon fontSize="small" />}
                    sx={{ borderRadius: 2, flexShrink: 0 }}
                  >
                    {viewer3DOpen ? 'Close Planner' : 'Open Planner'}
                  </Button>
                </Box>

                {viewer3DOpen && (
                  <Suspense fallback={<Skeleton variant="rounded" height={500} sx={{ mt: 2, borderRadius: 2 }} />}>
                    <PatternViewer3DLazy viewData={viewData} />
                  </Suspense>
                )}
              </BorderedCard>
            )}

            {!viewData?.pattern_file_external && (
              <PatternInstructions viewData={viewData} key={'instructions' + viewData?.id} />
            )}
          </Box>

          <Box sx={{ order: { xs: 2, lg: 3 } }}>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
                <Typography
                  variant="h3"
                  sx={{
                    wordBreak: 'break-word',
                    fontSize: { xs: '2rem', md: '3rem' },
                    lineHeight: 1.1,
                    color: 'text.primary',
                    mb: 0.5,
                  }}
                >
                  {viewData?.name}
                </Typography>
              </Box>

              <Tooltip title="Copy ID" arrow>
                <Typography
                  onClick={handleCopyId}
                  variant="caption"
                  sx={{ color: 'text.secondary', letterSpacing: '0.1em', cursor: 'pointer' }}
                >
                  ID: {viewData?.id}
                </Typography>
              </Tooltip>

              {viewData?.pattern_file_external && (
                <Box sx={{ pt: 4 }}>
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
            </Box>

            {viewData?.description && (
              <Box sx={{ mb: 2.5 }}>
                <MarkdownWrapper>{viewData.description}</MarkdownWrapper>
              </Box>
            )}

            <ThinDivider />

            <PatternSaveContainer viewData={viewData} />

            <PatternRatings viewData={viewData} />

            <ThinDivider />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                rowGap: 0,
              }}
            >
              <MetaRow label="Width" value={viewData?.design_width} unit={viewData?.design_width_unit} />
              <MetaRow label="Height" value={viewData?.design_height} unit={viewData?.design_height_unit} />
              <MetaRow label="Line Width" value={viewData?.line_width} unit={viewData?.line_width_unit} />
              <MetaRow label="Pieces" value={viewData?.pieces?.toLocaleString()} />
            </Box>

            <ThinDivider />

            <Stack spacing={2} sx={{ mb: 2.5 }}>
              <Box>
                <SectionLabel>Designed by</SectionLabel>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                  {viewData?.expand?.authors?.map((author, index) => (
                    <Link
                      key={`designed-by-list-${index}`}
                      to={`/profile`}
                      search={{
                        id: author?.id,
                      }}
                    >
                      <Typography variant="body1" key={`author-name-${index}`}>
                        {author?.name || 'Not Listed'}
                      </Typography>
                    </Link>
                  ))}

                  {viewData?.author_manual?.map((author, index) => (
                    <Typography variant="body1" key={`author-name-${index}`}>
                      {author || 'Not Listed'}
                    </Typography>
                  ))}
                </Box>
              </Box>

              <Box>
                <MetaRow label="Design Date" value={createPrettyDate(viewData?.design_date || '')} />
              </Box>

              <Box>
                <SectionLabel>Uploaded by</SectionLabel>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">{viewData?.uploaded_by || 'Not Listed'}</Typography>
                </Box>
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                rowGap: 0,
              }}
            >
              <MetaRow label="Uploaded On" value={createPrettyDate(viewData?.created || '')} />
              <MetaRow label="Last Update" value={createPrettyDate(viewData?.updated || '')} />
            </Box>

            <ThinDivider />

            <PatternReportIssue viewData={viewData} key={patternId} />

            <ThinDivider />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

const sidebarBlockStyles = {
  height: '100%',
  maxHeight: '100svh',
  overflowY: 'auto',
  position: 'sticky',
  top: 0,
  scrollbarWidth: 'none',
};

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
    <BorderedCard>
      <DecorativeTitle>Pattern Instructions</DecorativeTitle>

      <MarkdownWrapper>{props.viewData?.instructions}</MarkdownWrapper>
    </BorderedCard>
  );
};
