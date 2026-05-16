// WikiTableOfContents
// Parses ## and ### headings from a markdown string and renders a sticky
// anchor list. Only rendered when the page has 2 or more headings.

import { Box, Typography, Link as MuiLink } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { slugifyHeading } from './WikiMarkdownWrapper';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeadingEntry {
  level: 2 | 3;
  text: string;
  id: string;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/** Extract all h2 / h3 headings from a raw markdown string. */
export function parseHeadings(markdown: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{2,3})\s+(.+)/);
    if (m) {
      const level = m[1].length as 2 | 3;
      const text = m[2].trim();
      headings.push({ level, text, id: slugifyHeading(text) });
    }
  }
  return headings;
}

// ─── Component ────────────────────────────────────────────────────────────────

type WikiTableOfContentsProps = {
  markdown: string;
};

export const WikiTableOfContents = ({ markdown }: WikiTableOfContentsProps) => {
  const headings = parseHeadings(markdown);

  if (headings.length < 2) return null;

  return (
    <Box
      component="nav"
      aria-label="Table of contents"
      sx={{
        position: 'sticky',
        top: 24,
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        p: 2,
        borderLeft: '2px solid',
        borderColor: alpha('#C8A96E', 0.25),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.disabled',
          mb: 1.25,
        }}
      >
        On this page
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {headings.map((h) => (
          <MuiLink
            key={h.id}
            href={`#${h.id}`}
            underline="none"
            sx={{
              display: 'block',
              color: 'text.secondary',
              fontSize: h.level === 2 ? '0.825rem' : '0.775rem',
              pl: h.level === 3 ? 1.5 : 0,
              py: 0.25,
              borderRadius: 0.5,
              '&:hover': { color: 'primary.main' },
              transition: 'color 0.15s',
            }}
          >
            {h.text}
          </MuiLink>
        ))}
      </Box>
    </Box>
  );
};
