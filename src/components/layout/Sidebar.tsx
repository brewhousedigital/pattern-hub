import React from 'react';
import type { TypeTagObject } from '@/functions/types/types';
import { useGlobalIsSidebarOpen } from '@/data/sidebar';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { useQueryGetAllTagsV2, useQueryGetAllTagTypes } from '@/functions/database/tags';
import { getTagType, isDefaultTagType, type TypeTagGroup } from '@/functions/utilities/group-tags-by-type';
import { BlockedTagsBanner } from '@/components/BlockedTagsBanner';

// color is set for a 'tag' item with a real (non-default) Type that has a
// color configured, and now also for an 'author' item derived from a real
// tagFacets id (an Author-typed tag has a Type - its own color) - only the
// name-only fallback derivation (see mixedItems below) has no id to resolve
// a Type/color from at all.
type SidebarItem = { kind: 'tag' | 'author'; label: string; count: number; color?: string | null };

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';

import { Box, Skeleton, Typography, Stack, IconButton, Tooltip, Alert, Drawer } from '@mui/material';

type SidebarListProps = {
  /** Each tag's Type color already resolved by the caller (see ViewDrawerPatternSidebar) - id-based upstream, so no name-collision risk. */
  tagList?: { tag: string; color?: string | null }[];
  handleClose?: () => void;
};

