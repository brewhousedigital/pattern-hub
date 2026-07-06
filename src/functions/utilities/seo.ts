export const seoTitle = (title?: string) => {
  if (!title) {
    return [{ title: `Pattern Archive` }, { 'og:title': `Pattern Archive` }];
  }

  return [{ title: `${title} - Pattern Archive` }, { 'og:title': `${title} - Pattern Archive` }];
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

export const generateSEO = (title?: string, description?: string, url?: string) => {
  return {
    meta: [
      ...seoTitle(title),
      ...seoDescription(description),
      ...seoUrl(url),
      { property: 'og:image', content: `https://patternarchive.net/poster.png` },
      { property: 'og:site_name', content: `Pattern Archive` },
      { name: 'twitter:card', content: `summary_large_image` },
      { name: 'twitter:image', content: `https://patternarchive.net/poster.png` },
    ],
    links: seoCanonical(url),
  };
};
