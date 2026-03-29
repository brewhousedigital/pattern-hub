export const seoTitle = (title?: string) => {
  if (!title) {
    return [{ title: `Pattern Archive` }, { 'og:title': `Pattern Archive` }];
  }

  return [{ title: `${title} - Pattern Archive` }, { 'og:title': `${title} - Pattern Archive` }];
};

export const seoDescription = (description?: string) => {
  if (!description) {
    return [{ property: 'og:description', content: `Find a pattern for your stained glass project.` }];
  }

  return [{ property: 'og:description', content: `${description} Find a pattern for your stained glass project.` }];
};

export const seoUrl = (url?: string) => {
  const baseURL = `https://patternarchive.net`;

  if (!url) {
    return [{ property: 'og:url', content: baseURL }];
  }

  return [{ property: 'og:url', content: `${baseURL}${url}` }];
};

export const generateSEO = (title?: string, description?: string, url?: string) => {
  return [...seoTitle(title), ...seoDescription(description), ...seoUrl(url)];
};
