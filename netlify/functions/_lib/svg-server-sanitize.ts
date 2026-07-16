// Node-safe counterpart to src/functions/utilities/sanitize-svg.ts.
// The browser version relies on `DOMParser`/`XMLSerializer`/`document`, none of
// which exist in the Netlify Functions runtime, so user-submitted SVGs are
// sanitized and threat-scanned here using jsdom instead. Kept in sync in spirit
// (same DOMPurify config, same threat categories) but intentionally NOT a
// literal re-export - a compromised/absent browser check must never be the only
// gate before untrusted content reaches storage, so this file is the real
// enforcement point.
//
// jsdom (via html-encoding-sniffer) now pulls in an ESM-only dependency deep
// in its tree. Netlify's function bundler produces a CommonJS bundle, and a
// static top-level `import` of jsdom compiles to a top-level `require()` that
// throws ERR_REQUIRE_ESM at module load - crashing every submission, not just
// SVG ones (this is the same class of bug as the earlier pdf-to-img/DOMMatrix
// crash). `import()` CAN load ESM from a CJS module at runtime, so jsdom and
// dompurify are loaded dynamically here instead, deferred until an SVG is
// actually being processed.

export type SvgThreatSeverity = 'high' | 'medium';
export type SvgThreat = { id: string; severity: SvgThreatSeverity; title: string; detail: string };

const URL_FUNC_REGEX = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

async function getWindow() {
  const { JSDOM } = await import('jsdom');
  return new JSDOM('').window;
}

export async function sanitizeSvgServer(raw: string): Promise<string> {
  const window = await getWindow();
  const { default: createDOMPurify } = await import('dompurify');
  const DOMPurify = createDOMPurify(window as any);
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
    ADD_ATTR: ['xlink:href', 'clip-path'],
  });
  if (!clean || clean.trim().length === 0) {
    throw new Error('SVG failed sanitization - file may be malformed or malicious');
  }

  // Strip descriptive metadata the same way the admin pipeline does.
  const doc = new window.DOMParser().parseFromString(clean, 'image/svg+xml');
  doc.querySelectorAll('metadata, title, desc').forEach((el: Element) => el.remove());
  return new window.XMLSerializer().serializeToString(doc);
}

