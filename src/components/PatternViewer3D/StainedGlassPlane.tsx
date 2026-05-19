/**
 * StainedGlassPlane
 *
 * Renders a flat plane mesh in the Three.js scene whose surface is a
 * CanvasTexture built by compositing the color-fill canvas (bottom) and the
 * SVG overlay canvas (top).  The material is transparent so the environment
 * background shines through unfilled and semi-filled regions — creating the
 * backlit stained-glass effect without needing explicit light sources.
 *
 * Click flow
 * ──────────
 * onPointerDown → UV → canvas pixel → floodFill(colorCanvas) →
 *   redrawDisplay (composite) → texture.needsUpdate = true
 *
 * Imperative API (via forwardRef)
 * ─────────────────────────────────
 *   fillAll(color)  — fill every interior region in one pass
 *   clearAll()      — wipe all color fills
 */

import React, { useEffect, useMemo, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { STAINED_GLASS_COLORS } from './ColorPalette';
import { isBoundary, floodFill, fillAllRegions } from './floodFill';

export type StainedGlassHandle = {
  fillAll: (color: string) => void;
  clearAll: () => void;
};

type Props = {
  colorCanvas: HTMLCanvasElement;
  svgOverlayCanvas: HTMLCanvasElement;
  hitData: Uint8ClampedArray;
  exteriorMask: Uint8Array;
  canvasW: number;
  canvasH: number;
  paintColor: string;
  planeWidth: number;
  planeHeight: number;
  onColorUsed: (hex: string, label: string) => void;
  onColorsCleared: () => void;
};

export const StainedGlassPlane = React.forwardRef<StainedGlassHandle, Props>(
  (
    {
      colorCanvas,
      svgOverlayCanvas,
      hitData,
      exteriorMask,
      canvasW,
      canvasH,
      paintColor,
      planeWidth,
      planeHeight,
      onColorUsed,
      onColorsCleared,
    },
    ref,
  ) => {
    // ── Off-screen display canvas: composites fills + SVG overlay ─────────
    const displayCanvas = useMemo(() => {
      const c = document.createElement('canvas');
      c.width = canvasW;
      c.height = canvasH;
      return c;
    }, [canvasW, canvasH]);

    // ── CanvasTexture wraps displayCanvas ─────────────────────────────────
    const texture = useMemo(() => {
      const t = new THREE.CanvasTexture(displayCanvas);
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      return t;
    }, [displayCanvas]);

    // Dispose texture on unmount
    useEffect(
      () => () => {
        texture.dispose();
      },
      [texture],
    );

    // ── Composite helper ──────────────────────────────────────────────────
    const redrawDisplay = useCallback(() => {
      const ctx = displayCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(colorCanvas, 0, 0); // color fills (bottom)
      ctx.drawImage(svgOverlayCanvas, 0, 0); // SVG stroke lines (top)
      texture.needsUpdate = true;
    }, [displayCanvas, colorCanvas, svgOverlayCanvas, canvasW, canvasH, texture]);

    // Initial composite once props arrive
    useEffect(() => {
      redrawDisplay();
    }, [redrawDisplay]);

    // ── Imperative API ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      fillAll(color: string) {
        fillAllRegions(colorCanvas, hitData, exteriorMask, color);
        redrawDisplay();
        const label = STAINED_GLASS_COLORS.find((c) => c.hex === color)?.label ?? color;
        onColorUsed(color, label);
      },
      clearAll() {
        colorCanvas.getContext('2d')!.clearRect(0, 0, colorCanvas.width, colorCanvas.height);
        redrawDisplay();
        onColorsCleared();
      },
    }));

    // ── Click → flood fill ────────────────────────────────────────────────
    const handlePointerDown = useCallback(
      (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (!e.uv) return;

        // PlaneGeometry UVs: (0,0)=bottom-left, (1,1)=top-right.
        // CanvasTexture flipY=true: canvas row 0 (top) ↔ UV.y=1 (top of mesh).
        // Therefore: canvas_y = (1 - uv.y) * canvasH
        const px = Math.min(canvasW - 1, Math.max(0, Math.round(e.uv.x * canvasW)));
        const py = Math.min(canvasH - 1, Math.max(0, Math.round((1 - e.uv.y) * canvasH)));

        // Boundary check only — no exterior mask on click (see floodFill.ts comment).
        // floodFill itself aborts if the region covers > 45% of the canvas.
        if (isBoundary(hitData, px, py, canvasW)) return;

        const filled = floodFill(colorCanvas, hitData, px, py, paintColor);
        if (!filled) return; // aborted — region was too large (outer background)

        redrawDisplay();
        const label = STAINED_GLASS_COLORS.find((c) => c.hex === paintColor)?.label ?? paintColor;
        onColorUsed(paintColor, label);
      },
      [hitData, exteriorMask, colorCanvas, canvasW, canvasH, paintColor, redrawDisplay, onColorUsed],
    );

    return (
      <mesh onPointerDown={handlePointerDown}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
  },
);

StainedGlassPlane.displayName = 'StainedGlassPlane';
