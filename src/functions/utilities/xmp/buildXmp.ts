// buildXmp.ts
// Shared metadata model + XMP packet builder for pattern exports.
//
// One source of truth for "what metadata goes into an exported file". The same
// PatternXmpMeta feeds:
//   • SVG   → an embedded <metadata> element holding the XMP packet
//   • raster → an XMP packet injected into PNG/JPEG/WebP binary (injectRasterXmp.ts)
//   • PDF   → the Info dictionary via jsPDF setDocumentProperties (no true XMP — see
//             buildPdfDocumentProperties; jsPDF.addMetadata can't embed clean Dublin Core)

import { DOMAIN_URL } from '@/data/constants';
import type { TypePatternResponse } from '@/functions/database/patterns';

const CREATOR_TOOL = 'Pattern Archive';
const PATTERNARCHIVE_NS = 'https://patternarchive.net/ns/1.0/';

export interface PatternXmpMeta {
  title: string;
  description: string;
  creators: string[];
  keywords: string[];
  sourceUrl: string;
  patternUrl: string;
  creatorTool: string;
  sizeLabel?: string;
  pieces?: number;
  difficulty?: string;
  createDate?: string; // ISO 8601
}

// ─── Derivation ─────────────────────────────────────────────────────────────--

function deriveCreators(pattern: TypePatternResponse): string[] {
  const isName = (n: string | undefined): n is string => !!n;
  const linked = (pattern.expand?.authors?.map((a) => a.name) ?? []).filter(isName);
  const manual = (pattern.author_manual ?? []).filter(isName);
  // De-dupe while preserving order (linked authors first).
  return Array.from(new Set([...linked, ...manual]));
}

function toIsoDate(value: TypePatternResponse['design_date'] | string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    // design_date may be a Date, a Dayjs (has toDate), or an ISO string.
    const maybeDayjs = value as { toDate?: () => Date };
    const date =
      typeof value === 'string' ? new Date(value) : typeof maybeDayjs.toDate === 'function' ? maybeDayjs.toDate() : (value as Date);
    if (date instanceof Date && !isNaN(date.getTime())) return date.toISOString();
  } catch {
    /* fall through */
  }
  return undefined;
}

export function buildPatternXmpMeta(pattern: TypePatternResponse, opts?: { sizeLabel?: string }): PatternXmpMeta {
  return {
    title: pattern.name ?? '',
    description: pattern.description ?? '',
    creators: deriveCreators(pattern),
    keywords: pattern.tags?.filter(Boolean) ?? [],
    sourceUrl: DOMAIN_URL,
    patternUrl: `${DOMAIN_URL}/pattern/${pattern.id}`,
    creatorTool: CREATOR_TOOL,
    sizeLabel: opts?.sizeLabel,
    pieces: typeof pattern.pieces === 'number' ? pattern.pieces : undefined,
    difficulty: pattern.difficulty || undefined,
    createDate: toIsoDate(pattern.design_date) ?? (pattern.created ? toIsoDate(pattern.created) : undefined),
  };
}

// ─── XMP packet (used by SVG + raster) ────────────────────────────────────────

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rdfBag(items: string[]): string {
  const lis = items.map((i) => `<rdf:li>${escapeXml(i)}</rdf:li>`).join('');
  return `<rdf:Bag>${lis}</rdf:Bag>`;
}

// Language-alternative wrapper used by dc:title / dc:description.
function rdfAlt(value: string): string {
  return `<rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt>`;
}

// Returns a standards-compliant, BOM-less XMP packet. BOM-less keeps it valid to
// embed inside an SVG <metadata> element while remaining a conformant packet for
// PNG/JPEG/WebP injection.
export function buildXmpPacket(meta: PatternXmpMeta): string {
  const props: string[] = [];

  if (meta.title) props.push(`<dc:title>${rdfAlt(meta.title)}</dc:title>`);
  if (meta.description) props.push(`<dc:description>${rdfAlt(meta.description)}</dc:description>`);
  if (meta.creators.length) props.push(`<dc:creator>${rdfBag(meta.creators)}</dc:creator>`);
  if (meta.keywords.length) props.push(`<dc:subject>${rdfBag(meta.keywords)}</dc:subject>`);
  props.push(`<dc:source>${escapeXml(meta.sourceUrl)}</dc:source>`);

  props.push(`<xmp:CreatorTool>${escapeXml(meta.creatorTool)}</xmp:CreatorTool>`);
  if (meta.createDate) props.push(`<xmp:CreateDate>${escapeXml(meta.createDate)}</xmp:CreateDate>`);

  props.push(`<patternarchive:patternUrl>${escapeXml(meta.patternUrl)}</patternarchive:patternUrl>`);
  if (meta.sizeLabel) props.push(`<patternarchive:size>${escapeXml(meta.sizeLabel)}</patternarchive:size>`);
  if (typeof meta.pieces === 'number') props.push(`<patternarchive:pieces>${meta.pieces}</patternarchive:pieces>`);
  if (meta.difficulty) props.push(`<patternarchive:difficulty>${escapeXml(meta.difficulty)}</patternarchive:difficulty>`);

  return [
    `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"`,
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"`,
    ` xmlns:xmp="http://ns.adobe.com/xap/1.0/"`,
    ` xmlns:patternarchive="${PATTERNARCHIVE_NS}">`,
    `<rdf:Description rdf:about="">`,
    props.join(''),
    `</rdf:Description>`,
    `</rdf:RDF>`,
    `</x:xmpmeta>`,
    `<?xpacket end="w"?>`,
  ].join('');
}

// ─── SVG embedding ────────────────────────────────────────────────────────────

// Inserts a <metadata> element (plus optional <title>/<desc>) immediately after
// the opening <svg …> tag. Returns the SVG unchanged if no <svg> tag is found.
export function insertSvgMetadata(
  svgText: string,
  xmpPacket: string,
  opts?: { title?: string; desc?: string },
): string {
  const match = svgText.match(/<svg[^>]*>/i);
  if (!match || match.index === undefined) return svgText;
  const insertAt = match.index + match[0].length;
  const titleEl = opts?.title ? `<title>${escapeXml(opts.title)}</title>` : '';
  const descEl = opts?.desc ? `<desc>${escapeXml(opts.desc)}</desc>` : '';
  const metadataEl = `<metadata>${xmpPacket}</metadata>`;
  return svgText.slice(0, insertAt) + titleEl + descEl + metadataEl + svgText.slice(insertAt);
}

// ─── PDF Info dictionary ──────────────────────────────────────────────────────

// jsPDF's addMetadata can't embed clean Dublin Core XMP (it nests the string under
// a jspdf: namespace as escaped text), so PDFs use the Info dictionary instead —
// read reliably by Acrobat, Preview, and exiftool. The deep link is folded into
// keywords since the Info dictionary has no URL field.
export function buildPdfDocumentProperties(meta: PatternXmpMeta): {
  title: string;
  subject: string;
  author: string;
  keywords: string;
  creator: string;
} {
  return {
    title: meta.title,
    subject: meta.description,
    author: meta.creators.join(', '),
    keywords: [...meta.keywords, meta.patternUrl].filter(Boolean).join(', '),
    creator: `${meta.creatorTool} — ${meta.sourceUrl}`,
  };
}
