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
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  useTheme,
  useMediaQuery,
  Drawer,
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
    <Box
      sx={{
        minWidth: 250,
        maxWidth: isMediumSizeAndUp ? '100%' : 250,
        px: 1,
        pb: 2,
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
    </Box>
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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 2,
        transition: 'background-color 0.14s',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      {/* Tag label */}
      <Box
        component="button"
        onClick={() => handleAddTag(props.data.tag)}
        sx={{
          flex: 1,
          minWidth: 0,
          background: 'none',
          border: 'none',
          p: 0,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'baseline',
          gap: 0.75,
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ textTransform: 'capitalize', fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary' }}
        >
          {props.data.tag}
        </Typography>

        {!!props.data.count && (
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
            {props.data.count}
          </Typography>
        )}
      </Box>

      {/* Include / Exclude buttons */}
      <Stack direction="row" sx={{ flexShrink: 0, gap: 0.25 }}>
        <Tooltip title={`Include "${props.data.tag}"`} arrow>
          <IconButton
            size="small"
            onClick={() => handleAddTag(props.data.tag)}
            sx={{
              p: { xs: 1.5, md: 0.5 },
              color: 'success.main',
              '&:hover': { backgroundColor: 'success.main', color: 'success.contrastText' },
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={`Exclude "${props.data.tag}"`} arrow>
          <IconButton
            size="small"
            onClick={() => handleRemoveTag(props.data.tag)}
            sx={{
              p: { xs: 1.5, md: 0.5 },
              color: 'error.main',
              '&:hover': { backgroundColor: 'error.main', color: 'error.contrastText' },
            }}
          >
            <RemoveRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
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
    <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
      <Typography
        variant="overline"
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'text.disabled',
          lineHeight: 1,
        }}
      >
        {props.title}
      </Typography>
    </Box>
  );
};

// 56 px = approximate sticky header height; sidebar scrolls independently below it
const HEADER_HEIGHT = 0;

const sidebarBlockStyles = {
  overflowY: 'auto',
  position: 'sticky',
  top: HEADER_HEIGHT,
  height: `calc(100svh - ${HEADER_HEIGHT}px)`,
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
};

// Used inside drawers where there is no sticky app header to account for
const drawerSidebarBlockStyles = {
  overflowY: 'auto',
  height: '100%',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
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
  const { isSidebarOpen, handleCloseMobileSidebar } = useGlobalIsSidebarOpen();

  return (
    <Drawer anchor="right" open={isSidebarOpen} onClose={handleCloseMobileSidebar}>
      <SidebarBlock />
    </Drawer>
  );
};

export const ViewDrawerPatternSidebar = (props: SidebarListProps) => {
  return (
    <Box sx={drawerSidebarBlockStyles}>
      <SidebarCategoryTitle title="Current Pattern Tags" />

      <SidebarList tagList={props.tagList} handleClose={props.handleClose} />
    </Box>
  );
};
