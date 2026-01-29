import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination, type TypePatternResponse } from '@/functions/database/patterns';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Container,
  Grid,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  TextField,
  Typography,
  Pagination,
  Stack,
  CircularProgress,
  IconButton,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
} from '@mui/material';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

const BORDER_CSS = `1px solid #25424C`;

type TypeTagObject = {
  tag: string;
  count: number;
};

function RouteComponent() {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  const [patternPageNumber, setPatternPageNumber] = React.useState(1);
  const handleChangePage = (event: React.ChangeEvent<unknown>, value: number) => {
    setPatternPageNumber(value);
  };

  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 600);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const { isPending, isFetching, isError, data } = useQueryGetAllPatternsByPagination(
    debouncedSearchTerm,
    patternPageNumber,
  );
  console.log('>>>data', data);

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
  console.log('>>>tagCounts', tagCounts);

  const handleTagClickAdd = (tag: string) => {
    setSearchTerm((prev) => {
      if (prev) {
        return `${prev} ${tag}`;
      }

      return tag;
    });
  };

  const handleTagClickRemove = (tag: string) => {
    setSearchTerm((prev) => {
      if (prev) {
        return `${prev} -${tag}`;
      }

      return tag;
    });
  };

  const SidebarBlock = () => {
    return (
      <>
        <SidebarCategoryTitle title="Current Page Tags" />

        <SidebarList
          isPending={isPending}
          isError={isError}
          data={tagCounts}
          handleClickAdd={handleTagClickAdd}
          handleClickRemove={handleTagClickRemove}
        />
      </>
    );
  };

  return (
    <Box>
      <Fade in={isFetching}>
        <Stack
          sx={{
            minHeight: '100svh',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100svw',
            margin: '0 auto',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
          }}
        >
          <CircularProgress />
        </Stack>
      </Fade>

      <Box sx={{ borderBottom: BORDER_CSS, pb: 3.75 }}>
        <Container>
          <TextField
            id="homepage-search"
            fullWidth
            aria-label="Search for a Pattern"
            placeholder="Search for a pattern name, or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <SearchRoundedIcon />,
                endAdornment: (
                  <IconButton
                    type="button"
                    onClick={handleClearSearch}
                    sx={{ transition: 'opacity 300ms', opacity: searchTerm.length > 0 ? 1 : 0 }}
                  >
                    <CloseRoundedIcon />
                  </IconButton>
                ),
              },
            }}
            variant="outlined"
          />
        </Container>
      </Box>

      <Grid container>
        <Grid
          size={{ xs: 12, md: 'auto' }}
          sx={{ borderRight: BORDER_CSS, borderBottom: BORDER_CSS, minWidth: { xs: 0, md: 300 } }}
        >
          {isMediumSizeAndUp ? (
            <SidebarBlock />
          ) : (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="filters-content" id="filters-header">
                Filters
              </AccordionSummary>

              <AccordionDetails>
                <SidebarBlock />
              </AccordionDetails>
            </Accordion>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 'grow' }} sx={{ p: 3 }}>
          <MainContent isPending={isPending} isError={isError} data={data?.items} />

          <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <Pagination
              count={data?.totalPages || 0}
              variant="outlined"
              color="primary"
              sx={{ mx: 'auto' }}
              page={patternPageNumber}
              onChange={handleChangePage}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

type MainContentProps = {
  data?: TypePatternResponse[];
  isPending: boolean;
  isError: boolean;
};

const MainContent = (props: MainContentProps) => {
  // props.isPending
  if (props.data && props.data.length > 0) {
    return (
      <Grid container spacing={2}>
        {props.data.map((pattern) => {
          const tags = pattern.tags.split(',');
          const cleanedTags = tags.map((tag) => tag.trim()).map((tag) => tag.toLowerCase());
          const joinedTags = cleanedTags.join(', ');

          const authors = pattern.authors.split(',');
          const cleanedAuthors = authors
            .map((tag) => tag.trim())
            .map((tag) => tag.toLowerCase())
            .join(', ');

          const difficulties = pattern.difficulty.split(',');
          const cleanedDifficulty = difficulties
            .map((tag) => tag.trim())
            .map((tag) => tag.toLowerCase())
            .join(', ');

          const handleChipClick = (e: any) => {
            e.preventDefault();
          };

          return (
            <Grid key={`pattern-${pattern.id}`} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 }}>
              <Link to={`/`} style={{ textDecoration: 'none' }}>
                <Card elevation={0}>
                  <Box sx={{ p: 2 }}>
                    <img
                      src={`${pocketbaseDomain}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file}`}
                      alt={`pattern template for ${pattern.name}`}
                      style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                    />
                  </Box>

                  <CardContent sx={{ display: 'none' }}>
                    <Typography sx={{ mb: 2 }}>{pattern.name}</Typography>

                    {pattern.description && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        {pattern.description}
                      </Typography>
                    )}

                    <Typography sx={{ opacity: 0.7, textTransform: 'capitalize', fontSize: 11 }}>
                      Tags: {joinedTags}
                    </Typography>

                    <Typography sx={{ opacity: 0.7, textTransform: 'capitalize', fontSize: 11 }}>
                      Difficulty: {cleanedDifficulty}
                    </Typography>

                    <Typography sx={{ opacity: 0.7, textTransform: 'capitalize', fontSize: 11 }}>
                      Authors: {cleanedAuthors}
                    </Typography>
                  </CardContent>
                </Card>
              </Link>
            </Grid>
          );
        })}
      </Grid>
    );
  }

  if (props.data && props.data.length === 0) {
    return (
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '50svh' }}>
        <Alert severity="info">No results found for your search</Alert>
      </Stack>
    );
  }
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

const SidebarCategoryTitle = (props: SidebarCategoryTitleProps) => {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#15252B',
        padding: '12px 16px',
        borderBottom: BORDER_CSS,
      }}
    >
      <Typography color="primary" sx={{ fontWeight: 600 }}>
        {props.title}
      </Typography>
    </Stack>
  );
};

type SidebarListProps = {
  isPending: boolean;
  isError: boolean;
  data?: TypeTagObject[];
  handleClickAdd: (value: string) => void;
  handleClickRemove: (value: string) => void;
};

const SidebarList = (props: SidebarListProps) => {
  return (
    <List
      disablePadding
      sx={{
        maxHeight: '70svh',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: (theme) => `${theme.palette.primary.main} #222222`,
      }}
    >
      {props.isPending && <SkeletonLink />}
      {props.isError && <Alert severity="error">Unable to load this category</Alert>}
      {props.data &&
        props.data.map((thisTag) => {
          // Removing secondaryAction={thisTag.count}
          return (
            <ListItem
              key={`sidebar-link-${thisTag.tag}`}
              sx={{ textTransform: 'capitalize' }}
              secondaryAction={
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <Box>
                    <IconButton size="small" onClick={() => props.handleClickAdd(thisTag.tag)}>
                      <AddRoundedIcon />
                    </IconButton>
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => props.handleClickRemove(thisTag.tag)}>
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
