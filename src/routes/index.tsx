import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllPatternsByPagination, type TypePatternResponse } from '@/functions/database/patterns';
import { useDebounce } from '@/functions/hooks/useDebounce';

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
  CardMedia,
  Rating,
  TextField,
  Typography,
  Pagination,
  Stack,
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

  const { isLoading, isError, data } = useQueryGetAllPatternsByPagination(debouncedSearchTerm, patternPageNumber);

  console.log('>>>data', data);

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
            <ListItem disablePadding secondaryAction="24">
              <ListItemButton>lol</ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton>lol</ListItemButton>
            </ListItem>
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
      <Grid container spacing={3} sx={{ p: 4 }}>
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
        <SkeletonPattern />
      </Grid>
    );
  }

  if (props.data && props.data.length > 0) {
    return (
      <Masonry columns={4} spacing={2}>
        {props.data.map((pattern) => (
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Card elevation={0}>
              <Box sx={{ p: 2 }}>
                <img
                  src={`https://stained-glass.pockethost.io/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file}`}
                  alt={`pattern template for ${pattern.name}`}
                  style={{ width: '100%', height: 'auto' }}
                />
              </Box>

              <CardContent>
                <Typography>Daedra</Typography>

                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Lizards are a widespread group of squamate reptiles, with over 6,000 species, ranging across all
                  continents except Antarctica
                </Typography>
              </CardContent>
            </Card>
          </Link>
        ))}
      </Masonry>
    );
  }

  /*return (
    <Grid spacing={3} container sx={{ p: 4 }}>
      {props.data?.map((pattern) => (
        <Grid size={{ xs: 12, md: 6, lg: 4, xl: 3 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Card elevation={0}>
              <Box sx={{ p: 2 }}>
                <img
                  src={`https://stained-glass.pockethost.io/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file}`}
                  alt={`pattern template for ${pattern.name}`}
                  style={{ width: '100%', height: 'auto' }}
                />
              </Box>

              <CardContent>
                <Typography>Daedra</Typography>

                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Lizards are a widespread group of squamate reptiles, with over 6,000 species, ranging across all
                  continents except Antarctica
                </Typography>

                {/!*<Rating name="read-only" value={3.5} readOnly />*!/}
              </CardContent>
            </Card>
          </Link>
        </Grid>
      ))}
    </Grid>
  );*/
};

const SkeletonPattern = () => {
  return (
    <Grid size={{ xs: 12, md: 6, lg: 4, xl: 3 }}>
      <Skeleton variant="rounded" width="100%" height={285} />
    </Grid>
  );
};
