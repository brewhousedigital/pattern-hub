// renderLegend.ts
// Builds the legend card as an SVG string. Reusable: image export AND print view
// both consume this. Height is dynamic — depends on number of pattern keys.
//
// Layout (top-down):
//   Header:   pattern name (bold, 22px)
//   Sub:      author line (14px)
//   Stats:    Project Size / Pieces / Line Width / Design Date  (one per row, 13px)
//   Divider
//   Keys:     [icon 24px]  key name   (one per row)
//
// Returned dimensions let the compositor place the card precisely.

import { QueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { TypePatternKeyReferenceObject } from '@/functions/database/patterns';

export interface LegendInput {
  patternName: string;
  authorLine: string; // pre-joined "by Foo, Bar"
  projectSizeLabel: string; // e.g. "36in x 24in"
  pieces: number;
  lineWidthLabel: string; // e.g. "0.5mm"
  designDate: Date | null;
  keys: TypePatternKeyReferenceObject[];
  queryClient: QueryClient;
}

export interface LegendOutput {
  svg: string;
  width: number;
  height: number;
}

const PAD = 20;
const WIDTH = 320;
const HEADER_H = 32;
const SUB_H = 22;
const STAT_ROW_H = 20;
const STAT_COUNT = 4; // size, pieces, line width, date
const DIVIDER_H = 16;
const KEY_ROW_H = 32;
const KEY_ICON = 24;

export async function buildLegend(input: LegendInput): Promise<LegendOutput> {
  const dateStr = input.designDate ? dayjs(input.designDate).format('MM-DD-YYYY') : '—';

  const statsBlockH = STAT_COUNT * STAT_ROW_H;
  const keysBlockH = input.keys.length * KEY_ROW_H;
  const height = PAD + HEADER_H + SUB_H + 6 + statsBlockH + DIVIDER_H + keysBlockH + PAD;

  // Convert remote key icons to data URIs so the SVG is self-contained when
  // serialized → rasterized. Without this, <image href="https://..."> fails to
  // load inside an <img> wrapping the SVG (CORS / async race).
  const iconDataUris = await Promise.all(
    input.keys.map((k) => fetchAsDataUri(k?.fullPath || '', input.queryClient).catch(() => '')),
  );

  let y = PAD;
  const rows: string[] = [];

  // Header — pattern name
  rows.push(
    `<text x="${PAD}" y="${y + 22}" font-family="Roboto, Arial, sans-serif" font-size="20" font-weight="700" fill="#1a1a1a">${escapeXml(
      input.patternName,
    )}</text>`,
  );
  y += HEADER_H;

  // Author
  rows.push(
    `<text x="${PAD}" y="${y + 14}" font-family="Roboto, Arial, sans-serif" font-size="13" fill="#555">${escapeXml(
      input.authorLine,
    )}</text>`,
  );
  y += SUB_H + 6;

  // Stats — label : value pairs aligned in two columns
  const stats: [string, string][] = [
    ['Project Size', input.projectSizeLabel],
    ['Pieces', String(input.pieces)],
    ['Line Width', input.lineWidthLabel],
    ['Design Date', dateStr],
  ];
  for (const [label, val] of stats) {
    rows.push(
      `<text x="${PAD}" y="${y + 14}" font-family="Roboto, Arial, sans-serif" font-size="12" font-weight="600" fill="#2e7d32">${label}</text>` +
        `<text x="${WIDTH - PAD}" y="${y + 14}" text-anchor="end" font-family="Roboto, Arial, sans-serif" font-size="12" fill="#1a1a1a">${escapeXml(val)}</text>`,
    );
    y += STAT_ROW_H;
  }

  // Divider
  y += 4;
  rows.push(`<line x1="${PAD}" y1="${y}" x2="${WIDTH - PAD}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`);
  y += DIVIDER_H - 4;

  // Keys
  for (let i = 0; i < input.keys.length; i++) {
    const k = input.keys[i];
    const dataUri = iconDataUris[i];
    if (dataUri) {
      rows.push(
        `<image x="${PAD}" y="${y + (KEY_ROW_H - KEY_ICON) / 2}" width="${KEY_ICON}" height="${KEY_ICON}" href="${dataUri}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    }
    rows.push(
      `<text x="${PAD + KEY_ICON + 10}" y="${y + KEY_ROW_H / 2 + 4}" font-family="Roboto, Arial, sans-serif" font-size="13" fill="#1a1a1a">${escapeXml(k.name)}</text>`,
    );
    y += KEY_ROW_H;
  }

  // White card with green accent border + soft shadow (drawn via filter).
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">` +
    `<defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>` +
    `</filter></defs>` +
    `<rect x="2" y="2" width="${WIDTH - 4}" height="${height - 4}" rx="8" ry="8" fill="#ffffff" stroke="#2e7d32" stroke-width="1.5" filter="url(#shadow)"/>` +
    rows.join('') +
    `</svg>`;

  return { svg, width: WIDTH, height };
}

async function fetchAsDataUri(url: string, queryClient: QueryClient): Promise<string> {
  return queryClient.fetchQuery({
    queryKey: ['pattern-key-icon', url],
    queryFn: async () => {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    },
    staleTime: Infinity, // never refetch — pattern key icons immutable
    gcTime: 1000 * 60 * 60, // keep 1 hr after last use
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
