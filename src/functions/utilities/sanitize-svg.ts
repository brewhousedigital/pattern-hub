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
  return Array.from(doc.querySelectorAll('g[id]'))
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

// ─── Threat analysis (admin upload warning) ──────────────────────────────────────
//
// WHY: DOMPurify strips <script>, event handlers, and JavaScript: URIs, so stored
// XSS is not the primary concern. The residual risk comes from the tags we had to
// ALLOW for Affinity's fill sections — `<use>` and `clip-path` — combined with the
// fact that layered patterns are rendered INLINE (dangerouslySetInnerHTML in
// PatternViewContent), not via <img>. Inline SVG, unlike <img>-loaded SVG, does
// NOT run in the browser's "secure static mode": it will load external sub-resources.
//
// Residual attack vectors with the current allow-list:
//   1. External `<use href="https://…">` / `xlink:href` → on inline render the browser
//      fetches the remote document: visitor IP/referrer leak, tracking beacon, or
//      pulling in attacker-controlled markup.
//   2. External `clip-path`/`mask`/`filter`/`fill` `url(https://…)` → same remote fetch.
//   3. `<image href="https://…">` → displays arbitrary remote content inside the pattern.
//   4. Recursive / self-referencing `<use>` chains → exponential node expansion
//      ("A Billion Laughs") → tab freeze / DoS, including in the admin's own browser
//      during the upload-time getBBox() measurement (which injects via innerHTML).
//   5. `javascript:` URIs / `on*` handlers / `<script>` / `<foreignObject>` → neutralized
//      by DOMPurify, but their presence means the file was crafted, not exported by a tool.
//
// `analyzeSvgThreats` runs on the RAW (pre-sanitize) text so it can surface BOTH the
// allow-listed-but-sneaky cases and the would-be-stripped cases, giving the admin full
// visibility before they choose to proceed. Detection is parse-only (DOMParser as XML
// never executes scripts or loads resources), so analysis itself is safe.

export type SvgThreatSeverity = 'high' | 'medium';

export type SvgThreat = {
  /** Stable key, also used to de-duplicate repeated findings of the same kind. */
  id: string;
  severity: SvgThreatSeverity;
  title: string;
  detail: string;
};

const URL_FUNC_REGEX = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

