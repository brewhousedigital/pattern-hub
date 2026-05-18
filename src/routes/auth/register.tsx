import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useMutationAuthCreateUser, useMutationAuthSignIn } from '@/functions/database/authentication';
import { useGlobalAuthData } from '@/data/auth-data';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';

import { styled, alpha } from '@mui/material/styles';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

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
  LinearProgress,
  Tooltip,
} from '@mui/material';

export const Route = createFileRoute('/auth/register')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Register', '', match.pathname),
  }),
});

function RouteComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const { setAuthData } = useGlobalAuthData();

  const navigate = useNavigate();

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordMismatch = confirm.length > 0 && password !== confirm;

  const isValid = email.trim().length > 0 && password.length >= 8 && password === confirm;

  const createUser = useMutationAuthCreateUser();
  const signIn = useMutationAuthSignIn();

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (!isValid) return;
    setIsLoading(true);

    try {
      // Create the user object and get the ID out so we can create the private user data next
      await createUser.mutateAsync({
        email,
        password,
        name: `NewUser_${Date.now()}`,
      });

      // Sign in the newly created user so we have a valid token
      await signIn.mutateAsync({ email, password });

      const userData = pocketbase.authStore.record;

      setAuthData(userData);

      navigate({
        to: '/profile',
      }).then();
    } catch {
      enqueueSnackbar('Something went wrong registering an account. Try again in a few minutes.');
    }

    setIsLoading(false);
  };

  return (
    <GeneralLayout>
      <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <Card elevation={0}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={500} sx={{ letterSpacing: '-0.3px' }}>
              Create an account
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Favorites, ratings, and tracking which patterns you've completed already.
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

              <Box>
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  variant="filled"
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  autoComplete="new-password"
                  required
                  helperText="Minimum 8 characters"
                  InputProps={{
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
                  }}
                />

                {password.length > 0 && (
                  <Box sx={{ mt: 1, px: 0.5 }}>
                    <Tooltip title={strength.label} placement="right">
                      <StrengthBar
                        variant="determinate"
                        value={(strength.score / 4) * 100}
                        strengthcolor={strength.color}
                      />
                    </Tooltip>
                    <Typography
                      variant="caption"
                      sx={{ color: strength.color, fontWeight: 600, mt: 0.5, display: 'block' }}
                    >
                      {strength.label}
                    </Typography>
                  </Box>
                )}
              </Box>

              <TextField
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                variant="filled"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                fullWidth
                autoComplete="new-password"
                required
                error={passwordMismatch}
                helperText={passwordMismatch ? 'Passwords do not match' : ''}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {passwordsMatch ? (
                        <CheckCircleOutlinedIcon fontSize="small" sx={{ color: 'success.main' }} />
                      ) : (
                        <IconButton
                          onClick={() => setShowConfirm((v) => !v)}
                          edge="end"
                          size="small"
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                        >
                          {showConfirm ? (
                            <VisibilityOffOutlinedIcon fontSize="small" />
                          ) : (
                            <VisibilityOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      )}
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <SubmitButton type="submit" variant="contained" fullWidth disabled={!isValid || isLoading} sx={{ mt: 3.5 }}>
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Create account'}
            </SubmitButton>

            <Typography
              variant="caption"
              color="text.disabled"
              display="block"
              textAlign="center"
              sx={{ mt: 2, lineHeight: 1.6 }}
            >
              By creating an account you agree to our{' '}
              <MuiLink component={Link} to="/help/terms-of-service" underline="hover" color="text.secondary">
                Terms of Service
              </MuiLink>{' '}
              and{' '}
              <MuiLink component={Link} to="/help/privacy-policy" underline="hover" color="text.secondary">
                Privacy Policy
              </MuiLink>
              .
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3.5 }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <MuiLink component={Link} to="/auth/login" underline="hover" fontWeight={600}>
                Sign in
              </MuiLink>
            </Typography>
          </Box>
        </Card>
      </Container>
    </GeneralLayout>
  );
}

type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; color: string };

const getPasswordStrength = (password: string): PasswordStrength => {
  if (password.length === 0) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels: PasswordStrength[] = [
    { score: 0, label: '', color: 'transparent' },
    { score: 1, label: 'Weak', color: '#f44336' },
    { score: 2, label: 'Fair', color: '#ff9800' },
    { score: 3, label: 'Good', color: '#2196f3' },
    { score: 4, label: 'Strong', color: '#4caf50' },
  ];
  return levels[score] as PasswordStrength;
};

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

const StrengthBar = styled(LinearProgress)<{ strengthcolor: string }>(({ strengthcolor }) => ({
  borderRadius: 4,
  height: 4,
  backgroundColor: 'rgba(0,0,0,0.08)',
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
    backgroundColor: strengthcolor,
    transition: 'transform 0.4s ease, background-color 0.3s ease',
  },
}));
