import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { pocketbase } from '@/functions/database/authentication-setup';
import {
  useMutationConfirmVerification,
  useMutationResendVerificationCode,
} from '@/functions/database/authentication';
import { useGlobalAuthData, useRefreshAuth } from '@/data/auth-data';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';

import { styled, alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import { Box, Button, CircularProgress, Container, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';

// ─── Route ───────────────────────────────────────────────────────────────────

type ConfirmVerificationSearch = {
  token?: string;
};

export const Route = createFileRoute('/auth/confirm-verification')({
  ssr: false,
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): ConfirmVerificationSearch => ({
    token: search.token as string | undefined,
  }),
  head: ({ match }) => generateSEO('Verify Email', '', match.pathname),
});

// ─── Component ────────────────────────────────────────────────────────────────

type Status = 'invalid' | 'verifying' | 'success' | 'error';

function RouteComponent() {
  const { token } = Route.useSearch();
  const { authData } = useGlobalAuthData();
  const { handleRefresh } = useRefreshAuth();

  const { mutateAsync: confirmVerification } = useMutationConfirmVerification();
  const resendVerification = useMutationResendVerificationCode();

  const [status, setStatus] = React.useState<Status>(token ? 'verifying' : 'invalid');

  // Verify exactly once on mount. Tokens are single-use, so a re-run (however
  // caused) would report a false failure.
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current || !token) return;
    ranRef.current = true;

    confirmVerification(token)
      .then(async () => {
        // Registration signs users in, so refresh the auth atom - the
        // "verify your account" banner disappears without a reload
        await handleRefresh();
        setStatus('success');
      })
      .catch(async () => {
        // The token may simply have been consumed already (email link clicked
        // twice, or a mail scanner got there first). If this browser is signed
        // in and the account IS verified, that's a success, not an error.
        await handleRefresh();
        if (pocketbase.authStore.record?.verified) {
          setStatus('success');
        } else {
          setStatus('error');
        }
      });
  }, [token, confirmVerification, handleRefresh]);

  const handleResend = async () => {
    if (!authData?.email) return;
    try {
      await resendVerification.mutateAsync(authData.email);
      enqueueSnackbar('A new verification email is on its way. Check your inbox.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Unable to send the email right now. Try again in a few minutes.', { variant: 'error' });
    }
  };

  return (
    <GeneralLayout>
      <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <Card elevation={0}>
          {status === 'invalid' && (
            <Box sx={{ textAlign: 'center' }}>
              <MarkEmailReadRoundedIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Invalid verification link
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                This link is missing a verification token. Please use the button from your verification email.
              </Typography>
              <BackToSignIn />
            </Box>
          )}

          {status === 'verifying' && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CircularProgress size={40} sx={{ mb: 3 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Verifying your email…
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This will only take a moment.
              </Typography>
            </Box>
          )}

          {status === 'success' && (
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: (t) => alpha(t.palette.success.main, 0.12),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <CheckCircleRoundedIcon color="success" />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 500, letterSpacing: '-0.3px', mb: 1 }}>
                Your email is verified!
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                You're all set. Thanks for joining Pattern Archive.
              </Typography>

              {authData ? (
                <Link to="/profile" search={{ tab: 0 }} style={{ textDecoration: 'none' }}>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700, mb: 3 }}
                  >
                    Go to your profile
                  </Button>
                </Link>
              ) : (
                <Button
                  component={Link}
                  to="/auth/login"
                  variant="contained"
                  fullWidth
                  sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700, mb: 3 }}
                >
                  Sign in
                </Button>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                New around here? A few good places to start:
              </Typography>

              <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                <MuiLink component={Link} to="/help/faq" variant="body2" underline="hover">
                  Frequently asked questions
                </MuiLink>
                <MuiLink component={Link} to="/wiki" variant="body2" underline="hover">
                  Browse the wiki
                </MuiLink>
                <Typography variant="body2" sx={{ color: 'primary.main' }}>
                  <Link
                    to="/wiki/$categorySlug/$pageSlug"
                    params={{ categorySlug: 'site-functions', pageSlug: 'search' }}
                    style={{ color: 'inherit' }}
                  >
                    How to use the pattern search
                  </Link>
                </Typography>
              </Stack>
            </Box>
          )}

          {status === 'error' && (
            <Box sx={{ textAlign: 'center' }}>
              <ErrorOutlineRoundedIcon sx={{ fontSize: 52, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                This link is invalid or has expired
              </Typography>

              {authData && !authData.verified ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    No problem - we can send a fresh verification email to {authData.email}.
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    loading={resendVerification.isPending}
                    onClick={handleResend}
                    sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700, mb: 1.5 }}
                  >
                    Resend verification email
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Sign in and we'll offer to resend the verification email from there.
                  </Typography>
                  <Button
                    component={Link}
                    to="/auth/login"
                    variant="contained"
                    fullWidth
                    sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700, mb: 1.5 }}
                  >
                    Sign in
                  </Button>
                </>
              )}

              <BackToSignIn label="Back to the homepage" to="/" />
            </Box>
          )}
        </Card>
      </Container>
    </GeneralLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BackToSignIn = ({ label = 'Back to sign in', to = '/auth/login' }: { label?: string; to?: string }) => (
  <MuiLink
    component={Link}
    to={to}
    variant="body2"
    underline="hover"
    sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
  >
    <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
    {label}
  </MuiLink>
);

const Card = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 420,
  padding: theme.spacing(5),
  borderRadius: 20,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: `0 8px 40px ${alpha(theme.palette.common.black, 0.08)}`,
}));
