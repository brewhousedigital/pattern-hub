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

  const fixed = normalizeSvgDimensions(clean);

  const blob = new Blob([fixed], { type: 'image/svg+xml' });
  return new File([blob], file.name, { type: 'image/svg+xml' });
};

const normalizeSvgDimensions = (svg: string): string => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;

  root.removeAttribute('width');
  root.removeAttribute('height');

  // Pad viewBox to cover stroke + overflow
  const vb = root
    .getAttribute('viewBox')
    ?.split(/[\s,]+/)
    .map(Number);
  if (vb?.length === 4) {
    const [x, y, w, h] = vb;
    const pad = 24; // covers stroke + minor overflow
    root.setAttribute('viewBox', `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`);
  }

  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return new XMLSerializer().serializeToString(doc);
};
