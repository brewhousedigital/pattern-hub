import type { TypeComponentWithChildrenProps } from '@/functions/types/types';

import { Box } from '@mui/material';

export const BorderedCard = (props: TypeComponentWithChildrenProps) => {
  return (
    <Box
      sx={{
        backgroundColor: '#fff',
        border: (theme) => `2px solid ${theme.palette.primary.main}`,
        borderRadius: 6,
        p: 3,
        mb: 3,
      }}
    >
      {props.children}
    </Box>
  );
};
