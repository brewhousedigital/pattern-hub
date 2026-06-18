import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { BG_PATTERNS, getCssPattern, hexToRgba } from '@/constants/profile-customization';
import { SectionCard, SectionHeader, type SectionCustProps, type CustomizationForm } from './_shared';

// ─── Preview ──────────────────────────────────────────────────────────────────

const ColorsPreview = ({
  customization,
  activeBgImageSrc,
}: {
  customization: CustomizationForm;
  activeBgImageSrc: string | null;
}) => {
  const primary = customization.site_color || '#0b6536';
  const secondary = customization.site_color_secondary || '#cfe1b9';

  let pageBg: string | undefined;
  const { profile_bg_type: bgType, profile_bg_color: bgColor } = customization;
  if (bgType === 'gradient' && bgColor) {
    pageBg = `linear-gradient(${customization.profile_bg_gradient_angle}deg, ${bgColor}, ${customization.profile_bg_gradient_end})`;
  } else if (bgType === 'pattern' && bgColor) {
    pageBg = getCssPattern(customization.profile_bg_pattern, hexToRgba(primary, 0.18), bgColor);
  } else if (bgType === 'image' && activeBgImageSrc) {
    pageBg = `url(${activeBgImageSrc}) center/cover no-repeat`;
  } else if (bgColor) {
    pageBg = bgColor;
  }

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        mb: 3,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Hero strip */}
      <Box
        sx={{
          height: 76,
          backgroundColor: primary,
          background: `linear-gradient(135deg, ${alpha(primary, 0.78)} 0%, ${primary} 55%, ${secondary} 100%)`,
          position: 'relative',
          overflow: 'hidden',
          px: 2,
          display: 'flex',
          alignItems: 'flex-end',
          pb: 1.25,
          gap: 1.25,
        }}
      >
        {/* decorative orb */}
        <Box
          sx={{
            position: 'absolute',
            top: -28,
            right: -28,
            width: 90,
            height: 90,
            borderRadius: '50%',
            backgroundColor: alpha(primary, 0.45),
          }}
        />
        {/* avatar */}
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: secondary,
            border: '2px solid rgba(255,255,255,0.5)',
            flexShrink: 0,
          }}
        />
        <Box sx={{ pb: 0.25 }}>
          <Box sx={{ width: 68, height: 9, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.9)', mb: 0.6 }} />
          <Box sx={{ width: 44, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
        </Box>
        <Box sx={{ ml: 'auto', px: 1.25, py: 0.5, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
          <Box sx={{ width: 26, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.8)' }} />
        </Box>
      </Box>

      {/* Stat bar */}
      <Box
        sx={{
          height: 44,
          backgroundColor: customization.profile_dark_mode ? '#1c1c1e' : '#ffffff',
          borderBottom: `1px solid ${customization.profile_dark_mode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {(['12', '4', '7'] as const).map((n, i) => (
          <Box key={i} sx={{ textAlign: 'center' }}>
            <Box sx={{ width: 18, height: 7, borderRadius: 1, backgroundColor: customization.profile_dark_mode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)', mx: 'auto', mb: 0.4 }} />
            <Box sx={{ width: 24, height: 4, borderRadius: 1, backgroundColor: customization.profile_dark_mode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', mx: 'auto' }} />
          </Box>
        ))}
      </Box>

      {/* Page background area */}
      <Box
        sx={{
          height: 52,
          background: pageBg,
          backgroundColor: !pageBg ? (customization.profile_dark_mode ? '#121212' : '#f5f5f5') : undefined,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        {(['Favorites', 'Gallery', 'Collections'] as const).map((label, i) => (
          <Box
            key={label}
            sx={{
              px: 1.25,
              py: 0.3,
              borderRadius: 10,
              fontSize: '0.58rem',
              fontWeight: 700,
              lineHeight: 1.7,
              backgroundColor: i === 0 ? primary : 'transparent',
              color: i === 0 ? 'white' : (customization.profile_dark_mode ? 'rgba(255,255,255,0.85)' : primary),
              border: `1px solid ${i === 0 ? primary : alpha(primary, 0.4)}`,
            }}
          >
            {label}
          </Box>
        ))}
        <Box sx={{ ml: 'auto', px: 1.25, py: 0.375, borderRadius: 1, backgroundColor: primary }}>
          <Box sx={{ width: 34, height: 5, borderRadius: 1, backgroundColor: 'white' }} />
        </Box>
      </Box>
    </Box>
  );
};

// ─── Color picker ─────────────────────────────────────────────────────────────

type ColorPickerProps = {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
};

const ColorPicker = ({ label, value, fallback, onChange }: ColorPickerProps) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        component="input"
        type="color"
        value={value || fallback}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        sx={{
          width: 44,
          height: 44,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 0.25,
          cursor: 'pointer',
        }}
      />
      <TextField
        size="small"
        variant="filled"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 7 } }}
        sx={{ flex: 1 }}
      />
    </Box>
  </Box>
);

// ─── Section ──────────────────────────────────────────────────────────────────

type ColorsSectionProps = SectionCustProps & {
  bgImageInputRef: React.RefObject<HTMLInputElement | null>;
  processingImage: 'avatar' | 'header' | 'bgimage' | null;
  activeBgImageSrc: string | null;
  bgImageCleared: boolean;
  onImageSelect: (f: File, type: 'bgimage') => void;
  onClearImage: (type: 'bgimage') => void;
};

export const ColorsSection = ({
  customization,
  setCust,
  onReset,
  bgImageInputRef,
  processingImage,
  activeBgImageSrc,
  bgImageCleared,
  onImageSelect,
  onClearImage,
}: ColorsSectionProps) => (
  <SectionCard elevation={0}>
    <SectionHeader title="Colors & Background" onReset={onReset} />

    <ColorsPreview customization={customization} activeBgImageSrc={activeBgImageSrc} />

    {/* Dark / Light mode */}
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Profile Theme
    </Typography>
    <ToggleButtonGroup
      exclusive
      value={customization.profile_dark_mode ? 'dark' : 'light'}
      onChange={(_, v) => { if (v) setCust('profile_dark_mode', v === 'dark'); }}
      size="small"
      sx={{ mb: 3 }}
    >
      <ToggleButton value="light" sx={{ gap: 0.75, fontWeight: 600, textTransform: 'none', px: 2 }}>
        <LightModeRoundedIcon fontSize="small" />
        Light
      </ToggleButton>
      <ToggleButton value="dark" sx={{ gap: 0.75, fontWeight: 600, textTransform: 'none', px: 2 }}>
        <DarkModeRoundedIcon fontSize="small" />
        Dark
      </ToggleButton>
    </ToggleButtonGroup>

    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <ColorPicker
          label="Primary Accent"
          value={customization.site_color}
          fallback="#0b6536"
          onChange={(v) => setCust('site_color', v)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <ColorPicker
          label="Secondary Accent"
          value={customization.site_color_secondary}
          fallback="#cfe1b9"
          onChange={(v) => setCust('site_color_secondary', v)}
        />
      </Grid>
    </Grid>

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
      Page Background
    </Typography>
    <ToggleButtonGroup
      exclusive
      value={customization.profile_bg_type}
      onChange={(_, v) => {
        if (v) setCust('profile_bg_type', v);
      }}
      size="small"
      sx={{ mb: 2 }}
    >
      {(['solid', 'gradient', 'pattern', 'image'] as const).map((t) => (
        <ToggleButton key={t} value={t} sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
          {t}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>

    {(customization.profile_bg_type === 'solid' ||
      customization.profile_bg_type === 'gradient' ||
      customization.profile_bg_type === 'pattern') && (
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <ColorPicker
            label={customization.profile_bg_type === 'solid' ? 'Background Color' : 'Start Color'}
            value={customization.profile_bg_color}
            fallback="#f4f7f5"
            onChange={(v) => setCust('profile_bg_color', v)}
          />
        </Grid>
        {customization.profile_bg_type === 'gradient' && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <ColorPicker
              label="End Color"
              value={customization.profile_bg_gradient_end}
              fallback="#ffffff"
              onChange={(v) => setCust('profile_bg_gradient_end', v)}
            />
          </Grid>
        )}
      </Grid>
    )}

    {customization.profile_bg_type === 'gradient' && (
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Angle: {customization.profile_bg_gradient_angle}°
        </Typography>
        <Slider
          min={0}
          max={360}
          value={customization.profile_bg_gradient_angle}
          onChange={(_, v) => setCust('profile_bg_gradient_angle', v as number)}
          size="small"
          sx={{ mt: 1 }}
        />
      </Box>
    )}

    {customization.profile_bg_type === 'pattern' && (
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
          Pattern Style
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {BG_PATTERNS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              size="small"
              clickable
              onClick={() => setCust('profile_bg_pattern', p.key)}
              color={customization.profile_bg_pattern === p.key ? 'primary' : 'default'}
              variant={customization.profile_bg_pattern === p.key ? 'filled' : 'outlined'}
              sx={{ borderRadius: 2 }}
            />
          ))}
        </Stack>
      </Box>
    )}

    {customization.profile_bg_type === 'image' && (
      <Box sx={{ mt: 1 }}>
        <input
          ref={bgImageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImageSelect(f, 'bgimage');
          }}
        />
        {activeBgImageSrc && (
          <Box
            component="img"
            src={activeBgImageSrc}
            alt="Background preview"
            sx={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 2, mb: 1, display: 'block' }}
          />
        )}
        <Button
          fullWidth
          variant="outlined"
          size="small"
          onClick={() => bgImageInputRef.current?.click()}
          disabled={processingImage === 'bgimage'}
          startIcon={
            processingImage === 'bgimage' ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <AddPhotoAlternateOutlinedIcon fontSize="small" />
            )
          }
          sx={{ borderStyle: 'dashed' }}
        >
          {processingImage === 'bgimage' ? 'Processing…' : activeBgImageSrc ? 'Replace' : 'Upload background image'}
        </Button>
        {activeBgImageSrc && !bgImageCleared && (
          <Button
            fullWidth
            size="small"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
            onClick={() => onClearImage('bgimage')}
            sx={{ mt: 0.75 }}
          >
            Remove background image
          </Button>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
          Landscape image · max 5 MB · resized to 1920×1080 px
        </Typography>
      </Box>
    )}
  </SectionCard>
);
