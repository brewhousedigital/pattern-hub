// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import type { Context } from 'https://edge.netlify.com';

const POCKETBASE_URL = Deno.env.get('POCKETBASE_URL') ?? '';
const SITE_URL = Deno.env.get('URL') ?? '';
const SITE_NAME = 'Pattern Hub';

const BOT_AGENTS = [
  'discordbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'googlebot',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_AGENTS.some((bot) => ua.includes(bot));
}

function injectMeta(html: string, meta: Record<string, string>): string {
  const tags = Object.entries(meta)
    .map(([property, content]) =>
      property.startsWith('og:') || property.startsWith('twitter:')
        ? `<meta property="${property}" content="${content}">`
        : `<meta name="${property}" content="${content}">`,
    )
    .join('\n    ');

  return html.replace('</head>', `  ${tags}\n  </head>`);
}

async function resolvePageMeta(pathname: string): Promise<Record<string, string>> {
  const base = {
    'og:site_name': SITE_NAME,
    'og:type': 'website',
    'twitter:card': 'summary_large_image',
  };

  // /patterns/:id
  const patternMatch = pathname.match(/^\/patterns\/([^/]+)$/);
  if (patternMatch) {
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/collections/patterns/records/${patternMatch[1]}`);
      if (res.ok) {
        const pattern = await res.json();
        const imageUrl = pattern.image
          ? `${POCKETBASE_URL}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.image}?thumb=1200x630`
          : null;

        return {
          ...base,
          title: `${pattern.name} — ${SITE_NAME}`,
          description: pattern.description ?? 'View this pattern on Pattern Hub.',
          'og:title': `${pattern.name} — ${SITE_NAME}`,
          'og:description': pattern.description ?? 'View this pattern on Pattern Hub.',
          'og:url': `${SITE_URL}${pathname}`,
          ...(imageUrl ? { 'og:image': imageUrl, 'twitter:image': imageUrl } : {}),
        };
      }
    } catch {
      // fall through to defaults
    }
  }

  // /faq
  if (pathname === '/faq') {
    return {
      ...base,
      title: `FAQ — ${SITE_NAME}`,
      description: 'Frequently asked questions about Pattern Hub.',
      'og:title': `FAQ — ${SITE_NAME}`,
      'og:description': 'Frequently asked questions about Pattern Hub.',
      'og:url': `${SITE_URL}/faq`,
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

  // Pass non-bot requests straight through — zero overhead for real users
  if (!isBot(userAgent)) {
    return context.next();
  }

  const { pathname } = new URL(request.url);

  // Only handle HTML page routes, not assets or API calls
  if (pathname.match(/\.(js|css|png|jpg|svg|ico|json|woff2?)$/)) {
    return context.next();
  }

  try {
    const [response, meta] = await Promise.all([context.next(), resolvePageMeta(pathname)]);

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
