import React from 'react';
import { Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { PRIMARY_COLOR } from '@/data/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomizationForm {
  site_color: string;
  site_color_secondary: string;
  profile_bg_type: 'solid' | 'gradient' | 'pattern' | 'image';
  profile_bg_color: string;
  profile_bg_gradient_end: string;
  profile_bg_gradient_angle: number;
  profile_bg_pattern: string;
  profile_bg_image_size: string;
  profile_bg_image_position: string;
  profile_bg_image_fixed: boolean;
  profile_card_bg: string;
  profile_font: string;
  profile_font_size: 'small' | 'medium' | 'large';
  profile_name_effect: string;
  profile_avatar_shape: 'circle' | 'squircle' | 'square' | 'hexagon';
  profile_cursor: string;
  profile_sparkles: boolean;
  profile_dark_mode: boolean;
  profile_mood_emoji: string;
  profile_mood_text: string;
  profile_youtube_url: string;
  social_links: Array<{ platform: string; url: string }>;
  tab_show_favorites: boolean;
  tab_show_done: boolean;
  tab_show_ratings: boolean;
  tab_show_difficulty: boolean;
  tab_show_gallery: boolean;
  tab_show_collections: boolean;
  header_gradient: boolean;
  blocked_tags: string[];
}

export const DEFAULT_CUSTOMIZATION: CustomizationForm = {
  site_color: PRIMARY_COLOR,
  site_color_secondary: '#cfe1b9',
  profile_bg_type: 'solid',
  profile_bg_color: '',
  profile_bg_gradient_end: '#ffffff',
  profile_bg_gradient_angle: 135,
  profile_bg_pattern: 'dots',
  profile_bg_image_size: 'cover',
  profile_bg_image_position: 'center center',
  profile_bg_image_fixed: false,
  profile_card_bg: '',
  profile_font: '',
  profile_font_size: 'medium',
  profile_name_effect: 'none',
  profile_avatar_shape: 'circle',
  profile_cursor: 'default',
  profile_sparkles: false,
  profile_dark_mode: false,
  profile_mood_emoji: '',
  profile_mood_text: '',
  profile_youtube_url: '',
  social_links: [],
  tab_show_favorites: true,
  tab_show_done: true,
  tab_show_ratings: true,
  tab_show_difficulty: true,
  tab_show_gallery: true,
  tab_show_collections: true,
  header_gradient: true,
  blocked_tags: [],
};

export type SetCust = <K extends keyof CustomizationForm>(key: K, value: CustomizationForm[K]) => void;

export type SectionCustProps = {
  customization: CustomizationForm;
  setCust: SetCust;
  onReset: () => void;
};

// ─── Styled components ────────────────────────────────────────────────────────

export const SectionCard = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3.5, 4),
  marginBottom: theme.spacing(3),
  boxShadow: 'none',
}));

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="overline"
    sx={{
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'text.disabled',
      display: 'block',
    }}
  >
    {children}
  </Typography>
);

export const SectionHeader = ({ title, onReset }: { title: string; onReset: () => void }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
    <SectionTitle>{title}</SectionTitle>
    <Tooltip title="Reset to defaults">
      <Button
        size="small"
        onClick={onReset}
        startIcon={<RestartAltRoundedIcon sx={{ fontSize: '14px !important' }} />}
        sx={{
          fontSize: '0.7rem',
          color: 'text.disabled',
          minWidth: 0,
          px: 1,
          py: 0.25,
          '&:hover': { color: 'text.secondary' },
        }}
      >
        Reset
      </Button>
    </Tooltip>
  </Box>
);
