import React from 'react';
import { PatternDrawerTopNavigation } from '@/components/PatternUtilities/PatternDrawerTopNavigation';
import { ViewDrawerPatternSidebar } from '@/components/layout/Sidebar';
import { PatternViewContent } from '@/components/PatternViewContent';
import { type TypePatternResponse } from '@/functions/database/patterns.ts';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { useGlobalIsViewOpen } from '@/data/view';

import { Box, Container } from '@mui/material';

type ViewDrawerProps = {
  viewData: TypePatternResponse | undefined;
  handleClose?: () => void;
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
  }, [patternId]);

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
