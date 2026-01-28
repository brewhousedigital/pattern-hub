import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination, type TypePatternResponse } from '@/functions/database/patterns';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useQueryGetAllDifficulties } from '@/functions/database/difficulties';
import { useQueryGetAllAuthors } from '@/functions/database/authors';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Masonry from '@mui/lab/Masonry';
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
  ListItemButton,
  Card,
  CardContent,
  Rating,
  TextField,
  Typography,
  Pagination,
  Stack,
  Chip,
  CircularProgress,
  IconButton,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

const BORDER_CSS = `1px solid #25424C`;

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

  const [tag, setTag] = React.useState<string>('');
  const [difficulty, setDifficulty] = React.useState<string>('');
  const [author, setAuthor] = React.useState<string>('');

  const { isLoading, isError, data } = useQueryGetAllPatternsByPagination(
    debouncedSearchTerm,
    patternPageNumber,
    tag,
    difficulty,
    author,
  );

  const { isPending: isPendingTags, isError: isErrorTags, data: dataTags } = useQueryGetAllTags();

  const {
    isPending: isPendingDifficulties,
    isError: isErrorDifficulties,
    data: dataDifficulties,
  } = useQueryGetAllDifficulties();

  const { isPending: isPendingAuthors, isError: isErrorAuthors, data: dataAuthors } = useQueryGetAllAuthors();

  const handleTagClick = (tag: string) => {
    setTag(tag);
  };

  const handleDifficultyClick = (tag: string) => {
    setDifficulty(tag);
  };

  const handleAuthorClick = (tag: string) => {
    setAuthor(tag);
  };

  const handleClearTags = () => {
    setTag('');
  };

  const handleClearDifficulties = () => {
    setDifficulty('');
  };

  const handleClearAuthors = () => {
    setAuthor('');
  };

  const SidebarBlock = () => {
    return (
      <>
        <SidebarCategoryTitle title="All Tags" hasItem={tag.length > 0} handleClearTags={handleClearTags} />

        <SidebarList
          isPending={isPendingTags}
          isError={isErrorTags}
          data={dataTags}
          selectedValue={tag}
          handleClick={handleTagClick}
        />

        {/*<SidebarCategoryTitle
          title="All Difficulties"
          hasItem={difficulty.length > 0}
          handleClearTags={handleClearDifficulties}
        />*/}

        {/*<SidebarList
          isPending={isPendingDifficulties}
          isError={isErrorDifficulties}
          data={dataDifficulties}
          selectedValue={difficulty}
          handleClick={handleDifficultyClick}
        />*/}

        {/*<SidebarCategoryTitle title="All Authors" hasItem={author.length > 0} handleClearTags={handleClearAuthors} />*/}

        {/*<SidebarList
          isPending={isPendingAuthors}
          isError={isErrorAuthors}
          data={dataAuthors}
          selectedValue={author}
          handleClick={handleAuthorClick}
        />*/}
      </>
    );
  };

  return (
    <Box>
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
          <MainContent isLoading={isLoading} isError={isError} data={data?.items} />

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
  isLoading: boolean;
  isError: boolean;
};

const MainContent = (props: MainContentProps) => {
  if (props.isLoading) {
    return (
      <Stack sx={{ minHeight: '50svh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Stack>
    );
  }

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
  hasItem: boolean;
  handleClearTags: () => void;
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

      <IconButton
        type="button"
        onClick={props.handleClearTags}
        sx={{ transition: 'opacity 300ms', opacity: props.hasItem ? 1 : 0 }}
      >
        <CloseRoundedIcon />
      </IconButton>
    </Stack>
  );
};

type SidebarListProps = {
  isPending: boolean;
  isError: boolean;
  data?: TypeReadOnlyDatabaseItem[];
  selectedValue: string;
  handleClick: (value: string) => void;
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
            <ListItem key={`sidebar-link-${thisTag.id}`} disablePadding>
              <ListItemButton
                sx={{ textTransform: 'capitalize' }}
                selected={props.selectedValue === thisTag.tag}
                onClick={() => props.handleClick(thisTag.tag)}
              >
                {thisTag.tag}
              </ListItemButton>
            </ListItem>
          );
        })}
    </List>
  );
};

/* Masonry Layout */

/*
<Masonry columns={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }} spacing={2}>
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
      <Link key={`pattern-${pattern.id}`} to={`/`} style={{ textDecoration: 'none' }}>
        <Card elevation={0}>
          <Box sx={{ p: 2 }}>
            <img
              src={`${pocketbaseDomain}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file}`}
              alt={`pattern template for ${pattern.name}`}
              style={{ width: '100%', height: 'auto' }}
            />
          </Box>

          <CardContent>
            <Typography sx={{ mb: 2 }}>{pattern.name}</Typography>

            {pattern.description && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {pattern.description}
              </Typography>
            )}

            <Typography sx={{ opacity: 0.7, textTransform: 'capitalize', fontSize: 11 }}>Tags: {joinedTags}</Typography>

            <Typography sx={{ opacity: 0.7, textTransform: 'capitalize', fontSize: 11 }}>
              Difficulty: {cleanedDifficulty}
            </Typography>

            <Typography sx={{ opacity: 0.7, textTransform: 'capitalize', fontSize: 11 }}>
              Authors: {cleanedAuthors}
            </Typography>
          </CardContent>
        </Card>
      </Link>
    );
  })}
</Masonry>*/
