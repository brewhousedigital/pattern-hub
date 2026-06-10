/**
 * usePatternRasterizer
 *
 * Fetches the pattern SVG, scales it to RASTER_RES, and rasterises it into
 * three off-screen canvases:
 *
 *   hitCanvas        - white background + SVG.  Used for flood-fill boundary
 *                      detection (dark pixel = stroke = boundary).
 *
 *   svgOverlayCanvas - transparent background + SVG.  Drawn on top of fill
 *                      colors in the CanvasTexture so stroke lines always
 *                      appear above the glass color regions.
 *
 *   colorCanvas      - blank canvas that receives user flood-fills.
 *
 * The exterior mask (pixels reachable from the image edges) is pre-computed
 * once so click-to-fill silently ignores the outer background.
 */

import { useEffect, useState } from 'react';
import { generatePbImageSVG } from '@/functions/utilities/generate-pb-image';
import type { TypePatternResponse } from '@/functions/database/patterns.ts';
import { buildExteriorMask } from './floodFill';

const RASTER_RES = 1024;

export type RasterizerState = {
  hitData: Uint8ClampedArray | null;
  exteriorMask: Uint8Array | null;
  svgOverlayCanvas: HTMLCanvasElement | null;
  colorCanvas: HTMLCanvasElement | null;
  canvasW: number;
  canvasH: number;
  loading: boolean;
  error: string | null;
};

const INITIAL: RasterizerState = {
  hitData: null,
  exteriorMask: null,
  svgOverlayCanvas: null,
  colorCanvas: null,
  canvasW: 0,
  canvasH: 0,
  loading: true,
  error: null,
};

export function usePatternRasterizer(viewData: TypePatternResponse | undefined): RasterizerState {
  const [state, setState] = useState<RasterizerState>(INITIAL);

  useEffect(() => {
    if (!viewData?.pattern_file) {
      setState({ ...INITIAL, loading: false, error: 'No SVG file available for this pattern.' });
      return;
    }

    setState({ ...INITIAL, loading: true, error: null });

    let cancelled = false;
    let blobUrl = '';

    fetch(generatePbImageSVG(viewData))
      .then((res) => {
        if (!res.ok) throw new Error(`SVG fetch failed (${res.status})`);
        return res.text();
      })
      .then((svgText) => {
        if (cancelled) return;

        // ── Determine canvas dimensions from viewBox ──────────────────────
        let vbW = 100,
          vbH = 100;
        const vbMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
        if (vbMatch) {
          const p = vbMatch[1]
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          if (p.length === 4 && p.every((n) => !isNaN(n))) {
            vbW = p[2];
            vbH = p[3];
          }
        } else {
          const wm = svgText.match(/\bwidth\s*=\s*["']([0-9.]+)/);
          const hm = svgText.match(/\bheight\s*=\s*["']([0-9.]+)/);
          if (wm && hm) {
            vbW = parseFloat(wm[1]);
            vbH = parseFloat(hm[1]);
          }
        }

        const scale = RASTER_RES / Math.max(vbW, vbH);
        const canvasW = Math.max(1, Math.round(vbW * scale));
        const canvasH = Math.max(1, Math.round(vbH * scale));

        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        blobUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          if (cancelled) {
            URL.revokeObjectURL(blobUrl);
            blobUrl = '';
            return;
          }

          // ── Hit canvas: white bg for boundary detection ───────────────
          const hitCanvas = document.createElement('canvas');
          hitCanvas.width = canvasW;
          hitCanvas.height = canvasH;
          const hCtx = hitCanvas.getContext('2d')!;
          hCtx.fillStyle = '#ffffff';
          hCtx.fillRect(0, 0, canvasW, canvasH);
          hCtx.drawImage(img, 0, 0, canvasW, canvasH);
          const hitData = hCtx.getImageData(0, 0, canvasW, canvasH).data;
          const exteriorMask = buildExteriorMask(hitData, canvasW, canvasH);

          // ── SVG overlay canvas: transparent bg, strokes only ──────────
          const svgOverlayCanvas = document.createElement('canvas');
          svgOverlayCanvas.width = canvasW;
          svgOverlayCanvas.height = canvasH;
          svgOverlayCanvas.getContext('2d')!.drawImage(img, 0, 0, canvasW, canvasH);

          // ── Color canvas: blank, receives user fills ─────────────────
          const colorCanvas = document.createElement('canvas');
          colorCanvas.width = canvasW;
          colorCanvas.height = canvasH;

          URL.revokeObjectURL(blobUrl);
          blobUrl = '';
          setState({
            hitData,
            exteriorMask,
            svgOverlayCanvas,
            colorCanvas,
            canvasW,
            canvasH,
            loading: false,
            error: null,
          });
        };

        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          blobUrl = '';
          if (!cancelled) setState({ ...INITIAL, loading: false, error: 'Failed to rasterise SVG.' });
        };

        img.src = blobUrl;
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ ...INITIAL, loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      });

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = '';
      }
    };
  }, [viewData?.id, viewData?.pattern_file]);

  return state;
}
