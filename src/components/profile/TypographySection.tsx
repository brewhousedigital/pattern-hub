import React from 'react';
import { Box, Chip, FormControlLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { PROFILE_FONTS, AVATAR_SHAPES, CURSOR_OPTIONS, NAME_EFFECTS } from '@/constants/profile-customization';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

export const TypographySection = ({ customization, setCust, onReset }: SectionCustProps) => (
  <SectionCard elevation={0}>
    <SectionHeader title="Typography & Style" onReset={onReset} />

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Profile Font
    </Typography>
    <Select
      fullWidth
      size="small"
      variant="filled"
      value={customization.profile_font}
      onChange={(e) => setCust('profile_font', e.target.value)}
      displayEmpty
      renderValue={(v) => v || 'Default font'}
      sx={{ mb: 2 }}
    >
      <MenuItem value="">
        <em>Default font</em>
      </MenuItem>
      {PROFILE_FONTS.map((f) => (
        <MenuItem key={f.value} value={f.value} sx={{ fontFamily: `'${f.value}', sans-serif` }}>
          <Box>
            <Typography sx={{ fontFamily: `'${f.value}', sans-serif`, fontWeight: 600 }}>{f.label}</Typography>
            <Typography variant="caption" color="text.disabled">
              {f.category}
            </Typography>
          </Box>
        </MenuItem>
      ))}
    </Select>

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Name Effect
    </Typography>
    <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
      {NAME_EFFECTS.map((ef) => (
        <Chip
          key={ef.key}
          label={ef.label}
          size="small"
          clickable
          onClick={() => setCust('profile_name_effect', ef.key)}
          color={customization.profile_name_effect === ef.key ? 'primary' : 'default'}
          variant={customization.profile_name_effect === ef.key ? 'filled' : 'outlined'}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </Stack>

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Avatar Shape
    </Typography>
    <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
      {AVATAR_SHAPES.map((s) => (
        <Chip
          key={s.key}
          label={s.label}
          size="small"
          clickable
          onClick={() => setCust('profile_avatar_shape', s.key as 'circle' | 'squircle' | 'square' | 'hexagon')}
          color={customization.profile_avatar_shape === s.key ? 'primary' : 'default'}
          variant={customization.profile_avatar_shape === s.key ? 'filled' : 'outlined'}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </Stack>

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Cursor Style
    </Typography>
    <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
      {CURSOR_OPTIONS.map((c) => (
        <Chip
          key={c.key}
          label={c.label}
          size="small"
          clickable
          onClick={() => setCust('profile_cursor', c.key)}
          color={customization.profile_cursor === c.key ? 'primary' : 'default'}
          variant={customization.profile_cursor === c.key ? 'filled' : 'outlined'}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </Stack>

    <FormControlLabel
      control={
        <Switch
          checked={customization.profile_sparkles}
          onChange={(e) => setCust('profile_sparkles', e.target.checked)}
          color="primary"
        />
      }
      label={
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Sparkle effect ✦
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Adds animated star sparkles to your hero section.
          </Typography>
        </Box>
      }
    />
  </SectionCard>
);
