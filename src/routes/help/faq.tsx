import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryGetAllFAQ } from '@/functions/database/faq';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { useFuzzySearch } from '@/functions/hooks/useFuzzySearch';
import { generateSEO } from '@/functions/utilities/seo';

import { styled, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
  Box,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
  Divider,
  TextField,
} from '@mui/material';

export const Route = createFileRoute('/help/faq')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('FAQ', '', match.pathname),
  }),
});

function RouteComponent() {
  const [expanded, setExpanded] = useState<number | false>(false);

  const { isPending, isError, data } = useQueryGetAllFAQ();

  const { query, search, results } = useFuzzySearch(data, ['title', 'content']);

  const handleChange = (index: number) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? index : false);
  };

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          {/* Hero */}
          <HeroSection>
            <Typography variant="h1" sx={{ fontSize: '46px!important' }}>
              Frequently Asked Questions
            </Typography>
          </HeroSection>

          <Box sx={{ mb: 2, maxWidth: 400, mx: 'auto' }}>
            <TextField
              fullWidth
              label="Search FAQ"
              variant="filled"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
          </Box>

          {/*<Divider sx={{ mb: 6 }} />*/}

          {/* Content */}
          {isPending && <FaqSkeleton />}

          {isError && (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                color: 'error.main',
                border: '1px solid',
                borderColor: 'error.light',
                borderRadius: 3,
                backgroundColor: 'error.50',
              }}
            >
              <Typography variant="h6" gutterBottom>
                Failed to load FAQs
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Unable to load the FAQ items... Sorry about that. Try again in a few minutes.
              </Typography>
            </Box>
          )}

          {results && results.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                No FAQs available at the moment.
              </Typography>
            </Box>
          )}

          {results &&
            results.map((faq, index) => (
              <StyledAccordion key={index} expanded={expanded === index} onChange={handleChange(index)} disableGutters>
                <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: expanded === index ? 700 : 500, transition: 'font-weight 0.2s' }}
                  >
                    {faq.title}
                  </Typography>
                </StyledAccordionSummary>

                <StyledAccordionDetails>
                  <Divider sx={{ mb: 2.5 }} />

                  <MarkdownWrapper>{faq.content}</MarkdownWrapper>
                </StyledAccordionDetails>
              </StyledAccordion>
            ))}

          <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Can't find what you're looking for? <Link to="/help/contact">Contact us</Link> and we'll get back to you
            shortly.
          </Typography>
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));

const HeroSection = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(4),
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '12px !important',
  marginBottom: theme.spacing(2),
  boxShadow: 'none',
  '&:before': { display: 'none' },
  '&.Mui-expanded': {
    boxShadow: `0 4px 24px ${alpha(theme.palette.primary.main, 0.1)}`,
    borderColor: theme.palette.primary.main,
  },
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
}));

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
  padding: theme.spacing(0.5, 3),
  minHeight: 64,
  '& .MuiAccordionSummary-content': {
    margin: theme.spacing(2, 0),
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: theme.palette.primary.main,
  },
}));

const StyledAccordionDetails = styled(AccordionDetails)(({ theme }) => ({
  padding: theme.spacing(0, 3, 3),
}));

const FaqSkeleton: React.FC = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <Box
        key={i}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
          mb: 2,
          p: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width={`${45 + i * 8}%`} height={28} />
          <Skeleton variant="circular" width={24} height={24} sx={{ ml: 'auto' }} />
        </Box>
      </Box>
    ))}
  </>
);