export const SidebarList = (props: SidebarListProps) => {
  const { isPending, isError, data } = useQueryGetAllPatternsByPagination();

  const { isTagActive, tokens } = usePatternSearch();

  // Per-tag color accent, resolved from each tag's Type below via
  // getTagType(tagId, tagsV2) - id-based, so it's exact even when a name is
  // shared across types. Sidebar always loads tagsV2 anyway (HomepageSearchV3,
  // co-rendered on /pattern, needs the same full list for its own chip
  // coloring - React Query dedupes both calls to one fetch under the shared
  // query key), so this and the author-type check below both resolve
  // straight off it - no separate fetch needed for either.
  const { data: tagsV2 = [] } = useQueryGetAllTagsV2();

  // ── Pass-through tags (drawer mode) ──────────────────────────────────────
  // Each entry already carries its Type's color, resolved upstream in
  // ViewDrawer.tsx (via groupTagsByType, which matches by id against the
  // pattern's own tag_refs - precise, no name-collision risk) and threaded
  // through by ViewDrawerPatternSidebar below. Re-deriving it here by name
  // used to require its own tagsV2 name-scan, which could silently pick the
  // wrong row when two tags_v2 rows share a name under different types.
  const passThroughDataTagCounts = (props?.tagList ?? [])
    .map((t) => ({ tag: t.tag.trim().toLowerCase(), color: t.color }))
    //.filter((tag) => !isTagActive(tag))
    .reduce<TypeTagObject[]>((acc, t) => {
      const existing = acc.find((item) => item.tag === t.tag);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ tag: t.tag, count: 0, color: t.color });
      }
      return acc;
    }, [])
    .sort((a, b) => a.tag.localeCompare(b.tag))
    .sort((a, b) => b.count - a.count);

  // ── Mixed tags + authors (homepage mode) ─────────────────────────────────
  const isAuthorActive = (author: string) =>
    tokens.some((t) => t.type === 'author' && t.value === author && !t.exclude);

  // Tag counts come from the server's tagFacets - accurate across the whole
  // filtered result set, not just this page (see useQueryGetAllPatternsByPagination).
  // Author counts still come from the current page only; that's a known,
  // separate gap left out of this pass - see the note on useQueryGetAllPatternsByPagination.
  const facetTagNames = new Set((data?.tagFacets ?? []).map((f) => f.tag.toLowerCase()));

  // Now that Author-typed tags are correctly cascaded into tag_refs, a
  // tagFacets entry can itself be an Author-typed tag (e.g. "spectrum
  // glass"). MixedListItem's click handlers route purely on `kind` -
  // addAuthor/setOnlyAuthor for 'author', addTag/setOnlyTag for 'tag' - so a
  // facet left at 'tag' here would search it as a plain tag/text token
  // instead of an author: token, reintroducing the exact "same name, wrong
  // type" ambiguity the dedicated author: token exists to avoid (see
  // pb_hooks/main.pb.js's buildPatternFilters, the `t.type === 'author'`
  // branch's own comment).
  //
  // Resolved from the tag_types list (tiny, 7 rows) rather than
  // useQueryAuthorTagIds - that hook's own value comes from a SECOND,
  // separate tags_v2 fetch filtered to just the Author type, which is
  // redundant here: tagsV2 above already has every row, so the same
  // getTagType() lookup used for color below tells us the Type directly.
  const { data: tagTypes = [] } = useQueryGetAllTagTypes();
  const authorTypeId = tagTypes.find((t) => t.name === 'Author')?.id;

  const mixedItems: SidebarItem[] = !props?.tagList
    ? [
        ...(data?.tagFacets ?? [])
          // This will hide the currently searched tag
          // Enable this if we ever need it in the future
          //.filter((f) => !isTagActive(f.tag))
          .map((f): SidebarItem => {
            const type = getTagType(f.tagId, tagsV2);
            return {
              kind: type?.id === authorTypeId ? 'author' : 'tag',
              label: f.tag,
              count: f.count,
              color: isDefaultTagType(type) ? null : (type?.color ?? null),
            };
          }),
        ...(data?.items ?? [])
          .flatMap((item) => [
            ...(item.expand?.authors?.map((a) => a.name).filter((n): n is string => Boolean(n)) ?? []),
            ...(item.author_manual ?? []),
          ])
          .filter((name) => !isAuthorActive(name))
          // Author-typed tags are now correctly cascaded into tag_refs (see
          // pb_hooks/main.pb.js's /api/sync-author-tags fix), so an author
          // already counted server-side via tagFacets above needs no
          // separate "Author: X" entry - deriving one here was previously
          // the ONLY way an author ever showed up in this list, back when
          // the cascade bug meant most authors' tag_refs were never actually
          // populated. Kept as a fallback rather than removed outright, for
          // the narrow window before a brand-new credit's next sync run.
          .filter((name) => !facetTagNames.has(name.toLowerCase()))
          .reduce<SidebarItem[]>((acc, name) => {
            const existing = acc.find((x) => x.kind === 'author' && x.label === name);
            if (existing) existing.count++;
            else acc.push({ kind: 'author', label: name, count: 1 });
            return acc;
          }, []),
      ]
        .sort((a, b) => a.label.localeCompare(b.label))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <Box
      sx={{
        minWidth: 250,
        // CSS instead of useMediaQuery so SSR renders the correct width
        maxWidth: { xs: 250, md: '100%' },
        px: 1,
        pb: 2,
      }}
    >
      {isPending && <SkeletonLink />}

      {isError && <Alert severity="error">Unable to load this category</Alert>}

      {!props?.tagList &&
        mixedItems.map((item) => <MixedListItem item={item} key={`sidebar-${item.kind}-${item.label}`} />)}

      {props?.tagList &&
        passThroughDataTagCounts.map((thisTag) => (
          <TagListItem
            data={thisTag}
            color={thisTag.color}
            key={`sidebar-link-${thisTag.tag}`}
            handleClose={props.handleClose}
          />
        ))}
    </Box>
  );
};

type TagListItemProps = {
  data: TypeTagObject;
  /** This tag's Type color, or null/undefined for the default type - resolved by the caller (see SidebarList's passThroughDataTagCounts / mixedItems). */
  color?: string | null;
  handleClose?: () => void;
};

