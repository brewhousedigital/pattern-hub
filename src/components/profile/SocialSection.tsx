import React from 'react';
import { Box, Button, Grid, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { SOCIAL_PLATFORMS, extractYouTubeId } from '@/constants/profile-customization';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

export const SocialSection = ({ customization, setCust, onReset }: SectionCustProps) => (
  <SectionCard elevation={0}>
    <SectionHeader title="Media & Social Links" onReset={onReset} />

    <TextField
      fullWidth
      label="YouTube Video URL"
      variant="filled"
      placeholder="https://youtube.com/watch?v=… or https://youtu.be/…"
      value={customization.profile_youtube_url}
      onChange={(e) => setCust('profile_youtube_url', e.target.value.trim())}
      helperText={
        customization.profile_youtube_url
          ? extractYouTubeId(customization.profile_youtube_url)
            ? '✓ Valid YouTube URL'
            : '⚠ Could not find a video ID in this URL'
          : 'Paste a YouTube video link to embed it on your profile.'
      }
      sx={{ mb: 3 }}
    />

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Social Links (up to 8)
    </Typography>
    <Stack spacing={1.5} sx={{ mb: 1.5 }}>
      {customization.social_links.map((link, i) => (
        <Grid key={i} container spacing={1} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 4 }}>
            <Select
              fullWidth
              size="small"
              variant="filled"
              value={link.platform}
              onChange={(e) => {
                const updated = [...customization.social_links];
                updated[i] = { ...updated[i], platform: e.target.value };
                setCust('social_links', updated);
              }}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <MenuItem key={p.key} value={p.key}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid size="grow">
            <TextField
              fullWidth
              size="small"
              variant="filled"
              placeholder={SOCIAL_PLATFORMS.find((p) => p.key === link.platform)?.placeholder ?? 'https://'}
              value={link.url}
              onChange={(e) => {
                const updated = [...customization.social_links];
                updated[i] = { ...updated[i], url: e.target.value.trim() };
                setCust('social_links', updated);
              }}
            />
          </Grid>
          <Grid size="auto">
            <Tooltip title="Remove">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  const updated = [...customization.social_links];
                  updated.splice(i, 1);
                  setCust('social_links', updated);
                }}
              >
                <RemoveCircleOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      ))}
    </Stack>

    {customization.social_links.length < 8 && (
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        onClick={() => setCust('social_links', [...customization.social_links, { platform: 'instagram', url: '' }])}
        sx={{ borderStyle: 'dashed' }}
      >
        Add social link
      </Button>
    )}
  </SectionCard>
);
