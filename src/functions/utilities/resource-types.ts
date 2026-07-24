import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import { extractYouTubeId } from '@/constants/profile-customization';

import SmartDisplayRoundedIcon from '@mui/icons-material/SmartDisplayRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';

export type TypeResourceType = 'video' | 'article' | 'store' | 'pdf';

export const RESOURCE_TYPES: TypeResourceType[] = ['video', 'article', 'store', 'pdf'];

export const RESOURCE_TYPE_LABELS: Record<TypeResourceType, string> = {
  video: 'Video',
  article: 'Article',
  store: 'Store / Materials',
  pdf: 'PDF',
};

export const RESOURCE_TYPE_ICONS: Record<TypeResourceType, ComponentType<SvgIconProps>> = {
  video: SmartDisplayRoundedIcon,
  article: ArticleRoundedIcon,
  store: StorefrontRoundedIcon,
  pdf: PictureAsPdfRoundedIcon,
};

// Reuses the same accent palette as pattern_sets (see ACCENT_COLORS in
// space-command/sets.tsx) so the two admin sections feel visually consistent.
export const RESOURCE_TYPE_COLORS: Record<TypeResourceType, string> = {
  video: '#c62828',
  article: '#1565c0',
  store: '#2e7d32',
  pdf: '#e65100',
};

/**
 * Resolves a YouTube thumbnail URL for video resources. Returns null for
 * non-YouTube video links (or any other resource type) - callers fall back
 * to a generic type-icon card in that case.
 */
export function getYouTubeThumbnail(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
