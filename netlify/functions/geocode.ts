/**
 * GET /api/geocode?q=<address>
 *
 * Proxies Nominatim (OpenStreetMap geocoder) with:
 *  - A proper application User-Agent (required by Nominatim ToS)
 *  - 7-day CDN cache (same address always returns same result, safe to cache aggressively)
 *
 * Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
 * - Max 1 req/s from a single IP - Netlify CDN caching means repeated queries
 *   for the same address never reach Nominatim.
 * - Must identify application via User-Agent.
 */
export default async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return Response.json([], { status: 200 });
  }

  try {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('q', q.trim());
    nominatimUrl.searchParams.set('format', 'json');
    nominatimUrl.searchParams.set('limit', '5');
    nominatimUrl.searchParams.set('addressdetails', '1');

    const nominatimRes = await fetch(nominatimUrl.toString(), {
      headers: {
        // Nominatim requires a meaningful User-Agent identifying your application
        'User-Agent': 'PatternArchive/1.0 (https://patternarchive.net)',
        'Accept-Language': 'en',
        Referer: 'https://patternarchive.net',
      },
    });

    if (!nominatimRes.ok) {
      return new Response('Nominatim request failed', { status: 502 });
    }

    const data = await nominatimRes.json();

    return Response.json(data, {
      headers: {
        // 7 days - same address string always returns the same geocoding result
        'Cache-Control': 'public, s-maxage=604800',
      },
    });
  } catch {
    return new Response('Internal server error', { status: 500 });
  }
};

export const config = { path: '/api/geocode' };
