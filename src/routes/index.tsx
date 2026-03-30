import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { useGlobalSearchPagination } from '@/data/search';
import { MainPageContent } from '@/components/MainPageContent';
import { MobileSidebarBlock, SidebarBlock } from '@/components/layout/Sidebar';
import { useGlobalIsViewOpen } from '@/data/view';
import { ViewDrawer } from '@/components/ViewDrawer';
import { PRIMARY_COLOR } from '@/data/constants';
import { PaginationBox } from '@/components/PaginationBox';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { patternSearchSchema } from '@/functions/utilities/search-v2';
import { HomepageSearchV2 } from '@/components/layout/HomepageSearchV2';

import { Box, useTheme, useMediaQuery, Fade, SwipeableDrawer, LinearProgress } from '@mui/material';

export const Route = createFileRoute('/')({
  component: RouteComponent,
  validateSearch: patternSearchSchema,
  head: () => ({
    meta: generateSEO(),
  }),
});

function RouteComponent() {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  // Pagination
  const { page, setPage } = useGlobalSearchPagination();

  // Get the pattern data
  const { isFetching, isError, data } = useQueryGetAllPatternsByPagination();

  return (
    <GeneralLayout>
      <Box sx={{ px: 2, mb: 2 }}>
        <HomepageSearchV2 />
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Fade in={isFetching}>
          <Box sx={{ position: 'absolute', top: -9, left: 0, zIndex: 100, width: '100%' }}>
            <LinearProgress variant="indeterminate" />
          </Box>
        </Fade>

        <MobileSidebarBlock />

        <Box sx={ContainerStyles}>
          {isMediumSizeAndUp && <SidebarBlock />}

          <Box sx={mainContentStyles}>
            <MainPageContent />

            <PaginationBox data={data} value={page} setter={setPage} />
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

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isViewOpen}
      onClose={handleCloseView}
      onOpen={handleOpenView}
      sx={{
        '& > .MuiPaper-root': {
          maxHeight: '95svh',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
      }}
    >
      <ViewDrawer />
    </SwipeableDrawer>
  );
};

const ContainerStyles = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
  gap: 0,
};
