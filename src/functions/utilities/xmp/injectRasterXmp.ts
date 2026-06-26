// injectRasterXmp.ts
// Pure-JS, dependency-free injection of an XMP packet into raster image bytes.
// Browser canvas.toBlob() strips metadata, so we splice the packet into each
// format's standard metadata location after the blob is produced.
//
//   PNG  → an uncompressed iTXt chunk with keyword "XML:com.adobe.xmp" before IEND
//   JPEG → an APP1 (0xFFE1) segment with the "http://ns.adobe.com/xap/1.0/\0" header
//   WebP → a RIFF "XMP " chunk (promoting the file to extended VP8X if needed)
//
// Every injector returns the input unchanged if the bytes don't match the
// expected signature, so a parsing surprise degrades to "no metadata" rather
// than a corrupt file.

export type RasterFormat = 'png' | 'jpg' | 'webp';

// ─── byte helpers ─────────────────────────────────────────────────────────────

function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i]);
  return s;
}

function readUint32BE(bytes: Uint8Array, o: number): number {
  return ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
}

function uint32BE(v: number): Uint8Array {
  return Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

function readUint32LE(bytes: Uint8Array, o: number): number {
  return (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
}

function uint32LE(v: number): Uint8Array {
  return Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

// ─── CRC32 (PNG) ──────────────────────────────────────────────────────────────

let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PNG ──────────────────────────────────────────────────────────────────────

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function injectPngXmp(bytes: Uint8Array, xmp: string): Uint8Array {
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return bytes; // not a PNG

  const keyword = latin1Bytes('XML:com.adobe.xmp');
  const xmpBytes = new TextEncoder().encode(xmp);

  // iTXt data: keyword \0 | compFlag(0) compMethod(0) | langTag \0 | transKeyword \0 | text
  const data = concatBytes(keyword, Uint8Array.of(0, 0, 0, 0, 0), xmpBytes);
  const type = latin1Bytes('iTXt');
  const chunk = concatBytes(uint32BE(data.length), type, data, uint32BE(crc32(concatBytes(type, data))));

  // Insert immediately after IHDR (Adobe's conventional XMP placement). Some
  // readers (libvips/sharp among them) only surface PNG XMP when the iTXt sits
  // before the image data rather than just before IEND.
  let insertAt = -1;
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = readUint32BE(bytes, pos);
    const chunkType = ascii(bytes, pos + 4, 4);
    if (chunkType === 'IHDR') {
      insertAt = pos + 12 + len;
      break;
    }
    pos += 12 + len;
  }
  if (insertAt < 0) return bytes; // no IHDR → not a usable PNG
  return concatBytes(bytes.slice(0, insertAt), chunk, bytes.slice(insertAt));
}

// ─── JPEG ─────────────────────────────────────────────────────────────────────

const JPEG_XMP_HEADER = 'http://ns.adobe.com/xap/1.0/';

export function injectJpegXmp(bytes: Uint8Array, xmp: string): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes; // not a JPEG (no SOI)

  const header = latin1Bytes(JPEG_XMP_HEADER);
  const xmpBytes = new TextEncoder().encode(xmp);
  const payloadLen = header.length + 1 + xmpBytes.length; // +1 for the null terminator
  const segLen = payloadLen + 2; // segment length field counts itself
  if (segLen > 0xffff) return bytes; // too large for a standard APP1 segment; skip

  const segment = concatBytes(
    Uint8Array.of(0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff),
    header,
    Uint8Array.of(0x00),
    xmpBytes,
  );
  // Insert right after SOI. Valid placement regardless of any following APP0/JFIF.
  return concatBytes(bytes.slice(0, 2), segment, bytes.slice(2));
}

// ─── WebP ─────────────────────────────────────────────────────────────────────

interface RiffChunk {
  cc: string;
  data: Uint8Array;
}

export function injectWebpXmp(bytes: Uint8Array, xmp: string, width: number, height: number): Uint8Array {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return bytes;
  // Need valid dimensions to synthesize VP8X for a simple (non-extended) file.
  if (!width || !height || width < 1 || height < 1) return bytes;

  const chunks: RiffChunk[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const cc = ascii(bytes, pos, 4);
    const size = readUint32LE(bytes, pos + 4);
    const dataStart = pos + 8;
    if (dataStart + size > bytes.length) break; // malformed; bail to original
    chunks.push({ cc, data: bytes.slice(dataStart, dataStart + size) });
    pos = dataStart + size + (size & 1); // chunks are padded to even size
  }
  if (!chunks.length) return bytes;

  // Drop any existing XMP chunk so re-export doesn't accumulate duplicates.
  const out = chunks.filter((c) => c.cc !== 'XMP ');

  const existingVp8x = out.find((c) => c.cc === 'VP8X');
  if (existingVp8x) {
    const d = new Uint8Array(existingVp8x.data);
    d[0] = d[0] | 0x04; // set the XMP flag bit
    existingVp8x.data = d;
  } else {
    // Promote to extended format: VP8X must be the first chunk.
    const d = new Uint8Array(10);
    d[0] = 0x04; // flags: XMP present
    const w = width - 1;
    const h = height - 1;
    d[4] = w & 0xff;
    d[5] = (w >> 8) & 0xff;
    d[6] = (w >> 16) & 0xff;
    d[7] = h & 0xff;
    d[8] = (h >> 8) & 0xff;
    d[9] = (h >> 16) & 0xff;
    out.unshift({ cc: 'VP8X', data: d });
  }

  out.push({ cc: 'XMP ', data: new TextEncoder().encode(xmp) });

  // Reassemble: "WEBP" fourCC + each chunk (fourCC + LE size + data + pad).
  const parts: Uint8Array[] = [latin1Bytes('WEBP')];
  for (const c of out) {
    parts.push(latin1Bytes(c.cc), uint32LE(c.data.length), c.data);
    if (c.data.length & 1) parts.push(Uint8Array.of(0));
  }
  const payload = concatBytes(...parts);
  return concatBytes(latin1Bytes('RIFF'), uint32LE(payload.length), payload);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function injectXmpForFormat(
  blob: Blob,
  format: RasterFormat,
  xmp: string,
  dims?: { width: number; height: number },
): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let out: Uint8Array;
  switch (format) {
    case 'png':
      out = injectPngXmp(buf, xmp);
      break;
    case 'jpg':
      out = injectJpegXmp(buf, xmp);
      break;
    case 'webp':
      out = injectWebpXmp(buf, xmp, dims?.width ?? 0, dims?.height ?? 0);
      break;
    default:
      return blob;
  }
  if (out === buf) return blob; // injector bailed → original blob untouched
  const mime = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  return new Blob([ab], { type: mime });
}
