import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor.tsx';

import VerticalSplitRoundedIcon from '@mui/icons-material/VerticalSplitRounded';

import { Box, IconButton, Tooltip } from '@mui/material';
import type { TypePatternResponse } from '@/functions/database/patterns.ts';

export const AdminPatternInstructionsModal = (props: TypePatternResponse) => {
  return (
    <>
      <Box>
        <Tooltip title="Instructions" arrow>
          <IconButton size="small">
            <VerticalSplitRoundedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>
    </>
  );
};
