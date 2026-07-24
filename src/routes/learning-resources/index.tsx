import React, { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { stripMarkdown } from '@/functions/utilities/markdown';
import { PaginationBox } from '@/components/PaginationBox';
import { dynamicCacheHeaders } from '@/functions/utilities/cache-headers';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useLearningResourceSearch } from '@/functions/hooks/useLearningResourceSearch';
import {
  getPublishedResourcesOptions,
  useQueryGetPublishedResourcesPaginated,
} from '@/functions/database/learning-resources';
import {
  learningResourceSearchSchema,
  RESOURCE_SORT_OPTIONS,
  type TypeResourceSortValue,
} from '@/functions/utilities/learning-resources-search';
import { RESOURCE_TYPE_COLORS, RESOURCE_TYPE_ICONS, RESOURCE_TYPE_LABELS, getYouTubeThumbnail } from '@/functions/utilities/resource-types';
import { alpha } from '@mui/material/styles';

import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/learning-resources/')({
  component: RouteComponent,
  validateSearch: learningResourceSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q, sort: search.sort, page: search.page }),
  loader: ({ context, deps }) =>
    context.queryClient
      .ensureQueryData(getPublishedResourcesOptions({ page: deps.page, search: deps.q, sort: deps.sort }))
      .catch(() => undefined),
  head: ({ match }) =>
    generateSEO(
      'Learning Resources',
      'Educational videos, articles, and resources for stained glass crafting.',
      match.pathname,
    ),
  headers: dynamicCacheHeaders,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const EMPTY_RESULTS = { page: 1, perPage: 0, totalItems: 0, totalPages: 0, items: [] };

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { q, sort, page, setQ, setSort, setPage } = useLearningResourceSearch();

  // Debounced free-text search - rawInput drives the box, q (URL state) only
  // updates once the user pauses typing. Seeded once from q on mount; not
  // re-synced afterwards (e.g. browser back/forward), matching the tradeoff
  // used for other debounced search boxes in this app.
  const [rawInput, setRawInput] = useState(q);
  const debouncedInput = useDebounce(rawInput, 400);

  useEffect(() => {
    if (debouncedInput !== q) setQ(debouncedInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  const {
    data = EMPTY_RESULTS,
    isFetching,
    isPending,
    isError,
  } = useQueryGetPublishedResourcesPaginated({ page, search: q, sort });

  return (
    <GeneralLayout>
      <Container maxWidth="lg" sx={{ py: 5 }}>
        {/* Page header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, lineHeight: 1.2 }} gutterBottom>
            Learning Resources
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
            Videos, articles, store links, and guides to help you learn stained glass
          </Typography>
        </Box>

        {/* Search + sort controls */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search learning resources…"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    {isFetching ? <CircularProgress size={16} /> : <SearchRoundedIcon fontSize="small" />}
                  </InputAdornment>
                ),
              },
            }}
          />

          <FormControl sx={{ minWidth: { xs: '100%', sm: 220 } }}>
            <InputLabel id="resource-sort-label">Sort</InputLabel>
            <Select
              labelId="resource-sort-label"
              label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as TypeResourceSortValue)}
            >
              {RESOURCE_SORT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load learning resources. Please try refreshing the page.
          </Alert>
        )}

        {isPending && (
          <Grid container spacing={3}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
        )}

        {!isPending && !isError && data.items.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <SchoolRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {q ? 'No matching resources' : 'No resources yet'}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {q ? `No resources found for "${q}". Try a different search.` : 'Check back soon for videos, articles, and more.'}
            </Typography>
          </Box>
        )}

        {data.items.length > 0 && (
          <Grid container spacing={3}>
            {data.items.map((resource) => {
              const Icon = RESOURCE_TYPE_ICONS[resource.resource_type];
              const accentColor = RESOURCE_TYPE_COLORS[resource.resource_type];
              const thumbnail = resource.resource_type === 'video' ? getYouTubeThumbnail(resource.url) : null;
              const hostname = getHostname(resource.url);

              return (
                <Grid key={resource.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.2s',
                      '&:hover': {
                        boxShadow: 6,
                        transform: 'translateY(-2px)',
                        borderColor: accentColor,
                      },
                    }}
                  >
                    <CardActionArea
                      component="a"
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      {/* Header: YouTube thumbnail if resolvable, otherwise a solid accent block + type icon */}
                      <Box
                        sx={{
                          backgroundColor: accentColor,
                          backgroundImage: thumbnail
                            ? `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.6)), url("${thumbnail}")`
                            : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          minHeight: 96,
                          px: 2.5,
                          pt: 2.5,
                          pb: 2,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            backgroundColor: alpha('#fff', 0.2),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon sx={{ color: '#fff', fontSize: 22 }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, color: '#fff', pt: 0.5 }}>
                          {resource.title}
                        </Typography>
                      </Box>

                      <CardContent
                        sx={{
                          flexGrow: 1,
                          px: 2.5,
                          pt: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          '&:last-child': { pb: 2.5 },
                        }}
                      >
                        <Chip
                          label={RESOURCE_TYPE_LABELS[resource.resource_type]}
                          size="small"
                          variant="outlined"
                          sx={{
                            alignSelf: 'flex-start',
                            mb: 1.5,
                            fontSize: '0.65rem',
                            height: 20,
                            borderColor: accentColor,
                            color: accentColor,
                          }}
                        />

                        {resource.description && (
                          <Typography
                            variant="body2"
                            sx={{
                              mb: 2,
                              color: '#222',
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                              lineHeight: 1.65,
                            }}
                          >
                            {stripMarkdown(resource.description)}
                          </Typography>
                        )}

                        {resource.tags.length > 0 && (
                          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                            {resource.tags.slice(0, 3).map((tag) => (
                              <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                            ))}
                            {resource.tags.length > 3 && (
                              <Chip
                                label={`+${resource.tags.length - 3}`}
                                size="small"
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                          </Stack>
                        )}

                        <Stack
                          direction="row"
                          sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#222', opacity: 0.55 }}>
                            {hostname}
                          </Typography>
                          <OpenInNewRoundedIcon sx={{ fontSize: 18, color: accentColor }} />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        <Box sx={{ mt: 4 }}>
          <PaginationBox data={data} value={page} setter={setPage} />
        </Box>
      </Container>
    </GeneralLayout>
  );
}