export function analyzeSvgThreats(svgText: string): SvgThreat[] {
  const threats: SvgThreat[] = [];
  const add = (t: SvgThreat) => {
    if (!threats.some((x) => x.id === t.id)) threats.push(t);
  };

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');

  if (doc.querySelector('parsererror')) {
    add({
      id: 'parse-error',
      severity: 'medium',
      title: 'Malformed SVG',
      detail: 'The file could not be parsed as clean XML. It may be corrupt or crafted to confuse parsers.',
    });
  }

  const all = Array.from(doc.querySelectorAll('*'));

  // id → element map, used for <use> cycle detection.
  const byId = new Map<string, Element>();
  all.forEach((el) => {
    const id = el.getAttribute('id');
    if (id) byId.set(id, el);
  });

  for (const el of all) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'script') {
      add({
        id: 'script',
        severity: 'high',
        title: 'Embedded <script>',
        detail: `Contains a <script> element. Sanitization removes it, but a legitimate pattern export never includes one.`,
      });
    }
    if (tag === 'foreignobject') {
      add({
        id: 'foreignobject',
        severity: 'high',
        title: 'Embedded <foreignObject>',
        detail: 'Can embed arbitrary HTML inside the SVG. Not produced by pattern design tools.',
      });
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = (attr.value || '').trim();
      if (!value) continue;

      if (name.startsWith('on')) {
        add({
          id: 'event-handler',
          severity: 'high',
          title: 'Inline event handler',
          detail: `Found an "${name}" handler that runs JavaScript. Sanitization strips it, but it means the file was hand-crafted.`,
        });
      }

      if (/javascript:/i.test(value)) {
        add({
          id: 'js-uri',
          severity: 'high',
          title: 'javascript: URI',
          detail: `Attribute "${name}" contains a javascript: URI.`,
        });
      }

      if (name === 'href' || name === 'xlink:href' || name === 'src') {
        if (value.startsWith('#') || /^data:image\//i.test(value)) {
          // Local fragment ("#id") or embedded raster — both benign.
        } else if (/^(https?:)?\/\//i.test(value)) {
          add(
            tag === 'use'
              ? {
                  id: 'use-external',
                  severity: 'high',
                  title: 'External <use> reference',
                  detail: `A <use> element points to "${value}" instead of a local "#id". Legitimate fills only reference shapes inside the same file — this fetches a remote resource when the pattern is rendered inline.`,
                }
              : {
                  id: 'external-resource',
                  severity: 'high',
                  title: 'External resource reference',
                  detail: `<${tag}> references "${value}". Rendered inline, this triggers a network request to a remote server (IP/referrer leak or remote content injection).`,
                },
          );
        } else if (/^data:/i.test(value)) {
          add({
            id: 'data-uri',
            severity: 'high',
            title: 'Non-image data: URI',
            detail: `<${tag}> embeds a data: URI that is not an image (e.g. data:text/html). This can smuggle arbitrary content.`,
          });
        } else {
          add({
            id: 'external-file-ref',
            severity: 'medium',
            title: 'External file reference',
            detail: `<${tag}> references "${value}", a path outside this file rather than a local "#id".`,
          });
        }
      }

      // Presentation attributes that can carry url(): clip-path, mask, filter, fill, etc.
      if (name !== 'href' && name !== 'xlink:href' && /\burl\(/i.test(value)) {
        for (const m of value.matchAll(URL_FUNC_REGEX)) {
          const ref = m[1].trim();
          if (ref && !ref.startsWith('#')) {
            add({
              id: 'external-url-func',
              severity: 'high',
              title: `External url() in "${name}"`,
              detail: `"${name}" references url(${ref}). External url() references load remote resources when the pattern is rendered inline.`,
            });
          }
        }
      }
    }

    if (tag === 'style') {
      const css = el.textContent || '';
      if (/@import/i.test(css)) {
        add({
          id: 'css-import',
          severity: 'high',
          title: 'CSS @import',
          detail: 'A <style> block uses @import, which loads a remote stylesheet.',
        });
      }
      for (const m of css.matchAll(URL_FUNC_REGEX)) {
        const ref = m[1].trim();
        if (ref && !ref.startsWith('#') && !/^data:image\//i.test(ref)) {
          add({
            id: 'css-external-url',
            severity: 'medium',
            title: 'External url() in CSS',
            detail: 'A <style> block references an external url(), which loads a remote resource when rendered inline.',
          });
          break;
        }
      }
    }
  }

  // Recursive <use> chains → exponential expansion (DoS).
  const uses = all.filter((el) => el.tagName.toLowerCase() === 'use');
  for (const u of uses) {
    const start = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').trim();
    if (!start.startsWith('#')) continue;
    const seen = new Set<string>();
    let cursor: Element | undefined = byId.get(start.slice(1));
    let depth = 0;
    let cyclic = false;
    while (cursor && depth < 200) {
      const inner = cursor.tagName.toLowerCase() === 'use' ? cursor : cursor.querySelector('use');
      const innerHref = (inner?.getAttribute('href') || inner?.getAttribute('xlink:href') || '').trim();
      if (!innerHref.startsWith('#')) break;
      const targetId = innerHref.slice(1);
      if (seen.has(targetId)) {
        cyclic = true;
        break;
      }
      seen.add(targetId);
      cursor = byId.get(targetId);
      depth++;
    }
    if (cyclic) {
      add({
        id: 'use-recursion',
        severity: 'high',
        title: 'Recursive <use> chain',
        detail:
          'A <use> element references itself through a chain of other elements. This can cause exponential expansion (denial of service) when the pattern is rendered.',
      });
      break;
    }
  }

  return threats;
}

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
