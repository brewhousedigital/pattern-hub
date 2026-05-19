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
 * Undo
 * ────
 * Before every destructive canvas operation (click-fill, fillAll, clearAll)
 * a snapshot of colorCanvas is captured via getImageData and pushed onto an
 * in-memory stack (capped at MAX_UNDO steps).  undo() pops the last snapshot
 * and restores it with putImageData.  onUndoStackChange fires whenever the
 * stack goes from empty→non-empty or non-empty→empty so the parent can
 * enable/disable the Undo button accordingly.
 *
 * Imperative API (via forwardRef)
 * ─────────────────────────────────
 *   fillAll(color)  — fill every interior region in one pass
 *   clearAll()      — wipe all color fills
 *   undo()          — restore the previous canvas state
 */

import React, { useEffect, useRef, useMemo, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { STAINED_GLASS_COLORS } from './ColorPalette';
import { isBoundary, floodFill, fillAllRegions } from './floodFill';

export type StainedGlassHandle = {
  fillAll: (color: string) => void;
  clearAll: () => void;
  undo: () => void;
};

/** Maximum number of undo steps retained in memory. */
const MAX_UNDO = 20;

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
  /** Called whenever the undo stack becomes available (true) or empty (false). */
  onUndoStackChange: (canUndo: boolean) => void;
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
      onUndoStackChange,
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

    // ── Undo stack ────────────────────────────────────────────────────────
    const undoStack = useRef<ImageData[]>([]);

    // Reset stack whenever a new pattern is loaded (canvas dimensions change)
    useEffect(() => {
      undoStack.current = [];
      onUndoStackChange(false);
    }, [canvasW, canvasH, onUndoStackChange]);

    /**
     * Capture the current colorCanvas state.  Call this BEFORE the operation
     * you want to be undoable; pass the result to commitSnapshot if the
     * operation actually modified the canvas.
     */
    const captureSnapshot = useCallback((): ImageData => {
      return colorCanvas.getContext('2d')!.getImageData(0, 0, canvasW, canvasH);
    }, [colorCanvas, canvasW, canvasH]);

    /**
     * Push a previously-captured snapshot onto the undo stack.  The parent is
     * notified that undo is now available.
     */
    const commitSnapshot = useCallback(
      (snapshot: ImageData) => {
        undoStack.current.push(snapshot);
        if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
        onUndoStackChange(true);
      },
      [onUndoStackChange],
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
    useImperativeHandle(
      ref,
      () => ({
        fillAll(color: string) {
          const snapshot = captureSnapshot();
          fillAllRegions(colorCanvas, hitData, exteriorMask, color);
          commitSnapshot(snapshot);
          redrawDisplay();
          const label = STAINED_GLASS_COLORS.find((c) => c.hex === color)?.label ?? color;
          onColorUsed(color, label);
        },
        clearAll() {
          const snapshot = captureSnapshot();
          colorCanvas.getContext('2d')!.clearRect(0, 0, colorCanvas.width, colorCanvas.height);
          commitSnapshot(snapshot);
          redrawDisplay();
          onColorsCleared();
        },
        undo() {
          const snapshot = undoStack.current.pop();
          if (!snapshot) return;
          colorCanvas.getContext('2d')!.putImageData(snapshot, 0, 0);
          redrawDisplay();
          onUndoStackChange(undoStack.current.length > 0);
        },
      }),
      [captureSnapshot, commitSnapshot, colorCanvas, hitData, exteriorMask, redrawDisplay, onColorUsed, onColorsCleared, onUndoStackChange],
    );

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

        // Capture state before fill; discard snapshot if fill is aborted (outer bg click).
        const snapshot = captureSnapshot();
        const filled = floodFill(colorCanvas, hitData, px, py, paintColor);
        if (!filled) return; // aborted — region was too large (outer background)

        commitSnapshot(snapshot);
        redrawDisplay();
        const label = STAINED_GLASS_COLORS.find((c) => c.hex === paintColor)?.label ?? paintColor;
        onColorUsed(paintColor, label);
      },
      [hitData, colorCanvas, canvasW, canvasH, paintColor, captureSnapshot, commitSnapshot, redrawDisplay, onColorUsed],
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
