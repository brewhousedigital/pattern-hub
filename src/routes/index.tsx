import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination, type TypePatternResponse } from '@/functions/database/patterns';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Masonry from '@mui/lab/Masonry';
import {
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
} from '@mui/material';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

const BORDER_CSS = `1px solid #25424C`;

function RouteComponent() {
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

  const { isLoading, isError, data } = useQueryGetAllPatternsByPagination(debouncedSearchTerm, patternPageNumber, tag);
  console.log('>>>data', data);

  const { isPending: isPendingTags, isError: isErrorTags, data: dataTags } = useQueryGetAllTags();

  const handleTagClick = (tag: string) => {
    setTag(tag);
  };

  const handleClearTags = () => {
    setTag('');
  };

  return (
    <Box>
      <Box sx={{ borderBottom: BORDER_CSS, pb: 3.75 }}>
        <Container>
          <TextField
            id="homepage-search"
            fullWidth
            aria-label="Search for a Pattern"
            placeholder="Search for a pattern name, difficulty, or author"
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
        <Grid size={{ xs: 12, md: 'auto' }} sx={{ borderRight: BORDER_CSS, borderBottom: BORDER_CSS, minWidth: 300 }}>
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
              All Tags
            </Typography>

            <IconButton
              type="button"
              onClick={handleClearTags}
              sx={{ transition: 'opacity 300ms', opacity: tag.length > 0 ? 1 : 0 }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          <List disablePadding>
            {isPendingTags && <SkeletonLink />}
            {isErrorTags && <>Error</>}
            {dataTags &&
              dataTags.map((thisTag) => {
                return (
                  <ListItem key={`sidebar-link-${thisTag.id}`} disablePadding secondaryAction={thisTag.count}>
                    <ListItemButton selected={tag === thisTag.tag} onClick={() => handleTagClick(thisTag.tag)}>
                      {thisTag.tag}
                    </ListItemButton>
                  </ListItem>
                );
              })}
          </List>
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
      <Masonry columns={5} spacing={2}>
        {props.data.map((pattern) => {
          const tags = pattern.tags.split(',');
          const cleanedTags = tags.map((tag) => tag.trim()).map((tag) => tag.toLowerCase());

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

                  {/*<Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography sx={{ fontSize: 11, opacity: 0.6 }}>Difficulty: Easy</Typography>
                    <Typography sx={{ fontSize: 11, opacity: 0.6 }}>Author: Zach</Typography>
                  </Stack>*/}

                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    {cleanedTags.map((tag, index) => (
                      <Chip
                        key={`tag-chip-${pattern.id}-${index}-${tag}`}
                        label={tag}
                        variant="outlined"
                        color="primary"
                        onClick={handleChipClick}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    ))}

                    <Chip
                      label={`Difficulty: ${cleanedDifficulty}`}
                      variant="outlined"
                      color="primary"
                      onClick={handleChipClick}
                      sx={{ textTransform: 'capitalize' }}
                    />

                    <Chip
                      label={`Authors: ${cleanedAuthors}`}
                      variant="outlined"
                      color="primary"
                      onClick={handleChipClick}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </Masonry>
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
