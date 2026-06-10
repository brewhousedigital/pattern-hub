const PB_URL = 'https://stained-glass.pockethost.io';
const IK_API_URL = 'https://api.imagekit.io/v1/files';

function ikAuthHeader(): string {
  return 'Basic ' + btoa((process.env.IMAGEKIT_PRIVATE_KEY ?? '') + ':');
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { recordId?: string; authToken?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { recordId, authToken } = body;

  if (!recordId || !authToken) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 1. Verify PocketBase auth token - get userId
  const pbAuthResp = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!pbAuthResp.ok) {
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }
  const pbAuthData = (await pbAuthResp.json()) as { record: { id: string } };
  const userId = pbAuthData.record.id;

  // 2. Fetch the gallery record - verify ownership
  const recordResp = await fetch(`${PB_URL}/api/collections/gallery/records/${recordId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!recordResp.ok) {
    return Response.json({ error: 'Photo not found' }, { status: 404 });
  }
  const record = (await recordResp.json()) as { owner_id: string; imagekit_file_id: string };

  if (record.owner_id !== userId) {
    return Response.json({ error: 'Not authorised' }, { status: 403 });
  }

  // 3. Delete from ImageKit (best-effort - don't fail the whole request if this errors)
  if (record.imagekit_file_id) {
    try {
      await fetch(`${IK_API_URL}/${record.imagekit_file_id}`, {
        method: 'DELETE',
        headers: { Authorization: ikAuthHeader() },
      });
    } catch (e) {
      console.warn('Image delete failed (continuing):', e);
    }
  }

  // 4. Delete from PocketBase
  const deleteResp = await fetch(`${PB_URL}/api/collections/gallery/records/${recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!deleteResp.ok) {
    return Response.json({ error: 'Failed to delete photo' }, { status: 500 });
  }

  return Response.json({ success: true });
};

export const config = { path: '/api/delete-gallery' };
