// @ts-ignore
import sharp from 'sharp';

const PB_URL = 'https://stained-glass.pockethost.io';
const IK_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const IK_API_URL = 'https://api.imagekit.io/v1/files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 1000;

const AI_TASK_EXTENSIONS = JSON.stringify([
  {
    name: 'ai-tasks',
    tasks: [
      {
        type: 'yes_no',
        instruction:
          'Does this image contain explicit nudity, pornographic content, or extreme graphic violence that is clearly not artistic in nature? Note: stained glass art, abstract patterns, craft photography, and typical art community content should pass. Only flag content that is blatantly NSFW.',
        on_yes: { add_tags: ['nsfw-flagged'], set_metadata: [{ field: 'status', value: 'rejected' }] },
        on_no: { add_tags: ['content-safe'], set_metadata: [{ field: 'status', value: 'approved' }] },
        on_unknown: { add_tags: ['needs-review'], set_metadata: [{ field: 'status', value: 'pending' }] },
      },
    ],
  },
]);

function ikAuthHeader(): string {
  return 'Basic ' + btoa((process.env.IMAGEKIT_PRIVATE_KEY ?? '') + ':');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteIkFile(fileId: string): Promise<void> {
  try {
    await fetch(`${IK_API_URL}/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: ikAuthHeader() },
    });
  } catch (e) {
    console.warn('ImageKit delete failed (continuing):', e);
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const patternId = (formData.get('pattern_id') as string | null)?.trim() ?? '';
  const recordId = (formData.get('recordId') as string | null)?.trim() ?? '';
  const authToken = (formData.get('authToken') as string | null)?.trim() ?? '';
  const turnstileToken = (formData.get('token') as string | null)?.trim() ?? '';
  const hp = (formData.get('hp') as string | null) ?? '';
  const ts = Number(formData.get('ts') ?? 0);

  // 1. Honeypot
  if (hp !== '') return Response.json({ success: true });

  // 2. Timing guard
  const now = Date.now();
  if (!ts || now - ts < 2_000 || now - ts > 300_000) {
    return Response.json({ error: 'Invalid submission timing' }, { status: 400 });
  }

  // 3. Required fields
  if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });
  if (!authToken) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  if (!recordId) return Response.json({ error: 'Record ID is required' }, { status: 400 });
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
  if (!turnstileToken) return Response.json({ error: 'Security check missing' }, { status: 400 });

  // 4. Turnstile verification
  const cfResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
  });
  const cfData = (await cfResp.json()) as { success: boolean };
  if (!cfData.success) return Response.json({ error: 'Security check failed' }, { status: 400 });

  // 5. Verify PocketBase auth + get userId
  const pbAuthResp = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!pbAuthResp.ok) return Response.json({ error: 'Authentication failed' }, { status: 401 });
  const pbAuthData = (await pbAuthResp.json()) as { record: { id: string } };
  const userId = pbAuthData.record.id;

  // 6. Fetch existing record + verify ownership
  const recordResp = await fetch(`${PB_URL}/api/collections/gallery/records/${recordId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!recordResp.ok) return Response.json({ error: 'Photo not found' }, { status: 404 });
  const record = (await recordResp.json()) as { owner_id: string; imagekit_file_id: string };
  if (record.owner_id !== userId) return Response.json({ error: 'Not authorised' }, { status: 403 });

  // 7. Validate file
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: 'Only image files are allowed' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'File too large - maximum 10 MB' }, { status: 400 });
  }

  // 8. Process image with sharp
  let uploadBlob: Blob;
  let sanitizedName: string;
  try {
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const processedBuffer = await sharp(originalBuffer)
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    uploadBlob = new Blob([new Uint8Array(processedBuffer)], { type: 'image/webp' });
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';
    sanitizedName = `${baseName}.webp`;
  } catch (error: any) {
    return Response.json(
      { error: 'Failed to process image - please try a different file.', message: error?.message ?? '' },
      { status: 400 },
    );
  }

  // 9. Upload new image to ImageKit
  const ikForm = new FormData();
  ikForm.append('file', uploadBlob, sanitizedName);
  ikForm.append('fileName', `${userId}_${sanitizedName}`);
  ikForm.append('folder', `/pattern-archive/user-gallery/`);
  ikForm.append('useUniqueFileName', 'true');
  ikForm.append('tags', 'user-gallery');
  ikForm.append('extensions', AI_TASK_EXTENSIONS);

  const ikUploadResp = await fetch(IK_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: ikAuthHeader() },
    body: ikForm,
  });
  if (!ikUploadResp.ok) {
    return Response.json({ error: 'Image upload failed - please try again' }, { status: 500 });
  }

  const ikData = (await ikUploadResp.json()) as {
    fileId: string;
    url: string;
    tags?: string[];
    extensionStatus?: Record<string, string>;
  };
  const { fileId, url } = ikData;

  // 10. Resolve AI content moderation
  let tags: string[] = ikData.tags ?? [];
  const uploadAiStatus = ikData.extensionStatus?.['ai-tasks'];

  if (uploadAiStatus === 'failed') {
    tags = ['nsfw-flagged'];
  } else if (uploadAiStatus !== 'success') {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await delay(POLL_DELAY_MS);
      const fileResp = await fetch(`${IK_API_URL}/${fileId}/details`, {
        headers: { Authorization: ikAuthHeader() },
      });
      if (fileResp.ok) {
        const fileData = (await fileResp.json()) as {
          tags?: string[];
          extensionStatus?: Record<string, string>;
        };
        const aiStatus = fileData.extensionStatus?.['ai-tasks'];
        if (aiStatus === 'success') { tags = fileData.tags ?? []; break; }
        if (aiStatus === 'failed') { tags = ['nsfw-flagged']; break; }
      }
    }
  }

  // 11. Block NSFW
  if (tags.includes('nsfw-flagged')) {
    await deleteIkFile(fileId);
    return Response.json({ error: 'Content not permitted in this community' }, { status: 400 });
  }

  // 12. Update PocketBase record
  const pbResp = await fetch(`${PB_URL}/api/collections/gallery/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      title,
      description,
      src: url,
      imagekit_file_id: fileId,
      pattern_id: patternId || null,
    }),
  });
  if (!pbResp.ok) {
    await deleteIkFile(fileId);
    return Response.json({ error: 'Failed to save changes - please try again' }, { status: 500 });
  }

  // 13. Delete old ImageKit file (best-effort)
  if (record.imagekit_file_id) {
    await deleteIkFile(record.imagekit_file_id);
  }

  return Response.json({ success: true, src: url });
};

export const config = { path: '/api/update-gallery' };
