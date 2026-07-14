import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  getHomepageDefaultPatternsOptions,
  getPatternByIdOptions,
  useQueryGetAllPatternsByPagination,
} from '@/functions/database/patterns';
import { MainPageContent } from '@/components/MainPageContent';
import { MobileSidebarBlock, SidebarBlock } from '@/components/layout/Sidebar';
import { useGlobalIsViewOpen } from '@/data/view';
import { ViewDrawer } from '@/components/ViewDrawer';
import { PRIMARY_COLOR } from '@/data/constants';
import { PaginationBox } from '@/components/PaginationBox';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { generatePbImageOpenGraph } from '@/functions/utilities/generate-pb-image';
import { stripMarkdown, truncate } from '@/functions/utilities/strip-markdown';
import { patternSearchSchema } from '@/functions/utilities/search-v2';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { usePatternViewData } from '@/functions/hooks/usePatternView';
import { HomepageSearchV3 } from '@/components/layout/HomepageSearchV3.tsx';

import { Box, Typography, Fade, SwipeableDrawer, LinearProgress } from '@mui/material';
import { visuallyHidden } from '@mui/utils';

export const Route = createFileRoute('/pattern/')({
  component: RouteComponent,
  validateSearch: patternSearchSchema,
  loaderDeps: ({ search }) => ({ patternId: search.patternId }),
  // Prefetches the default grid; when a pattern is shared via ?patternId=…
  // (the view drawer), also loads it so the head() below can emit its meta
  // tags server-side (this replaced the og-meta edge function).
  loader: async ({ deps, context }) => {
    const defaultPatterns = context.queryClient
      .ensureQueryData(getHomepageDefaultPatternsOptions())
      .catch(() => undefined);
    const sharedPattern = deps.patternId
      ? context.queryClient.ensureQueryData(getPatternByIdOptions(deps.patternId)).catch(() => undefined)
      : undefined;
    const [, shared] = await Promise.all([defaultPatterns, sharedPattern]);
    return shared;
  },
  head: ({ loaderData, match }) =>
    loaderData
      ? generateSEO(
          loaderData.name,
          loaderData.description ? truncate(stripMarkdown(loaderData.description), 160) : '',
          `/pattern/${loaderData.id}`,
          loaderData.opengraph_image ? generatePbImageOpenGraph(loaderData) : undefined,
        )
      : generateSEO('Browse Patterns', 'Browse and search hundreds of free stained glass patterns.', match.pathname),
});

function RouteComponent() {
  const { patternId, pageNumber, setPageNumber } = usePatternSearch();
  const { handleOpenView } = useGlobalIsViewOpen();

  // Get the pattern data
  const { isFetching, isError, data } = useQueryGetAllPatternsByPagination();

  // Open the drawer when a shared/deep link lands with ?patternId= and data is
  // ready. handleOpenView is idempotent (setting an already-true atom is a
  // no-op), so no isViewOpen guard is needed - and reading isViewOpen here
  // would re-open the drawer mid-close (patternId is cleared 300ms after
  // isViewOpen flips false, see ViewDrawerContainer's handleClose).
  React.useEffect(() => {
    if (data && patternId) {
      handleOpenView();
    }
  }, [data, patternId, handleOpenView]);

  return (
    <GeneralLayout>
      <Typography variant="h1" sx={visuallyHidden}>
        Stained Glass Pattern Archive — Browse and Download Patterns
      </Typography>

      {/* viewTransitionName pairs with the homepage hero search bar - browsers
          with the View Transitions API morph between them on navigation */}
      <Box sx={{ px: 2, mb: 2, viewTransitionName: 'pattern-search' }}>
        <HomepageSearchV3 />
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Fade in={isFetching}>
          <Box sx={{ position: 'absolute', top: -9, left: 0, zIndex: 100, width: '100%' }}>
            <LinearProgress variant="indeterminate" />
          </Box>
        </Fade>

        <MobileSidebarBlock />

        <Box sx={ContainerStyles}>
          {/* Hidden via CSS rather than useMediaQuery: the media query is false
              during SSR/first render, which left the sidebar column empty until
              hydration. CSS lets the server render the sidebar for desktop. */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <SidebarBlock />
          </Box>

          <Box sx={mainContentStyles}>
            <MainPageContent />

            <PaginationBox data={data} value={pageNumber} setter={setPageNumber} />
          </Box>
        </Box>

        <ViewDrawerContainer />
      </Box>
    </GeneralLayout>
  );
}

const mainContentStyles = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  p: 3,
  mr: 2,
  mb: 2,
  ml: { xs: 2, md: 0 },
  backgroundColor: PRIMARY_COLOR,
  borderRadius: 6,
  minHeight: 'calc(100svh - 104px)',
};

const ViewDrawerContainer = () => {
  // Pattern View Drawer
  const { isViewOpen, handleOpenView, handleCloseView } = useGlobalIsViewOpen();

  const { setPatternId, patternId } = usePatternSearch();

  const { viewData, isPending } = usePatternViewData(patternId);

  const handleClose = () => {
    handleCloseView();

    setTimeout(() => {
      setPatternId(undefined);
    }, 300);
  };

  return (
    <SwipeableDrawer
      transitionDuration={300}
      anchor="bottom"
      open={isViewOpen}
      onClose={handleClose}
      onOpen={handleOpenView}
      sx={{
        '& > .MuiPaper-root': {
          maxHeight: '95svh',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
      }}
    >
      <ViewDrawer viewData={viewData} handleClose={handleClose} isLoading={isPending} />
    </SwipeableDrawer>
  );
};

const ContainerStyles = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
  gap: 0,
  alignItems: 'start',
};
