import type { TypeWikiPage } from '@/functions/database/wiki';
import { WikiMarkdownWrapper } from '@/components/wiki/WikiMarkdownWrapper';
import { WikiTableOfContents } from '@/components/wiki/WikiTableOfContents';

import { styled } from '@mui/material/styles';
import { Box, Skeleton, Typography } from '@mui/material';

type WikiPageContentProps = {
  page: TypeWikiPage | undefined;
  isLoading: boolean;
  isError: boolean;
  /** All wiki pages, for resolving [[wiki-link]] references inside the content. */
  allPages: TypeWikiPage[];
};

// The "title + last-updated + markdown body + sticky TOC" layout shared by
// /wiki/$categorySlug/$pageSlug and /news/$pageSlug - deliberately excludes the
// breadcrumb (and its JSON-LD), since that trail differs between the two.
export const WikiPageContent = ({ page, isLoading, isError, allPages }: WikiPageContentProps) => {
  if (isError) {
    return <Typography color="error.main">Page not found.</Typography>;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 6 }}>
        <Box>
          <Skeleton variant="text" width="60%" height={56} sx={{ mb: 2 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="text" width={`${70 + (i % 3) * 10}%`} height={24} sx={{ mb: 0.5 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={200} />
      </Box>
    );
  }

  if (!page) return null;

  return (
    <ContentGrid>
      {/* Main content */}
      <Box>
        <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 0.75, color: 'text.primary' }}>
          {page.title}
        </Typography>

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 4 }}>
          Last updated{' '}
          {new Date(page.updated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Typography>

        <WikiMarkdownWrapper wikiPages={allPages}>{page.content}</WikiMarkdownWrapper>
      </Box>

      {/* Sticky TOC sidebar */}
      <Box>
        <WikiTableOfContents markdown={page.content} />
      </Box>
    </ContentGrid>
  );
};

const ContentGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(6),
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: '1fr 220px',
  },
}));
