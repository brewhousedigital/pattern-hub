import React from 'react';
import { Link } from '@tanstack/react-router';
import { MetaRow, ThinDivider, SectionLabel, DecorativeTitle } from '@/components/ViewHelpers';
import { ExportPatternForPrintV2 } from '@/components/ExportPatternForPrintV2';
import { ExportPatternForPrintV3 } from '@/components/PatternExport/ExportPatternForPrintV3';
import { ExportPatternToDownloadV2 } from '@/components/ExportPatternToDownloadV2';
import { ExportPatternToDownloadV3 } from '@/components/PatternExport/ExportPatternToDownloadV3';
import { ExportPatternForSVG } from '@/components/PatternExport/ExportPatternForSVG';
import type { TypeExportPatternContext } from '@/components/PatternExport/useExportPattern';
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

import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { Box, Typography, Stack, Container, Button, Tooltip } from '@mui/material';

type ViewDrawerProps = {
  viewData: TypePatternResponse | undefined;
  handleClose?: () => void;
};

export const ViewDrawer = (props: ViewDrawerProps) => {
  const viewData = props.viewData;

  const { handleOpenView, handleCloseView } = useGlobalIsViewOpen();

  const { patternId } = usePatternSearch();

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

  const exportPatternContext: TypeExportPatternContext = {
    patternFileUrl: svgImageUrl,
    patternName: viewData?.name || '',
    authorLine: viewData?.expand?.authors?.map((a) => a.name).join(', ') ?? '',
    pieces: viewData?.pieces || 0,
    designDate: viewData?.design_date as Date | null,
    designWidth: viewData?.design_width || 0,
    designWidthUnit: viewData?.design_width_unit || '',
    designHeight: viewData?.design_height || 0,
    designHeightUnit: viewData?.design_height_unit || '',
    lineWidth: viewData?.line_width || 0,
    lineWidthUnit: viewData?.line_width_unit || '',
    instructionsMarkdown: viewData?.instructions || '',
    patternKeys: viewData?.pattern_key_reference_list || [],
  };

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
                  src={svgImageUrl}
                  alt={`pattern template for ${viewData?.name}`}
                  style={{ width: '100%', height: 'auto', borderRadius: 16, display: 'block' }}
                />
              ) : (
                <img
                  src={svgImageUrl}
                  alt={`pattern template for ${viewData?.name}`}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1', display: 'block' }}
                />
              )}
            </BorderedCard>

            {/*{!viewData?.pattern_file_external && <ExportPatternToDownload viewData={viewData} />}*/}
            {/*{!viewData?.pattern_file_external && (
              <ExportPatternToDownloadV2 viewData={viewData} key={'download' + viewData?.id} />
            )}*/}
            {/*{!viewData?.pattern_file_external && (
              <ExportPatternToDownloadV3 ctx={exportPatternContext} key={'download' + viewData?.id} />
            )}*/}

            {!viewData?.pattern_file_external && (
              <ExportPatternForPrintV3 viewData={viewData} key={'print' + viewData?.id} />
            )}

            {!viewData?.pattern_file_external && (
              <ExportPatternForSVG viewData={viewData} key={'svg' + viewData?.id} />
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

            {viewData?.pattern_key_reference_list && (
              <>
                {/*{viewData.pattern_key_reference_list?.map((item) => {
                  return (
                    <Grid container sx={{ alignItems: 'center', mb: 2 }}>
                      <Grid size={{ xs: 4 }}>{item.name}</Grid>
                      <Grid size={{ xs: 8 }}>
                        <img
                          src={item.fullPath}
                          alt={item.name}
                          //style={{ width: '100%', height: 'auto', maxHeight: 50, borderRadius: 8 }}
                          style={{
                            width: '100%',
                            height: 40,
                            objectFit: 'contain',
                            objectPosition: 'left',
                            display: 'block',
                          }}
                        />
                      </Grid>
                    </Grid>
                  );
                })}*/}
              </>
            )}

            <PatternReportIssue viewData={viewData} />

            {/*<Box>
              <SectionLabel>Tags for this Pattern</SectionLabel>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                {viewData?.tags?.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: alpha('#C8A96E', 0.25),
                      color: 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            </Box>*/}

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

const PatternInstructions = (props: TypeViewData) => {
  if (!props.viewData?.instructions) return <></>;

  return (
    <BorderedCard>
      <DecorativeTitle>Pattern Instructions</DecorativeTitle>

      <MarkdownWrapper>{props.viewData?.instructions}</MarkdownWrapper>
    </BorderedCard>
  );
};
