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

// Fallback for SVGs that have no width/height attributes (or have them in a
// unit we don't parse, e.g. "px"/unitless). Derives inches directly from the
// viewBox's width/height (assumed to be in CSS pixels) at a given DPI - the
// same approach as the reference Python script, just gated behind
// extractSvgDimensions() returning nothing usable first.
export function extractSvgDimensionsFromViewBox(svgText: string, dpi = 300): SvgDimensions | null {
  if (!dpi || dpi <= 0) return null;

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;

  const vbAttr = root.getAttribute('viewBox');
  if (!vbAttr) return null;

  const vb = vbAttr
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb.length !== 4 || vb.some((n) => isNaN(n))) return null;

  const [, , vbWidth, vbHeight] = vb;
  if (vbWidth <= 0 || vbHeight <= 0) return null;

  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  return {
    width: round3(vbWidth / dpi),
    widthUnit: 'in',
    height: round3(vbHeight / dpi),
    heightUnit: 'in',
  };
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
//   4. Recursive / self-referencing `<use>` chains AND acyclic fan-out ("A Billion
//      Laughs": each level references many copies of a distinct lower group, so node
//      count explodes without any id repeating) → tab freeze / DoS. Both are detected
//      below by computing the theoretical expanded node count (memoized DFS over the
//      reference graph). The upload-time getBBox() measurement additionally renders in
//      an isolated, CSP-locked, script-disabled iframe (see computeBBox) so nothing can
//      fetch or execute there.
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

  // <use> expansion cost — catches BOTH cyclic references and the classic
  // "Billion Laughs" attack (acyclic, fan-out: each level references many copies
  // of a distinct lower-level group, so node count grows exponentially without
  // any id ever repeating). We compute the THEORETICAL expanded node count via a
  // memoized DFS over the reference graph: only the resulting number grows — each
  // element is costed once, so the analysis itself stays cheap and never expands
  // the nodes for real.
  const MAX_EXPANDED_NODES = 100_000;
  const costMemo = new Map<Element, number>();
  const inStack = new Set<Element>();
  let cyclicUse = false;
  let overflowUse = false;

  const expandedCost = (el: Element): number => {
    if (inStack.has(el)) {
      cyclicUse = true;
      return 0; // break the cycle; flagged separately
    }
    const cached = costMemo.get(el);
    if (cached !== undefined) return cached;

    inStack.add(el);
    let total = 1; // the element itself

    if (el.tagName.toLowerCase() === 'use') {
      const href = (el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim();
      if (href.startsWith('#')) {
        const target = byId.get(href.slice(1));
        if (target) total += expandedCost(target);
      }
    }

    for (const child of Array.from(el.children)) {
      total += expandedCost(child);
      if (total > MAX_EXPANDED_NODES) break;
    }

    if (total > MAX_EXPANDED_NODES) {
      overflowUse = true;
      total = MAX_EXPANDED_NODES + 1; // clamp so the number can't run away
    }

    inStack.delete(el);
    costMemo.set(el, total);
    return total;
  };

  // Costing the root walks every definition and every rendered <use>, so a
  // malicious structure trips the threshold regardless of where it sits.
  try {
    expandedCost(doc.documentElement);
  } catch {
    // Pathologically deep nesting could overflow the call stack — treat as a threat.
    overflowUse = true;
  }

  if (cyclicUse) {
    add({
      id: 'use-cycle',
      severity: 'high',
      title: 'Recursive <use> cycle',
      detail:
        'A <use> element references itself through a chain of other elements. This loops infinitely and can hang or crash the renderer.',
    });
  }
  if (overflowUse) {
    add({
      id: 'use-expansion',
      severity: 'high',
      title: 'Excessive <use> expansion',
      detail: `Nested <use> references expand to more than ${MAX_EXPANDED_NODES.toLocaleString()} elements (a "billion laughs" pattern). Rendering this can freeze or crash the browser.`,
    });
  }

  return threats;
}

// Removes descriptive metadata elements (and all their content) so a re-uploaded
// export doesn't accumulate stale metadata. DOMPurify's SVG profile keeps
// <title>/<desc>/<metadata> but strips the RDF children inside <metadata>, leaving
// flattened text behind. We drop these entirely on upload; the exporter re-adds a
// fresh <metadata>/<title>/<desc> from the pattern's data on download.
const stripDescriptiveMetadata = (svg: string): string => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  doc.querySelectorAll('metadata, title, desc').forEach((el) => el.remove());
  return new XMLSerializer().serializeToString(doc);
};

export const sanitizeSvgFile = async (file: File): Promise<File> => {
  const raw = await file.text();

  const clean = sanitizeSvg(raw);

  if (!clean || clean.trim().length === 0) {
    throw new Error('SVG failed sanitization - file may be malformed or malicious');
  }

  const stripped = stripDescriptiveMetadata(clean);

  const fixed = await normalizeSvgDimensions(stripped);

  const blob = new Blob([fixed], { type: 'image/svg+xml' });
  return new File([blob], file.name, { type: 'image/svg+xml' });
};

// Measures the rendered bounding box of an SVG WITHOUT live-mounting it in the
// admin's own document. getBBox() requires the element to be laid out in a real
// DOM (it can't be read from an <img>), so we render into an isolated iframe:
//   • sandbox WITHOUT allow-scripts → no JavaScript executes inside the frame
//   • allow-same-origin → the parent can reach contentDocument to call getBBox()
//     (safe to combine here precisely because allow-scripts is omitted)
//   • CSP `default-src 'none'` → blocks every remote fetch the SVG might attempt
//     (external <use>/<image>, clip-path url(http), CSS @import/url) so a crafted
//     file can't beacon out from the admin's browser during measurement.
// A timeout guards against a frame that never settles; the recursive-<use>
// expansion risk is still caught earlier by analyzeSvgThreats at upload time.
const computeBBox = (svgString: string): Promise<DOMRect | null> =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-same-origin');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1200px;height:1200px;opacity:0;border:0;pointer-events:none;';

    const csp =
      `<meta http-equiv="Content-Security-Policy" ` +
      `content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:">`;
    iframe.srcdoc = `<!DOCTYPE html><html><head>${csp}</head><body style="margin:0">${svgString}</body></html>`;

    let settled = false;
    const finish = (rect: DOMRect | null) => {
      if (settled) return;
      settled = true;
      iframe.remove();
      resolve(rect);
    };

    iframe.onload = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const svgEl = iframe.contentDocument?.querySelector('svg') as SVGSVGElement | null;
            const b = svgEl?.getBBox();
            // Copy into a detached DOMRect before the iframe is torn down.
            finish(b ? new DOMRect(b.x, b.y, b.width, b.height) : null);
          } catch {
            finish(null);
          }
        });
      });
    };

    // Safety net: never leave a measurement hanging (e.g. a frame that fails to load).
    setTimeout(() => finish(null), 3000);

    document.body.appendChild(iframe);
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

  // Skip if no change (within 0.5 unit tolerance)
  const changed =
    Math.abs(newX - vx) > 0.5 || Math.abs(newY - vy) > 0.5 || Math.abs(newW - vw) > 0.5 || Math.abs(newH - vh) > 0.5;

  if (changed) {
    root.setAttribute('viewBox', `${newX} ${newY} ${newW} ${newH}`);
  }

  return new XMLSerializer().serializeToString(doc);
};
