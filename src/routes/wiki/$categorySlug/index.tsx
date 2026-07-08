import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import {
  getAllWikiCategoriesOptions,
  useQueryGetAllWikiCategories,
  useQueryGetAllWikiPages,
} from '@/functions/database/wiki';
import { queryClient } from '@/functions/database/authentication-setup';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { WikiCategoryPageList } from '@/components/wiki/WikiCategoryPageList';
import { generateSEO } from '@/functions/utilities/seo';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { styled } from '@mui/material/styles';
import { Box, Container, Typography } from '@mui/material';

export const Route = createFileRoute('/wiki/$categorySlug/')({
  component: RouteComponent,
  loader: ({ params }) =>
    queryClient.ensureQueryData(getAllWikiCategoriesOptions()).then(
      (categories) => categories.find((c) => c.slug === params.categorySlug),
      () => undefined,
    ),
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.name,
      loaderData?.name ? `Browse ${loaderData.name} articles in the Pattern Archive wiki.` : '',
      match.pathname,
    ),
});

function RouteComponent() {
  const { categorySlug } = useParams({ from: '/wiki/$categorySlug/' });

  const { data: categories = [], isLoading: catsLoading } = useQueryGetAllWikiCategories();
  const { data: pages = [], isLoading: pagesLoading } = useQueryGetAllWikiPages();

  const category = categories.find((c) => c.slug === categorySlug);
  const catPages = pages.filter((p) => p.category === category?.id);
  const isLoading = catsLoading || pagesLoading;

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          {/* Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 4, color: 'text.disabled', fontSize: '0.85rem' }}>
            <Link to="/wiki" style={{ color: 'inherit', textDecoration: 'none' }}>
              Wiki
            </Link>
            <ChevronRightIcon sx={{ fontSize: '0.9rem' }} />
            <Typography variant="body2" color="text.secondary">
              {isLoading ? '…' : (category?.name ?? categorySlug)}
            </Typography>
          </Box>

          <WikiCategoryPageList
            category={category}
            pages={catPages}
            isLoading={isLoading}
            basePath={`/wiki/${categorySlug}`}
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
