import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import { styled, alpha } from '@mui/material/styles';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import UpdateOutlinedIcon from '@mui/icons-material/UpdateOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';

import { Box, Container, Typography, Divider, Chip, Paper, Stack } from '@mui/material';

const LAST_UPDATED = 'April 23, 2026';

export const Route = createFileRoute('/help/terms-of-service')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Terms of Service', '', match.pathname),
  }),
});

function RouteComponent() {
  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          <HeroSection>
            <Typography variant="h1" sx={{ fontSize: '46px!important' }}>
              Terms of Service
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mx: 'auto', lineHeight: 1.8 }}>
              Plain-language terms for using our service. Please read them before you get started.
            </Typography>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
              Last updated: {LAST_UPDATED}
            </Typography>
          </HeroSection>

          <Divider sx={{ mb: 6 }} />

          <SummaryBanner elevation={0}>
            <GavelOutlinedIcon sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                The short version
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                The service is free. You're responsible for what you do with it. We provide no warranties and accept no
                liability for any harm arising from your use. Use it wisely.
              </Typography>
            </Box>
          </SummaryBanner>

          <Stack spacing={2}>
            {sections.map((section) => (
              <SectionCard key={section.title} highlight={section.highlight} elevation={0}>
                <IconCircle highlight={section.highlight}>{section.icon}</IconCircle>

                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.4 }} gutterBottom>
                    {section.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.85 }}>
                    {section.body}
                  </Typography>
                </Box>
              </SectionCard>
            ))}
          </Stack>

          <Box
            sx={{
              mt: 5,
              p: 3,
              borderRadius: 3,
              backgroundColor: 'action.hover',
              borderLeft: '3px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
              Governing Law
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              These terms are governed by the laws of the jurisdiction in which we operate, without regard to
              conflict-of-law principles. Any disputes arising from these terms or your use of the service will be
              subject to the exclusive jurisdiction of the courts in that jurisdiction.
            </Typography>
          </Box>

          <ContactBox elevation={0}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              Questions about these terms?
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', lineHeight: 1.8 }}>
              If anything here is unclear or you'd like to get in touch, reach us at{' '}
              <Typography
                component="a"
                href="mailto:team@celestial.dev"
                variant="body2"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                team@celestial.dev
              </Typography>
              .
            </Typography>
          </ContactBox>
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

interface TosSection {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  highlight?: boolean;
}

const sections: TosSection[] = [
  {
    icon: <CardGiftcardOutlinedIcon />,
    title: 'Pattern Use',
    body: (
      <>
        Pattern Archive does not have restrictions on how you use the downloadable patterns available through this
        service. Some patterns may still be protected by other copyright holders though.
        <br />
        <br />
        External Source Patterns follow the terms and copyright policies set by their original creators. We include them
        here to make them easier to discover, and when possible, we display images from the source location you are
        linked to which may change at any time outside of Pattern Archive's control. Because these patterns come from
        other platforms, their availability and pricing are determined solely by the provider, not by Pattern Archive.
      </>
    ),
  },
  {
    icon: <PersonOutlinedIcon />,
    title: 'Your Responsibility',
    body: (
      <>
        You are solely responsible for how you use this service and for any outcomes that result from your use of it. By
        using the patterns, you agree that you are acting under your own judgment and that any actions you take using or
        informed by this service are <strong>entirely your own responsibility</strong>.
      </>
    ),
  },
  {
    icon: <WarningAmberOutlinedIcon />,
    title: 'No Warranty & Limitation of Liability',
    highlight: true,
    body: (
      <>
        This service is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranty of any
        kind - express or implied. We make no guarantees regarding accuracy, reliability, uptime, or fitness for any
        particular purpose. To the fullest extent permitted by law, we disclaim all liability for any direct, indirect,
        incidental, consequential, or other damages arising from your use of, or inability to use, this service, even if
        we have been advised of the possibility of such damages.
      </>
    ),
  },
  {
    icon: <HandshakeOutlinedIcon />,
    title: 'Acceptable Use',
    body: (
      <>
        You agree not to use this service for any unlawful purpose or in any way that could harm others. You may not
        attempt to disrupt, reverse-engineer, or exploit the platform. We reserve the right to suspend access for any
        user who violates these terms.
      </>
    ),
  },
  {
    icon: <UpdateOutlinedIcon />,
    title: 'Changes to These Terms',
    body: (
      <>
        We may update these Terms of Service from time to time. When we do, we will update the date at the top of this
        page. Continued use of the service after any changes constitutes your acceptance of the revised terms. If a
        change is material, we will make reasonable efforts to notify registered users in advance.
      </>
    ),
  },
];

const PageWrapper = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));

const HeroSection = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(8),
}));

const SummaryBanner = styled(Paper)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.06),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  borderRadius: 16,
  padding: theme.spacing(3, 4),
  marginBottom: theme.spacing(6),
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(2),
}));

const SectionCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'highlight',
})<{ highlight?: boolean }>(({ theme, highlight }) => ({
  backgroundColor: highlight ? alpha(theme.palette.warning.main, 0.04) : theme.palette.background.paper,
  border: `1px solid ${highlight ? alpha(theme.palette.warning.main, 0.3) : theme.palette.divider}`,
  borderRadius: 16,
  padding: theme.spacing(3.5, 4),
  display: 'flex',
  gap: theme.spacing(3),
  alignItems: 'flex-start',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    borderColor: highlight ? alpha(theme.palette.warning.main, 0.5) : alpha(theme.palette.primary.main, 0.4),
    boxShadow: `0 4px 20px ${alpha(highlight ? theme.palette.warning.main : theme.palette.primary.main, 0.08)}`,
  },
}));

const IconCircle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'highlight',
})<{ highlight?: boolean }>(({ theme, highlight }) => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: highlight ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.primary.main, 0.1),
  color: highlight ? theme.palette.warning.main : theme.palette.primary.main,
  '& svg': { fontSize: 22 },
}));

const ContactBox = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  padding: theme.spacing(4),
  textAlign: 'center',
  marginTop: theme.spacing(6),
}));
