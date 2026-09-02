import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  getTagBySlugOptions,
  useQueryGetTagBySlug,
  useQueryGetTagUsageCount,
  useQueryGetDirectImpliedTags,
  useQueryGetTagsImplyingDirect,
  useQueryGetAliasesForTag,
} from '@/functions/database/tags';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

import { Alert, Box, Button, Chip, Container, Paper, Skeleton, Stack, Typography } from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────
//
// The Definition Page for one tag (Phase 1 of the tag redesign - see
// TAG_REDESIGN_PROJECT_NOTES.md). Phase 2 extended this route with the
// implied-tags/alias sections below.

export const Route = createFileRoute('/tags/$slug')({
  component: RouteComponent,
  loader: async ({ params, context }) => {
    const tag = await context.queryClient.ensureQueryData(getTagBySlugOptions(params.slug)).catch(() => undefined);
    // getTagBySlugOptions matches either the current slug or a past one
    // filed in previous_slugs - a mismatch here means this tag was renamed
    // since the requested URL was indexed or bookmarked. Redirect to the
    // canonical current slug instead of rendering under the stale one.
    if (tag && tag.slug !== params.slug) {
      throw redirect({ to: '/tags/$slug', params: { slug: tag.slug } });
    }
    return tag;
  },
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.tag,
      loaderData?.definition
        ? loaderData.definition.slice(0, 160)
        : loaderData?.tag
          ? `Stained glass patterns tagged "${loaderData.tag}".`
          : '',
      match.pathname,
      loaderData?.tag
        ? `https://patternarchive.net/api/og-image?type=tag&title=${encodeURIComponent(loaderData.tag)}`
        : undefined,
    ),
  headers: staticCacheHeaders,
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const { data: tagRecord, isPending, isError } = useQueryGetTagBySlug(slug);
  const { data: usageCount } = useQueryGetTagUsageCount(tagRecord?.tag ?? '');
  const { data: implies = [] } = useQueryGetDirectImpliedTags(tagRecord?.tag ?? '');
  const { data: impliedBy = [] } = useQueryGetTagsImplyingDirect(tagRecord?.tag ?? '');
  const { data: alsoKnownAs = [] } = useQueryGetAliasesForTag(tagRecord?.tag ?? '');

  if (isPending) {
    return (
      <GeneralLayout>
        <TagSkeleton />
      </GeneralLayout>
    );
  }

  if (isError || !tagRecord) {
    return (
      <GeneralLayout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Alert severity="info">This tag page could not be found. It may not exist yet.</Alert>
        </Container>
      </GeneralLayout>
    );
  }

  // "General" is the default Type every tag starts with (see Phase 1) - not
  // worth a badge on every single tag page, only shown once a tag has been
  // given a real, differentiating Type.
  const typeInfo = tagRecord.expand?.type;
  const showTypeBadge = !!typeInfo?.name && typeInfo.name.toLowerCase() !== 'general';

  return (
    <GeneralLayout>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: tagRecord.tag, url: `/tags/${tagRecord.slug}` },
        ]}
      />
      <Container maxWidth="md" sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 3, md: 4 }, mb: 4 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
            <LocalOfferRoundedIcon sx={{ color: 'text.disabled' }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              {tagRecord.tag}
            </Typography>
            {showTypeBadge && (
              <Chip
                size="small"
                label={typeInfo.name}
                sx={typeInfo.color ? { bgcolor: typeInfo.color, color: '#fff' } : undefined}
              />
            )}
          </Stack>

          {tagRecord.disambiguation_note && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {tagRecord.disambiguation_note}
            </Typography>
          )}

          <Button
            onClick={() => navigate({ to: '/pattern', search: { tags: [tagRecord.tag] } })}
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ mb: tagRecord.definition ? 3 : 0 }}
          >
            Browse {usageCount ?? 0} pattern{usageCount === 1 ? '' : 's'}
          </Button>

          {tagRecord.definition ? (
            <Box sx={{ color: 'text.secondary' }}>
              <MarkdownWrapper>{tagRecord.definition}</MarkdownWrapper>
            </Box>
          ) : (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              No definition written yet.
            </Typography>
          )}

          <RelatedTagChips label="Implies" tags={implies.map((e) => e.implies_tag)} />
          <RelatedTagChips label="Implied by" tags={impliedBy.map((e) => e.tag)} />
          <RelatedTagChips label="Also known as" tags={alsoKnownAs.map((a) => a.alias)} />
        </Paper>
      </Container>
    </GeneralLayout>
  );
}

// onClick + useNavigate(), not component={Link} - the same fix the "Browse
// N patterns" button above needed. MUI's polymorphic `component` prop
// doesn't narrow TanStack Router's per-route `search` typing correctly (see
// that button's own history in this file); onClick sidesteps it entirely.
function RelatedTagChips({ label, tags }: { label: string; tags: string[] }) {
  const navigate = useNavigate();
  if (tags.length === 0) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        {tags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            clickable
            onClick={() => navigate({ to: '/pattern', search: { tags: [tag] } })}
          />
        ))}
      </Stack>
    </Box>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const TagSkeleton = () => (
  <Container maxWidth="md" sx={{ py: 4, px: { xs: 2, md: 4 } }}>
    <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 3, md: 4 }, mb: 4 }}>
      <Skeleton variant="text" width="40%" sx={{ fontSize: '2rem', mb: 2 }} />
      <Skeleton variant="rounded" width={160} height={36} sx={{ mb: 3 }} />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="60%" />
    </Paper>
  </Container>
);
