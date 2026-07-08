import { Link } from '@tanstack/react-router';
import type { TypeWikiCategory, TypeWikiPage } from '@/functions/database/wiki';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArticleIcon from '@mui/icons-material/Article';

import { alpha, styled } from '@mui/material/styles';
import { Box, Skeleton, Typography } from '@mui/material';

type WikiCategoryPageListProps = {
  category: TypeWikiCategory | undefined;
  pages: TypeWikiPage[];
  isLoading: boolean;
  /** URL prefix each page links to, e.g. "/wiki/tagging-guidelines" or "/news" - the page's slug is appended. */
  basePath: string;
  /** Overrides the heading text (defaults to the category's own name). */
  title?: string;
};

// The "title + count + list of article cards" body shared by /wiki/$categorySlug
// and /news - deliberately excludes the breadcrumb, since that trail differs
// between the two (and /news doesn't show one at all).
export const WikiCategoryPageList = ({ category, pages, isLoading, basePath, title }: WikiCategoryPageListProps) => {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="text" width="40%" height={48} />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Box>
    );
  }

  if (!category) {
    return <Typography color="error.main">Category not found.</Typography>;
  }

  return (
    <>
      <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' }, mb: 1 }}>
        {title ?? category.name}
      </Typography>
      <Typography color="text.disabled" sx={{ mb: 4 }}>
        {pages.length} page{pages.length !== 1 ? 's' : ''}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {pages.map((page) => (
          <Link key={page.id} to={`${basePath}/${page.slug}` as any} style={{ textDecoration: 'none', display: 'block' }}>
            <PageCard>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <ArticleIcon sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>{page.title}</Typography>
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
  );
};

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
