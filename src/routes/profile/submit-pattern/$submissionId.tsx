import { createFileRoute, Link } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { useGlobalAuthData } from '@/data/auth-data';
import { useQueryGetUserSubmissionById } from '@/functions/database/user-submissions';
import { UserUploadForm } from '@/components/submission/UserUploadForm';

import { Alert, Box, Button, CircularProgress, Container } from '@mui/material';

export const Route = createFileRoute('/profile/submit-pattern/$submissionId')({
  component: RouteComponent,
  ssr: false,
  head: () =>
    generateSEO('Edit Your Submission', 'Edit a pattern you submitted for review', '/profile/submit-pattern'),
});

function RouteComponent() {
  const { submissionId } = Route.useParams();
  const { authData } = useGlobalAuthData();
  // The collection's viewRule (submitter = @request.auth.id || admin) means a
  // submission that isn't this user's own simply fails to load here - no
  // separate ownership check needed on top of isError below.
  const { data: submission, isPending, isError } = useQueryGetUserSubmissionById(submissionId);

  return (
    <GeneralLayout>
      <Container maxWidth="lg">
        {!authData?.id ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Alert severity="info" sx={{ display: 'inline-flex', mb: 2 }}>
              You need to be logged in to edit a submission.
            </Alert>
            <Box>
              <Button component={Link} to="/auth/login" variant="contained">
                Log In
              </Button>
            </Box>
          </Box>
        ) : isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : isError || !submission ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Alert severity="error" sx={{ display: 'inline-flex', mb: 2 }}>
              This submission couldn't be found, or you don't have access to it.
            </Alert>
            <Box sx={{ mt: 2 }}>
              <Button component={Link} to="/profile/submissions" variant="contained">
                Back to My Submissions
              </Button>
            </Box>
          </Box>
        ) : submission.status !== 'pending' ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Alert severity="warning" sx={{ display: 'inline-flex', mb: 2 }}>
              This submission can no longer be edited - it's already in review or has been processed.
            </Alert>
            <Box sx={{ mt: 2 }}>
              <Button component={Link} to="/profile/submissions" variant="contained">
                Back to My Submissions
              </Button>
            </Box>
          </Box>
        ) : (
          <UserUploadForm key={submission.id} editSubmission={submission} />
        )}
      </Container>
    </GeneralLayout>
  );
}
