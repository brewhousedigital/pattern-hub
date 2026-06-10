const PB_URL = 'https://stained-glass.pockethost.io';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { pattern_id, email, reason, category, owner_id, token, hp, ts } = body as {
    pattern_id?: string;
    email?: string;
    reason?: string;
    category?: string;
    owner_id?: string;
    token?: string;
    hp?: string;
    ts?: number;
  };

  // 1. Honeypot - silent success to avoid training bots to retry
  if (hp !== '') {
    return Response.json({ success: true });
  }

  // 2. Timing guard: must be 2s–5min after form opened
  const now = Date.now();
  if (!ts || now - ts < 2_000 || now - ts > 300_000) {
    return Response.json({ error: 'Invalid submission timing' }, { status: 400 });
  }

  // 3. Basic field presence
  if (!pattern_id?.trim() || !email?.trim() || !reason?.trim() || !category?.trim()) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (reason.trim().length < 25) {
    return Response.json({ error: 'Report too short' }, { status: 400 });
  }

  // 4. Turnstile token verification
  if (!token) {
    return Response.json({ error: 'Security check missing' }, { status: 400 });
  }

  const cfResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });

  const cfData = (await cfResp.json()) as { success: boolean };
  if (!cfData.success) {
    return Response.json({ error: 'Security check failed' }, { status: 400 });
  }

  // 5. Forward clean payload to PocketBase
  const pbResp = await fetch(`${PB_URL}/api/collections/complaints/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pattern_id: pattern_id.trim(),
      email: email.trim(),
      reason: reason.trim(),
      category: category.trim(),
      owner_id: owner_id?.trim() || '',
      password: process.env.FORM_SUBMISSION_PASSWORD,
    }),
  });

  if (!pbResp.ok) {
    return Response.json({ error: 'Submission failed - please try again' }, { status: 500 });
  }

  return Response.json({ success: true });
};

export const config = { path: '/api/submit-report' };
