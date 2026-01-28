import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination, type TypePatternResponse } from '@/functions/database/patterns';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';

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

  const { isPending: isPendingTags, isError: isErrorTags, data: dataTags } = useQueryGetAllTags();

  const handleTagClick = (tag: string) => {
    setTag(tag);
  };

  return (
    <Box>
      <Box sx={{ borderBottom: BORDER_CSS, pb: 3.75 }}>
        <Container>
          <TextField
            id="homepage-search"
            fullWidth
            aria-label="Search for a Pattern"
            placeholder="Search for a Pattern"
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
        <Grid size={{ xs: 12, md: 3 }} sx={{ borderRight: BORDER_CSS, borderBottom: BORDER_CSS }}>
          <TagsTitle />

          <List disablePadding>
            {isPendingTags && <SkeletonLink />}
            {isErrorTags && <>Error</>}
            {dataTags &&
              dataTags.map((tag) => (
                <ListItem key={`sidebar-link-${tag.id}`} disablePadding secondaryAction={tag.count}>
                  <ListItemButton onClick={() => handleTagClick(tag.tag)}>{tag.tag}</ListItemButton>
                </ListItem>
              ))}
          </List>
        </Grid>

        <Grid size={{ xs: 12, md: 9 }} sx={{ p: 3 }}>
          <MainContent isLoading={isLoading} isError={isError} data={data?.items} />

          <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <Pagination
              count={10}
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

const TagsTitle = () => {
  return (
    <Typography
      color="primary"
      sx={{ backgroundColor: '#15252B', fontWeight: 600, padding: '12px 16px', borderBottom: BORDER_CSS }}
    >
      Tags
    </Typography>
  );
};

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
      <Masonry columns={4} spacing={2}>
        {props.data.map((pattern) => {
          const tags = pattern.tags.split(',');
          const cleanedTags = tags.map((tag) => tag.trim()).map((tag) => tag.toLowerCase());

          const handleChipClick = (e: any) => {
            e.preventDefault();
          };

          return (
            <Link key={`pattern-${pattern.id}`} to={`/`} style={{ textDecoration: 'none' }}>
              <Card elevation={0}>
                <Box sx={{ p: 2 }}>
                  <img
                    src={`https://stained-glass.pockethost.io/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file}`}
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

                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    {cleanedTags.map((tag, index) => (
                      <Chip
                        key={`tag-chip-${pattern.id}-${index}-${tag}`}
                        label={tag}
                        variant="outlined"
                        color="primary"
                        onClick={handleChipClick}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </Masonry>
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
