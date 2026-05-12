import DOMPurify from 'dompurify';

export const sanitizeSvg = (code: string) => {
  return DOMPurify.sanitize(code, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Explicitly allow the 'use' tag
    ADD_TAGS: ['use'],
    // Explicitly allow the 'xlink:href' attribute
    ADD_ATTR: ['xlink:href', 'clip-path'],
  });
};

export const sanitizeSvgFile = async (file: File): Promise<File> => {
  const raw = await file.text();

  const clean = sanitizeSvg(raw);

  if (!clean || clean.trim().length === 0) {
    throw new Error('SVG failed sanitization — file may be malformed or malicious');
  }

  const blob = new Blob([clean], { type: 'image/svg+xml' });
  return new File([blob], file.name, { type: 'image/svg+xml' });
};
