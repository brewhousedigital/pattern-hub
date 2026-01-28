import type { TypeComponentWithChildrenProps } from '../functions/types/types';
import { Box, Typography } from '@mui/material';

export const GeneralLayout = (props: TypeComponentWithChildrenProps) => {
  const logoStyles = {
    background: 'linear-gradient(to right, #FD8D35, #EE5F0D)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ textAlign: 'center' }}>
        <Typography variant="h1" component="span" sx={logoStyles}>
          Pattern
        </Typography>{' '}
        Hub
      </Typography>
      <Box>{props.children}</Box>
    </Box>
  );
};
