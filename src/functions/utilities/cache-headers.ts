// Cache-Control presets for TanStack Start route `headers()` options. These
// become real HTTP response headers on the SSR Response (not just <head>
// meta - see createStartHandler's getStartResponseHeaders), so Netlify's CDN
// can serve repeat requests without invoking the SSR function at all.
//
// Only apply these to routes whose SSR output is identical for every visitor
// regardless of auth state - verified for this app by NotificationBell (and
// similar auth-gated UI) rendering `null` during SSR and only hydrating
// per-user content client-side from localStorage. Never apply to /auth/*,
// /profile/*, /space-command/*, or /submit-pattern.
//
// `max-age=0` keeps browsers from caching a stale copy past a single
// navigation; `s-maxage` is what Netlify's CDN honors; `stale-while-revalidate`
// lets the CDN keep serving a slightly-stale copy while it refetches in the
// background, so a cache expiry never turns into a slow PocketBase round trip
// for whoever happens to hit it first.

// For content that changes often relative to how often it's viewed (pattern
// search results, the homepage's random-pattern doodle) - short CDN cache.
export const dynamicCacheHeaders = () => ({
  'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
});

// For content that only changes when an admin edits it (wiki pages, FAQ,
// individual pattern/set pages, static help pages) - longer CDN cache.
export const staticCacheHeaders = () => ({
  'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
});
