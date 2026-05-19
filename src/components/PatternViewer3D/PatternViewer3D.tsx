/**
 * PatternViewer3D
 *
 * Interactive 3D stained-glass color planner.
 *
 * Architecture
 * ────────────
 * 1. usePatternRasterizer fetches the SVG and produces three off-screen
 *    canvases (hit, svgOverlay, color) plus pre-computed hit/exterior data.
 *
 * 2. Inside an R3F Canvas:
 *    • <Environment preset background />  — HDR sky dome (no manual SkyDome
 *      needed).  Provides both the background image and ambient lighting.
 *      The bright sky shines through the transparent glass regions, creating
 *      the backlit stained-glass glow.
 *    • <StainedGlassPlane>  — flat plane with CanvasTexture.  Handles click-
 *      to-fill via UV raycasting.
 *    • <GroundPlane>  — subtle reflective ground for outdoor environments.
 *    • <OrbitControls>  — orbit / zoom the view.
 *    • <ExportWirer>  — wires up the export callback inside the GL context.
 *
 * 3. Below the canvas: ColorControls with palette, Fill All, Clear, Export,
 *    and background environment selector.
 *
 * Export flow
 * ───────────
 * gl.domElement (WebGL) → drawn into an off-screen 2D canvas →
 * legend composited bottom-left → PNG download.
 */

import React, { Suspense, useState, useCallback, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Alert, Skeleton, Typography } from '@mui/material';

import { StainedGlassPlane, type StainedGlassHandle } from './StainedGlassPlane';
import { usePatternRasterizer } from './usePatternRasterizer';
import { ColorControls } from './ColorControls';
import { STAINED_GLASS_COLORS, ENV_OPTIONS, type EnvPreset } from './ColorPalette';
import type { TypePatternResponse } from '@/functions/database/patterns.ts';

// ─── Legend drawing helper ─────────────────────────────────────────────────────

const LEGEND_PAD = 16;
const SWATCH_R = 8;
const SWATCH_GAP = 7;
const ITEM_H = 26;
const ITEM_W = 140;

function drawLegend(ctx: CanvasRenderingContext2D, w: number, h: number, usedColors: Map<string, string>): void {
  const entries = Array.from(usedColors.entries());
  if (entries.length === 0) return;

  const cols = Math.max(1, Math.floor((w * 0.55) / ITEM_W)); // use left 55% of width
  const rows = Math.ceil(entries.length / cols);
  const boxW = Math.min(w - LEGEND_PAD * 2, cols * ITEM_W + LEGEND_PAD * 2);
  const boxH = LEGEND_PAD * 2 + 22 + rows * ITEM_H; // header + rows
  const boxX = LEGEND_PAD;
  const boxY = h - boxH - LEGEND_PAD;

  // Semi-transparent background panel
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();

  // Heading
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Colors Used', boxX + LEGEND_PAD, boxY + LEGEND_PAD + 12);

  // Swatches + labels
  entries.forEach(([hex, label], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = boxX + LEGEND_PAD + col * ITEM_W;
    const y = boxY + LEGEND_PAD + 22 + row * ITEM_H;

    // Filled swatch
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(x + SWATCH_R, y + SWATCH_R, SWATCH_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(label, x + SWATCH_R * 2 + SWATCH_GAP, y + SWATCH_R + 4);
  });
}

// ─── Ground plane (outdoor scenes) ────────────────────────────────────────────

const OUTDOOR_PRESETS = new Set(ENV_OPTIONS.filter((e) => e.outdoor).map((e) => e.preset));

const GroundPlane = ({ bgPreset }: { bgPreset: EnvPreset }) => {
  if (!OUTDOOR_PRESETS.has(bgPreset)) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#3a4530" roughness={1} metalness={1} envMapIntensity={0.4} />
    </mesh>
  );
};

// ─── Export wirer (inside Canvas so it has useThree access) ───────────────────

type ExportWirerProps = {
  exportRef: React.MutableRefObject<(() => void) | null>;
  patternName?: string;
  usedColors: Map<string, string>;
};

const ExportWirer = ({ exportRef, patternName, usedColors }: ExportWirerProps) => {
  const { gl } = useThree();

  React.useEffect(() => {
    exportRef.current = () => {
      const src = gl.domElement;
      const w = src.width;
      const h = src.height;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = w;
      exportCanvas.height = h;
      const ctx = exportCanvas.getContext('2d')!;

      // Draw the current 3D scene
      ctx.drawImage(src, 0, 0);

      // Composite legend bottom-left
      // TODO: Swap this out for the Pattern Legend found in `render-legend.ts`
      drawLegend(ctx, w, h, usedColors);

      const a = document.createElement('a');
      a.href = exportCanvas.toDataURL('image/png');
      a.download = `${patternName ?? 'pattern'}-stained-glass.png`;
      a.click();
    };

    return () => {
      exportRef.current = null;
    };
  }, [gl, patternName, usedColors, exportRef]);

  return null;
};

// ─── Scene (inside Canvas) ────────────────────────────────────────────────────

