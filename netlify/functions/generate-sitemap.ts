import { getStore } from '@netlify/blobs';

const PB_URL = 'https://stained-glass.pockethost.io';
const SITE_URL = 'https://patternarchive.net';
const PER_PAGE = 200;

type PbListResponse<T> = { page: number; totalPages: number; items: T[] };

async function fetchAllPages<T>(collection: string, params: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const search = new URLSearchParams({ ...params, page: String(page), perPage: String(PER_PAGE) });
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records?${search}`);
    if (!res.ok) break;

    const data = (await res.json()) as PbListResponse<T>;
    items.push(...data.items);
    totalPages = data.totalPages;
    page += 1;
  }

  return items;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type SitemapUrl = { loc: string; lastmod?: string; changefreq?: string; priority?: string };

function buildUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${xmlEscape(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod.slice(0, 10)}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority) parts.push(`    <priority>${u.priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildSitemapIndex(names: string[], now: string): string {
  const body = names
    .map((name) => `  <sitemap>\n    <loc>${SITE_URL}/${name}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

const STATIC_URLS: SitemapUrl[] = [
  { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
  { loc: `${SITE_URL}/pattern/`, changefreq: 'daily', priority: '0.9' },
  { loc: `${SITE_URL}/sets/`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${SITE_URL}/wiki/`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${SITE_URL}/guides/`, changefreq: 'weekly', priority: '0.7' },
  { loc: `${SITE_URL}/store-locator/`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${SITE_URL}/help/about`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${SITE_URL}/help/faq`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${SITE_URL}/help/contact`, changefreq: 'monthly', priority: '0.4' },
  { loc: `${SITE_URL}/help/privacy-policy`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${SITE_URL}/help/terms-of-service`, changefreq: 'yearly', priority: '0.3' },
];

type PatternRecord = { id: string; updated: string; last_updated?: string; created: string };
type WikiCategoryRecord = { id: string; slug: string; updated: string; created: string };
type WikiPageRecord = { slug: string; updated: string; created: string; expand?: { category?: { slug: string } } };
type SetRecord = { id: string; updated: string; created: string };
type AuthorRecord = { slug: string; updated: string; created: string };

async function buildSitemaps(): Promise<Record<string, string>> {
  const [patterns, wikiCategories, wikiPages, sets, authors] = await Promise.all([
    fetchAllPages<PatternRecord>('patterns', {
      filter: 'isDeleted=false && is_draft=false',
      fields: 'id,updated,last_updated,created',
    }),
    fetchAllPages<WikiCategoryRecord>('wiki_categories', { fields: 'id,slug,updated' }),
    fetchAllPages<WikiPageRecord>('wiki_pages', { expand: 'category', fields: 'slug,updated,expand.category.slug' }),
    fetchAllPages<SetRecord>('pattern_sets', { filter: 'is_published=true', fields: 'id,updated' }),
    fetchAllPages<AuthorRecord>('manual_authors', { filter: 'is_published=true', fields: 'slug,updated' }),
  ]);

  const sitemapPatterns = buildUrlset(
    patterns.map((p) => ({
      loc: `${SITE_URL}/pattern/${p.id}`,
      lastmod: p.last_updated || p.created,
      changefreq: 'monthly',
    })),
  );

  const wikiCategoryUrls = wikiCategories.map((c) => ({
    loc: `${SITE_URL}/wiki/${c.slug}`,
    lastmod: c.updated,
    changefreq: 'weekly',
  }));
  const wikiPageUrls = wikiPages
    .filter((p) => p.expand?.category?.slug)
    .map((p) => ({
      loc: `${SITE_URL}/wiki/${p.expand!.category!.slug}/${p.slug}`,
      lastmod: p.updated,
      changefreq: 'monthly',
    }));
  const sitemapWiki = buildUrlset([...wikiCategoryUrls, ...wikiPageUrls]);

  const sitemapSets = buildUrlset(
    sets.map((s) => ({ loc: `${SITE_URL}/sets/${s.id}`, lastmod: s.updated, changefreq: 'monthly' })),
  );

  const sitemapAuthors = buildUrlset(
    authors.map((a) => ({ loc: `${SITE_URL}/authors/${a.slug}`, lastmod: a.updated, changefreq: 'monthly' })),
  );

  const sitemapStatic = buildUrlset(STATIC_URLS);

  const now = new Date().toISOString().slice(0, 10);
  const sitemapIndex = buildSitemapIndex(
    ['sitemap-static.xml', 'sitemap-patterns.xml', 'sitemap-wiki.xml', 'sitemap-sets.xml', 'sitemap-authors.xml'],
    now,
  );

  return {
    'sitemap.xml': sitemapIndex,
    'sitemap-static.xml': sitemapStatic,
    'sitemap-patterns.xml': sitemapPatterns,
    'sitemap-wiki.xml': sitemapWiki,
    'sitemap-sets.xml': sitemapSets,
    'sitemap-authors.xml': sitemapAuthors,
  };
}

export default async () => {
  try {
    const sitemaps = await buildSitemaps();
    const store = getStore('sitemaps');

    await Promise.all(
      Object.entries(sitemaps).map(([key, xml]) =>
        store.set(key, xml, { metadata: { contentType: 'application/xml' } }),
      ),
    );

    return Response.json({ success: true, files: Object.keys(sitemaps) });
  } catch (err) {
    console.error('[generate-sitemap] Failed:', err);
    return Response.json({ error: 'Sitemap generation failed' }, { status: 500 });
  }
};

export const config = { schedule: '@daily' };
