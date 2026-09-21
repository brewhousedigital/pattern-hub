import { Link } from '@tanstack/react-router';
import type { TypeWikiCategory, TypeWikiPage } from '@/functions/database/wiki';
import { WikiPageDate } from '@/components/wiki/WikiPageDate';
import { createMarkdownSnippet } from '@/functions/utilities/markdown-snippet';

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
  /** "news" shows each page as a larger card with an accent bar. The default is "wiki". */
  variant?: 'wiki' | 'news';
};

// The "title + count + list of article cards" body shared by /wiki/$categorySlug
// and /news - deliberately excludes the breadcrumb, since that trail differs
// between the two (and /news doesn't show one at all). /news uses the larger
// "news" card. Each card shows a plain-text teaser of the page (no markdown syntax).
export const WikiCategoryPageList = ({
  category,
  pages,
  isLoading,
  basePath,
  title,
  variant = 'wiki',
}: WikiCategoryPageListProps) => {
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

      {/* Card text sets its color with sx. The Typography "color" prop does not accept "text.secondary"
          in MUI 9, so text with no color takes the blue link color of the <a> around the card. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: variant === 'news' ? 2.5 : 1.5 }}>
        {pages.map((page) => (
          <Link key={page.id} to={`${basePath}/${page.slug}` as any} style={{ textDecoration: 'none', display: 'block' }}>
            {variant === 'news' ? (
              <NewsCard>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <WikiPageDate value={page.display_date} />
                    <Typography component="h2" variant="h6" sx={{ color: 'text.primary', mb: 0.75 }}>
                      {page.title}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>{createMarkdownSnippet(page.content)}</Typography>
                  </Box>
                  <ChevronRightIcon sx={{ color: 'primary.main', flexShrink: 0 }} />
                </Box>
              </NewsCard>
            ) : (
              <PageCard>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <ArticleIcon sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>{page.title}</Typography>
                    <WikiPageDate value={page.display_date} variant="muted" />
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineClamp: 2 }}>
                      {createMarkdownSnippet(page.content)}
                    </Typography>
                  </Box>
                  <ChevronRightIcon sx={{ color: 'text.disabled', mt: 0.25, flexShrink: 0 }} />
                </Box>
              </PageCard>
            )}
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

// Larger card for /news. The accent bar on the left edge is a pseudo-element,
// so the rounded corners of the card clip it.
const NewsCard = styled(Box)(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  padding: theme.spacing(2.5, 3, 2.5, 3.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  boxShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.06)}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
    backgroundColor: theme.palette.primary.main,
  },
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: alpha(theme.palette.primary.main, 0.35),
    boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': { transform: 'none' },
  },
}));
