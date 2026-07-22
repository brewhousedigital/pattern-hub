import sharp from 'sharp';
import { sanitizeSvgServer, analyzeSvgThreatsServer } from './_lib/svg-server-sanitize';

const PB_URL = 'https://stained-glass.pockethost.io';
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const RATE_LIMIT_MS = 5_000; // one submission per 5 seconds per user
const MAX_RASTER_DIMENSION = 3000; // preserve more resolution than the gallery pipeline - these get traced

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function convertImageToWebp(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .rotate()
    .resize(MAX_RASTER_DIMENSION, MAX_RASTER_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError('Invalid form data', 400);
  }

  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const instructions = (formData.get('instructions') as string | null)?.trim() ?? '';
  const isAuthor = (formData.get('is_author') as string | null) === 'true';
  const authorManualName = (formData.get('author_manual_name') as string | null)?.trim() ?? '';
  const sourceUrl = (formData.get('source_url') as string | null)?.trim() ?? '';
  const sourceNotes = (formData.get('source_notes') as string | null)?.trim() ?? '';
  const pieces = (formData.get('pieces') as string | null)?.trim() || '1';
  const designWidth = (formData.get('design_width') as string | null)?.trim() || '0';
  const designHeight = (formData.get('design_height') as string | null)?.trim() || '0';
  const lineWidth = (formData.get('line_width') as string | null)?.trim() || '0';
  const designWidthUnit = (formData.get('design_width_unit') as string | null)?.trim() || 'in';
  const designHeightUnit = (formData.get('design_height_unit') as string | null)?.trim() || 'in';
  const lineWidthUnit = (formData.get('line_width_unit') as string | null)?.trim() || 'in';
  const designDate = (formData.get('design_date') as string | null)?.trim() ?? '';
  const tags = (formData.get('tags') as string | null) ?? '[]';
  const patternKeyReferenceList = (formData.get('pattern_key_reference_list') as string | null) ?? '[]';
  const customPatternKeyRequested = (formData.get('custom_pattern_key_requested') as string | null) === 'true';
  const layersMapRaw = (formData.get('layers_map') as string | null) ?? '[]';
  const authToken = (formData.get('authToken') as string | null)?.trim() ?? '';
  const turnstileToken = (formData.get('token') as string | null)?.trim() ?? '';
  const hp = (formData.get('hp') as string | null) ?? '';
  const ts = Number(formData.get('ts') ?? 0);

  // 1. Honeypot - silent success to avoid training bots
  if (hp !== '') {
    return Response.json({ success: true });
  }

  // 2. Timing guard
  const now = Date.now();
  if (!ts || now - ts < 2_000 || now - ts > 300_000) {
    return jsonError('Invalid submission timing', 400);
  }

  // 3. Required fields
  if (!name) return jsonError('Pattern name is required', 400);
  if (!authToken) return jsonError('Not authenticated', 401);
  if (!turnstileToken) return jsonError('Security check missing', 400);
  if (!file) return jsonError('No file provided', 400);
  if (!isAuthor && !authorManualName) return jsonError("Please provide the original artist's name", 400);
  if (!process.env.FORM_SUBMISSION_PASSWORD) {
    console.error('FORM_SUBMISSION_PASSWORD is not configured');
    return jsonError('Server misconfiguration', 500);
  }

  // 4. Turnstile verification
  const cfResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
  });
  const cfData = (await cfResp.json()) as { success: boolean };
  if (!cfData.success) return jsonError('Security check failed', 400);

  // 5. Verify PocketBase auth token + require a verified account
  const pbAuthResp = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!pbAuthResp.ok) return jsonError('Authentication failed', 401);
  const pbAuthData = (await pbAuthResp.json()) as { record: { id: string; verified?: boolean; banned?: boolean } };
  const userId = pbAuthData.record.id;
  if (!pbAuthData.record.verified) return jsonError('Your account must be verified to submit patterns', 403);
  if (pbAuthData.record.banned) return jsonError('This account cannot submit patterns', 403);

  // 6. Server-side rate limit - the client-side cooldown is UX only and is
  // trivially bypassed, so the real 10s-per-user enforcement happens here.
  const rateResp = await fetch(
    `${PB_URL}/api/collections/user_submitted_patterns/records?` +
      new URLSearchParams({
        filter: `submitter="${userId}"`,
        sort: '-created',
        perPage: '1',
      }),
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  if (rateResp.ok) {
    const rateData = (await rateResp.json()) as { items: { created: string }[] };
    const last = rateData.items[0];
    if (last && now - new Date(last.created).getTime() < RATE_LIMIT_MS) {
      return jsonError('Please wait a moment before submitting another pattern', 429);
    }
  }

  // 7. File validation - PDFs are converted to an image client-side before
  // upload, so the server only ever needs to handle images and SVGs. A raw
  // PDF arriving here means the client was bypassed - reject it rather than
  // carrying PDF-rasterization dependencies just for that edge case.
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = !isSvg && !isPdf && file.type.startsWith('image/');
  if (isPdf) {
    return jsonError('PDF uploads must be converted to an image in the browser before submitting', 400);
  }
  if (!isSvg && !isImage) {
    return jsonError('Only image files or SVG are supported', 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return jsonError('File is too large - maximum 15 MB. Try compressing it first at https://tinypng.com/', 400);
  }

  let uploadBlob: Blob;
  let uploadFileName: string;
  let fileType: 'svg' | 'webp';
  let layersMap: unknown[] = [];

  try {
    if (isSvg) {
      const raw = await file.text();

      // Malicious SVGs are rejected outright at submit time - there's no
      // admin present here to eyeball a warning dialog the way the admin
      // upload flow does, so any detected threat is a hard block.
      const threats = await analyzeSvgThreatsServer(raw);
      if (threats.some((t) => t.severity === 'high')) {
        return jsonError(
          'This SVG could not be accepted for security reasons. Please re-export it from your design tool and try again.',
          400,
        );
      }

      const clean = await sanitizeSvgServer(raw);
      uploadBlob = new Blob([clean], { type: 'image/svg+xml' });
      uploadFileName = file.name.replace(/\.[^.]+$/, '') + '.svg';
      fileType = 'svg';
      try {
        layersMap = JSON.parse(layersMapRaw);
      } catch {
        layersMap = [];
      }
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const webp = await convertImageToWebp(buffer);
      uploadBlob = new Blob([new Uint8Array(webp)], { type: 'image/webp' });
      uploadFileName = file.name.replace(/\.[^.]+$/, '') + '.webp';
      fileType = 'webp';
    }
  } catch (error: any) {
    console.error('submit-pattern processing error:', error?.message || error);
    return jsonError('Failed to process the uploaded file - please try a different one.', 400);
  }

  // 8. Save to PocketBase - multipart because of the file field. Written
  // with the submitter's own token (not a superuser token): the
  // user_submitted_patterns API rule already requires @request.auth.verified.
  const pbForm = new FormData();
  pbForm.append('submitter', userId);
  pbForm.append('is_author', String(isAuthor));
  pbForm.append('author_manual_name', isAuthor ? '' : authorManualName);
  pbForm.append('source_url', isAuthor ? '' : sourceUrl);
  pbForm.append('source_notes', isAuthor ? '' : sourceNotes);
  pbForm.append('name', name);
  pbForm.append('description', description);
  pbForm.append('instructions', instructions);
  pbForm.append('pieces', pieces);
  pbForm.append('design_width', designWidth);
  pbForm.append('design_height', designHeight);
  pbForm.append('line_width', lineWidth);
  pbForm.append('design_width_unit', designWidthUnit);
  pbForm.append('design_height_unit', designHeightUnit);
  pbForm.append('line_width_unit', lineWidthUnit);
  if (designDate) pbForm.append('design_date', designDate);
  pbForm.append('tags', tags);
  pbForm.append('pattern_key_reference_list', patternKeyReferenceList);
  pbForm.append('custom_pattern_key_requested', String(customPatternKeyRequested));
  pbForm.append('file_type', fileType);
  pbForm.append('has_layers', String(layersMap.length > 0));
  pbForm.append('layers_map', JSON.stringify(layersMap));
  pbForm.append('status', 'pending');
  pbForm.append('hidden', 'false');
  pbForm.append('submitted_file', uploadBlob, uploadFileName);
  // Not a real schema field - only checked by the collection's Create API rule
  // (@request.data.password) to block direct writes that bypass this function
  // (captcha, rate limit, SVG threat scan) using nothing but a valid user's own
  // auth token. Same convention as submit-contact.ts/submit-report.ts.
  pbForm.append('password', process.env.FORM_SUBMISSION_PASSWORD as string);

  const pbResp = await fetch(`${PB_URL}/api/collections/user_submitted_patterns/records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: pbForm,
  });

  if (!pbResp.ok) {
    const errText = await pbResp.text();
    console.error('Failed to save user submission:', errText);
    return jsonError('Failed to save your submission - please try again', 500);
  }

  const pbData = (await pbResp.json()) as { id: string };
  return Response.json({ success: true, id: pbData.id });
};

export const config = { path: '/api/submit-pattern' };
