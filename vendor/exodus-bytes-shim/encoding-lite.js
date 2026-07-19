"use strict";
// Local CJS-only replacement for the real `@exodus/bytes` package's
// `encoding-lite.js` entry point.
//
// WHY THIS EXISTS: the real `@exodus/bytes` has published `"type": "module"`
// (ESM-only) since its very first release. `html-encoding-sniffer` (a jsdom
// dependency) does a plain synchronous `require("@exodus/bytes/encoding-lite.js")`
// at its own top level. Node can only satisfy a synchronous require() of an
// ES module if it supports "require(esm)" - and AWS Lambda's managed Node.js
// runtimes (confirmed on Node 22.x AND 24.x, via NODE_OPTIONS flags too)
// deliberately disable that capability with no supported way to re-enable it
// for managed runtimes. That made every SVG submission crash with
// ERR_REQUIRE_ESM in production, regardless of Netlify's configured Node
// version, since the restriction lives in AWS Lambda's runtime build itself.
//
// FIX: package.json's `overrides` field redirects `@exodus/bytes` to this
// local, plain-CJS package ONLY when required by `html-encoding-sniffer`
// (see root package.json). html-encoding-sniffer only ever imports two named
// exports from `encoding-lite.js` - `getBOMEncoding` and `labelToName` - both
// vendored below verbatim from the real package's logic (see
// node_modules/@exodus/bytes/fallback/encoding.api.js and encoding.js at the
// time this was written), just expressed as CJS instead of ESM so no
// CJS<->ESM boundary crossing is ever needed. No other @exodus/bytes exports
// (TextDecoder/TextEncoder/etc.) are used by html-encoding-sniffer, so they
// are intentionally not replicated here - if that ever changes upstream,
// `npm ls @exodus/bytes` will surface a missing-export error immediately.

function getBOMEncoding(uint8Array) {
  if (uint8Array.length >= 3 && uint8Array[0] === 0xef && uint8Array[1] === 0xbb && uint8Array[2] === 0xbf) {
    return 'utf-8';
  }
  if (uint8Array.length < 2) return null;
  if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) return 'utf-16le';
  if (uint8Array[0] === 0xfe && uint8Array[1] === 0xff) return 'utf-16be';
  return null;
}

// https://encoding.spec.whatwg.org/#names-and-labels - alias -> canonical name.
// Faithful CJS port of @exodus/bytes/fallback/encoding.labels.js (including
// its programmatic alias construction, not just the literal object - the
// original builds several alias lists via loops after the initial literal).
const labels = {
  'utf-8': ['unicode-1-1-utf-8', 'unicode11utf8', 'unicode20utf8', 'utf8', 'x-unicode20utf8'],
  'utf-16be': ['unicodefffe'],
  'utf-16le': ['csunicode', 'iso-10646-ucs-2', 'ucs-2', 'unicode', 'unicodefeff', 'utf-16'],
  'iso-8859-2': ['iso-ir-101'],
  'iso-8859-3': ['iso-ir-109'],
  'iso-8859-4': ['iso-ir-110'],
  'iso-8859-5': ['csisolatincyrillic', 'cyrillic', 'iso-ir-144'],
  'iso-8859-6': ['arabic', 'asmo-708', 'csiso88596e', 'csiso88596i', 'csisolatinarabic', 'ecma-114', 'iso-8859-6-e', 'iso-8859-6-i', 'iso-ir-127'],
  'iso-8859-7': ['csisolatingreek', 'ecma-118', 'elot_928', 'greek', 'greek8', 'iso-ir-126', 'sun_eu_greek'],
  'iso-8859-8': ['csiso88598e', 'csisolatinhebrew', 'hebrew', 'iso-8859-8-e', 'iso-ir-138', 'visual'],
  'iso-8859-8-i': ['csiso88598i', 'logical'],
  'iso-8859-16': [],
  'koi8-r': ['cskoi8r', 'koi', 'koi8', 'koi8_r'],
  'koi8-u': ['koi8-ru'],
  'windows-874': ['dos-874', 'iso-8859-11', 'iso8859-11', 'iso885911', 'tis-620'],
  ibm866: ['866', 'cp866', 'csibm866'],
  'x-mac-cyrillic': ['x-mac-ukrainian'],
  macintosh: ['csmacintosh', 'mac', 'x-mac-roman'],
  gbk: ['chinese', 'csgb2312', 'csiso58gb231280', 'gb2312', 'gb_2312', 'gb_2312-80', 'iso-ir-58', 'x-gbk'],
  gb18030: [],
  big5: ['big5-hkscs', 'cn-big5', 'csbig5', 'x-x-big5'],
  'euc-jp': ['cseucpkdfmtjapanese', 'x-euc-jp'],
  shift_jis: ['csshiftjis', 'ms932', 'ms_kanji', 'shift-jis', 'sjis', 'windows-31j', 'x-sjis'],
  'euc-kr': ['cseuckr', 'csksc56011987', 'iso-ir-149', 'korean', 'ks_c_5601-1987', 'ks_c_5601-1989', 'ksc5601', 'ksc_5601', 'windows-949'],
  'iso-2022-jp': ['csiso2022jp'],
  replacement: ['csiso2022kr', 'hz-gb-2312', 'iso-2022-cn', 'iso-2022-cn-ext', 'iso-2022-kr'],
  'x-user-defined': [],
};

