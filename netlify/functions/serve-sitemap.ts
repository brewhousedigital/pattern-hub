import { getStore } from '@netlify/blobs';

const SITEMAP_FILES = [
  'sitemap.xml',
  'sitemap-static.xml',
  'sitemap-patterns.xml',
  'sitemap-wiki.xml',
  'sitemap-sets.xml',
  'sitemap-authors.xml',
];

// Minimal fallback so a request never 500s if the scheduled generator hasn't run yet
// (first deploy) or Blobs is temporarily unreachable - matches the previous static file.
const FALLBACK_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://patternarchive.net/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
</urlset>
`;

export default async (req: Request) => {
  const { pathname } = new URL(req.url);
  const name = pathname.replace(/^\//, '');

  if (!SITEMAP_FILES.includes(name)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const store = getStore('sitemaps');
    const xml = await store.get(name, { type: 'text' });

    if (!xml) {
      return new Response(name === 'sitemap.xml' ? FALLBACK_INDEX : '', {
        status: name === 'sitemap.xml' ? 200 : 404,
        headers: { 'content-type': 'application/xml; charset=UTF-8' },
      });
    }

    return new Response(xml, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=UTF-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[serve-sitemap] Failed:', err);
    return new Response(FALLBACK_INDEX, {
      status: 200,
      headers: { 'content-type': 'application/xml; charset=UTF-8' },
    });
  }
};

// Netlify extracts `config.path` via static analysis of this file at build time -
// it does NOT execute the module, so a computed value (e.g. SITEMAP_FILES.map(...))
// is silently ignored and no custom route gets registered. Must be a literal array.
export const config = {
  path: [
    '/sitemap.xml',
    '/sitemap-static.xml',
    '/sitemap-patterns.xml',
    '/sitemap-wiki.xml',
    '/sitemap-sets.xml',
    '/sitemap-authors.xml',
  ],
};
