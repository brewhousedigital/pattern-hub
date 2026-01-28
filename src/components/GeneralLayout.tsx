import type { TypeComponentWithChildrenProps } from '../functions/types/types';
import { Box, Typography } from '@mui/material';

export const GeneralLayout = (props: TypeComponentWithChildrenProps) => {
  const logoStyles = {
    textAlign: 'center',
    WebkitTextStroke: '2px #222',
    textStroke: '2px #222',
    mb: 2,
  };

  const gradientStyles = {
    background: 'linear-gradient(to right, #FD8D35, #EE5F0D)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };

  return (
    <Box>
      <Typography variant="h1" sx={logoStyles}>
        <Typography variant="h1" component="span" sx={gradientStyles}>
          Pattern
        </Typography>{' '}
        Hub
      </Typography>
      <Box>{props.children}</Box>
    </Box>
  );
};
