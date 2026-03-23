import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { enqueueSnackbar } from 'notistack';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { useMutationAuthAdminSignIn, useMutationAuthGetAdmin } from '@/functions/database/authentication';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { AdminPatternTable } from '@/components/admin/AdminPatternTable';

import { Button, Container, TextField, Stack, Typography } from '@mui/material';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoading } = useRefreshAdminAuth();

  const { authData } = useGlobalAuthData();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!authData) {
    return <LoginView />;
  }

  return <AdminPageContent />;
}

const LoginView = () => {
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

const AdminPageContent = () => {
  return (
    <Container>
      <AdminPatternTable />
    </Container>
  );
};
