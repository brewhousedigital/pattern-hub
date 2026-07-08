import { createFileRoute } from '@tanstack/react-router';
import { getAllWikiCategoriesOptions, useQueryGetAllWikiCategories, useQueryGetAllWikiPages } from '@/functions/database/wiki';
import { queryClient } from '@/functions/database/authentication-setup';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { WikiCategoryPageList } from '@/components/wiki/WikiCategoryPageList';
import { generateSEO } from '@/functions/utilities/seo';

import { styled } from '@mui/material/styles';
import { Box, Container } from '@mui/material';

// The wiki category that backs the public /news page - reuses the same shared
// wiki components as /wiki/$categorySlug, just without the breadcrumb, and with
// article links kept under /news/$pageSlug instead of /wiki/$categorySlug/$pageSlug.
const NEWS_CATEGORY_SLUG = 'pattern-archive-news';

export const Route = createFileRoute('/news/')({
  component: RouteComponent,
  loader: () =>
    queryClient.ensureQueryData(getAllWikiCategoriesOptions()).then(
      (categories) => categories.find((c) => c.slug === NEWS_CATEGORY_SLUG),
      () => undefined,
    ),
  head: ({ match }) => generateSEO('News', 'Announcements and updates from Pattern Archive.', match.pathname),
});

function RouteComponent() {
  const { data: categories = [], isLoading: catsLoading } = useQueryGetAllWikiCategories();
  const { data: pages = [], isLoading: pagesLoading } = useQueryGetAllWikiPages();

  const category = categories.find((c) => c.slug === NEWS_CATEGORY_SLUG);
  const newsPages = pages.filter((p) => p.category === category?.id);
  const isLoading = catsLoading || pagesLoading;

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
