// After `vite build`, @netlify/vite-plugin-tanstack-start emits the SSR
// function at .netlify/v1/functions/server.mjs with:
//
//   export const config = { ..., path: "/*", preferStatic: true };
//
// `path: "/*"` makes this ONE function a Netlify Functions v2 path match for
// every request. `preferStatic: true` only steps aside when a static file of
// the exact same name exists in the publish dir - it does NOT step aside for
// a different function that also declares a more specific `path` (e.g.
// serve-sitemap.ts's `/sitemap.xml`). In production this meant /sitemap.xml,
// /sitemap-*.xml, etc. were served by the SSR app's 404 page instead of the
// sitemap function - Google Search Console couldn't fetch the sitemap.
//
// Netlify Functions support `excludedPath` specifically to carve exceptions
// out of a function's own `path` pattern (https://docs.netlify.com/build/functions/configuration/).
// The vite plugin doesn't expose an option to set it on the generated
// function, so this script patches the emitted file directly as a build step
// (see package.json's "build" script). Keep SITEMAP_PATHS in sync with
// SITEMAP_FILES in netlify/functions/serve-sitemap.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap-static.xml',
  '/sitemap-patterns.xml',
  '/sitemap-wiki.xml',
  '/sitemap-sets.xml',
  '/sitemap-authors.xml',
];

const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
const ssrFunctionPath = path.join(projectRoot, '.netlify/v1/functions/server.mjs');

const original = readFileSync(ssrFunctionPath, 'utf8');

if (original.includes('excludedPath')) {
  // Already patched (e.g. this script ran once already this build) - no-op.
  process.exit(0);
}

const target = 'preferStatic: true,';
if (!original.includes(target)) {
  console.error(
    `[patch-netlify-ssr-excluded-paths] Expected to find ${JSON.stringify(target)} in ` +
      `${ssrFunctionPath}, but it wasn't there. @netlify/vite-plugin's generated template ` +
      `may have changed - update this script (and re-verify /sitemap.xml routing) before deploying.`,
  );
  process.exit(1);
}

const excludedPathLiteral = `excludedPath: ${JSON.stringify(SITEMAP_PATHS)},`;
const patched = original.replace(target, `${target}\n${excludedPathLiteral}`);

writeFileSync(ssrFunctionPath, patched);
console.log(
  `[patch-netlify-ssr-excluded-paths] Excluded ${SITEMAP_PATHS.length} sitemap path(s) from the SSR function's wildcard route.`,
);
