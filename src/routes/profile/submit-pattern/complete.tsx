import { createFileRoute, Link } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import { styled, alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';

export const Route = createFileRoute('/profile/submit-pattern/complete')({
  ssr: false,
  component: RouteComponent,
  head: ({ match }) => generateSEO('Pattern Submitted', 'Your pattern has been submitted for review', match.pathname),
});

function RouteComponent() {
  return (
    <GeneralLayout>
      <Container disableGutters maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <Card elevation={0}>
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
              Thank you for submitting a pattern!
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              The team will review it and finish the rest of the processing.
            </Typography>

            <Stack spacing={1.5}>
              <Button
                component={Link}
                to="/profile/submit-pattern"
                variant="contained"
                fullWidth
                sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700 }}
              >
                Submit another pattern
              </Button>
              <Button
                component={Link}
                to="/"
                variant="outlined"
                fullWidth
                sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 700 }}
              >
                Go to the homepage
              </Button>
            </Stack>
          </Box>
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
