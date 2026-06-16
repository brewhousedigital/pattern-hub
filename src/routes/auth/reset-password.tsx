import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutationConfirmPasswordReset } from '@/functions/database/authentication';
import { enqueueSnackbar } from 'notistack';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import { styled, alpha } from '@mui/material/styles';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  LinearProgress,
  Link as MuiLink,
  Paper,
  TextField,
  Typography,
} from '@mui/material';

// ─── Route ───────────────────────────────────────────────────────────────────

type ResetPasswordSearch = {
  token?: string;
};

export const Route = createFileRoute('/auth/reset-password')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    token: search.token as string | undefined,
  }),
  head: ({ match }) => ({
    meta: generateSEO('Reset Password', '', match.pathname),
  }),
});

// ─── Password strength helper (mirrors register.tsx) ─────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: '', color: 'transparent' },
    { label: 'Weak', color: '#f44336' },
    { label: 'Fair', color: '#ff9800' },
    { label: 'Good', color: '#2196f3' },
    { label: 'Strong', color: '#4caf50' },
  ] as const;

  return { score, ...levels[score] };
}

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const confirmReset = useMutationConfirmPasswordReset();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const strength = getPasswordStrength(password);
  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const isValid = !!token && password.length >= 8 && password === passwordConfirm && !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || !token) return;
    setFormError('');
    setLoading(true);
    try {
      await confirmReset.mutateAsync({ token, password, passwordConfirm });
      enqueueSnackbar('Password updated - please sign in with your new password.', { variant: 'success' });
      void navigate({ to: '/auth/login' });
    } catch {
      setFormError('This reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  // No token in URL - the link is broken or already used
  if (!token) {
    return (
      <GeneralLayout>
        <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <Card elevation={0}>
            <Box sx={{ textAlign: 'center' }}>
              <LockResetRoundedIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Invalid reset link
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                This link is missing a reset token. Please use the link from your email, or request a new one.
              </Typography>
              <Button
                component={Link}
                to="/auth/forgot-password"
                variant="contained"
                fullWidth
                sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700, mb: 1.5 }}
              >
                Request new link
              </Button>
              <MuiLink
                component={Link}
                to="/auth/login"
                variant="body2"
                underline="hover"
                sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
              >
                <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                Back to sign in
              </MuiLink>
            </Box>
          </Card>
        </Container>
      </GeneralLayout>
    );
  }

  return (
    <GeneralLayout>
      <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <Card elevation={0}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: (t) => alpha(t.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <LockResetRoundedIcon color="primary" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 500, letterSpacing: '-0.3px' }}>
              Set a new password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Choose a strong password for your account.
            </Typography>
          </Box>

          {formError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {formError}{' '}
              <MuiLink component={Link} to="/auth/forgot-password" underline="hover" sx={{ fontWeight: 600 }}>
                Request a new link
              </MuiLink>
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* New password */}
              <Box>
                <TextField
                  label="New password"
                  type={showPassword ? 'text' : 'password'}
                  variant="filled"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  autoComplete="new-password"
                  autoFocus
                  required
                  helperText="Minimum 8 characters"
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

                {/* Password strength bar */}
                {password.length > 0 && (
                  <Box sx={{ mt: 1, px: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(strength.score / 4) * 100}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'divider',
                        '& .MuiLinearProgress-bar': { backgroundColor: strength.color, transition: 'width 0.3s' },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: strength.color, fontWeight: 600, mt: 0.25, display: 'block' }}
                    >
                      {strength.label}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Confirm password */}
              <TextField
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                variant="filled"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                fullWidth
                autoComplete="new-password"
                required
                error={passwordMismatch}
                helperText={passwordMismatch ? 'Passwords do not match' : ' '}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        {!passwordMismatch && passwordConfirm.length > 0 && password === passwordConfirm ? (
                          <CheckCircleOutlinedIcon fontSize="small" color="success" />
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
                  },
                }}
              />
            </Box>

            <SubmitButton type="submit" variant="contained" fullWidth disabled={!isValid} sx={{ mt: 3 }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Set new password'}
            </SubmitButton>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <MuiLink
              component={Link}
              to="/auth/login"
              variant="body2"
              underline="hover"
              sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
              Back to sign in
            </MuiLink>
          </Box>
        </Card>
      </Container>
    </GeneralLayout>
  );
}

// ─── Shared styles (match login.tsx exactly) ──────────────────────────────────

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
