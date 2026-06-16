import { useEffect } from 'react';
import { PatternViewContent } from '@/components/PatternViewContent';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { alpha } from '@mui/material/styles';

import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';

import { Box, Button, Container, SwipeableDrawer, Typography } from '@mui/material';

type PatternListDrawerProps = {
  patterns: TypePatternResponse[];
  selectedIndex: number | null;
  onNavigate: (index: number) => void;
  onClose: () => void;
};

export const PatternListDrawer = ({ patterns, selectedIndex, onNavigate, onClose }: PatternListDrawerProps) => {
  const isOpen = selectedIndex !== null;
  const pattern = selectedIndex !== null ? patterns[selectedIndex] : undefined;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < patterns.length - 1;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;
      if (e.key === 'ArrowLeft' && hasPrev && selectedIndex !== null) onNavigate(selectedIndex - 1);
      else if (e.key === 'ArrowRight' && hasNext && selectedIndex !== null) onNavigate(selectedIndex + 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, hasPrev, hasNext, selectedIndex, onNavigate, onClose]);

  return (
    <SwipeableDrawer
      transitionDuration={300}
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      onOpen={() => {}}
      sx={{
        '& > .MuiPaper-root': {
          maxHeight: '95svh',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
      }}
    >
      <Box sx={{ backgroundColor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
          {/* Nav bar */}
          <Container>
            <Box
              sx={{
                display: { xs: 'grid', md: 'flex' },
                gridTemplateColumns: '1fr 1fr',
                gap: 2,
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
                pb: 2.5,
                borderBottom: `1px solid ${alpha('#C8A96E', 0.2)}`,
              }}
            >
              <Box sx={{ order: { xs: 1 } }}>
                <Button
                  fullWidth
                  startIcon={<ArrowBackIosNewIcon fontSize="inherit" />}
                  variant="outlined"
                  disabled={!hasPrev}
                  size="small"
                  onClick={() => selectedIndex !== null && onNavigate(selectedIndex - 1)}
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
                  onClick={onClose}
                >
                  Close
                </Button>
                {selectedIndex !== null && (
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    {selectedIndex + 1} of {patterns.length}
                  </Typography>
                )}
              </Box>

              <Box sx={{ order: { xs: 2, md: 3 }, textAlign: 'right' }}>
                <Button
                  fullWidth
                  disabled={!hasNext}
                  endIcon={<ArrowForwardIosIcon fontSize="inherit" />}
                  variant="outlined"
                  size="small"
                  onClick={() => selectedIndex !== null && onNavigate(selectedIndex + 1)}
                >
                  Next
                </Button>
              </Box>
            </Box>
          </Container>

          <PatternViewContent viewData={pattern} />
        </Container>
      </Box>
    </SwipeableDrawer>
  );
};
