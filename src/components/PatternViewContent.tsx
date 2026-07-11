import React, { Suspense } from 'react';
import { ClientOnly, Link, useMatch } from '@tanstack/react-router';
import { ExportSection } from '@/components/PatternExport/ExportSection';
import { createPrettyDate } from '@/functions/utilities/dates';
import { MeasurementDisplay } from '@/components/MeasurementDisplay';
import { PatternMeasurement } from '@/components/PatternMeasurement';
import { generatePbImage, generatePbImageSVG } from '@/functions/utilities/generate-pb-image';
import { sanitizeSvg } from '@/functions/utilities/sanitize-svg';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternReportIssue } from '@/components/PatternUtilities/PatternReportIssue';
import { PatternSaveContainer } from '@/components/PatternUtilities/PatternSaveContainer';
import { PatternRatingsContainer } from '@/components/PatternUtilities/PatternRatingsContainer';
import { LayerSelectionHint } from '@/components/PatternUtilities/LayerSelectionHint';
import { type TypePatternResponse } from '@/functions/database/patterns.ts';
import { useQueryGetPublishedManualAuthors, nameToSlug } from '@/functions/database/manual-authors';
import { useQueryGetPatternDrawerData } from '@/functions/database/pattern-drawer-data';
import { useGlobalAuthData } from '@/data/auth-data';
import { copyToClipboard } from '@/functions/utilities/copy-to-clipboard';
import type { TypeViewData } from '@/functions/types/types';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { CollapsibleCard } from '@/components/cards/CollapsibleCard';
import { PatternViewer3DLazy } from '@/components/PatternViewer3D';
import { formatByteSize } from '@/functions/utilities/math';

import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  Typography,
  Button,
  Tooltip,
  Grid,
  Skeleton,
  Stack,
} from '@mui/material';

type PatternViewContentProps = {
  viewData: TypePatternResponse | undefined;
  /** Optional sidebar to render in the left column (e.g. ViewDrawerPatternSidebar). Omitting it collapses the left column. */
  sidebar?: React.ReactNode;
  showStandaloneTags?: boolean;
};