// Ported from src/functions/utilities/sanitize-svg.ts::analyzeSvgThreats - see
// that file for the full rationale behind each check. Runs on the RAW
// (pre-sanitize) text via jsdom's DOMParser, which never executes scripts or
// fetches resources, so analysis itself is safe.
export async function analyzeSvgThreatsServer(svgText: string): Promise<SvgThreat[]> {
  const window = await getWindow();
  const threats: SvgThreat[] = [];
  const add = (t: SvgThreat) => {
    if (!threats.some((x) => x.id === t.id)) threats.push(t);
  };

  const doc = new window.DOMParser().parseFromString(svgText, 'image/svg+xml');

  if (doc.querySelector('parsererror')) {
    add({
      id: 'parse-error',
      severity: 'medium',
      title: 'Malformed SVG',
      detail: 'The file could not be parsed as clean XML.',
    });
  }

  const all = Array.from(doc.querySelectorAll('*')) as Element[];
  const byId = new Map<string, Element>();
  all.forEach((el) => {
    const id = el.getAttribute('id');
    if (id) byId.set(id, el);
  });

  for (const el of all) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'script') {
      add({ id: 'script', severity: 'high', title: 'Embedded <script>', detail: 'Contains a <script> element.' });
    }
    if (tag === 'foreignobject') {
      add({
        id: 'foreignobject',
        severity: 'high',
        title: 'Embedded <foreignObject>',
        detail: 'Can embed arbitrary HTML inside the SVG.',
      });
    }

    for (const attr of Array.from(el.attributes) as Attr[]) {
      const name = attr.name.toLowerCase();
      const value = (attr.value || '').trim();
      if (!value) continue;

      if (name.startsWith('on')) {
        add({
          id: 'event-handler',
          severity: 'high',
          title: 'Inline event handler',
          detail: `Found an "${name}" handler that runs JavaScript.`,
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
          // benign local fragment / embedded raster
        } else if (/^(https?:)?\/\//i.test(value)) {
          add(
            tag === 'use'
              ? {
                  id: 'use-external',
                  severity: 'high',
                  title: 'External <use> reference',
                  detail: `A <use> element points to "${value}" instead of a local "#id".`,
                }
              : {
                  id: 'external-resource',
                  severity: 'high',
                  title: 'External resource reference',
                  detail: `<${tag}> references "${value}".`,
                },
          );
        } else if (/^data:/i.test(value)) {
          add({
            id: 'data-uri',
            severity: 'high',
            title: 'Non-image data: URI',
            detail: `<${tag}> embeds a data: URI that is not an image.`,
          });
        } else {
          add({
            id: 'external-file-ref',
            severity: 'medium',
            title: 'External file reference',
            detail: `<${tag}> references "${value}", a path outside this file.`,
          });
        }
      }
      if (name !== 'href' && name !== 'xlink:href' && /\burl\(/i.test(value)) {
        for (const m of value.matchAll(URL_FUNC_REGEX)) {
          const ref = m[1].trim();
          if (ref && !ref.startsWith('#')) {
            add({
              id: 'external-url-func',
              severity: 'high',
              title: `External url() in "${name}"`,
              detail: `"${name}" references url(${ref}).`,
            });
          }
        }
      }
    }

    if (tag === 'style') {
      const css = el.textContent || '';
      if (/@import/i.test(css)) {
        add({ id: 'css-import', severity: 'high', title: 'CSS @import', detail: 'A <style> block uses @import.' });
      }
      for (const m of css.matchAll(URL_FUNC_REGEX)) {
        const ref = m[1].trim();
        if (ref && !ref.startsWith('#') && !/^data:image\//i.test(ref)) {
          add({
            id: 'css-external-url',
            severity: 'medium',
            title: 'External url() in CSS',
            detail: 'A <style> block references an external url().',
          });
          break;
        }
      }
    }
  }

  // <use> expansion cost (cyclic + "billion laughs" fan-out) - see the client
  // version's comment block for the full explanation of this check.
  const MAX_EXPANDED_NODES = 100_000;
  const costMemo = new Map<Element, number>();
  const inStack = new Set<Element>();
  let cyclicUse = false;
  let overflowUse = false;

  const expandedCost = (el: Element): number => {
    if (inStack.has(el)) {
      cyclicUse = true;
      return 0;
    }
    const cached = costMemo.get(el);
    if (cached !== undefined) return cached;

    inStack.add(el);
    let total = 1;

    if (el.tagName.toLowerCase() === 'use') {
      const href = (el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim();
      if (href.startsWith('#')) {
        const target = byId.get(href.slice(1));
        if (target) total += expandedCost(target);
      }
    }

    for (const child of Array.from(el.children) as Element[]) {
      total += expandedCost(child);
      if (total > MAX_EXPANDED_NODES) break;
    }

    if (total > MAX_EXPANDED_NODES) {
      overflowUse = true;
      total = MAX_EXPANDED_NODES + 1;
    }

    inStack.delete(el);
    costMemo.set(el, total);
    return total;
  };

  try {
    expandedCost(doc.documentElement);
  } catch {
    overflowUse = true;
  }

  if (cyclicUse) {
    add({
      id: 'use-cycle',
      severity: 'high',
      title: 'Recursive <use> cycle',
      detail: 'A <use> element references itself through a chain of other elements.',
    });
  }
  if (overflowUse) {
    add({
      id: 'use-expansion',
      severity: 'high',
      title: 'Excessive <use> expansion',
      detail: `Nested <use> references expand to more than ${MAX_EXPANDED_NODES.toLocaleString()} elements.`,
    });
  }

  return threats;
}
