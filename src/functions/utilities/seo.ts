export const seoTitle = (title?: string) => {
  const fullTitle = title ? `${title} - Pattern Archive` : `Pattern Archive`;

  // NOTE: og meta entries must be { property, content } objects - a plain
  // { 'og:title': value } renders as the literal attribute <meta og:title="...">,
  // which social crawlers (Discord etc.) can't read.
  return [{ title: fullTitle }, { property: 'og:title', content: fullTitle }];
};

export const seoDescription = (description?: string) => {
  const content = description
    ? `${description} Find a pattern for your stained glass project.`
    : `Find a pattern for your stained glass project.`;

  return [
    { name: 'description', content },
    { property: 'og:description', content },
  ];
};

export const seoUrl = (url?: string) => {
  const baseURL = `https://patternarchive.net`;

  if (!url) {
    return [{ property: 'og:url', content: baseURL }];
  }

  return [{ property: 'og:url', content: `${baseURL}${url}` }];
};

export const seoCanonical = (url?: string) => {
  const baseURL = `https://patternarchive.net`;

  return [{ rel: 'canonical', href: `${baseURL}${url ?? ''}` }];
};

/**
 * @param image Absolute URL for the og/twitter share image. Falls back to the
 *              generic site poster. (Per-pattern share images, author avatars,
 *              and the /api/og-image cards were previously injected by the
 *              og-meta edge function - with SSR they belong here.)
 */
export const generateSEO = (title?: string, description?: string, url?: string, image?: string) => {
  const imageUrl = image || `https://patternarchive.net/poster.png`;

  return {
    meta: [
      ...seoTitle(title),
      ...seoDescription(description),
      ...seoUrl(url),
      { property: 'og:image', content: imageUrl },
      { property: 'og:site_name', content: `Pattern Archive` },
      { name: 'twitter:card', content: `summary_large_image` },
      { name: 'twitter:image', content: imageUrl },
    ],
    links: seoCanonical(url),
  };
};
