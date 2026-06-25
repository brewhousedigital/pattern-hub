import { createFileRoute, Link } from '@tanstack/react-router';
import { queryClient } from '@/functions/database/authentication-setup';
import { getPatternByIdOptions, useQueryGetPatternById } from '@/functions/database/patterns';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { PatternViewContent } from '@/components/PatternViewContent';
import { generateSEO } from '@/functions/utilities/seo';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Box, Container, Link as MuiLink } from '@mui/material';

export const Route = createFileRoute('/pattern/$patternId')({
  component: RouteComponent,
  loader: ({ params }) => queryClient.ensureQueryData(getPatternByIdOptions(params.patternId)),
  head: ({ loaderData, match }) => ({
    meta: generateSEO(loaderData?.name, loaderData?.description, match.pathname),
  }),
});

function RouteComponent() {
  const { patternId } = Route.useParams();
  const { isPending, isError, data } = useQueryGetPatternById(patternId);

  if (isPending) {
    return <FullScreenLoader />;
  }

  return (
    <GeneralLayout>
      <Box sx={{ backgroundColor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
          <MuiLink
            component={Link}
            to="/"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 3,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
            Back to search
          </MuiLink>

          {isError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              Pattern not found or failed to load.
            </Alert>
          )}

          <PatternViewContent viewData={data} showStandaloneTags />
        </Container>
      </Box>
    </GeneralLayout>
  );
}
