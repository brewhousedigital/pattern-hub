import React from 'react';
import type { TypeTagObject } from '@/functions/types/types';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';

import {
  Box,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Stack,
  IconButton,
  Alert,
  useTheme,
  useMediaQuery,
  SwipeableDrawer,
} from '@mui/material';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';

const SidebarList = () => {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { isPending, isError, data } = useQueryGetAllPatternsByPagination();

  const { isTagActive, addTag } = usePatternSearch();

  // Generate the list of tags based on the API Query
  const dataTags =
    data?.items
      ?.map((item) => {
        const tags = item.tags;
        return tags.map((tag) => tag.trim().toLowerCase());
      })
      .flat()
      .filter((tag) => !isTagActive(tag)) || [];

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

  const handleAddTag = (tag: string) => {
    addTag(tag);
  };

  const handleRemoveTag = (tag: string) => {
    addTag(tag, true);
  };

  return (
    <List
      disablePadding
      sx={{
        minWidth: 250,
        maxWidth: isMediumSizeAndUp ? '100%' : 250,
        maxHeight: isMediumSizeAndUp ? 'calc(100svh - 136px)' : 'calc(100svh - 50px)',
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {isPending && <SkeletonLink />}

      {isError && <Alert severity="error">Unable to load this category</Alert>}

      {tagCounts &&
        tagCounts?.map((thisTag) => {
          return (
            <ListItem
              key={`sidebar-link-${thisTag.tag}`}
              sx={{ textTransform: 'capitalize', paddingRight: '94px' }}
              secondaryAction={
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <Box>
                    <IconButton size="small" onClick={() => handleAddTag(thisTag.tag)}>
                      <AddRoundedIcon />
                    </IconButton>
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => handleRemoveTag(thisTag.tag)}>
                      <RemoveRoundedIcon />
                    </IconButton>
                  </Box>
                </Stack>
              }
            >
              <ListItemText primary={`${thisTag.tag} (${thisTag.count})`} />
            </ListItem>
          );
        })}
    </List>
  );
};

const SkeletonLink = () => {
  return (
    <Stack sx={{ spacing: 2, px: 2 }}>
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
    </Stack>
  );
};

type SidebarCategoryTitleProps = {
  title: string;
};

export const SidebarCategoryTitle = (props: SidebarCategoryTitleProps) => {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
      }}
    >
      <Typography color="primary" sx={{ fontWeight: 600 }}>
        {props.title}
      </Typography>
    </Stack>
  );
};

export const SidebarBlock = () => {
  return (
    <Box>
      <SidebarCategoryTitle title="Current Page Tags" />

      <SidebarList />
    </Box>
  );
};

export const MobileSidebarBlock = () => {
  // Sidebar
  const { isSidebarOpen, handleOpenMobileSidebar, handleCloseMobileSidebar } = useGlobalIsSidebarOpen();

  return (
    <SwipeableDrawer
      anchor="right"
      open={isSidebarOpen}
      onClose={handleCloseMobileSidebar}
      onOpen={handleOpenMobileSidebar}
    >
      <SidebarBlock />
    </SwipeableDrawer>
  );
};
