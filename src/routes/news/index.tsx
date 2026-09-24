import { createFileRoute } from '@tanstack/react-router';
import { getWikiDataOptions, useQueryGetWikiData } from '@/functions/database/wiki';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { WikiCategoryPageList } from '@/components/wiki/WikiCategoryPageList';
import { generateSEO } from '@/functions/utilities/seo';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

import { styled } from '@mui/material/styles';
import { Box, Container } from '@mui/material';

// The wiki category that backs the public /news page - reuses the same shared
// wiki components as /wiki/$categorySlug, just without the breadcrumb, and with
// article links kept under /news/$pageSlug instead of /wiki/$categorySlug/$pageSlug.
const NEWS_CATEGORY_SLUG = 'pattern-archive-news';

export const Route = createFileRoute('/news/')({
  component: RouteComponent,
  // Categories and pages come back in one request, so the article list is in
  // the server-rendered HTML.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getWikiDataOptions()).then(
      (data) => data.categories.find((c) => c.slug === NEWS_CATEGORY_SLUG),
      () => undefined,
    ),
  head: ({ match }) => generateSEO('News', 'Announcements and updates from Pattern Archive.', match.pathname),
  headers: staticCacheHeaders,
});

function RouteComponent() {
  const { data, isLoading } = useQueryGetWikiData();

  const category = data?.categories.find((c) => c.slug === NEWS_CATEGORY_SLUG);
  const newsPages = (data?.pages ?? []).filter((p) => p.category === category?.id);

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          <WikiCategoryPageList
            category={category}
            pages={newsPages}
            isLoading={isLoading}
            basePath="/news"
            title="News"
            variant="news"
          />
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));
