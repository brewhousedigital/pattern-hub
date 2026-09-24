import { createFileRoute, useParams } from '@tanstack/react-router';
import { findWikiPage, getWikiDataOptions, useQueryGetWikiData } from '@/functions/database/wiki';
import { WikiPageContent } from '@/components/wiki/WikiPageContent';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { stripMarkdown, truncate } from '@/functions/utilities/strip-markdown';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

import { styled } from '@mui/material/styles';
import { Box, Container } from '@mui/material';

// Same fixed category as /news - see news/index.tsx.
const NEWS_CATEGORY_SLUG = 'pattern-archive-news';

export const Route = createFileRoute('/news/$pageSlug')({
  component: RouteComponent,
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(getWikiDataOptions()).then(
      (data) => findWikiPage(data.pages, NEWS_CATEGORY_SLUG, params.pageSlug),
      () => undefined,
    ),
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.title,
      loaderData?.content ? truncate(stripMarkdown(loaderData.content), 160) : '',
      match.pathname,
      loaderData?.title
        ? `https://patternarchive.net/api/og-image?type=wiki&title=${encodeURIComponent(loaderData.title)}&category=News`
        : undefined,
    ),
  headers: staticCacheHeaders,
});

function RouteComponent() {
  const { pageSlug } = useParams({ from: '/news/$pageSlug' });

  // One cached request for every wiki page - this page, and all the others
  // for [[wiki-link]] resolution.
  const { data, isLoading, isError: isWikiError } = useQueryGetWikiData();
  const allPages = data?.pages ?? [];
  const page = findWikiPage(allPages, NEWS_CATEGORY_SLUG, pageSlug);
  const isError = isWikiError || (!!data && !page);

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="lg">
          {!isLoading && page && (
            <BreadcrumbJsonLd
              items={[
                { name: 'Home', url: '/' },
                { name: 'News', url: '/news' },
                { name: page.title, url: `/news/${pageSlug}` },
              ]}
            />
          )}

          <WikiPageContent page={page} isLoading={isLoading} isError={isError} allPages={allPages} />
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));
