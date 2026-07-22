import React from 'react';
import { Box, Chip, FormControlLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import {
  PROFILE_FONTS,
  AVATAR_SHAPES,
  CURSOR_OPTIONS,
  NAME_EFFECTS,
  getAvatarShapeStyles,
} from '@/constants/profile-customization';
import { SectionCard, SectionHeader, type SectionCustProps, type CustomizationForm } from './_shared';

// ─── Keyframes (mirrors profile/index.tsx) ────────────────────────────────────

const nameGradientAnim = keyframes`
  from { background-position: 0% center; }
  to   { background-position: 300% center; }
`;

const shimmerAnim = keyframes`
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
`;

const rainbowAnim = keyframes`
  from { filter: hue-rotate(0deg); }
  to   { filter: hue-rotate(360deg); }
`;

// ─── Preview ──────────────────────────────────────────────────────────────────

const TypographyPreview = ({ customization }: { customization: CustomizationForm }) => {
  const primary = customization.site_color || '#0b6536';
  const secondary = customization.site_color_secondary || '#cfe1b9';

  const fontStack = customization.profile_font
    ? (PROFILE_FONTS.find((f) => f.value === customization.profile_font)?.cssStack ??
      `'${customization.profile_font}', sans-serif`)
    : undefined;

  const avatarShapeSx = getAvatarShapeStyles(customization.profile_avatar_shape);

  // Name effect — mirrors profile page logic
  let nameEffectSx: Record<string, unknown>;
  switch (customization.profile_name_effect) {
    case 'gradient':
      nameEffectSx = {
        background: `linear-gradient(90deg, white 0%, ${secondary} 40%, white 70%, ${secondary} 100%)`,
        backgroundSize: '300% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: `${nameGradientAnim} 5s linear infinite`,
      };
      break;
    case 'glow':
      nameEffectSx = { textShadow: `0 0 18px ${primary}, 0 0 36px ${primary}80`, color: 'white' };
      break;
    case 'shadow':
      nameEffectSx = { textShadow: '2px 4px 10px rgba(0,0,0,0.6)', color: 'white' };
      break;
    case 'shimmer':
      nameEffectSx = {
        background: `linear-gradient(90deg, white 35%, ${secondary} 50%, white 65%)`,
        backgroundSize: '300% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: `${shimmerAnim} 3s linear infinite`,
      };
      break;
    case 'rainbow':
      nameEffectSx = { color: primary, animation: `${rainbowAnim} 3s linear infinite` };
      break;
    default:
      nameEffectSx = { color: 'white' };
  }

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        mb: 3,
        backgroundColor: primary,
        background: `linear-gradient(135deg, ${alpha(primary, 0.78)} 0%, ${primary} 55%, ${secondary} 100%)`,
        position: 'relative',
        p: { xs: 2, sm: 2.5 },
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        userSelect: 'none',
        pointerEvents: 'none',
        fontFamily: fontStack ?? 'inherit',
      }}
    >
      {/* Decorative orb */}
      <Box
        sx={{
          position: 'absolute',
          top: -32,
          right: -32,
          width: 110,
          height: 110,
          borderRadius: '50%',
          backgroundColor: alpha(primary, 0.4),
          pointerEvents: 'none',
        }}
      />

      {/* Avatar */}
      <Box
        sx={{
          width: 64,
          height: 64,
          background: `linear-gradient(135deg, ${alpha(secondary, 0.8)}, ${secondary})`,
          border: '2.5px solid rgba(255,255,255,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          ...avatarShapeSx,
        }}
      >
        <Typography
          sx={{
            fontFamily: 'inherit',
            fontWeight: 800,
            fontSize: '1.75rem',
            color: primary,
            lineHeight: 1,
          }}
        >
          A
        </Typography>
      </Box>

      {/* Name + subtitle */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: 'inherit',
            fontSize: { xs: '1.4rem', sm: '1.75rem' },
            fontWeight: 800,
            lineHeight: 1.1,
            mb: 0.5,
            letterSpacing: '-0.3px',
            ...nameEffectSx,
          }}
        >
          Your Name
        </Typography>
        <Typography
          sx={{
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1,
          }}
        >
          Member since June 2025
        </Typography>
      </Box>
    </Box>
  );
};

// ─── Section ──────────────────────────────────────────────────────────────────

export const TypographySection = ({ customization, setCust, onReset }: SectionCustProps) => (
  <SectionCard elevation={0}>
    <SectionHeader title="Typography & Style" onReset={onReset} />

    <TypographyPreview customization={customization} />

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
        <MenuItem key={f.value} value={f.value}>
          <Box>
            <Typography sx={{ fontFamily: f.cssStack ?? `'${f.value}', sans-serif`, fontWeight: 600 }}>
              {f.label}
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
