import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutationAuthSignIn, useMutationAuthGetUser } from '@/functions/database/authentication';
import { enqueueSnackbar } from 'notistack';

import { styled, alpha } from '@mui/material/styles';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  InputAdornment,
  IconButton,
  Link as MuiLink,
  CircularProgress,
} from '@mui/material';
import { useGlobalAuthData } from '@/data/auth-data.ts';

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
});

function RouteComponent() {
  const signIn = useMutationAuthSignIn();
  const getUser = useMutationAuthGetUser();

  const navigate = useNavigate();

  const { setAuthData } = useGlobalAuthData();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    try {
      const signInData = await signIn.mutateAsync({ email, password });

      // The sign in function doesn't automatically expand data points so we need to call it again to get the full record
      const userData = await getUser.mutateAsync({ userId: signInData.record.id });

      setAuthData(userData);

      navigate({
        to: '/profile',
      }).then();
    } catch (error: any) {
      console.error('Error loading your user data:', error);
      enqueueSnackbar('Invalid email or password. Please try again.', { variant: 'error' });
    }

    setLoading(false);
  };

  const isValid = email.trim().length > 0 && password.length > 0;

  return (
    <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
      <Card elevation={0}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={500} sx={{ letterSpacing: '-0.3px' }}>
            Welcome back
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Sign in to your account to continue
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Email address"
              type="email"
              variant="filled"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="email"
              autoFocus
              required
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              variant="filled"
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <VisibilityOffOutlinedIcon fontSize="small" />
                        ) : (
                          <VisibilityOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Box sx={{ textAlign: 'right', mt: 1 }}>
            <MuiLink
              component={Link}
              to="/auth/forgot-password"
              variant="body2"
              underline="hover"
              sx={{ color: 'text.secondary' }}
            >
              Forgot password?
            </MuiLink>
          </Box>

          <SubmitButton type="submit" variant="contained" fullWidth disabled={!isValid || loading} sx={{ mt: 3 }}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
          </SubmitButton>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 3.5 }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <MuiLink component={Link} to="/auth/register" underline="hover" fontWeight={600}>
              Create one
            </MuiLink>
          </Typography>
        </Box>
      </Card>
    </Container>
  );
}

const Card = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 420,
  padding: theme.spacing(5),
  borderRadius: 20,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: `0 8px 40px ${alpha(theme.palette.common.black, 0.08)}`,
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  borderRadius: 10,
  padding: theme.spacing(1.5),
  fontWeight: 700,
  fontSize: '0.95rem',
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': {
    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
  },
}));
