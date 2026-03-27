import DOMPurify from 'dompurify';

export const sanitizeSvg = (code: string) => {
  return DOMPurify.sanitize(code, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
};

export const sanitizeSvgFile = async (file: File): Promise<File> => {
  const raw = await file.text();

  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  if (!clean || clean.trim().length === 0) {
    throw new Error('SVG failed sanitization — file may be malformed or malicious');
  }

  const blob = new Blob([clean], { type: 'image/svg+xml' });
  return new File([blob], file.name, { type: 'image/svg+xml' });
};
