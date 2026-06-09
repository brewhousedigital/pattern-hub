import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllWikiCategories, useQueryGetAllWikiPages } from '@/functions/database/wiki';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import ArticleIcon from '@mui/icons-material/Article';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { alpha, styled } from '@mui/material/styles';
import { Box, Container, Skeleton, Typography } from '@mui/material';

export const Route = createFileRoute('/wiki/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Wiki', 'Browse the Pattern Archive wiki', match.pathname),
  }),
});

function RouteComponent() {
  const { data: categories = [], isLoading: catsLoading } = useQueryGetAllWikiCategories();
  const { data: pages = [], isLoading: pagesLoading } = useQueryGetAllWikiPages();
  const isLoading = catsLoading || pagesLoading;

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: '2rem', md: '3rem' }, mb: 1 }}>
              Wiki
            </Typography>
            <Typography color="text.secondary">
              Guides, tutorials, and reference documentation for Pattern Archive.
            </Typography>
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" height={120} />
              ))}
            </Box>
          ) : categories.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
              No wiki pages yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {categories.map((cat) => {
                const catPages = pages.filter((p) => p.category === cat.id);
                return (
                  <CategoryCard key={cat.id}>
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 0.25 }}>
                        {cat.name}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {catPages.length} page{catPages.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>

                    {catPages.length > 0 && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {catPages.map((page) => (
                          <Link
                            key={page.id}
                            to={`/wiki/${cat.slug}/${page.slug}` as any}
                            style={{ textDecoration: 'none' }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                color: 'text.secondary',
                                '&:hover': { color: 'primary.main', backgroundColor: alpha('#C8A96E', 0.07) },
                                transition: 'color 0.15s, background-color 0.15s',
                              }}
                            >
                              <ArticleIcon sx={{ fontSize: '0.85rem', flexShrink: 0 }} />
                              <Typography variant="body2">{page.title}</Typography>
                              <ChevronRightIcon sx={{ fontSize: '0.85rem', ml: 'auto', opacity: 0.4 }} />
                            </Box>
                          </Link>
                        ))}
                      </Box>
                    )}
                  </CategoryCard>
                );
              })}
            </Box>
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

const CategoryCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    borderColor: alpha('#C8A96E', 0.4),
  },
  transition: 'border-color 0.2s ease',
}));
