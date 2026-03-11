import React from 'react';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import { useGlobalIsViewOpen, useGlobalViewData } from '@/data/view';

import { Box, Grid, Card, CardContent, Typography, Stack, Alert, Link } from '@mui/material';

type MainContentProps = {
  data?: TypePatternResponse[];
  isPending: boolean;
  isError: boolean;
};

export const MainPageContent = (props: MainContentProps) => {
  const { handleOpenView } = useGlobalIsViewOpen();
  const { setViewData } = useGlobalViewData();

  const handleClick = (e: React.MouseEvent, pattern: TypePatternResponse) => {
    e.preventDefault();

    // Set the global view
    setViewData(pattern);

    // Open the modal
    handleOpenView();
  };

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

          return (
            <Grid key={`pattern-${pattern.id}`} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 }}>
              <Link href="#" onClick={(e) => handleClick(e, pattern)} style={{ textDecoration: 'none' }}>
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
