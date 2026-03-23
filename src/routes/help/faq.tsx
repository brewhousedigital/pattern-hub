import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryGetAllFAQ } from '@/functions/database/faq';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

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
} from '@mui/material';

export const Route = createFileRoute('/help/faq')({
  component: RouteComponent,
});

function RouteComponent() {
  const [expanded, setExpanded] = useState<number | false>(false);

  const { isPending, isError, data } = useQueryGetAllFAQ();

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

          {data && data.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                No FAQs available at the moment.
              </Typography>
            </Box>
          )}

          {data &&
            data.map((faq, index) => (
              <StyledAccordion key={index} expanded={expanded === index} onChange={handleChange(index)} disableGutters>
                <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={expanded === index ? 700 : 500}
                    sx={{ transition: 'font-weight 0.2s' }}
                  >
                    {faq.title}
                  </Typography>
                </StyledAccordionSummary>

                <StyledAccordionDetails>
                  <Divider sx={{ mb: 2.5 }} />

                  <MarkdownWrapper>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{faq.content}</ReactMarkdown>
                  </MarkdownWrapper>
                </StyledAccordionDetails>
              </StyledAccordion>
            ))}

          <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Can't find what you're looking for? Contact us and we'll get back to you shortly.
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

const MarkdownWrapper = styled(Box)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.8,
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    color: theme.palette.text.primary,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
  },
  '& h1': { fontSize: '1.5rem' },
  '& h2': { fontSize: '1.25rem' },
  '& h3': { fontSize: '1.1rem' },
  '& p': {
    marginTop: 0,
    marginBottom: theme.spacing(1.5),
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
    marginBottom: theme.spacing(1.5),
  },
  '& li': {
    marginBottom: theme.spacing(0.5),
  },
  '& code': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: '0.875em',
    fontFamily: 'monospace',
  },
  '& pre': {
    backgroundColor: theme.palette.action.hover,
    borderRadius: 8,
    padding: theme.spacing(2),
    overflowX: 'auto',
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
      color: theme.palette.text.primary,
    },
  },
  '& blockquote': {
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    margin: 0,
    paddingLeft: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
  '& hr': {
    border: 'none',
    borderTop: `1px solid ${theme.palette.divider}`,
    margin: theme.spacing(2, 0),
  },
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    p: 2,
  },
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
