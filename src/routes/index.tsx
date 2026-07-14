import React, { useState } from 'react';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { HomepageDoodle } from '@/components/homepage/HomepageDoodle';
import { useQuerySearchTags } from '@/functions/database/tags';
import { generateSEO } from '@/functions/utilities/seo';

import SearchIcon from '@mui/icons-material/Search';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';

import { Box, Chip, InputAdornment, Stack, TextField } from '@mui/material';
import { alpha } from '@mui/material/styles';

// Search params the browse experience used when it lived at "/". Old shared
// links (drawer shares, tag links, bookmarks) must keep working, so any of
// these on the homepage redirects to /pattern with the search intact. Runs
// during SSR too, so crawlers and link unfurlers follow the redirect and read
// the pattern meta from /pattern.
const LEGACY_PATTERN_SEARCH_KEYS = [
  'patternId',
  'q',
  'tags',
  'authors',
  'id',
  'title',
  'description',
  'parts',
  'width',
  'height',
  'filesize',
  'sort',
  'pageNumber',
  'exportTab',
] as const;

export const Route = createFileRoute('/')({
  component: RouteComponent,
  // Loose passthrough: the homepage has no search params of its own, but
  // beforeLoad needs to see legacy ones to redirect them.
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: ({ search }) => {
    if (LEGACY_PATTERN_SEARCH_KEYS.some((key) => search[key] !== undefined)) {
      throw redirect({ to: '/pattern', search: search as never });
    }
  },
  head: () => generateSEO(),
});

function RouteComponent() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Top 100 tags by count - powers the "Random Tag" button. Small, cached.
  const { data: topTags = [] } = useQuerySearchTags('');

  const goToPatterns = (search: { q?: string; tags?: string[]; sort?: '-favorite_count' }) => {
    void navigate({ to: '/pattern', search, viewTransition: true });
  };

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    goToPatterns(trimmed ? { q: trimmed } : {});
  };

  const handleRandomTag = () => {
    if (topTags.length === 0) {
      goToPatterns({});
      return;
    }
    const random = topTags[Math.floor(Math.random() * topTags.length)];
    goToPatterns({ tags: [String(random.tag)] });
  };

  return (
    <GeneralLayout>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          // Fill the viewport between header and footer so the hero sits
          // vertically centered, Google-style
          minHeight: 'calc(100svh - 320px)',
          px: 2,
          py: 8,
        }}
      >
        <HomepageDoodle />

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            width: '100%',
            maxWidth: 584,
            mt: 5,
            // Shared element with the search bar on /pattern - browsers with the
            // View Transitions API morph between the two on navigation
            viewTransitionName: 'pattern-search',
          }}
        >
          <TextField
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patterns by tag, like &quot;cat&quot; or &quot;snowflake&quot;…"
            autoComplete="off"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 999,
                  backgroundColor: '#fff',
                  px: 2.5,
                  py: 0.5,
                  boxShadow: (t) => `0 2px 12px ${alpha(t.palette.common.black, 0.08)}`,
                  '&:hover, &.Mui-focused': {
                    boxShadow: (t) => `0 4px 20px ${alpha(t.palette.common.black, 0.14)}`,
                  },
                  '& fieldset': { border: 'none' },
                },
              },
            }}
          />
        </Box>

        <Stack
          direction="row"
          sx={{ gap: 1.25, mt: 4, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <Chip
            icon={<CasinoRoundedIcon sx={{ fontSize: '16px !important' }} />}
            label="Random Tag"
            clickable
            variant="outlined"
            onClick={handleRandomTag}
            sx={{ px: 0.5 }}
          />

          <Chip
            icon={<WhatshotRoundedIcon sx={{ fontSize: '16px !important' }} />}
            label="Most Popular"
            clickable
            variant="outlined"
            onClick={() => goToPatterns({ sort: '-favorite_count' })}
            sx={{ px: 0.5 }}
          />

          <Link
            to="/wiki/$categorySlug/$pageSlug"
            params={{ categorySlug: 'site-functions', pageSlug: 'search' }}
            style={{ textDecoration: 'none' }}
          >
            <Chip
              icon={<TipsAndUpdatesRoundedIcon sx={{ fontSize: '16px !important' }} />}
              label="Tips on Searching"
              clickable
              variant="outlined"
              sx={{ px: 0.5 }}
            />
          </Link>
        </Stack>
      </Box>
    </GeneralLayout>
  );
}
