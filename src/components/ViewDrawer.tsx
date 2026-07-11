import React from 'react';
import { PatternDrawerTopNavigation } from '@/components/PatternUtilities/PatternDrawerTopNavigation';
import { ViewDrawerPatternSidebar } from '@/components/layout/Sidebar';
import { PatternViewContent } from '@/components/PatternViewContent';
import { type TypePatternResponse } from '@/functions/database/patterns.ts';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useGlobalIsViewOpen } from '@/data/view';

import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { Box, Button, Container, Typography } from '@mui/material';

type ViewDrawerProps = {
  viewData: TypePatternResponse | undefined;
  handleClose?: () => void;
  isLoading?: boolean;
};

export const ViewDrawer = (props: ViewDrawerProps) => {
  const viewData = props.viewData;

  const { handleOpenView, handleCloseView } = useGlobalIsViewOpen();
  const { patternId } = usePatternSearch();

  React.useEffect(() => {
    if (patternId) {
      handleOpenView();
    } else {
      handleCloseView();
    }
  }, [patternId, handleOpenView, handleCloseView]);

  const notFound = !props.isLoading && patternId && !viewData;

  if (notFound) {
    return (
      <Box
        sx={{
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 10,
          px: 3,
          textAlign: 'center',
        }}
      >
        <SearchOffRoundedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Pattern not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          This pattern may have been removed or the link may be incorrect.
        </Typography>
        <Button variant="outlined" onClick={props.handleClose}>
          Return to search
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
        <PatternDrawerTopNavigation handleClose={props.handleClose} />

        <PatternViewContent
          viewData={viewData}
          sidebar={
            <ViewDrawerPatternSidebar tagList={viewData?.tags || []} handleClose={props.handleClose} />
          }
        />
      </Container>
    </Box>
  );
};
