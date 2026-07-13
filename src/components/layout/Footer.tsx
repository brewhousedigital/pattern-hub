import React from 'react';
import { Logo } from '@/components/layout/Header/Header.tsx';
import { Link, useLocation } from '@tanstack/react-router';
import { copyToURLClipboard } from '@/functions/utilities/copy-to-clipboard.ts';
import { SectionLabel } from '@/components/ViewHelpers.tsx';
import { DOMAIN_URL, KOFI_LINK, DISCORD_SERVER_LINK, REDDIT_LINK } from '@/data/constants.ts';
import { subLinkStyles } from '@/components/layout/Header/sublink-styles.ts';
import { DiscordIcon } from '@/assets/DiscordIcon.tsx';

import { useVisitCounter } from '@/functions/database/visit-counter.ts';

import RedditIcon from '@mui/icons-material/Reddit';
import ShareIcon from '@mui/icons-material/Share';
import { Box, Button, Grid, Stack, Typography, Link as MuiLink } from '@mui/material';

// Old-school hit counter - zero-padded digits in dark odometer cells. Counts
// sessions only (see useVisitCounter); renders nothing until the count loads
// so a failed request just means no counter, never a broken footer.
const VisitorCounter = () => {
  const { data: count } = useVisitCounter();

  if (count == null) return null;

  const digits = String(count).padStart(7, '0').split('');

  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' }, gap: 1.25, mt: 4 }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.6875rem' }}
      >
        You are visitor
      </Typography>

      <Stack direction="row" sx={{ gap: '3px' }} aria-label={`Visitor number ${count}`}>
        {digits.map((digit, index) => (
          <Box
            key={index}
            aria-hidden="true"
            sx={{
              backgroundColor: '#101710',
              color: '#4ade80',
              fontFamily: '"Courier New", Courier, monospace',
              fontWeight: 700,
              fontSize: '0.9rem',
              lineHeight: 1,
              px: 0.6,
              py: 0.5,
              borderRadius: '3px',
              border: '1px solid #2a3a2a',
              boxShadow: 'inset 0 -6px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
              textShadow: '0 0 6px rgba(74,222,128,0.6)',
            }}
          >
            {digit}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
};

export const Footer = () => {
  const location = useLocation();

  const shareSite = async () => {
    await copyToURLClipboard(DOMAIN_URL + location.publicHref);
  };

  return (
    <Box component="footer" sx={{ p: 2 }}>
      <Box sx={{ backgroundColor: '#fff', borderRadius: 6, p: 4, textAlign: { xs: 'center', md: 'inherit' } }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 3 }} sx={{ mb: { xs: 4, md: 0 } }}>
            <Logo />

            <Box>
              <Button
                size="small"
                variant="contained"
                component="a"
                href={KOFI_LINK}
                target="_blank"
                startIcon={
                  <img
                    loading="lazy"
                    width="88"
                    height="71"
                    style={{ border: 0, maxWidth: 24, width: '100%', height: 'auto' }}
                    src="/images/icons/kofi-logo.png"
                    alt="Support the developer of Pattern Archive"
                  />
                }
              >
                Support the developer of Pattern Archive
              </Button>
            </Box>

            <VisitorCounter />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1} sx={{ mb: { xs: 4, md: 0 } }}>
              <SectionLabel>Explore</SectionLabel>

              {/*<MuiLink component={Link} to="/collections" sx={subLinkStyles}>
                Collections
              </MuiLink>*/}

              {/*<MuiLink component={Link} to="/guides" sx={subLinkStyles}>
                Guides
              </MuiLink>*/}

              <MuiLink component={Link} to="/help/faq" sx={subLinkStyles}>
                FAQ
              </MuiLink>

              <MuiLink component={Link} to="/wiki" sx={subLinkStyles}>
                Wiki
              </MuiLink>

              <MuiLink component={Link} to="/sets" sx={subLinkStyles}>
                Sets
              </MuiLink>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1} sx={{ mb: { xs: 4, md: 0 } }}>
              <SectionLabel>Helpful Links</SectionLabel>

              {/*<MuiLink component={Link} to="/help/about" sx={subLinkStyles}>
                About
              </MuiLink>*/}

              <MuiLink component={Link} to="/community" sx={subLinkStyles}>
                Community
              </MuiLink>

              <MuiLink component={Link} to="/help/contact" sx={subLinkStyles}>
                Contact
              </MuiLink>

              <MuiLink component={Link} to="/help/privacy-policy" sx={subLinkStyles}>
                Privacy Policy
              </MuiLink>

              <MuiLink component={Link} to="/help/terms-of-service" sx={subLinkStyles}>
                Terms of Service
              </MuiLink>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1}>
              <Button startIcon={<ShareIcon />} onClick={shareSite}>
                Share
              </Button>

              <Button component="a" startIcon={<RedditIcon />} href={REDDIT_LINK} target="_blank">
                Reddit
              </Button>

              <Button component="a" startIcon={<DiscordIcon />} href={DISCORD_SERVER_LINK} target="_blank">
                Discord
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
