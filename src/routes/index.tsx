import React from 'react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useGlobalSearch, useGlobalReadyToSearch } from '@/data/search';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { MainPageContent } from '@/components/MainPageContent';
import { buildUpdatedTerm } from '@/functions/utilities/searchBuildUpdatedTerms';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import type { TypeTagObject } from '@/functions/types/types';
import { SidebarList, SidebarCategoryTitle } from '@/components/Sidebar';
import { useGlobalIsViewOpen, useGlobalViewData } from '@/data/view';
import { ViewDrawer } from '@/components/ViewDrawer';
import { PRIMARY_COLOR } from '@/data/constants';

import { Box, Pagination, Stack, useTheme, useMediaQuery, Fade, SwipeableDrawer } from '@mui/material';

type PatternSearch = {
  q?: string;
  view?: string;
};
export const Route = createFileRoute('/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): PatternSearch => {
    return {};
  },
});

function RouteComponent() {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { setViewData } = useGlobalViewData();

  const navigate = useNavigate();

  const { view } = useSearch({ from: '/' });

  const { isSidebarOpen, handleOpenMobileSidebar, handleCloseMobileSidebar } = useGlobalIsSidebarOpen();

  const { isViewOpen, handleOpenView, handleCloseView } = useGlobalIsViewOpen();

  const [patternPageNumber, setPatternPageNumber] = React.useState(1);
  const handleChangePage = (event: React.ChangeEvent<unknown>, value: number) => {
    setPatternPageNumber(value);
  };

  const { searchTerm, setSearchTerm } = useGlobalSearch();
  const { readyToSearchTerm, setReadyToSearchTerm } = useGlobalReadyToSearch();
  const debouncedSearchTerm = useDebounce(searchTerm, 600);

  React.useEffect(() => {
    setReadyToSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  // When the search term is updated, push it to the URL
  React.useEffect(() => {
    if (readyToSearchTerm) {
      navigate({
        to: '/',
        search: (prev) => ({ ...prev, q: readyToSearchTerm }),
      }).then();
    }
  }, [readyToSearchTerm]);

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

  // Generate the list of tags based on the API Query
  const dataTags =
    data?.items
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

  const SidebarBlock = () => {
    return (
      <Box>
        <SidebarCategoryTitle title="Current Page Tags" />

        <SidebarList
          isPending={isPending}
          isError={isError}
          data={tagCounts}
          handleClickAdd={handleTagClickAdd}
          handleClickRemove={handleTagClickRemove}
        />
      </Box>
    );
  };

  return (
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
        <SidebarBlock />
      </SwipeableDrawer>

      <Box sx={ContainerStyles}>
        {isMediumSizeAndUp && <SidebarBlock />}

        <Box sx={{ p: 3, mr: 2, mb: 2, backgroundColor: PRIMARY_COLOR, borderRadius: 6 }}>
          <MainPageContent isPending={isPending} isError={isError} data={data?.items} />

          <Stack
            sx={{
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              py: 2,
              mt: 4,
              borderRadius: 6,
            }}
          >
            <Pagination
              count={data?.totalPages || 0}
              variant="outlined"
              color="primary"
              sx={{ mx: 'auto' }}
              page={patternPageNumber}
              onChange={handleChangePage}
            />
          </Stack>
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
  );
}

const ContainerStyles = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
  gap: 0,
};
