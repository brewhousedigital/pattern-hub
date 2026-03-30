import React from 'react';
import { Link } from '@tanstack/react-router';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useGlobalIsViewOpen } from '@/data/view';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';

import { alpha } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

import { Box, Button } from '@mui/material';

type TopNavigationProps = {
  hide?: boolean;
  handleClose?: () => void;
};

export const PatternDrawerTopNavigation = (props: TopNavigationProps) => {
  const { data } = useQueryGetAllPatternsByPagination();

  const { nextPattern, prevPattern, hasNext, hasPrev, patternId } = usePatternSearch();
  const resultIds = data?.items.map((item) => item.id) || [];

  if (props?.hide) return <></>;

  if (!data) return <></>;

  return (
    <Box
      sx={{
        display: { xs: 'grid', md: 'flex' },
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 4,
        pb: 2.5,
        borderBottom: `1px solid ${alpha('#C8A96E', 0.2)}`,
      }}
    >
      <Box sx={{ order: { xs: 1, md: 1 } }}>
        <Button
          startIcon={<ArrowBackIosNewIcon fontSize="inherit" />}
          variant="outlined"
          disabled={!hasPrev(resultIds)}
          size="small"
          onClick={() => prevPattern(resultIds)}
        >
          Previous
        </Button>
      </Box>

      <Box sx={{ order: { xs: 3, md: 2 } }}>
        <Button
          startIcon={<OpenInNewRoundedIcon />}
          component={Link}
          variant="outlined"
          size="small"
          to={`/pattern/${patternId}`}
        >
          View Standalone
        </Button>
      </Box>

      <Box sx={{ order: { xs: 4, md: 3 }, textAlign: 'right' }}>
        <Button startIcon={<CloseIcon />} variant="outlined" size="small" onClick={props.handleClose}>
          Close Window
        </Button>
      </Box>

      <Box sx={{ order: { xs: 2, md: 4 }, textAlign: 'right' }}>
        <Button
          disabled={!hasNext(resultIds)}
          endIcon={<ArrowForwardIosIcon fontSize="inherit" />}
          variant="outlined"
          size="small"
          onClick={() => nextPattern(resultIds)}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};
