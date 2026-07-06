import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import { styled, alpha } from '@mui/material/styles';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { Box, Container, Typography, Divider, Paper, Stack } from '@mui/material';

const LAST_UPDATED = 'April 4, 2026';

export const Route = createFileRoute('/help/privacy-policy')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Privacy Policy', '', match.pathname),
});

function RouteComponent() {
  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          <HeroSection>
            <Typography variant="h1" sx={{ fontSize: '46px!important' }}>
              Privacy Policy
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', lineHeight: 1.8 }}>
              We built Pattern Archive with privacy as a default, not an afterthought. Here's exactly what we do, and
              don't do, with your data.
            </Typography>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
              Last updated: {LAST_UPDATED}
            </Typography>
          </HeroSection>

          <Divider sx={{ mb: 6 }} />

          <SummaryBanner elevation={0}>
            <ShieldOutlinedIcon sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                The short version
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                Anonymous users: very little data collected. Registered users: email only, for account management. We
                don't sell data. We don't use third-party analytics. That's it.
              </Typography>
            </Box>
          </SummaryBanner>

          <Stack spacing={2}>
            {sections.map((section) => (
              <SectionCard key={section.title} elevation={0}>
                <IconCircle>{section.icon}</IconCircle>

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
              Account Deletion & Data Retention
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              When you delete your account, your email address is permanently removed from our systems. We do not retain
              any residual account data after account deletion.
            </Typography>
          </Box>

          <Box sx={{ mt: 4, p: 3, borderRadius: 3, backgroundColor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
              Changes to This Policy
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              If we ever change this policy in a meaningful way, we will notify registered users by email before the
              change takes effect. We will never retroactively weaken the privacy protections described here without
              explicit consent.
            </Typography>
          </Box>

          <ContactBox elevation={0}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              Questions about your privacy?
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', lineHeight: 1.8 }}>
              If you have any questions or concerns about this policy or how your data is handled, reach out to us at{' '}
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
              . We'll respond promptly.
            </Typography>
          </ContactBox>
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

interface PolicySection {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

const sections: PolicySection[] = [
  {
    icon: <PersonOffOutlinedIcon />,
    title: 'Anonymous Users',
    body: (
      <>
        If you use our service without creating an account, we collect{' '}
        <strong>as little information as possible</strong> about you. We don't collect cookies for tracking, and don't
        perform device fingerprinting. We do collect your IP address when you make an API request to our backend. This
        is used for rate limiting and security. We don't tie it to any profile unless you are logged in to an account.
        We also collect your "User Agent" information which is brief information about what browser you are on, and
        sometimes what operating system you use. This can be easily obfuscated and some browsers like Brave Browser do
        this automatically.
      </>
    ),
  },
  {
    icon: <ManageAccountsOutlinedIcon />,
    title: 'Registered Users',
    body: (
      <>
        When you create an account, we store your email address solely for account management purposes: password resets,
        security notices, and essential communications. We do not build profiles, infer demographics, or use your email
        for any purpose beyond keeping your account operational.
      </>
    ),
  },
  {
    icon: <BlockOutlinedIcon />,
    title: 'We Never Sell Your Data',
    body: (
      <>
        Your information is <strong>never sold, rented, or traded</strong> to any third party under any circumstances.
        It is not part of any advertising exchange, data broker arrangement, or commercial partnership.
      </>
    ),
  },
  {
    icon: <VisibilityOffOutlinedIcon />,
    title: 'No Third-Party Analytics',
    body: (
      <>
        We do not use any third-party analytics or telemetry services. There are{' '}
        <strong>no external tracking scripts</strong> on our platform that could observe your behavior.
      </>
    ),
  },
];

const PageWrapper = styled(Box)(({ theme }) => ({
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

const SectionCard = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  padding: theme.spacing(3.5, 4),
  display: 'flex',
  gap: theme.spacing(3),
  alignItems: 'flex-start',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`,
  },
}));

const IconCircle = styled(Box)(({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
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
