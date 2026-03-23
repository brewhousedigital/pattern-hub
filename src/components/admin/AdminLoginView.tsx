import React from 'react';
import { enqueueSnackbar } from 'notistack';
import { useGlobalAuthData } from '@/data/auth-data';
import { useMutationAuthAdminSignIn, useMutationAuthGetAdmin } from '@/functions/database/authentication';

import { Button, Container, TextField, Stack, Typography } from '@mui/material';

export const AdminLoginView = () => {
  const signIn = useMutationAuthAdminSignIn();
  const getUser = useMutationAuthGetAdmin();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);

  const { setAuthData } = useGlobalAuthData();

  const handleLogin = async () => {
    setIsLoading(true);

    try {
      const signInData = await signIn.mutateAsync({ email, password });

      // The sign in function doesn't automatically expand data points so we need to call it again to get the full record
      const userData = await getUser.mutateAsync({ userId: signInData.record.id });

      setAuthData(userData);
    } catch (error: any) {
      console.error('Error loading your user data:', error);
      enqueueSnackbar(`Error: ${error.message}`, { variant: 'error' });
    }

    setIsLoading(false);
  };

  return (
    <Container>
      <Typography sx={{ textAlign: 'center', mb: 2 }}>Space Command</Typography>

      <Stack
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 345, mx: 'auto' }}
      >
        <TextField label="Email" fullWidth type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <TextField
          label="Password"
          fullWidth
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button variant="outlined" fullWidth onClick={handleLogin} loading={isLoading}>
          Login
        </Button>
      </Stack>
    </Container>
  );
};