const TagListItem = (props: TagListItemProps) => {
  const { addTag, setOnlyTag, setPatternId } = usePatternSearch();

  // Clicking the tag label itself replaces the whole search with just this
  // tag (product decision) - the separate +/- icon buttons stay
  // additive/subtractive via handleAddTag/handleRemoveTag below.
  const handleSetOnlyTag = (tag: string) => {
    setOnlyTag(tag);
    if (props?.handleClose) {
      setPatternId(undefined);
      props?.handleClose();
    }
  };

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
        onClick={() => handleSetOnlyTag(props.data.tag)}
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
          sx={{
            textTransform: 'capitalize',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: props.color || 'text.primary',
          }}
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

type MixedListItemProps = {
  item: SidebarItem;
};

const MixedListItem = ({ item }: MixedListItemProps) => {
  const { addTag, addAuthor, setOnlyTag, setOnlyAuthor } = usePatternSearch();

  const handleInclude = () => (item.kind === 'author' ? addAuthor(item.label) : addTag(item.label));
  const handleExclude = () => (item.kind === 'author' ? addAuthor(item.label, true) : addTag(item.label, true));
  // Clicking the label replaces the whole search with just this tag/author
  // (same product decision as TagListItem) - the +/- icon buttons above stay
  // additive/subtractive via handleInclude/handleExclude.
  const handleSetOnly = () => (item.kind === 'author' ? setOnlyAuthor(item.label) : setOnlyTag(item.label));

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
      <Box
        component="button"
        onClick={handleSetOnly}
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
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: item.color || 'text.primary',
            textTransform: item.kind === 'tag' ? 'capitalize' : 'none',
          }}
        >
          {item.label}
        </Typography>

        <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
          {item.count}
        </Typography>
      </Box>

      <Stack direction="row" sx={{ flexShrink: 0, gap: 0.25 }}>
        <Tooltip title={`Include "${item.label}"`} arrow>
          <IconButton
            size="small"
            onClick={handleInclude}
            sx={{
              p: { xs: 1.5, md: 0.5 },
              color: 'success.main',
              '&:hover': { backgroundColor: 'success.main', color: 'success.contrastText' },
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={`Exclude "${item.label}"`} arrow>
          <IconButton
            size="small"
            onClick={handleExclude}
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
      <BlockedTagsBanner />

      <SidebarCategoryTitle title="Current Tags" />

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

type ViewDrawerPatternSidebarProps = {
  tagGroups: TypeTagGroup[];
  handleClose?: () => void;
};

export const ViewDrawerPatternSidebar = (props: ViewDrawerPatternSidebarProps) => {
  // Default-typed groups (no Type at all, or the "General" Type) collapse
  // into one bucket under this section's existing heading, sorted first -
  // General isn't a distinct category worth its own label, it's what every
  // tag starts as. Every other Type gets its own heading below, named after
  // its group_label (falling back to the Type's own name) - the same
  // fallback rule PatternViewContent's own standalone tag block already
  // uses, so a Type reads the same wherever its tags are grouped.
  //
  // color is threaded straight from each group's already-resolved Type
  // (matched by id against this pattern's own tag_refs in ViewDrawer.tsx's
  // groupTagsByType) instead of being re-derived later by name - a default
  // group's color is always null, same as the old isDefaultTagType(type) ?
  // null : ... check this replaces.
  const defaultTags = props.tagGroups
    .filter((g) => isDefaultTagType(g.type))
    .flatMap((g) => g.tags.map((tag) => ({ tag, color: null })));
  const namedGroups = props.tagGroups.filter((g) => !isDefaultTagType(g.type));

  return (
    <Box sx={drawerSidebarBlockStyles}>
      <SidebarCategoryTitle title="Current Pattern Tags" />
      {defaultTags.length > 0 && <SidebarList tagList={defaultTags} handleClose={props.handleClose} />}

      {namedGroups.map((group) => (
        <Box key={group.type?.id ?? 'untyped'}>
          <SidebarCategoryTitle title={group.type?.group_label || group.type?.name || ''} />
          <SidebarList
            tagList={group.tags.map((tag) => ({ tag, color: group.type?.color ?? null }))}
            handleClose={props.handleClose}
          />
        </Box>
      ))}
    </Box>
  );
};