export const PatternViewContent = (props: PatternViewContentProps) => {
  const { viewData, sidebar, showStandaloneTags } = props;

  const onPatternPage = useMatch({ from: '/pattern/$patternId', shouldThrow: false });

  const { data: publishedManualAuthors = [] } = useQueryGetPublishedManualAuthors();

  const { authData } = useGlobalAuthData();
  const { data: drawerData } = useQueryGetPatternDrawerData(viewData?.id || '', authData?.id || '');
  const patternSets = drawerData?.sets ?? [];

  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  // ── Layer toggles ──────────────────────────────────────────────────────────
  const [hiddenLayers, setHiddenLayers] = React.useState<Set<string>>(new Set());
  const [layerSvgText, setLayerSvgText] = React.useState<string | null>(null);

  // Derived as a primitive so the effect below re-runs only when the actual
  // file URL changes, not on every viewData object identity change.
  const layerSvgUrl =
    viewData?.has_layers && (viewData.layers_map?.length ?? 0) > 0 && viewData.pattern_file
      ? generatePbImageSVG(viewData)
      : null;

  React.useEffect(() => {
    setHiddenLayers(new Set());
    setLayerSvgText(null);
    if (layerSvgUrl) {
      fetch(layerSvgUrl)
        .then((r) => r.text())
        .then((text) => setLayerSvgText(sanitizeSvg(text)))
        .catch(() => {});
    }
  }, [layerSvgUrl]);

  const displaySvg = React.useMemo(() => {
    if (!layerSvgText) return null;
    if (hiddenLayers.size === 0) return layerSvgText;
    const doc = new DOMParser().parseFromString(layerSvgText, 'image/svg+xml');
    hiddenLayers.forEach((id) => {
      const el = doc.getElementById(id);
      if (el) el.setAttribute('style', 'display:none');
    });
    return new XMLSerializer().serializeToString(doc);
  }, [layerSvgText, hiddenLayers]);

  const handleToggleLayer = (layerId: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  // Render the layered SVG through an <img> (secure static mode: no scripts and no
  // external sub-resource loading) rather than inline. We feed it a blob URL built
  // from the sanitized, layer-toggled markup and revoke the previous URL on change.
  const [displaySvgUrl, setDisplaySvgUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!displaySvg) {
      setDisplaySvgUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([displaySvg], { type: 'image/svg+xml' }));
    setDisplaySvgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [displaySvg]);
  // ──────────────────────────────────────────────────────────────────────────

  const svgImageUrl = generatePbImage(viewData);

  const handleCopyId = async () => {
    await copyToClipboard(viewData?.id || '');
  };

  return (
    <Grid container spacing={2}>
      {sidebar && (
        <Grid
          size={{ xs: 12, lg: 'auto' }}
          sx={{
            width: { lg: 250 },
            flexShrink: 0,
            order: { xs: 3, lg: 1 },
          }}
        >
          {sidebar}
        </Grid>
      )}

      <Grid
        size={{ xs: 12, lg: 'grow' }}
        sx={{
          minWidth: 0,
          order: { xs: 1, lg: 2 },
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
              {displaySvgUrl ? (
                <img
                  loading="lazy"
                  src={displaySvgUrl}
                  alt={`pattern template for ${viewData?.name}`}
                  style={{ width: '100%', height: '100%', aspectRatio: '1/1', display: 'block' }}
                />
              ) : (
                <img
                  loading="lazy"
                  src={svgImageUrl}
                  alt={`pattern template for ${viewData?.name}`}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1', display: 'block' }}
                />
              )}

              <Grid
                container
                spacing={6}
                sx={{
                  mt: 2,
                  pt: 2,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  justifyContent: 'space-between',
                }}
              >
                <Grid size={{ xs: 12, md: 6 }}>
                  <PatternLegendCard viewData={viewData} />
                </Grid>

                {viewData?.has_layers && (viewData.layers_map?.length ?? 0) > 0 && (
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 0.75,
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                        color: 'text.disabled',
                      }}
                    >
                      Layers
                    </Typography>
                    <Stack spacing={0}>
                      {viewData.layers_map
                        .filter((layer) => layer.isVisible !== false)
                        .map((layer) => (
                          <FormControlLabel
                            key={layer.layerName}
                            control={
                              <Checkbox
                                size="small"
                                checked={!hiddenLayers.has(layer.layerName)}
                                onChange={() => handleToggleLayer(layer.layerName)}
                              />
                            }
                            label={<Typography variant="body2">{layer.mappedName || layer.layerName}</Typography>}
                            sx={{ ml: 0 }}
                          />
                        ))}
                    </Stack>
                    <LayerSelectionHint sx={{ mt: 1 }} />
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </BorderedCard>

        {!viewData?.pattern_file_external && (
          <PatternInstructions viewData={viewData} key={'instructions' + viewData?.id} />
        )}

        {!viewData?.pattern_file_external && <ExportSection viewData={viewData} hiddenLayers={hiddenLayers} />}

        {!viewData?.pattern_file_external && (
          <CollapsibleCard title="Color Planner" key={'3d-' + viewData?.id}>
            {viewData?.has_layers && (viewData.layers_map?.length ?? 0) > 0 && <LayerSelectionHint sx={{ mb: 2 }} />}
            {/* three.js/@react-three cannot execute on the server - keep the whole chunk client-only */}
            <ClientOnly fallback={<Skeleton variant="rounded" height={500} sx={{ borderRadius: 2 }} />}>
              <Suspense fallback={<Skeleton variant="rounded" height={500} sx={{ borderRadius: 2 }} />}>
                <PatternViewer3DLazy viewData={viewData} hiddenLayers={hiddenLayers} />
              </Suspense>
            </ClientOnly>
          </CollapsibleCard>
        )}
      </Grid>

      <Grid
        size={{ xs: 12, lg: 'auto' }}
        sx={{
          width: { lg: 300 },
          flexShrink: 0,
          order: { xs: 2, lg: 3 },
        }}
      >
        <Box>
          {/* ── Name & ID ─────────────────────────────────────── */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h3"
              component="h1"
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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            <Box sx={{ px: 1, pt: 0.5, mb: 3 }}>
              <MarkdownWrapper>{viewData.description}</MarkdownWrapper>
            </Box>
          )}

          <PatternRatingsContainer viewData={viewData} />

          {/* ── Community ─────────────────────────────────────── */}
          <PanelSectionTitle>Community</PanelSectionTitle>

          <CompactRow label="Favorited">{(viewData?.favorite_count ?? 0).toLocaleString()}</CompactRow>
          <CompactRow label="Completed">{(viewData?.done_count ?? 0).toLocaleString()}</CompactRow>
          <CompactRow label="Ratings">{(viewData?.total_ratings ?? 0).toLocaleString()}</CompactRow>
          <CompactRow label="Difficulty Votes">{(viewData?.total_difficulty_ratings ?? 0).toLocaleString()}</CompactRow>

          {/* ── Details ───────────────────────────────────────── */}
          <PanelSectionTitle>Details</PanelSectionTitle>

          <CompactRow label="Width">
            <PatternMeasurement pattern={viewData} dimension="width" />
          </CompactRow>

          <CompactRow label="Height">
            <PatternMeasurement pattern={viewData} dimension="height" />
          </CompactRow>

          <CompactRow label="Line Width">
            <MeasurementDisplay value={viewData?.line_width} unit={viewData?.line_width_unit} />
          </CompactRow>

          <CompactRow label="Pieces">{viewData?.pieces?.toLocaleString() ?? '-'}</CompactRow>

          <Box
            onClick={() => setDetailsExpanded((v) => !v)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.4,
              mt: 0.25,
              cursor: 'pointer',
              userSelect: 'none',
              borderRadius: 1,
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 600 }}>
              {detailsExpanded ? 'Show less' : 'Show more details'}
            </Typography>
            <ExpandMoreRoundedIcon
              sx={{
                fontSize: '1.1rem',
                color: 'primary.main',
                transition: 'transform 0.2s',
                transform: detailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </Box>

          <Collapse in={detailsExpanded}>
            <CompactRow label="Width (in)">
              <MeasurementDisplay value={viewData?.size_width_in} unit="in" forceDecimal />
            </CompactRow>
            <CompactRow label="Width (cm)">
              <MeasurementDisplay value={viewData?.size_width_cm} unit="cm" />
            </CompactRow>
            <CompactRow label="Width (mm)">
              <MeasurementDisplay value={viewData?.size_width_mm} unit="mm" />
            </CompactRow>

            <CompactRow label="Height (in)">
              <MeasurementDisplay value={viewData?.size_height_in} unit="in" forceDecimal />
            </CompactRow>
            <CompactRow label="Height (cm)">
              <MeasurementDisplay value={viewData?.size_height_cm} unit="cm" />
            </CompactRow>
            <CompactRow label="Height (mm)">
              <MeasurementDisplay value={viewData?.size_height_mm} unit="mm" />
            </CompactRow>

            {/*{viewData?.source_url && (
              <CompactRow label="Source">
                <Typography
                  component="a"
                  href={viewData.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 500 }}
                >
                  View Source
                </Typography>
              </CompactRow>
            )}*/}
          </Collapse>

          {/* ── Attribution ───────────────────────────────────── */}
          <PanelSectionTitle>Attribution</PanelSectionTitle>

          <CompactRow label="Designed by">
            <Stack direction="column" sx={{ gap: 0.5, justifyContent: 'flex-end' }}>
              {viewData?.expand?.authors?.map((author, index) => {
                return (
                  <Link key={`designed-by-${index}`} to="/profile" search={{ id: author.id, tab: 0 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 500 }}>
                      {author.name || 'Not Listed'}
                    </Typography>
                  </Link>
                );
              })}

              {viewData?.author_manual?.map((author, i) => {
                const page = publishedManualAuthors.find(
                  (a) => a.name === author || nameToSlug(a.name) === nameToSlug(author),
                );
                return page ? (
                  <Link key={`manual-${i}`} to="/authors/$slug" params={{ slug: page.slug }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 500 }}>
                      {author}
                    </Typography>
                  </Link>
                ) : (
                  <Typography key={`manual-${i}`} sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 500 }}>
                    {author || 'Not Listed'}
                  </Typography>
                );
              })}
            </Stack>
          </CompactRow>

          <CompactRow label="Design Date">{createPrettyDate(viewData?.design_date || '') || '-'}</CompactRow>
          <CompactRow label="Uploaded by">{viewData?.uploaded_by || 'Not Listed'}</CompactRow>
          <CompactRow label="Added on">{createPrettyDate(viewData?.created || '') || '-'}</CompactRow>
          <CompactRow label="Last updated">{createPrettyDate(viewData?.updated || '') || '-'}</CompactRow>

          {viewData?.pattern_file_size ? (
            <CompactRow label="File size">{formatByteSize(viewData?.pattern_file_size)}</CompactRow>
          ) : (
            <></>
          )}

          {patternSets.length > 0 && (
            <Box sx={{ px: 1, pt: 2 }}>
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'text.disabled',
                  pb: 0.75,
                }}
              >
                In Sets
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {patternSets.map((set) => (
                  <Tooltip key={set.id} title={set.description || ''} arrow disableHoverListener={!set.description}>
                    <Link to="/sets/$setId" params={{ setId: set.id }}>
                      <Chip
                        icon={<StyleRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                        label={set.title}
                        size="small"
                        variant="outlined"
                        clickable
                        sx={set.color ? { borderColor: set.color, color: set.color } : undefined}
                      />
                    </Link>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          {showStandaloneTags && (viewData?.tags?.length ?? 0) > 0 && (
            <Box sx={{ px: 1, pt: 2 }}>
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'text.disabled',
                  pb: 0.75,
                }}
              >
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {viewData!.tags!.map((tag) => (
                  <Link key={tag} to="/" search={{ tags: [tag] }}>
                    <Chip label={tag} size="small" variant="outlined" clickable />
                  </Link>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ px: 1, pt: 6, pb: 1 }}>
            <PatternReportIssue viewData={viewData} key={viewData?.id} />
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
};

// ─── Right-panel compact layout helpers ──────────────────────────────────────

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

  const sizeLabel = (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
      <PatternMeasurement pattern={viewData} dimension="width" />
      <Box component="span">×</Box>
      <PatternMeasurement pattern={viewData} dimension="height" />
    </Box>
  );
  const lineWidthLabel = <MeasurementDisplay value={viewData.line_width} unit={viewData.line_width_unit} />;
  const dateLabel = createPrettyDate(viewData.design_date || '');

  const stats: [string, React.ReactNode][] = [
    ['Project Size', sizeLabel],
    ['Pieces', (viewData.pieces ?? 0).toLocaleString()],
    ['Line Width', lineWidthLabel],
    ['Design Date', dateLabel],
  ];

  return (
    <Box>
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
