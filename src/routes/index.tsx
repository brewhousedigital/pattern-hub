import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { useGlobalSearch, useGlobalReadyToSearch } from '@/data/search';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader.tsx';
import { MainPageContent } from '@/components/MainPageContent';
import { buildUpdatedTerm } from '@/functions/utilities/search-build-updated-terms';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import type { TypeTagObject } from '@/functions/types/types';
import { SidebarList, SidebarCategoryTitle } from '@/components/layout/Sidebar.tsx';
import { useGlobalIsViewOpen, useGlobalViewData } from '@/data/view';
import { ViewDrawer } from '@/components/ViewDrawer';
import { PRIMARY_COLOR } from '@/data/constants';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { PaginationBox } from '@/components/PaginationBox';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

import { Box, useTheme, useMediaQuery, Fade, SwipeableDrawer } from '@mui/material';

type PatternSearch = {
  q?: string;
  view?: string;
};

export const Route = createFileRoute('/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): PatternSearch => {
    return {};
  },
  head: () => ({
    meta: [{ title: 'Home - Pattern Archive' }],
  }),
});

function RouteComponent() {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { setViewData } = useGlobalViewData();

  const { view } = Route.useSearch();

  const { isSidebarOpen, handleOpenMobileSidebar, handleCloseMobileSidebar } = useGlobalIsSidebarOpen();

  const { isViewOpen, handleOpenView, handleCloseView } = useGlobalIsViewOpen();

  const [patternPageNumber, setPatternPageNumber] = React.useState(1);

  const { readyToSearchTerm } = useGlobalReadyToSearch();

  const { isPending, isFetching, isError, data } = useQueryGetAllPatternsByPagination(
    readyToSearchTerm,
    patternPageNumber,
  );

  // On site load, check if the user already had a pattern in view
  React.useEffect(() => {
    if (view && data) {
      const pattern = data.items.find((item) => item.id === view);

      if (pattern) {
        setViewData(pattern);
        handleOpenView();
      }
    }
  }, [data]);

  return (
    <GeneralLayout>
      <Box>
        <Fade in={isFetching}>
          <Box>
            <FullScreenLoader />
          </Box>
        </Fade>

        <SwipeableDrawer
          anchor="right"
          open={isSidebarOpen}
          onClose={handleCloseMobileSidebar}
          onOpen={handleOpenMobileSidebar}
        >
          <SidebarBlock isPending={isPending} isError={isError} data={data} />
        </SwipeableDrawer>

        <Box sx={ContainerStyles}>
          {isMediumSizeAndUp && <SidebarBlock isPending={isPending} isError={isError} data={data} />}

          <Box
            sx={{
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
            }}
          >
            <MainPageContent isPending={isPending} isError={isError} data={data?.items} />

            <PaginationBox data={data} value={patternPageNumber} setter={setPatternPageNumber} />
          </Box>
        </Box>

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
      </Box>
    </GeneralLayout>
  );
}

type SidebarBlockProps = {
  isPending: boolean;
  isError: boolean;
  data: TypePaginationDatabaseResponse<TypePatternResponse> | undefined;
};

const SidebarBlock = (props: SidebarBlockProps) => {
  const { setSearchTerm } = useGlobalSearch();
  const { setReadyToSearchTerm } = useGlobalReadyToSearch();

  // Generate the list of tags based on the API Query
  const dataTags =
    props.data?.items
      ?.map((item) => {
        const tags = item.tags.split(',');
        return tags.map((tag) => tag.trim().toLowerCase());
      })
      .flat() || [];

  const tagCounts = dataTags
    .reduce<TypeTagObject[]>((acc, tag) => {
      const existing = acc.find((item) => item.tag === tag);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ tag, count: 1 });
      }
      return acc;
    }, [])
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const syncTerms = (tag: string, prefix = '') => {
    const updater = (prev: string) => buildUpdatedTerm(prev, tag, prefix);
    setSearchTerm(updater);
    setReadyToSearchTerm(updater);
  };

  const handleTagClickAdd = (tag: string) => syncTerms(tag);
  const handleTagClickRemove = (tag: string) => syncTerms(tag, '-');

  return (
    <Box>
      <SidebarCategoryTitle title="Current Page Tags" />

      <SidebarList
        isPending={props.isPending}
        isError={props.isError}
        data={tagCounts}
        handleClickAdd={handleTagClickAdd}
        handleClickRemove={handleTagClickRemove}
      />
    </Box>
  );
};

const ContainerStyles = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
  gap: 0,
};
