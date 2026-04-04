import React from 'react';
import { Logo } from '@/components/layout/Header/Header.tsx';
import { Link, useLocation } from '@tanstack/react-router';
import { copyToClipboard } from '@/functions/utilities/copy-to-clipboard.ts';
import { SectionLabel } from '@/components/ViewHelpers.tsx';
import { DOMAIN_URL } from '@/data/constants.ts';
import { subLinkStyles } from '@/components/layout/Header/sublink-styles.ts';
import { DiscordIcon } from '@/assets/DiscordIcon.tsx';

import RedditIcon from '@mui/icons-material/Reddit';
import ShareIcon from '@mui/icons-material/Share';
import { Box, Button, Grid, Stack, Link as MuiLink } from '@mui/material';

export const Footer = () => {
  const location = useLocation();

  const shareSite = async () => {
    await copyToClipboard(DOMAIN_URL + location.publicHref);
  };

  return (
    <Box component="footer" sx={{ p: 2 }}>
      <Box sx={{ backgroundColor: '#fff', borderRadius: 6, p: 4, textAlign: { xs: 'center', md: 'inherit' } }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 3 }} sx={{ mb: { xs: 4, md: 0 } }}>
            <Logo />

            <Button
              variant="contained"
              component="a"
              href="https://ko-fi.com/I2I51RLS9K"
              target="_blank"
              startIcon={
                <img
                  width="88"
                  height="71"
                  style={{ border: 0, maxWidth: 24, width: '100%', height: 'auto' }}
                  src="/kofi-logo.png"
                  alt="Support the project on ko-fi.com"
                />
              }
            >
              Support the project on Ko-fi
            </Button>
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
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1} sx={{ mb: { xs: 4, md: 0 } }}>
              <SectionLabel>Helpful Links</SectionLabel>

              {/*<MuiLink component={Link} to="/help/about" sx={subLinkStyles}>
                About
              </MuiLink>*/}

              <MuiLink component={Link} to="/help/privacy-policy" sx={subLinkStyles}>
                Privacy Policy
              </MuiLink>

              <MuiLink component={Link} to="/help/terms-of-service" sx={subLinkStyles}>
                Terms of Service
              </MuiLink>

              <MuiLink component={Link} to="/help/contact" sx={subLinkStyles}>
                Contact
              </MuiLink>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1}>
              <Button startIcon={<ShareIcon />} onClick={shareSite}>
                Share
              </Button>

              <Button
                component="a"
                startIcon={<RedditIcon />}
                href="https://www.reddit.com/r/StainedGlass"
                target="_blank"
              >
                Reddit
              </Button>

              <Button component="a" startIcon={<DiscordIcon />} href="https://discord.gg/vFHvrhY5K8" target="_blank">
                Discord
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
