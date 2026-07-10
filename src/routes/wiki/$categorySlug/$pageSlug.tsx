import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { getWikiPageOptions, useQueryGetWikiPage, useQueryGetAllWikiPages } from '@/functions/database/wiki';
import { WikiPageContent } from '@/components/wiki/WikiPageContent';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { stripMarkdown, truncate } from '@/functions/utilities/strip-markdown';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { styled } from '@mui/material/styles';
import { Box, Container, Typography } from '@mui/material';

export const Route = createFileRoute('/wiki/$categorySlug/$pageSlug')({
  component: RouteComponent,
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(getWikiPageOptions(params.categorySlug, params.pageSlug)).catch(() => undefined),
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.title,
      loaderData?.content ? truncate(stripMarkdown(loaderData.content), 160) : '',
      match.pathname,
    ),
});

function RouteComponent() {
  const { categorySlug, pageSlug } = useParams({ from: '/wiki/$categorySlug/$pageSlug' });

  const { data: page, isLoading, isError } = useQueryGetWikiPage(categorySlug, pageSlug);

  // All pages are fetched for [[wiki-link]] resolution - cached by React Query
  const { data: allPages = [] } = useQueryGetAllWikiPages();

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="lg">
          {/* Breadcrumb */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 4, color: 'text.disabled', fontSize: '0.85rem' }}
          >
            <Link to="/wiki" style={{ color: 'inherit', textDecoration: 'none' }}>
              Wiki
            </Link>
            <ChevronRightIcon sx={{ fontSize: '0.9rem' }} />
            {page ? (
              <Link
                to="/wiki/$categorySlug"
                params={{ categorySlug }}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {page.expand?.category?.name ?? categorySlug}
              </Link>
            ) : (
              <Typography variant="body2" color="text.disabled">
                {categorySlug}
              </Typography>
            )}
            <ChevronRightIcon sx={{ fontSize: '0.9rem' }} />
            <Typography variant="body2" color="text.secondary">
              {isLoading ? '…' : (page?.title ?? pageSlug)}
            </Typography>
          </Box>

          {!isLoading && page && (
            <BreadcrumbJsonLd
              items={[
                { name: 'Home', url: '/' },
                { name: 'Wiki', url: '/wiki' },
                { name: page.expand?.category?.name ?? categorySlug, url: `/wiki/${categorySlug}` },
                { name: page.title, url: `/wiki/${categorySlug}/${pageSlug}` },
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
