const PB_URL = 'https://stained-glass.pockethost.io';

/**
 * GET /api/get-stores
 *
 * Returns all store_locations records from PocketBase.
 * Netlify CDN caches the response for 1 hour (stale-while-revalidate 24 h).
 * This prevents hammering PocketBase on every page load and keeps tile/geocode
 * API usage well under rate limits.
 */
export default async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const res = await fetch(
      `${PB_URL}/api/collections/store_locations/records?perPage=500&sort=-created`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      return new Response('Failed to fetch stores from database', { status: 502 });
    }

    const data = await res.json();

    return Response.json(data, {
      headers: {
        // Netlify CDN: serve fresh for 1 h, then serve stale while revalidating for 24 h
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new Response('Internal server error', { status: 500 });
  }
};

export const config = { path: '/api/get-stores' };