for (const i of [10, 13, 14, 15]) labels[`iso-8859-${i}`] = [`iso8859-${i}`, `iso8859${i}`];
for (const i of [2, 6, 7]) labels[`iso-8859-${i}`].push(`iso_8859-${i}:1987`);
for (const i of [3, 4, 5, 8]) labels[`iso-8859-${i}`].push(`iso_8859-${i}:1988`);
for (let i = 2; i < 9; i++) labels[`iso-8859-${i}`].push(`iso8859-${i}`, `iso8859${i}`, `iso_8859-${i}`);
for (let i = 2; i < 5; i++) labels[`iso-8859-${i}`].push(`csisolatin${i}`, `l${i}`, `latin${i}`);
for (let i = 0; i < 9; i++) labels[`windows-125${i}`] = [`cp125${i}`, `x-cp125${i}`];

labels['windows-1252'].push('ansi_x3.4-1968', 'ascii', 'cp819', 'csisolatin1', 'ibm819', 'iso-8859-1', 'iso-ir-100', 'iso8859-1', 'iso88591', 'iso_8859-1', 'iso_8859-1:1987', 'l1', 'latin1', 'us-ascii');
labels['windows-1254'].push('csisolatin5', 'iso-8859-9', 'iso-ir-148', 'iso8859-9', 'iso88599', 'iso_8859-9', 'iso_8859-9:1989', 'l5', 'latin5');
labels['iso-8859-10'].push('csisolatin6', 'iso-ir-157', 'l6', 'latin6');
labels['iso-8859-15'].push('csisolatin9', 'iso_8859-15', 'l9');

let labelsMap;

function normalizeEncoding(label) {
  if (label === 'utf-8' || label === 'utf8' || label === 'UTF-8' || label === 'UTF8') return 'utf-8';
  if (label === 'windows-1252' || label === 'ascii' || label === 'latin1') return 'windows-1252';
  if (/[^\w\t\n\f\r .:-]/i.test(label)) return null;
  const low = `${label}`.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(labels, low)) return low;
  if (!labelsMap) {
    labelsMap = new Map();
    for (const [name, aliases] of Object.entries(labels)) {
      for (const alias of aliases) labelsMap.set(alias, name);
    }
  }
  const mapped = labelsMap.get(low);
  if (mapped) return mapped;
  return null;
}

const uppercasePrefixes = new Set(['utf', 'iso', 'koi', 'euc', 'ibm', 'gbk']);

function labelToName(label) {
  const enc = normalizeEncoding(label);
  if (enc === 'utf-8') return 'UTF-8';
  if (!enc) return enc;
  if (uppercasePrefixes.has(enc.slice(0, 3))) return enc.toUpperCase();
  if (enc === 'big5') return 'Big5';
  if (enc === 'shift_jis') return 'Shift_JIS';
  return enc;
}

module.exports = { getBOMEncoding, labelToName };
