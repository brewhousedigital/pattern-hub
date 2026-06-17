// ─── Font Options ─────────────────────────────────────────────────────────────

export type ProfileFont = { value: string; label: string; category: string };

export const PROFILE_FONTS: ProfileFont[] = [
  { value: 'Playfair Display',    label: 'Playfair Display',     category: 'Elegant' },
  { value: 'Dancing Script',      label: 'Dancing Script',       category: 'Handwritten' },
  { value: 'Lobster',             label: 'Lobster',              category: 'Display' },
  { value: 'Pacifico',            label: 'Pacifico',             category: 'Handwritten' },
  { value: 'Josefin Sans',        label: 'Josefin Sans',         category: 'Modern' },
  { value: 'Space Mono',          label: 'Space Mono',           category: 'Monospace' },
  { value: 'Cinzel',              label: 'Cinzel',               category: 'Serif' },
  { value: 'Bebas Neue',          label: 'Bebas Neue',           category: 'Display' },
  { value: 'Architects Daughter', label: "Architect's Daughter", category: 'Handwritten' },
  { value: 'Fredoka One',         label: 'Fredoka One',          category: 'Friendly' },
  { value: 'Abril Fatface',       label: 'Abril Fatface',        category: 'Display' },
  { value: 'Comfortaa',           label: 'Comfortaa',            category: 'Rounded' },
  { value: 'Satisfy',             label: 'Satisfy',              category: 'Handwritten' },
  { value: 'Righteous',           label: 'Righteous',            category: 'Display' },
  { value: 'Indie Flower',        label: 'Indie Flower',         category: 'Handwritten' },
  { value: 'Exo 2',               label: 'Exo 2',               category: 'Sci-Fi' },
  { value: 'Special Elite',       label: 'Special Elite',        category: 'Typewriter' },
  { value: 'Permanent Marker',    label: 'Permanent Marker',     category: 'Handwritten' },
  { value: 'Press Start 2P',      label: 'Press Start 2P',       category: 'Retro' },
  { value: 'Unbounded',           label: 'Unbounded',            category: 'Bold' },
];

// ─── Social Platforms ─────────────────────────────────────────────────────────

