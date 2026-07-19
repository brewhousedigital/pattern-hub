import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout.tsx';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { useGlobalAuthData } from '@/data/auth-data.ts';
import { UserUploadForm } from '@/components/submission/UserUploadForm.tsx';

import { Alert, Box, Button, Container, Link as MuiLink } from '@mui/material';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/profile/submit-pattern')({
  component: RouteComponent,
  ssr: false,
  head: () =>
    generateSEO('Submit a Pattern', 'Share your stained glass pattern with the community', '/profile/submit-pattern'),
});

function RouteComponent() {
  const { authData } = useGlobalAuthData();

  return (
    <GeneralLayout>
      <Container maxWidth="lg">
        {!authData?.id ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Alert severity="info" sx={{ display: 'inline-flex', mb: 2 }}>
              You need to be logged in to submit a pattern.
            </Alert>
            <Box>
              <Button component={Link} to="/auth/login" variant="contained">
                Log In
              </Button>
            </Box>
          </Box>
        ) : !authData?.verified ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Alert severity="warning" sx={{ display: 'inline-flex' }}>
              Please verify your account (check your email) before submitting a pattern.
            </Alert>
          </Box>
        ) : (
          <UserUploadForm />
        )}
      </Container>
    </GeneralLayout>
  );
}
