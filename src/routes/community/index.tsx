import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { useQueryGetPublicSiteStats } from '@/functions/database/site-stats';
import { COMMUNITY_BANNERS, type CommunityBanner } from '@/constants/community-banners';
import { copyToClipboard } from '@/functions/utilities/copy-to-clipboard';
import { DOMAIN_URL, DISCORD_SERVER_LINK, REDDIT_LINK } from '@/data/constants';
import { DiscordIcon } from '@/assets/DiscordIcon';

import RedditIcon from '@mui/icons-material/Reddit';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import HistoryToggleOffRoundedIcon from '@mui/icons-material/HistoryToggleOffRounded';

import { alpha, styled } from '@mui/material/styles';
import { Box, Button, Chip, Container, Grid, Skeleton, Stack, Typography } from '@mui/material';

export const Route = createFileRoute('/community/')({
  component: RouteComponent,
  head: ({ match }) =>
    generateSEO(
      'Spread the Word',
      'Help Pattern Archive reach more crafters - banners, embed code, and a look back at where it all started.',
      match.pathname,
    ),
});

function RouteComponent() {
  const { data: stats, isPending: statsPending } = useQueryGetPublicSiteStats();

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          {/* ─── Hero ─────────────────────────────────────────────────────── */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <CelebrationRoundedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="h1" sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 800, mb: 1.5 }}>
              Spread the Word
            </Typography>

            <Typography color="text.secondary" sx={{ maxWidth: 560, mx: 'auto', fontSize: '1.05rem' }}>
              Pattern Archive grows one share at a time. Every link, banner, and Reddit post helps another crafter find
              their next project, and helps more stained glass artists find a home for their work.
            </Typography>
          </Box>

          {/* ─── Stats strip ──────────────────────────────────────────────── */}
          <Grid container spacing={2} sx={{ mb: 16 }}>
            <Grid size={{ xs: 6 }}>
              <StatCard>
                {statsPending ? (
                  <Skeleton variant="text" width="50%" sx={{ mx: 'auto', fontSize: '2.25rem' }} />
                ) : (
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {(stats?.patterns ?? 0).toLocaleString()}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Patterns to browse
                </Typography>
              </StatCard>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <StatCard>
                {statsPending ? (
                  <Skeleton variant="text" width="50%" sx={{ mx: 'auto', fontSize: '2.25rem' }} />
                ) : (
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {(stats?.members ?? 0).toLocaleString()}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Members and counting
                </Typography>
              </StatCard>
            </Grid>
          </Grid>

          {/* ─── Banners & Graphics ───────────────────────────────────────── */}
          <SectionHeading variant="h2">Banners &amp; Graphics</SectionHeading>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Grab a banner for your website, or blog.
          </Typography>

          {COMMUNITY_BANNERS.length === 0 ? (
            <EmptyBannerNotice>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Banners coming soon!</Typography>
              <Typography variant="body2" color="text.secondary">
                We're still putting these together - check back shortly.
              </Typography>
            </EmptyBannerNotice>
          ) : (
            <Stack spacing={3} sx={{ mb: 16 }}>
              {COMMUNITY_BANNERS.map((banner) => (
                <BannerCard key={banner.id} banner={banner} />
              ))}
            </Stack>
          )}

          {/* ─── Join the conversation ────────────────────────────────────── */}
          <SectionHeading variant="h2">Join the Conversation</SectionHeading>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Talking about the site helps just as much as linking to it. Come hang out.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 16 }}>
            <Button
              component="a"
              href={DISCORD_SERVER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<DiscordIcon />}
              size="large"
              sx={{ flex: 1 }}
            >
              Join the Discord
            </Button>
            <Button
              component="a"
              href={REDDIT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<RedditIcon />}
              size="large"
              sx={{ flex: 1 }}
            >
              r/StainedGlass
            </Button>
          </Stack>

          {/* ─── Time Capsule ─────────────────────────────────────────────── */}
          <SectionHeading variant="h2">Time Capsule</SectionHeading>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <HistoryToggleOffRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
            <Typography color="text.secondary">This is Pattern Archive on day one -</Typography>
            <Chip label="Started January 27, 2026" size="small" color="primary" variant="outlined" />
          </Box>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            One very good dog, a search bar, and absolutely no ratings system yet. We've come a long way.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TimeCapsuleImage
                src="/images/history/history-1.webp"
                alt="An early wireframe of Pattern Archive (then called Pattern Hub) showing a placeholder search grid"
                loading="lazy"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TimeCapsuleImage
                src="/images/history/history-2.webp"
                alt="An early wireframe of a single pattern view, with placeholder text standing in for real content"
                loading="lazy"
              />
            </Grid>
          </Grid>
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

// ─── Banner card ────────────────────────────────────────────────────────────

const BannerCard = ({ banner }: { banner: CommunityBanner }) => {
  const imageUrl = `${DOMAIN_URL}/images/share-banners/${banner.filename}`;
  const markdownSnippet = `[![${banner.alt}](${imageUrl})](${DOMAIN_URL})`;
  const htmlSnippet = `<a href="${DOMAIN_URL}"><img src="${imageUrl}" alt="${banner.alt}" width="${banner.width}" height="${banner.height}"></a>`;

  return (
    <BannerCardRoot>
      <Box
        component="img"
        src={`/images/share-banners/${banner.filename}`}
        alt={banner.alt}
        loading="lazy"
        sx={{ maxWidth: '100%', width: banner.width, height: 'auto', borderRadius: 1, mb: 2 }}
      />

      {/*<Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        {banner.label}
      </Typography>*/}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <Button
          component="a"
          href={`/images/share-banners/${banner.filename}`}
          download
          variant="contained"
          size="small"
          startIcon={<DownloadRoundedIcon fontSize="small" />}
        >
          Download
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
          onClick={() => copyToClipboard(markdownSnippet)}
        >
          Copy Markdown
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
          onClick={() => copyToClipboard(htmlSnippet)}
        >
          Copy HTML
        </Button>
      </Stack>

      <CodeBlock>{markdownSnippet}</CodeBlock>
      <CodeBlock sx={{ mt: 1 }}>{htmlSnippet}</CodeBlock>
    </BannerCardRoot>
  );
};

// ─── Styled bits ──────────────────────────────────────────────────────────────

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));

const SectionHeading = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 800,
  marginBottom: theme.spacing(1),
}));

const StatCard = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(2.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
}));

const EmptyBannerNotice = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(5),
  border: `1.5px dashed ${theme.palette.divider}`,
  borderRadius: 12,
  marginBottom: theme.spacing(7),
}));

const BannerCardRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
}));

const CodeBlock = styled(Box)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  color: theme.palette.text.secondary,
  overflowX: 'auto',
  whiteSpace: 'pre',
  display: 'none',
}));

const TimeCapsuleImage = styled('img')(({ theme }) => ({
  width: '100%',
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  display: 'block',
}));
