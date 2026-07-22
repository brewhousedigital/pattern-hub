import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { useQueryGetPublicSiteStats } from '@/functions/database/site-stats';
import { COMMUNITY_BANNERS, type CommunityBanner } from '@/constants/community-banners';
import { copyToClipboard } from '@/functions/utilities/copy-to-clipboard';
import { DOMAIN_URL, DISCORD_SERVER_LINK, REDDIT_LINK } from '@/data/constants';
import { DiscordIcon } from '@/assets/DiscordIcon';
import { dynamicCacheHeaders } from '@/functions/utilities/cache-headers';

import RedditIcon from '@mui/icons-material/Reddit';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import HistoryToggleOffRoundedIcon from '@mui/icons-material/HistoryToggleOffRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';

import { alpha, styled } from '@mui/material/styles';
import { Box, Button, Chip, Container, Grid, Skeleton, Stack, Typography } from '@mui/material';

// In no particular order - see WALL_OF_FAME.txt at the project root for the source list.
const WALL_OF_FAME: { name: string; blurb: string }[] = [
  {
    name: 'Raine',
    blurb:
      'Vectorizing hundreds of patterns, providing dozens of their own patterns, helping us deal with Cricut and its stupidness while testing the vast majority of the site.',
  },
  {
    name: 'Jog',
    blurb: 'Helping dig through dozens of websites to collect patterns, vectorizing dozens of patterns and connecting with pattern authors.',
  },
  {
    name: 'Axin',
    blurb: 'Creating the site, dealing with all the mess we made and stepping into the great unknown of creating a project like this.',
  },
  {
    name: 'KGlassPatterns',
    blurb:
      'Agreeing to be our first pattern author directly involved with the project, all the feedback on the author account pages and providing their entire pattern catalog (our first full catalog) for archiving.',
  },
  {
    name: 'Kristin',
    blurb: 'Vectorizing and helpful feedback on layouts of pages.',
  },
  {
    name: 'Autumn',
    blurb: 'Vectorizing, feedback on various elements and helping with vectorizing guidelines.',
  },
  {
    name: 'Ollie',
    blurb: 'Sharing with their local glass shop owner to get feedback and for helping out testing features.',
  },
  {
    name: 'Alicia',
    blurb: 'Helping test out the processes we use for vectorizing, worker tracking and vectorizing patterns.',
  },
  {
    name: 'Frank & Crow',
    blurb: 'Helping us decide how to try to fairly represent paid for patterns.',
  },
  {
    name: 'Deejiraffe',
    blurb: 'Connecting us with Axin for creating all of this while giving tons of feedback at every step of the process.',
  },
];

export const Route = createFileRoute('/community/')({
  component: RouteComponent,
  head: ({ match }) =>
    generateSEO(
      'Spread the Word',
      'Help Pattern Archive reach more crafters - banners, embed code, and a look back at where it all started.',
      match.pathname,
    ),
  headers: dynamicCacheHeaders,
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
            <Grid size={{ xs: 4 }}>
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
            <Grid size={{ xs: 4 }}>
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
            <Grid size={{ xs: 4 }}>
              <StatCard>
                {statsPending ? (
                  <Skeleton variant="text" width="50%" sx={{ mx: 'auto', fontSize: '2.25rem' }} />
                ) : (
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {(stats?.tags ?? 0).toLocaleString()}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Tags to explore
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

          {/* ─── Wall of Fame ─────────────────────────────────────────────── */}
          <SectionHeading variant="h2">Wall of Fame!</SectionHeading>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <EmojiEventsRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
            <Typography color="text.secondary">
              In no particular order - the community members who helped make Pattern Archive what it is.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {WALL_OF_FAME.map((person) => (
              <Grid size={{ xs: 12, sm: 6 }} key={person.name}>
                <FameCard>
                  <FameNameRow>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {person.name}
                    </Typography>
                  </FameNameRow>
                  <Typography variant="body2" color="text.secondary">
                    {person.blurb}
                  </Typography>
                </FameCard>
              </Grid>
            ))}

            <Grid size={{ xs: 12 }}>
              <FameCard sx={{ textAlign: 'center' }}>
                <FameNameRow sx={{ justifyContent: 'center' }}>
                  <DiscordIcon style={{ fontSize: 18 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    The Stained Glass Discord
                  </Typography>
                </FameNameRow>
                <Typography variant="body2" color="text.secondary">
                  Everyone who jumped in whenever we needed extra eyes to check something out, give feedback, or test a
                  feature.
                </Typography>
              </FameCard>
            </Grid>
          </Grid>

          <ThankYouBanner>
            <FavoriteRoundedIcon sx={{ color: 'primary.main', fontSize: 28, mb: 1 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>
              Without these people this project wouldn't exist, wouldn't be this awesome, and wouldn't have all the
              content it does.
            </Typography>
            <Typography color="text.secondary">
              Thank you. You all should be extremely proud to know you've helped the glass community (and possibly
              others!) in unmeasurable ways.
            </Typography>
          </ThankYouBanner>
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

const FameCard = styled(Box)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(2.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[2],
    borderColor: theme.palette.primary.main,
  },
}));

const FameNameRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  marginBottom: theme.spacing(0.75),
  color: theme.palette.primary.main,
}));

const ThankYouBanner = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(5, 3),
  marginTop: theme.spacing(4),
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.primary.main, 0.02)})`,
}));
