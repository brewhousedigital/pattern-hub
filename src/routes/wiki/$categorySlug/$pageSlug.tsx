import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useQueryGetWikiPage, useQueryGetAllWikiPages } from '@/functions/database/wiki';
import { WikiMarkdownWrapper } from '@/components/wiki/WikiMarkdownWrapper';
import { WikiTableOfContents } from '@/components/wiki/WikiTableOfContents';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { styled } from '@mui/material/styles';
import { Box, Container, Skeleton, Typography } from '@mui/material';

export const Route = createFileRoute('/wiki/$categorySlug/$pageSlug')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Wiki', '', match.pathname),
  }),
});

function RouteComponent() {
  const { categorySlug, pageSlug } = useParams({ from: '/wiki/$categorySlug/$pageSlug' });

  const { data: page, isLoading, isError } = useQueryGetWikiPage(categorySlug, pageSlug);

  // All pages are fetched for [[wiki-link]] resolution — cached by React Query
  const { data: allPages = [] } = useQueryGetAllWikiPages();

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="lg">
          {/* Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 4, color: 'text.disabled', fontSize: '0.85rem' }}>
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
              <Typography variant="body2" color="text.disabled">{categorySlug}</Typography>
            )}
            <ChevronRightIcon sx={{ fontSize: '0.9rem' }} />
            <Typography variant="body2" color="text.secondary">
              {isLoading ? '…' : (page?.title ?? pageSlug)}
            </Typography>
          </Box>

          {isError && (
            <Typography color="error.main">Page not found.</Typography>
          )}

          {isLoading && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 6 }}>
              <Box>
                <Skeleton variant="text" width="60%" height={56} sx={{ mb: 2 }} />
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="text" width={`${70 + (i % 3) * 10}%`} height={24} sx={{ mb: 0.5 }} />
                ))}
              </Box>
              <Skeleton variant="rounded" height={200} />
            </Box>
          )}

          {!isLoading && page && (
            <ContentGrid>
              {/* Main content */}
              <Box>
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 0.75, color: 'text.primary' }}
                >
                  {page.title}
                </Typography>

                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 4 }}>
                  Last updated {new Date(page.updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Typography>

                <WikiMarkdownWrapper wikiPages={allPages}>
                  {page.content}
                </WikiMarkdownWrapper>
              </Box>

              {/* Sticky TOC sidebar */}
              <Box>
                <WikiTableOfContents markdown={page.content} />
              </Box>
            </ContentGrid>
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

const ContentGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(6),
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: '1fr 220px',
  },
}));