export type SocialPlatform = {
  key: string;
  label: string;
  placeholder: string;
  domain: string;
  color: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'instagram',  label: 'Instagram',   placeholder: 'https://instagram.com/yourhandle',  domain: 'instagram.com',  color: '#E1306C' },
  { key: 'twitterx',   label: 'X / Twitter', placeholder: 'https://x.com/yourhandle',          domain: 'x.com',          color: '#000000' },
  { key: 'tiktok',     label: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle',    domain: 'tiktok.com',     color: '#010101' },
  { key: 'facebook',   label: 'Facebook',    placeholder: 'https://facebook.com/yourpage',     domain: 'facebook.com',   color: '#1877F2' },
  { key: 'pinterest',  label: 'Pinterest',   placeholder: 'https://pinterest.com/yourhandle',  domain: 'pinterest.com',  color: '#E60023' },
  { key: 'etsy',       label: 'Etsy',        placeholder: 'https://etsy.com/shop/yourshop',    domain: 'etsy.com',       color: '#F1641E' },
  { key: 'youtube',    label: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel',  domain: 'youtube.com',    color: '#FF0000' },
  { key: 'bluesky',    label: 'Bluesky',     placeholder: 'https://bsky.app/profile/yourname', domain: 'bsky.app',       color: '#0085FF' },
  { key: 'github',     label: 'GitHub',      placeholder: 'https://github.com/yourhandle',     domain: 'github.com',     color: '#333333' },
  { key: 'website',    label: 'Website',     placeholder: 'https://yourwebsite.com',           domain: '*',              color: '#555555' },
];

// ─── Background Patterns ──────────────────────────────────────────────────────

export type BgPattern = { key: string; label: string };

export const BG_PATTERNS: BgPattern[] = [
  { key: 'dots',      label: 'Dots' },
  { key: 'stripes',   label: 'Stripes' },
  { key: 'checker',   label: 'Checker' },
  { key: 'diamonds',  label: 'Diamonds' },
  { key: 'crosshatch',label: 'Crosshatch' },
  { key: 'waves',     label: 'Diagonal Waves' },
];

export function getCssPattern(patternKey: string, accentColor: string, bgColor: string): string {
  const c = accentColor;
  switch (patternKey) {
    case 'stripes':
      return `repeating-linear-gradient(45deg, transparent, transparent 10px, ${c} 10px, ${c} 12px)`;
    case 'checker':
      return `conic-gradient(${c} 90deg, transparent 90deg) 0 0 / 24px 24px`;
    case 'diamonds':
      return `conic-gradient(${c} 90deg, transparent 90deg) 0 0 / 16px 16px`;
    case 'crosshatch':
      return [
        `repeating-linear-gradient(0deg, ${c}, ${c} 1px, transparent 1px, transparent 20px)`,
        `repeating-linear-gradient(90deg, ${c}, ${c} 1px, transparent 1px, transparent 20px)`,
      ].join(', ');
    case 'waves':
      return `repeating-linear-gradient(135deg, ${c}, ${c} 2px, transparent 2px, transparent 10px)`;
    default: // dots
      return [
        `radial-gradient(${c} 1.5px, transparent 1.5px) 0 0 / 24px 24px`,
        `radial-gradient(${c} 1.5px, transparent 1.5px) 12px 12px / 24px 24px`,
      ].join(', ');
  }
}

// ─── Avatar Shapes ────────────────────────────────────────────────────────────

export type AvatarShape = { key: string; label: string };

export const AVATAR_SHAPES: AvatarShape[] = [
  { key: 'circle',   label: 'Circle' },
  { key: 'squircle', label: 'Squircle' },
  { key: 'square',   label: 'Square' },
  { key: 'hexagon',  label: 'Hexagon' },
];

export function getAvatarShapeStyles(shape: string): { borderRadius?: string; clipPath?: string } {
  switch (shape) {
    case 'squircle': return { borderRadius: '30%' };
    case 'square':   return { borderRadius: '14px' };
    case 'hexagon':  return { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', borderRadius: '0' };
    default:         return { borderRadius: '50%' };
  }
}

// ─── Custom Cursors ───────────────────────────────────────────────────────────

export type CursorOption = { key: string; label: string; css: string };

function svgCursor(svg: string, hx = 8, hy = 8): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, auto`;
}

export const CURSOR_OPTIONS: CursorOption[] = [
  { key: 'default',   label: 'Default',     css: 'auto' },
  { key: 'crosshair', label: 'Crosshair',   css: 'crosshair' },
  { key: 'pointer',   label: 'Pointer',     css: 'pointer' },
  {
    key: 'star',
    label: 'Star ✦',
    css: svgCursor(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><polygon points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7" fill="gold" stroke="#b8860b" stroke-width="1"/></svg>',
      10, 10,
    ),
  },
  {
    key: 'heart',
    label: 'Heart ♥',
    css: svgCursor(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="M10 17C10 17 2 11 2 6.5C2 3.4 4.4 1 7.5 1C8.8 1 10 2 10 2C10 2 11.2 1 12.5 1C15.6 1 18 3.4 18 6.5C18 11 10 17 10 17Z" fill="#e74c3c" stroke="#c0392b" stroke-width="1"/></svg>',
      10, 10,
    ),
  },
  {
    key: 'wand',
    label: 'Magic Wand ✨',
    css: svgCursor(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><line x1="4" y1="20" x2="16" y2="8" stroke="#9b59b6" stroke-width="3" stroke-linecap="round"/><polygon points="16,8 19,5 20,7 18,10" fill="#f39c12"/><circle cx="20" cy="3" r="2" fill="#f1c40f"/><circle cx="3" cy="10" r="1.5" fill="#f1c40f" opacity="0.7"/></svg>',
      4, 20,
    ),
  },
  {
    key: 'quill',
    label: 'Quill ✒',
    css: svgCursor(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M20 2C20 2 10 8 6 14C5 16 5 18 6 19C7 20 9 20 11 19C13 18 16 16 18 13C20 10 22 6 20 2Z" fill="#a8d5a2" stroke="#4a7c4e" stroke-width="1"/><path d="M6 19L3 22" stroke="#333" stroke-width="2" stroke-linecap="round"/></svg>',
      3, 22,
    ),
  },
];

// ─── Name Effects ─────────────────────────────────────────────────────────────

export type NameEffect = { key: string; label: string };

export const NAME_EFFECTS: NameEffect[] = [
  { key: 'none',     label: 'None' },
  { key: 'gradient', label: 'Gradient Sweep' },
  { key: 'glow',     label: 'Glow' },
  { key: 'shadow',   label: 'Drop Shadow' },
  { key: 'shimmer',  label: 'Shimmer' },
  { key: 'rainbow',  label: 'Rainbow' },
];

// ─── Validation Utilities ─────────────────────────────────────────────────────

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
export const isValidHex = (color: string): boolean => HEX_REGEX.test(color);

export function sanitizeHex(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  return HEX_REGEX.test(trimmed) ? trimmed : fallback;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isValidSocialUrl(url: string, domain: string): boolean {
  if (!url.startsWith('https://')) return false;
  if (domain === '*') return true;
  try {
    const u = new URL(url);
    return u.hostname === domain || u.hostname.endsWith('.' + domain);
  } catch {
    return false;
  }
}
