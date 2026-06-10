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

  // /faq
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
