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

  //const fixed = await normalizeSvgDimensions(clean);

  const blob = new Blob([clean], { type: 'image/svg+xml' });
  return new File([blob], file.name, { type: 'image/svg+xml' });
};

/*const normalizeSvgDimensions = (svg: string): string => {
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
};*/

const computeBBox = (svgString: string): Promise<DOMRect | null> =>
  new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:hidden';
    container.innerHTML = svgString;
    document.body.appendChild(container);
    const svgEl = container.querySelector('svg') as SVGSVGElement | null;
    requestAnimationFrame(() => {
      try {
        resolve(svgEl?.getBBox() ?? null);
      } catch {
        resolve(null);
      } finally {
        container.remove();
      }
    });
  });

const normalizeSvgDimensions = async (svg: string): Promise<string> => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  root.removeAttribute('width');
  root.removeAttribute('height');

  const bbox = await computeBBox(svg);
  if (bbox) {
    const stroke = 12; // max stroke width buffer
    const x = bbox.x - stroke;
    const y = bbox.y - stroke;
    const w = bbox.width + stroke * 2;
    const h = bbox.height + stroke * 2;
    root.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return new XMLSerializer().serializeToString(doc);
};
