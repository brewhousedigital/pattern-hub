import React, { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useGlobalIsViewOpen } from '@/data/view';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { RingSpinner } from '@/components/RingSpinner';

import { alpha } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

import { Box, Button, Container } from '@mui/material';

type TopNavigationProps = {
  handleClose?: () => void;
};

export const PatternDrawerTopNavigation = (props: TopNavigationProps) => {
  const { data } = useQueryGetAllPatternsByPagination();

  const { patternId, nextPattern, prevPattern, hasNext, hasPrev } = usePatternSearch();

  const resultIds = useMemo(
    () => data?.items.map((item) => item.id) ?? [],
    [data],
  );

  // Closing re-renders the drawer and the page before the slide-down starts,
  // which can take a moment. The button shows a spinner for that time. The
  // drawer stays mounted after it closes, so the spinner clears as soon as
  // the drawer's open flag turns false (the slide-down has started) - it is
  // not left on the button for the next open.
  const { isViewOpen } = useGlobalIsViewOpen();
  const [isClosing, setIsClosing] = useState(false);
  if (isClosing && !isViewOpen) setIsClosing(false);

  const handleCloseClick = () => {
    if (isClosing) return;
    setIsClosing(true);
    // Close only after the browser paints the spinner - see the same pattern
    // in MainPageContent's handleClick. requestAnimationFrame runs just
    // before the next paint, and the setTimeout inside it runs just after it.
    requestAnimationFrame(() => {
      setTimeout(() => props.handleClose?.(), 0);
    });
  };

  const currentIndex = patternId ? resultIds.indexOf(patternId) : -1;
  const prevId = currentIndex > 0 ? resultIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < resultIds.length - 1 ? resultIds[currentIndex + 1] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;
      if (e.key === 'ArrowLeft' && prevId) prevPattern(resultIds);
      else if (e.key === 'ArrowRight' && nextId) nextPattern(resultIds);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevId, nextId, prevPattern, nextPattern, resultIds]);

  if (!data) return <></>;

  return (
    <Container>
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
        <Box sx={{ order: { xs: 1 } }}>
          <Button
            fullWidth
            startIcon={<ArrowBackIosNewIcon fontSize="inherit" />}
            variant="outlined"
            disabled={!hasPrev(resultIds)}
            size="small"
            onClick={() => prevPattern(resultIds)}
          >
            Previous
          </Button>
        </Box>

        <Box sx={{ order: { xs: 3, md: 2 }, gridColumn: 'span 2', textAlign: 'center' }}>
          <Button
            fullWidth
            startIcon={<CloseIcon />}
            variant="outlined"
            size="small"
            onClick={handleCloseClick}
            loading={isClosing}
            loadingPosition="start"
            loadingIndicator={<RingSpinner size={16} thickness={2} />}
          >
            Close Window
          </Button>
        </Box>

        <Box sx={{ order: { xs: 2, md: 3 }, textAlign: 'right' }}>
          <Button
            fullWidth
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
    </Container>
  );
};
