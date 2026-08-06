import sharp from 'sharp';
import { sanitizeSvgServer, analyzeSvgThreatsServer } from './_lib/svg-server-sanitize';

const PB_URL = 'https://stained-glass.pockethost.io';
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
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

// Lets a submitter edit their own pattern while it's still 'pending' (wrong
// file, a typo in the title, missing tags, etc.) - mirrors submit-pattern.ts's
// validation and file-processing pipeline so a replacement file still goes
// through SVG sanitization / raster-to-webp conversion instead of being
// written raw. The one real difference: the file is optional here. Omitting
// it (the common "just fixing the title" case) leaves the existing stored
// file untouched, since PocketBase ignores absent fields on a PATCH.
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

  const submissionId = (formData.get('submissionId') as string | null)?.trim() ?? '';
  const file = formData.get('file') as File | null; // optional - absent means "keep the existing file"
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
  if (!submissionId) return jsonError('Missing submission id', 400);
  if (!name) return jsonError('Pattern name is required', 400);
  if (!authToken) return jsonError('Not authenticated', 401);
  if (!turnstileToken) return jsonError('Security check missing', 400);
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

  // 6. Fetch the existing submission with the submitter's OWN token - the
  // collection's viewRule (submitter = @request.auth.id || admin) means a
  // request for someone else's submission simply 404s here, before any
  // write is attempted. Also enforces the actual edit window: once an admin
  // has claimed it (in_review) or it's been actioned, editing is over.
  const existingResp = await fetch(`${PB_URL}/api/collections/user_submitted_patterns/records/${submissionId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!existingResp.ok) return jsonError('Submission not found', 404);
  const existing = (await existingResp.json()) as { submitter: string; status: string; file_type: 'svg' | 'webp' };
  if (existing.submitter !== userId) return jsonError('You do not own this submission', 403);
  if (existing.status !== 'pending') {
    return jsonError('This submission can no longer be edited - it is already in review or has been processed.', 409);
  }

  // 7. File validation - optional on edit. PDFs are converted to an image
  // client-side before upload, same as create, so a raw PDF arriving here
  // means the client was bypassed.
  let uploadBlob: Blob | null = null;
  let uploadFileName: string | null = null;
  let newFileType: 'svg' | 'webp' | null = null;

  if (file) {
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

    try {
      if (isSvg) {
        const raw = await file.text();
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
        newFileType = 'svg';
      } else {
        const buffer = Buffer.from(await file.arrayBuffer());
        const webp = await convertImageToWebp(buffer);
        uploadBlob = new Blob([new Uint8Array(webp)], { type: 'image/webp' });
        uploadFileName = file.name.replace(/\.[^.]+$/, '') + '.webp';
        newFileType = 'webp';
      }
    } catch (error: any) {
      console.error('edit-pattern-submission processing error:', error?.message || error);
      return jsonError('Failed to process the uploaded file - please try a different one.', 400);
    }
  }

  // Layers only ever mean something for an SVG. Trust the client-sent layer
  // map only when the file that will actually be stored - the new upload if
  // there is one, otherwise the existing one - is SVG; this mirrors
  // submit-pattern.ts only reading layersMapRaw inside its isSvg branch,
  // rather than trusting a client flag that could be stale or wrong.
  const effectiveFileType = newFileType ?? existing.file_type;
  let layersMapToSend = '[]';
  let hasLayers = false;
  if (effectiveFileType === 'svg') {
    try {
      const parsed = JSON.parse(layersMapRaw);
      if (Array.isArray(parsed)) {
        layersMapToSend = JSON.stringify(parsed);
        hasLayers = parsed.length > 0;
      }
    } catch {
      // leave the safe defaults above
    }
  }

  // 8. Save to PocketBase - PATCH with the submitter's own token, gated by
  // the same shared password the create rule uses (see submit-pattern.ts /
  // FORM_SUBMISSION_PASSWORD). file_type/submitted_file are only included
  // when a replacement file was actually processed above; PocketBase leaves
  // an omitted file field untouched on a PATCH.
  const pbForm = new FormData();
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
  pbForm.append('layers_map', layersMapToSend);
  pbForm.append('has_layers', String(hasLayers));
  if (uploadBlob && uploadFileName && newFileType) {
    pbForm.append('file_type', newFileType);
    pbForm.append('submitted_file', uploadBlob, uploadFileName);
  }
  // Not a real schema field - only checked by the collection's Update API
  // rule (@request.body.password) to block direct writes that bypass this
  // function using nothing but a valid submitter token. Same convention as
  // the create rule / submit-contact.ts / submit-report.ts.
  pbForm.append('password', process.env.FORM_SUBMISSION_PASSWORD as string);

  const pbResp = await fetch(`${PB_URL}/api/collections/user_submitted_patterns/records/${submissionId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${authToken}` },
    body: pbForm,
  });

  if (!pbResp.ok) {
    const errText = await pbResp.text();
    console.error('Failed to update user submission:', errText);
    return jsonError('Failed to save your changes - please try again', 500);
  }

  return Response.json({ success: true, id: submissionId });
};

export const config = { path: '/api/edit-pattern-submission' };
