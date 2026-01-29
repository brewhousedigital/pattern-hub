import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Container, TextField, Button, Typography, Stack } from '@mui/material';

export const Route = createFileRoute('/register')({
  component: RouteComponent,
});

function RouteComponent() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <Container maxWidth="sm">
      <Stack sx={{ gap: 2 }}>
        <Typography sx={{ textAlign: 'center' }} variant="h2">
          Register an Account
        </Typography>

        <TextField fullWidth label="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <TextField
          fullWidth
          label="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button variant="contained" sx={{ py: 2 }}>
          Register!
        </Button>

        <Typography sx={{ textAlign: 'center' }}>
          <Link style={{ color: '#fff' }} to={'/login'}>
            Click here to login
          </Link>
        </Typography>
      </Stack>
    </Container>
  );
}
