import React from 'react';
import { enqueueSnackbar } from 'notistack';
import { useGlobalAuthData } from '@/data/auth-data';
import { useMutationAuthAdminSignIn, useMutationAuthGetAdmin } from '@/functions/database/authentication';

import { Box, Button, TextField, Stack, Typography } from '@mui/material';

export const AdminLoginView = () => {
  const signIn = useMutationAuthAdminSignIn();
  const getUser = useMutationAuthGetAdmin();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);

  const { setAuthData } = useGlobalAuthData();

  const handleLogin = async (e: React.SubmitEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const signInData = await signIn.mutateAsync({ email, password });

      // The sign in function doesn't automatically expand data points so we need to call it again to get the full record
      const userData = await getUser.mutateAsync({ userId: signInData.record.id });

      setAuthData(userData);

      window.location.reload();
    } catch (error: any) {
      console.error('Error loading your user data:', error);
      enqueueSnackbar(`Error: ${error.message}`, { variant: 'error' });
    }

    setIsLoading(false);
  };

  const bgStyles = {
    backgroundImage: "url('/space-command-bg.gif')",
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    minHeight: '100svh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const boxStyles = {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    paddingX: 6,
    paddingY: 8,
    width: '100%',
    maxWidth: 460,
    borderRadius: 6,
    backdropFilter: 'blur(12px)',
  };

  return (
    <Box sx={bgStyles}>
      <Box sx={boxStyles} component="form" onSubmit={handleLogin}>
        <Typography variant="h3" sx={{ textAlign: 'center', mb: 2, color: '#fff' }}>
          Space Command
        </Typography>

        <Stack
          spacing={3}
          sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 345, mx: 'auto' }}
        >
          <TextField
            variant="filled"
            label="Email"
            fullWidth
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            variant="filled"
            label="Password"
            fullWidth
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button variant="contained" type="submit" disableElevation fullWidth loading={isLoading}>
            Login
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
