import DOMPurify from 'dompurify';

type SvgDimensions = {
  width: number;
  widthUnit: 'in' | 'cm' | 'mm';
  height: number;
  heightUnit: 'in' | 'cm' | 'mm';
};

export function extractSvgDimensions(svgText: string): SvgDimensions | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;

  const widthAttr = root.getAttribute('width');
  const heightAttr = root.getAttribute('height');
  if (!widthAttr || !heightAttr) return null;

  const parse = (val: string): { value: number; unit: 'in' | 'cm' | 'mm' } | null => {
    const m = val.trim().match(/^([\d.]+)\s*(in|cm|mm)$/i);
    if (!m) return null;
    const value = parseFloat(m[1]);
    if (isNaN(value) || value <= 0) return null;
    return { value, unit: m[2].toLowerCase() as 'in' | 'cm' | 'mm' };
  };

  const w = parse(widthAttr);
  const h = parse(heightAttr);
  if (!w || !h) return null;

  return { width: w.value, widthUnit: w.unit, height: h.value, heightUnit: h.unit };
}

export function extractSvgLayerIds(svgText: string): string[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  return Array.from(doc.querySelectorAll('[id]'))
    .map((el) => el.getAttribute('id')!)
    .filter(Boolean);
}

export function applyHiddenLayers(svgText: string, hiddenLayers: Set<string>): string {
  if (hiddenLayers.size === 0) return svgText;
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  hiddenLayers.forEach((id) => {
    const el = doc.getElementById(id);
    if (el) el.setAttribute('style', 'display:none');
  });
  return new XMLSerializer().serializeToString(doc);
}

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
    throw new Error('SVG failed sanitization - file may be malformed or malicious');
  }

  const fixed = await normalizeSvgDimensions(clean);

  const blob = new Blob([fixed], { type: 'image/svg+xml' });
  return new File([blob], file.name, { type: 'image/svg+xml' });
};

const computeBBox = (svgString: string): Promise<DOMRect | null> =>
  new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:-9999px;width:auto;height:auto';
    container.innerHTML = svgString;
    document.body.appendChild(container);
    const svgEl = container.querySelector('svg') as SVGSVGElement | null;
    requestAnimationFrame(() => {
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
  });

const getMaxStrokeWidth = (root: Element): number => {
  let max = 0;
  root.querySelectorAll('*').forEach((el) => {
    const sw = el.getAttribute('stroke-width') ?? el.getAttribute('style')?.match(/stroke-width:\s*([\d.]+)/)?.[1];
    if (sw) max = Math.max(max, parseFloat(sw));
  });
  return max;
};

const normalizeSvgDimensions = async (svg: string): Promise<string> => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;

  root.removeAttribute('width');
  root.removeAttribute('height');
  if (!root.getAttribute('preserveAspectRatio')) {
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  const vbAttr = root
    .getAttribute('viewBox')
    ?.split(/[\s,]+/)
    .map(Number);
  const bbox = await computeBBox(svg);

  if (!bbox || vbAttr?.length !== 4) {
    return new XMLSerializer().serializeToString(doc);
  }

  const [vx, vy, vw, vh] = vbAttr;
  const stroke = getMaxStrokeWidth(root) / 2; // half extends each side

  // Real bounds including stroke
  const minX = bbox.x - stroke;
  const minY = bbox.y - stroke;
  const maxX = bbox.x + bbox.width + stroke;
  const maxY = bbox.y + bbox.height + stroke;

  // Only expand viewBox if content overflows. Never shrink.
  const newX = Math.min(vx, minX);
  const newY = Math.min(vy, minY);
  const newW = Math.max(vx + vw, maxX) - newX;
  const newH = Math.max(vy + vh, maxY) - newY;

  console.log('1 before:', vbAttr);
  console.log('1 bbox:', bbox);
  console.log('1 stroke:', stroke);
  console.log('1 after:', [newX, newY, newW, newH]);

  // Skip if no change (within 0.5 unit tolerance)
  const changed =
    Math.abs(newX - vx) > 0.5 || Math.abs(newY - vy) > 0.5 || Math.abs(newW - vw) > 0.5 || Math.abs(newH - vh) > 0.5;

  if (changed) {
    root.setAttribute('viewBox', `${newX} ${newY} ${newW} ${newH}`);
  }

  return new XMLSerializer().serializeToString(doc);
};