type SceneProps = {
  colorCanvas: HTMLCanvasElement;
  svgOverlayCanvas: HTMLCanvasElement;
  hitData: Uint8ClampedArray;
  exteriorMask: Uint8Array;
  canvasW: number;
  canvasH: number;
  paintColor: string;
  planeWidth: number;
  planeHeight: number;
  bgPreset: EnvPreset;
  glassRef: React.Ref<StainedGlassHandle>;
  exportRef: React.MutableRefObject<(() => void) | null>;
  patternName?: string;
  usedColors: Map<string, string>;
  onColorUsed: (hex: string, label: string) => void;
  onColorsCleared: () => void;
};

const Scene = ({
  colorCanvas,
  svgOverlayCanvas,
  hitData,
  exteriorMask,
  canvasW,
  canvasH,
  paintColor,
  planeWidth,
  planeHeight,
  bgPreset,
  glassRef,
  exportRef,
  patternName,
  usedColors,
  onColorUsed,
  onColorsCleared,
}: SceneProps) => (
  <>
    {/* HDR environment — acts as both background and ambient light.
        The bright sky shines through the transparent glass regions. */}
    <Environment preset={bgPreset} background backgroundRotation={[0, 6.5 / 2, 0]} />

    {/* Optional ground plane for outdoor environments */}
    <GroundPlane bgPreset={bgPreset} />

    {/* The stained glass panel */}
    <StainedGlassPlane
      ref={glassRef}
      colorCanvas={colorCanvas}
      svgOverlayCanvas={svgOverlayCanvas}
      hitData={hitData}
      exteriorMask={exteriorMask}
      canvasW={canvasW}
      canvasH={canvasH}
      paintColor={paintColor}
      planeWidth={planeWidth}
      planeHeight={planeHeight}
      onColorUsed={onColorUsed}
      onColorsCleared={onColorsCleared}
    />

    {/* Camera orbit — disabled pan, limited polar range so glass stays upright */}
    <OrbitControls
      enablePan={false}
      minDistance={1.2}
      maxDistance={8}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={(5 * Math.PI) / 6}
    />

    <ExportWirer exportRef={exportRef} patternName={patternName} usedColors={usedColors} />
  </>
);

// ─── Main export ──────────────────────────────────────────────────────────────

type PatternViewer3DProps = {
  viewData: TypePatternResponse | undefined;
};

export const PatternViewer3D = ({ viewData }: PatternViewer3DProps) => {
  const { hitData, exteriorMask, svgOverlayCanvas, colorCanvas, canvasW, canvasH, loading, error } =
    usePatternRasterizer(viewData);

  const [paintColor, setPaintColor] = useState<string>(STAINED_GLASS_COLORS[0].hex);
  const [usedColors, setUsedColors] = useState<Map<string, string>>(new Map());
  const [bgPreset, setBgPreset] = useState<EnvPreset>('apartment');

  const glassRef = useRef<StainedGlassHandle>(null);
  const exportRef = useRef<(() => void) | null>(null);

  // Reset used-colors when the pattern changes
  React.useEffect(() => {
    setUsedColors(new Map());
  }, [viewData?.id]);

  const handleColorUsed = useCallback((hex: string, label: string) => {
    setUsedColors((prev) => new Map(prev).set(hex, label));
  }, []);

  const handleColorsCleared = useCallback(() => {
    setUsedColors(new Map());
  }, []);

  const handleFillAll = useCallback((color: string) => {
    glassRef.current?.fillAll(color);
    setPaintColor(color);
  }, []);

  const handleClearAll = useCallback(() => {
    glassRef.current?.clearAll();
    // clearAll fires onColorsCleared which resets the map
  }, []);

  const handleExport = useCallback(() => {
    exportRef.current?.();
  }, []);

  // ── Derive world-space plane dimensions ───────────────────────────────────
  const maxDim = Math.max(canvasW, canvasH);
  const planeWidth = maxDim > 0 ? 2 * (canvasW / maxDim) : 2;
  const planeHeight = maxDim > 0 ? 2 * (canvasH / maxDim) : 2;

  // ── Guard states ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
        {error}
      </Alert>
    );
  }

  if (loading) {
    return <Skeleton variant="rounded" height={500} sx={{ mt: 2, borderRadius: 2 }} />;
  }

  if (!hitData || !colorCanvas || !svgOverlayCanvas || !exteriorMask || canvasW === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* 3D Canvas */}
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          camera={{ position: [0, 0, 3.2], fov: 50 }}
          style={{ height: 500, display: 'block' }}
        >
          <Suspense fallback={null}>
            <Scene
              colorCanvas={colorCanvas}
              svgOverlayCanvas={svgOverlayCanvas}
              hitData={hitData}
              exteriorMask={exteriorMask}
              canvasW={canvasW}
              canvasH={canvasH}
              paintColor={paintColor}
              planeWidth={planeWidth}
              planeHeight={planeHeight}
              bgPreset={bgPreset}
              glassRef={glassRef}
              exportRef={exportRef}
              patternName={viewData?.name}
              usedColors={usedColors}
              onColorUsed={handleColorUsed}
              onColorsCleared={handleColorsCleared}
            />
          </Suspense>
        </Canvas>
      </Box>

      {/* Controls */}
      <ColorControls
        paintColor={paintColor}
        onPaintColorChange={setPaintColor}
        onFillAll={handleFillAll}
        onClearAll={handleClearAll}
        onExport={handleExport}
        usedColors={usedColors}
        bgPreset={bgPreset}
        onBgPresetChange={setBgPreset}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        Click any region to fill it · Drag to orbit · Scroll to zoom
      </Typography>
    </Box>
  );
};
