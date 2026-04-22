import React from 'react';
import type { TypeTagObject } from '@/functions/types/types';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';

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

type SidebarListProps = {
  tagList?: string[];
  handleClose?: () => void;
};

export const SidebarList = (props: SidebarListProps) => {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const { isPending, isError, data } = useQueryGetAllPatternsByPagination();

  const { isTagActive } = usePatternSearch();

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
    .sort((a, b) => a.tag.localeCompare(b.tag))
    .sort((a, b) => b.count - a.count);

  const passThroughDataTags =
    props?.tagList?.map((tag) => tag.trim().toLowerCase()).filter((tag) => !isTagActive(tag)) || [];

  const passThroughDataTagCounts = passThroughDataTags
    .reduce<TypeTagObject[]>((acc, tag) => {
      const existing = acc.find((item) => item.tag === tag);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ tag, count: 0 });
      }
      return acc;
    }, [])
    .sort((a, b) => a.tag.localeCompare(b.tag))
    .sort((a, b) => b.count - a.count);

  return (
    <List
      disablePadding
      sx={{
        minWidth: 250,
        maxWidth: isMediumSizeAndUp ? '100%' : 250,
      }}
    >
      {isPending && <SkeletonLink />}

      {isError && <Alert severity="error">Unable to load this category</Alert>}

      {!props?.tagList &&
        tagCounts &&
        tagCounts?.map((thisTag) => {
          return <TagListItem data={thisTag} key={`sidebar-link-${thisTag.tag}`} />;
        })}

      {props?.tagList &&
        passThroughDataTagCounts?.map((thisTag) => {
          return <TagListItem data={thisTag} key={`sidebar-link-${thisTag.tag}`} handleClose={props.handleClose} />;
        })}
    </List>
  );
};

type TagListItemProps = {
  data: TypeTagObject;
  handleClose?: () => void;
};

const TagListItem = (props: TagListItemProps) => {
  const { addTag, setPatternId } = usePatternSearch();

  const handleAddTag = (tag: string) => {
    addTag(tag);

    if (props?.handleClose) {
      setPatternId(undefined);
      props?.handleClose();
    }
  };

  const handleRemoveTag = (tag: string) => {
    addTag(tag, true);

    if (props?.handleClose) {
      setPatternId(undefined);
      props?.handleClose();
    }
  };

  return (
    <ListItem
      sx={{ textTransform: 'capitalize', paddingRight: '94px' }}
      secondaryAction={
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Box>
            <IconButton size="small" onClick={() => handleAddTag(props.data.tag)}>
              <AddRoundedIcon />
            </IconButton>
          </Box>

          <Box>
            <IconButton size="small" onClick={() => handleRemoveTag(props.data.tag)}>
              <RemoveRoundedIcon />
            </IconButton>
          </Box>
        </Stack>
      }
    >
      {props.data.count ? (
        <ListItemText primary={`${props.data.tag} (${props.data.count})`} />
      ) : (
        <ListItemText primary={`${props.data.tag}`} />
      )}
    </ListItem>
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

const sidebarBlockStyles = {
  height: '100%',
  maxHeight: '100svh',
  overflowY: 'auto',
  position: 'sticky',
  top: 0,
  scrollbarWidth: 'none',
};

export const SidebarBlock = () => {
  return (
    <Box sx={sidebarBlockStyles}>
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

export const ViewDrawerPatternSidebar = (props: SidebarListProps) => {
  return (
    <Box sx={sidebarBlockStyles}>
      <SidebarCategoryTitle title="Current Pattern Tags" />

      <SidebarList tagList={props.tagList} handleClose={props.handleClose} />
    </Box>
  );
};
