// Node-safe counterpart to src/functions/utilities/sanitize-svg.ts.
// The browser version relies on `DOMParser`/`XMLSerializer`/`document`, none of
// which exist in the Netlify Functions runtime, so user-submitted SVGs are
// sanitized and threat-scanned here using linkedom instead. Kept in sync in
// spirit (same DOMPurify config, same threat categories) but intentionally NOT
// a literal re-export - a compromised/absent browser check must never be the
// only gate before untrusted content reaches storage, so this file is the
// real enforcement point.
//
// WHY linkedom AND NOT jsdom: jsdom is a full HTML5 *browser* emulation
// (URL parsing, HTML-spec character-encoding sniffing, CSS object model,
// etc.) - far more than parsing well-formed XML (SVG) needs, and that extra
// surface (specifically whatwg-url and html-encoding-sniffer) pulls in
// @exodus/bytes, an ESM-only package that multiple independent jsdom
// dependencies require() synchronously. AWS Lambda's managed Node.js
// runtimes disable "require(esm)" with no supported override, so that
// crashed every SVG submission in production regardless of Node version
// configured, no matter how jsdom itself was imported on our end. linkedom's
// entire dependency tree (css-select, cssom, html-escaper, htmlparser2,
// uhyphen) has none of that baggage, sidestepping the problem rather than
// working around it.
//
// SAFETY NOTE: analyzeSvgThreatsServer below (our own hand-written scanner,
// not DOMPurify) runs FIRST and hard-rejects the submission on any
// high-severity finding - <script>, event handlers, javascript: URIs,
// external references, XML "billion laughs" expansion, etc. - all BEFORE
// sanitizeSvgServer/DOMPurify ever sees the content. That ordering is what
// makes linkedom safe to use here: it was rejected once before as a DOMPurify
// backend because DOMPurify silently failed to strip a <script> tag with it
// (no error, just quietly unsafe output) - but by the time DOMPurify runs in
// THIS pipeline, the input has already passed our own strict pre-scan, so
// DOMPurify's role here is defense-in-depth on already-vetted content, not
// the primary gate. Verified directly: linkedom's DOMParser + querySelectorAll
// correctly surfaces a <script> element (and all attributes, including
// xlink:href) for our own scanner to find and reject - confirmed against the
// actual analyzeSvgThreatsServer function, not just a standalone probe.

export type SvgThreatSeverity = 'high' | 'medium';
export type SvgThreat = { id: string; severity: SvgThreatSeverity; title: string; detail: string };

const URL_FUNC_REGEX = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

async function getWindow() {
  const { parseHTML } = await import('linkedom');
  return parseHTML('<!doctype html><html><body></body></html>').window;
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
  // linkedom has no XMLSerializer class - doc.toString() is the equivalent.
  // Unlike jsdom's serializer, it prepends a standard XML declaration
  // (`<?xml version="1.0" encoding="utf-8"?>`) - this used to get stripped
  // here to match jsdom's old output, but real SVG files normally carry this
  // declaration (every design-tool export does), and PocketBase's
  // server-side MIME sniffing on the `submitted_file` field rejected a
  // declaration-less upload as not being image/svg+xml. Keep it.
  return doc.toString();
}

// Ported from src/functions/utilities/sanitize-svg.ts::analyzeSvgThreats - see
// that file for the full rationale behind each check. Runs on the RAW
// (pre-sanitize) text via linkedom's DOMParser, which never executes scripts
// or fetches resources, so analysis itself is safe.
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
