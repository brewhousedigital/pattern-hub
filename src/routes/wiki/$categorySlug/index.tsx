import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import {
  getAllWikiCategoriesOptions,
  useQueryGetAllWikiCategories,
  useQueryGetAllWikiPages,
} from '@/functions/database/wiki';
import { queryClient } from '@/functions/database/authentication-setup';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArticleIcon from '@mui/icons-material/Article';

import { alpha, styled } from '@mui/material/styles';
import { Box, Container, Skeleton, Typography } from '@mui/material';

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

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Skeleton variant="text" width="40%" height={48} />
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={80} />)}
            </Box>
          ) : !category ? (
            <Typography color="error.main">Category not found.</Typography>
          ) : (
            <>
              <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' }, mb: 1 }}>
                {category.name}
              </Typography>
              <Typography color="text.disabled" sx={{ mb: 4 }}>
                {catPages.length} page{catPages.length !== 1 ? 's' : ''}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {catPages.map((page) => (
                  <Link
                    key={page.id}
                    to={`/wiki/${category.slug}/${page.slug}` as any}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                  <PageCard>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <ArticleIcon sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                          {page.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineClamp: 2 }}>
                          {page.content.replace(/^#+\s.+$/m, '').trim().slice(0, 150)}
                          {page.content.length > 150 ? '…' : ''}
                        </Typography>
                      </Box>
                      <ChevronRightIcon sx={{ color: 'text.disabled', mt: 0.25, flexShrink: 0 }} />
                    </Box>
                  </PageCard>
                  </Link>
                ))}
              </Box>
            </>
          )}
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));

const PageCard = styled(Box)(({ theme }) => ({
  display: 'block',
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 10,
  backgroundColor: theme.palette.background.paper,
  textDecoration: 'none',
  '&:hover': {
    borderColor: alpha('#C8A96E', 0.5),
    backgroundColor: alpha('#C8A96E', 0.03),
  },
  transition: 'border-color 0.2s ease, background-color 0.2s ease',
  cursor: 'pointer',
}));
