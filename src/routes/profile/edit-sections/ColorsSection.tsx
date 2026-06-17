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
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { BG_PATTERNS } from '@/constants/profile-customization';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

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
