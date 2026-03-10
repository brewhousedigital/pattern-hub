import { Stack, CircularProgress } from '@mui/material';

export const FullScreenLoader = () => {
  return (
    <Stack
      sx={{
        width: '100svw',
        height: '100svh',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <CircularProgress />
    </Stack>
  );
};
