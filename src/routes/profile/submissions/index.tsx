import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { useGlobalAuthData } from '@/data/auth-data';
import { createPrettyDate } from '@/functions/utilities/dates';
import { PaginationBox } from '@/components/PaginationBox';
import {
  useQueryGetMySubmissions,
  type TypeUserSubmittedPatternResponse,
  type TypeUserSubmissionStatus,
} from '@/functions/database/user-submissions';
import { generateUserSubmissionFileUrl } from '@/functions/utilities/generate-pb-image';

import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { Alert, Box, Button, Chip, CircularProgress, Container, Grid, Paper, Stack, Typography } from '@mui/material';

export const Route = createFileRoute('/profile/submissions/')({
  component: RouteComponent,
  ssr: false,
  head: () => generateSEO('My Submissions', 'Track the status of the patterns you have submitted', '/profile/submissions'),
});

const STATUS_META: Record<TypeUserSubmissionStatus, { label: string; color: 'default' | 'info' | 'success' | 'error' }> = {
  pending: { label: 'Pending review', color: 'default' },
  in_review: { label: 'In review', color: 'info' },
  published: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
};

function RouteComponent() {
  const { authData } = useGlobalAuthData();
  const [page, setPage] = React.useState(1);

  const { data, isPending, isError } = useQueryGetMySubmissions(authData?.id || '', page);

  return (
    <GeneralLayout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {!authData?.id ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Alert severity="info" sx={{ display: 'inline-flex', mb: 2 }}>
              You need to be logged in to view your submissions.
            </Alert>
            <Box>
              <Button component={Link} to="/auth/login" variant="contained">
                Log In
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 3 }}
            >
              <Box>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.4px' }}>
                  My Submissions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track the patterns you've submitted for review.
                </Typography>
              </Box>
              <Button
                component={Link}
                to="/profile/submit-pattern"
                variant="outlined"
                startIcon={<UploadFileRoundedIcon />}
              >
                Submit another pattern
              </Button>
            </Stack>

            {isPending ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : isError ? (
              <Alert severity="error">Unable to load your submissions right now - please try again shortly.</Alert>
            ) : !data?.items.length ? (
              <Box sx={{ py: 8, textAlign: 'center', border: '1.5px dashed', borderColor: 'divider', borderRadius: 3 }}>
                <UploadFileRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.disabled">
                  You haven't submitted any patterns yet.
                </Typography>
              </Box>
            ) : (
              <>
                <Grid container spacing={2}>
                  {data.items.map((submission) => (
                    <Grid key={submission.id} size={12}>
                      <SubmissionRow submission={submission} />
                    </Grid>
                  ))}
                </Grid>
                {data.totalItems > 0 && <PaginationBox data={data} value={page} setter={setPage} />}
              </>
            )}
          </>
        )}
      </Container>
    </GeneralLayout>
  );
}

const SubmissionRow = ({ submission }: { submission: TypeUserSubmittedPatternResponse }) => {
  const statusMeta = STATUS_META[submission.status];

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
        <Box
          component="img"
          src={generateUserSubmissionFileUrl(submission)}
          alt=""
          sx={{
            width: 72,
            height: 72,
            objectFit: 'contain',
            borderRadius: 2,
            backgroundColor: 'action.hover',
            flexShrink: 0,
            alignSelf: { xs: 'center', sm: 'auto' },
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {submission.name || 'Untitled pattern'}
            </Typography>
            <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Submitted {createPrettyDate(submission.created)}
          </Typography>

          {submission.status === 'rejected' && (
            <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
              {submission.rejection_reason || 'No reason was given.'}
            </Alert>
          )}
        </Box>

        {submission.status === 'pending' && (
          <Button
            component={Link as any}
            to="/profile/submit-pattern/$submissionId"
            params={{ submissionId: submission.id }}
            startIcon={<EditRoundedIcon />}
            variant="outlined"
            size="small"
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}
          >
            Edit
          </Button>
        )}

        {submission.status === 'published' && submission.resulting_pattern && (
          <Button
            component={Link as any}
            to="/pattern/$patternId"
            params={{ patternId: submission.resulting_pattern }}
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}
          >
            View pattern
          </Button>
        )}
      </Stack>
    </Paper>
  );
};
