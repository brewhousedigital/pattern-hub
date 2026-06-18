// ─── Font Options ─────────────────────────────────────────────────────────────

export type ProfileFont = {
  value: string;
  label: string;
  category: string;
  /** Override the CSS font-family stack (e.g. for fonts with different names on Mac vs Windows) */
  cssStack?: string;
};

export const PROFILE_FONTS: ProfileFont[] = [
  // ── Cross-platform ──────────────────────────────────────────────────────────
  { value: 'Georgia',                  label: 'Georgia',             category: 'Serif' },
  { value: 'Trebuchet MS',             label: 'Trebuchet MS',        category: 'Sans-serif' },
  { value: 'Impact',                   label: 'Impact',              category: 'Display' },
  { value: 'Courier New',              label: 'Courier New',         category: 'Monospace' },
  { value: 'Brush Script MT',          label: 'Brush Script',        category: 'Script' },
  { value: 'Comic Sans MS',            label: 'Comic Sans',          category: 'Playful' },
  { value: 'Papyrus',                  label: 'Papyrus',             category: 'Decorative' },

  // ── Mac ─────────────────────────────────────────────────────────────────────
  { value: 'Baskerville',              label: 'Baskerville',         category: 'Mac · Serif' },
  { value: 'Didot',                    label: 'Didot',               category: 'Mac · Elegant Serif' },
  { value: 'Hoefler Text',             label: 'Hoefler Text',        category: 'Mac · Serif' },
  { value: 'Optima',                   label: 'Optima',              category: 'Mac · Humanist Sans' },
  { value: 'Gill Sans',                label: 'Gill Sans',           category: 'Mac · Sans-serif',   cssStack: "'Gill Sans', 'Gill Sans MT', sans-serif" },
  { value: 'American Typewriter',      label: 'American Typewriter', category: 'Mac · Typewriter' },
  { value: 'Copperplate',              label: 'Copperplate',         category: 'Mac · Display' },
  { value: 'Chalkboard SE',            label: 'Chalkboard',          category: 'Mac · Casual' },
  { value: 'Bradley Hand',             label: 'Bradley Hand',        category: 'Mac · Handwritten' },
  { value: 'Marker Felt',              label: 'Marker Felt',         category: 'Mac · Handwritten' },

  // ── Windows ─────────────────────────────────────────────────────────────────
  { value: 'Garamond',                 label: 'Garamond',            category: 'Windows · Serif' },
  { value: 'Cambria',                  label: 'Cambria',             category: 'Windows · Serif' },
  { value: 'Constantia',               label: 'Constantia',          category: 'Windows · Elegant Serif' },
  { value: 'Calibri',                  label: 'Calibri',             category: 'Windows · Modern Sans' },
  { value: 'Candara',                  label: 'Candara',             category: 'Windows · Humanist Sans' },
  { value: 'Franklin Gothic Medium',   label: 'Franklin Gothic',     category: 'Windows · Display' },
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

// ─── Background Image Options ─────────────────────────────────────────────────

export const BG_IMAGE_SIZE_OPTIONS = [
  { key: 'cover',     label: 'Stretch full screen' },
  { key: 'contain',   label: 'Fit to screen' },
  { key: 'stretch',   label: 'Stretch to fill' },
  { key: 'no-repeat', label: 'Original size' },
  { key: 'repeat',    label: 'Tile' },
  { key: 'repeat-x',  label: 'Tile horizontally' },
  { key: 'repeat-y',  label: 'Tile vertically' },
] as const;

export type BgImageSize = (typeof BG_IMAGE_SIZE_OPTIONS)[number]['key'];

export const BG_POSITION_GRID = [
  { key: 'left top',      label: '↖' },
  { key: 'center top',    label: '↑' },
  { key: 'right top',     label: '↗' },
  { key: 'left center',   label: '←' },
  { key: 'center center', label: '○' },
  { key: 'right center',  label: '→' },
  { key: 'left bottom',   label: '↙' },
  { key: 'center bottom', label: '↓' },
  { key: 'right bottom',  label: '↘' },
] as const;

export type BgPosition = (typeof BG_POSITION_GRID)[number]['key'];

export function getBgImageCss(size: string): { bgSize: string; bgRepeat: string } {
  switch (size) {
    case 'contain':   return { bgSize: 'contain',   bgRepeat: 'no-repeat' };
    case 'stretch':   return { bgSize: '100% 100%', bgRepeat: 'no-repeat' };
    case 'no-repeat': return { bgSize: 'auto',      bgRepeat: 'no-repeat' };
    case 'repeat':    return { bgSize: 'auto',      bgRepeat: 'repeat' };
    case 'repeat-x':  return { bgSize: 'auto',      bgRepeat: 'repeat-x' };
    case 'repeat-y':  return { bgSize: 'auto',      bgRepeat: 'repeat-y' };
    default:          return { bgSize: 'cover',     bgRepeat: 'no-repeat' };
  }
}

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
