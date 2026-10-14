import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ClientResponseError } from 'pocketbase';
import { getPatternByIdOptions, useQueryGetPatternById } from '@/functions/database/patterns';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { PatternViewContent } from '@/components/PatternViewContent';
import { PatternJsonLd } from '@/components/PatternJsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { generateSEO } from '@/functions/utilities/seo';
import { generatePbImageOpenGraph } from '@/functions/utilities/generate-pb-image';
import { stripMarkdown, truncate } from '@/functions/utilities/strip-markdown';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Box, Container, Link as MuiLink } from '@mui/material';

export const Route = createFileRoute('/pattern/$patternId')({
  component: RouteComponent,
  // PocketBase's viewRule on `patterns` is public, so getOne also returns
  // soft-deleted and draft rows (and the list/search endpoints are the only
  // place that filter them out). Treat a soft-deleted pattern, a draft, and an
  // ID that does not exist, as a real 404 - the SSR response gets the 404 status and the
  // router's defaultNotFoundComponent renders.
  loader: async ({ params, context }) => {
    let pattern;
    try {
      pattern = await context.queryClient.query({
        ...getPatternByIdOptions(params.patternId),
        staleTime: 'static',
      });
    } catch (error) {
      if (error instanceof ClientResponseError && error.status === 404) {
        throw notFound();
      }
      throw error;
    }

    if (pattern.isDeleted || pattern.is_draft) {
      throw notFound();
    }

    return pattern;
  },
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.name,
      loaderData?.description ? truncate(stripMarkdown(loaderData.description), 160) : '',
      match.pathname,
      loaderData?.opengraph_image ? generatePbImageOpenGraph(loaderData) : undefined,
    ),
  headers: staticCacheHeaders,
});

function RouteComponent() {
  const { patternId } = Route.useParams();
  const { isPending, isError, data } = useQueryGetPatternById(patternId);

  if (isPending) {
    return <FullScreenLoader />;
  }

  return (
    <GeneralLayout>
      <Box sx={{ backgroundColor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
          <MuiLink
            component={Link}
            to="/pattern"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 3,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
            Back to search
          </MuiLink>

          {isError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              Pattern not found or failed to load.
            </Alert>
          )}

          {data && (
            <>
              <PatternJsonLd pattern={data} />
              <BreadcrumbJsonLd
                items={[
                  { name: 'Home', url: '/' },
                  { name: data.name, url: `/pattern/${data.id}` },
                ]}
              />
            </>
          )}

          <PatternViewContent viewData={data} showStandaloneTags />
        </Container>
      </Box>
    </GeneralLayout>
  );
}
