import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutationRequestPasswordReset } from '@/functions/database/authentication';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import { styled, alpha } from '@mui/material/styles';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';

import { Box, Button, CircularProgress, Container, Link as MuiLink, Paper, TextField, Typography } from '@mui/material';

export const Route = createFileRoute('/auth/forgot-password')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Forgot Password', '', match.pathname),
  }),
});

function RouteComponent() {
  const requestReset = useMutationRequestPasswordReset();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isValid = email.trim().length > 0 && email.includes('@');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await requestReset.mutateAsync(email.trim());
    } catch {
      // PocketBase intentionally returns success even for unknown emails to prevent
      // user enumeration - so we always show the "check your inbox" message.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <GeneralLayout>
      <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <Card elevation={0}>
          {sent ? (
            /* ─── Success state ─── */
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 52, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Check your inbox
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                If <strong>{email}</strong> is linked to an account, we've sent a password reset link. It may take a
                minute to arrive - check your spam folder too.
              </Typography>
              <Button
                component={Link}
                to="/auth/login"
                variant="outlined"
                fullWidth
                sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 600 }}
              >
                Back to sign in
              </Button>
            </Box>
          ) : (
            /* ─── Email entry form ─── */
            <>
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
                  <MailOutlineRoundedIcon color="primary" />
                </Box>

                <Typography variant="h5" fontWeight={500} sx={{ letterSpacing: '-0.3px' }}>
                  Forgot your password?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  Enter your email and we'll send you a reset link.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit} noValidate>
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
                  sx={{ mb: 3 }}
                />

                <SubmitButton type="submit" variant="contained" fullWidth disabled={!isValid || loading}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Send reset link'}
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
            </>
          )}
        </Card>
      </Container>
    </GeneralLayout>
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
