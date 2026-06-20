// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import type { Context } from 'https://edge.netlify.com';

const POCKETBASE_URL = Deno.env.get('POCKETBASE_URL') ?? '';
const SITE_URL = Deno.env.get('URL') ?? '';
const SITE_NAME = 'Pattern Archive';

const BOT_AGENTS = [
  // Social platforms
  'discordbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'redditbot',
  'blueskypreviewbot',
  // Search engines
  'googlebot',
  'bingpreview',
  'yandex',
  // iMessage / Apple
  'applebot',
  // Microsoft Teams
  'skypeuripreview',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();

  // Catch anything explicitly in our list
  if (BOT_AGENTS.some((bot) => ua.includes(bot))) return true;

  // Generic fallback - most crawlers self-identify with "bot" in their UA
  // Excludes common false positives like "robot" in product names
  if (ua.includes('bot') && !ua.includes('chrome') && !ua.includes('firefox')) return true;

  return false;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s.*$/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

function injectMeta(html: string, meta: Record<string, string>): string {
  const tags = Object.entries(meta)
    .map(([property, content]) => {
      if (property === 'title') {
        return `<title>${content}</title>`;
      }

      if (property.startsWith('og:') || property.startsWith('twitter:')) {
        return `<meta property="${property}" content="${content}">`;
      }

      return `<meta name="${property}" content="${content}">`;
    })
    .join('\n    ');

  return html.replace('</head>', `  ${tags}\n  </head>`);
}

async function resolvePageMeta(request: Request, pathname: string): Promise<Record<string, string>> {
  const defaultPosterImage = `https://patternarchive.net/poster.png`;

  const base = {
    'og:site_name': SITE_NAME,
    'og:type': 'website',
    'twitter:card': 'summary_large_image',
    'og:image': defaultPosterImage,
    'twitter:image': defaultPosterImage,
  };

  // /patterns/:id
  const patternMatch = pathname.match(/^\/pattern\/([^/]+)$/);

  if (patternMatch) {
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/collections/patterns/records/${patternMatch[1]}`);

      if (res.ok) {
        const pattern = await res.json();
        const imageUrl = pattern?.opengraph_image
          ? `${POCKETBASE_URL}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.opengraph_image}`
          : defaultPosterImage;

        return {
          ...base,
          title: `${pattern.name} - ${SITE_NAME}`,
          description: pattern.description
            ? `${pattern.description}. ${POCKETBASE_URL}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.opengraph_image}`
            : 'View this pattern on Pattern Archive.',
          'og:title': `${pattern.name} - ${SITE_NAME}`,
          'og:description': pattern.description ?? 'View this pattern on Pattern Archive.',
          'og:url': `${SITE_URL}${pathname}`,
          ...(imageUrl ? { 'og:image': imageUrl, 'twitter:image': imageUrl } : {}),
        };
      }
    } catch {
      // fall through to defaults
    }
  }

  const homepagePatternMatch = new URL(request.url).searchParams.get('patternId');

  if (homepagePatternMatch) {
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/collections/patterns/records/${homepagePatternMatch}`);

      if (res.ok) {
        const pattern = await res.json();

        const imageUrl = pattern?.opengraph_image
          ? `${POCKETBASE_URL}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.opengraph_image}`
          : defaultPosterImage;

        return {
          ...base,
          title: `${pattern.name} - ${SITE_NAME}`,
          description: pattern.description
            ? `${pattern.description}. ${POCKETBASE_URL}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.opengraph_image}`
            : 'View this pattern on Pattern Archive.',
          'og:title': `${pattern.name} - ${SITE_NAME}`,
          'og:description': pattern.description ?? 'View this pattern on Pattern Archive.',
          'og:url': `${SITE_URL}${pathname}`,
          ...(imageUrl ? { 'og:image': imageUrl, 'twitter:image': imageUrl } : {}),
        };
      }
    } catch {
      // fall through to defaults
    }
  }

  // /wiki/:categorySlug/:pageSlug
  const wikiPageMatch = pathname.match(/^\/wiki\/([^/]+)\/([^/]+)$/);
  if (wikiPageMatch) {
    try {
      const categorySlug = wikiPageMatch[1].replace(/"/g, '');
      const pageSlug = wikiPageMatch[2].replace(/"/g, '');
      const params = new URLSearchParams({
        filter: `category.slug="${categorySlug}"&&slug="${pageSlug}"`,
        expand: 'category',
        perPage: '1',
      });
      const res = await fetch(`${POCKETBASE_URL}/api/collections/wiki_pages/records?${params}`);
      if (res.ok) {
        const data = await res.json();
        const page = data?.items?.[0];
        if (page) {
          const categoryName = page.expand?.category?.name ?? categorySlug;
          const excerpt = stripMarkdown(page.content).slice(0, 150);
          const description =
            excerpt || `Read ${page.title} in the ${categoryName} section of the ${SITE_NAME} wiki.`;
          return {
            ...base,
            title: `${page.title} - ${SITE_NAME}`,
            description,
            'og:title': `${page.title} - ${SITE_NAME}`,
            'og:description': description,
            'og:url': `${SITE_URL}${pathname}`,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // /wiki/:categorySlug
  const wikiCategoryMatch = pathname.match(/^\/wiki\/([^/]+)\/?$/);
  if (wikiCategoryMatch) {
    try {
      const categorySlug = wikiCategoryMatch[1].replace(/"/g, '');
      const params = new URLSearchParams({ filter: `slug="${categorySlug}"`, perPage: '1' });
      const res = await fetch(`${POCKETBASE_URL}/api/collections/wiki_categories/records?${params}`);
      if (res.ok) {
        const data = await res.json();
        const category = data?.items?.[0];
        if (category) {
          return {
            ...base,
            title: `${category.name} - Wiki - ${SITE_NAME}`,
            description: `Browse ${category.name} articles in the ${SITE_NAME} wiki.`,
            'og:title': `${category.name} - Wiki - ${SITE_NAME}`,
            'og:description': `Browse ${category.name} articles in the ${SITE_NAME} wiki.`,
            'og:url': `${SITE_URL}${pathname}`,
          };
        }
      }
    } catch {
      // fall through
    }
    return {
      ...base,
      title: `Wiki - ${SITE_NAME}`,
      description: 'Browse the Pattern Archive wiki.',
      'og:title': `Wiki - ${SITE_NAME}`,
      'og:description': 'Browse the Pattern Archive wiki.',
      'og:url': `${SITE_URL}${pathname}`,
    };
  }

  // /wiki
  if (pathname === '/wiki') {
    return {
      ...base,
      title: `Wiki - ${SITE_NAME}`,
      description: 'Guides, tutorials, and reference documentation for Pattern Archive.',
      'og:title': `Wiki - ${SITE_NAME}`,
      'og:description': 'Guides, tutorials, and reference documentation for Pattern Archive.',
      'og:url': `${SITE_URL}/wiki`,
    };
  }

  // /sets/:setId
  const setMatch = pathname.match(/^\/sets\/([^/]+)$/);
  if (setMatch) {
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/collections/pattern_sets/records/${setMatch[1]}`);
      if (res.ok) {
        const set = await res.json();
        if (set?.is_published) {
          const description = set.description
            ? stripMarkdown(set.description).slice(0, 150)
            : 'A curated collection of stained glass patterns on Pattern Archive.';
          return {
            ...base,
            title: `${set.title} - ${SITE_NAME}`,
            description,
            'og:title': `${set.title} - ${SITE_NAME}`,
            'og:description': description,
            'og:url': `${SITE_URL}${pathname}`,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // /sets
  if (pathname === '/sets') {
    return {
      ...base,
      title: `Sets - ${SITE_NAME}`,
      description: 'Browse curated pattern collections.',
      'og:title': `Sets - ${SITE_NAME}`,
      'og:description': 'Browse curated pattern collections.',
      'og:url': `${SITE_URL}/sets`,
    };
  }

  // /store-locator
  if (pathname === '/store-locator') {
    return {
      ...base,
      title: `Store Locator - ${SITE_NAME}`,
      description: 'Find craft supply stores near you.',
      'og:title': `Store Locator - ${SITE_NAME}`,
      'og:description': 'Find craft supply stores near you.',
      'og:url': `${SITE_URL}/store-locator`,
    };
  }

  // /help/faq
  if (pathname === '/help/faq') {
    return {
      ...base,
      title: `FAQ - ${SITE_NAME}`,
      description: 'Frequently asked questions about Pattern Archive.',
      'og:title': `FAQ - ${SITE_NAME}`,
      'og:description': 'Frequently asked questions about Pattern Archive.',
      'og:url': `${SITE_URL}/help/faq`,
    };
  }

  if (pathname === '/help/privacy-policy') {
    return {
      ...base,
      title: `Privacy Policy - ${SITE_NAME}`,
      description: 'Pattern Archive is built with privacy as a default. Read how we handle your data.',
      'og:title': `Privacy Policy - ${SITE_NAME}`,
      'og:description': 'Pattern Archive is built with privacy as a default. Read how we handle your data.',
      'og:url': `${SITE_URL}/help/privacy-policy`,
    };
  }

  if (pathname === '/help/terms-of-service') {
    return {
      ...base,
      title: `Terms of Service - ${SITE_NAME}`,
      description: 'Plain-language terms for using Pattern Archive.',
      'og:title': `Terms of Service - ${SITE_NAME}`,
      'og:description': 'Plain-language terms for using Pattern Archive.',
      'og:url': `${SITE_URL}/help/terms-of-service`,
    };
  }

  if (pathname === '/help/contact') {
    return {
      ...base,
      title: `Contact - ${SITE_NAME}`,
      description: 'Get in touch with the Pattern Archive team.',
      'og:title': `Contact - ${SITE_NAME}`,
      'og:description': 'Get in touch with the Pattern Archive team.',
      'og:url': `${SITE_URL}/help/contact`,
    };
  }

  if (pathname === '/help/about') {
    return {
      ...base,
      title: `About - ${SITE_NAME}`,
      description: 'Learn more about Pattern Archive, the stained glass pattern sharing platform.',
      'og:title': `About - ${SITE_NAME}`,
      'og:description': 'Learn more about Pattern Archive, the stained glass pattern sharing platform.',
      'og:url': `${SITE_URL}/help/about`,
    };
  }

  if (pathname === '/collections') {
    return {
      ...base,
      title: `Collections - ${SITE_NAME}`,
      description: 'Unique collections to help with your stained glass journey.',
      'og:title': `Collections - ${SITE_NAME}`,
      'og:description': 'Unique collections to help with your stained glass journey.',
      'og:url': `${SITE_URL}/collections`,
    };
  }

  if (pathname === '/guides') {
    return {
      ...base,
      title: `Guides - ${SITE_NAME}`,
      description: 'Guides and tutorials to help you through projects.',
      'og:title': `Guides - ${SITE_NAME}`,
      'og:description': 'Guides and tutorials to help you through projects.',
      'og:url': `${SITE_URL}/guides`,
    };
  }

  // homepage / fallback
  return {
    ...base,
    title: SITE_NAME,
    description: 'Find a pattern for your stained glass project.',
    'og:title': SITE_NAME,
    'og:description': 'Find a pattern for your stained glass project.',
    'og:url': `${SITE_URL}${pathname}`,
  };
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  const userAgent = request.headers.get('user-agent') ?? '';

  // Pass non-bot requests straight through - zero overhead for real users
  if (!isBot(userAgent)) {
    return context.next();
  }

  const { pathname } = new URL(request.url);

  // Only handle HTML page routes, not assets or API calls
  if (pathname.match(/\.(js|css|png|jpg|svg|ico|json|woff2?)$/)) {
    return context.next();
  }

  try {
    const [response, meta] = await Promise.all([context.next(), resolvePageMeta(request, pathname)]);

    const html = await response.text();
    const injected = injectMeta(html, meta);

    return new Response(injected, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  } catch {
    return context.next();
  }
}

export const config = {
  path: '/*',
};
