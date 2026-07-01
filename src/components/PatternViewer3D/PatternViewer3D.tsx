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
 *    • <Environment preset background />  - HDR sky dome (no manual SkyDome
 *      needed).  Provides both the background image and ambient lighting.
 *      The bright sky shines through the transparent glass regions, creating
 *      the backlit stained-glass glow.
 *    • <StainedGlassPlane>  - flat plane with CanvasTexture.  Handles click-
 *      to-fill via UV raycasting.
 *    • <GroundPlane>  - subtle reflective ground for outdoor environments.
 *    • <OrbitControls>  - orbit / zoom the view.
 *    • <ExportWirer>  - wires up the export callback inside the GL context.
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
import { useQueryClient } from '@tanstack/react-query';

import { StainedGlassPlane, type StainedGlassHandle } from './StainedGlassPlane';
import { usePatternRasterizer } from './usePatternRasterizer';
import { ColorControls } from './ColorControls';
import { STAINED_GLASS_COLORS, ENV_OPTIONS, type EnvPreset } from './ColorPalette';
import { buildLegend } from '../PatternExport/render-legend';
import { formatMeasurement } from '@/functions/utilities/format-measurement';
import type { TypePatternResponse } from '@/functions/database/patterns.ts';

// ─── SVG → HTMLImageElement helper ────────────────────────────────────────────

/** Converts an SVG string to a loaded HTMLImageElement via a temporary Blob URL. */
function svgStringToImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
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
  exportRef: React.MutableRefObject<(() => Promise<void>) | null>;
  viewData: TypePatternResponse | undefined;
};

const ExportWirer = ({ exportRef, viewData }: ExportWirerProps) => {
  const { gl } = useThree();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    exportRef.current = async () => {
      const src = gl.domElement;
      const w = src.width;
      const h = src.height;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = w;
      exportCanvas.height = h;
      const ctx = exportCanvas.getContext('2d')!;

      // Draw the current 3D scene
      ctx.drawImage(src, 0, 0);

      // Composite the same legend card used by SVG / print exports
      if (viewData) {
        const authorLine = [...(viewData.expand?.authors?.map((a) => a.name) ?? []), ...(viewData.author_manual ?? [])]
          .filter(Boolean)
          .join(', ');

        const projectSizeLabel = `${formatMeasurement(viewData.design_width, viewData.design_width_unit)} x ${formatMeasurement(viewData.design_height, viewData.design_height_unit)}`;
        const lineWidthLabel = formatMeasurement(viewData.line_width, viewData.line_width_unit);
        const designDate = viewData.design_date ? new Date(viewData.design_date as unknown as string) : null;

        try {
          const legend = await buildLegend({
            patternName: viewData.name ?? '',
            authorLine,
            projectSizeLabel,
            pieces: viewData.pieces ?? 0,
            lineWidthLabel,
            designDate,
            keys: [],
            queryClient,
            isSmall: true,
          });

          const legendImg = await svgStringToImage(legend.svg);
          const MARGIN = 16;
          ctx.drawImage(legendImg, MARGIN, h - legend.height - MARGIN, legend.width, legend.height);
        } catch {
          // Legend build failed - export scene without it
        }
      }

      const a = document.createElement('a');
      a.href = exportCanvas.toDataURL('image/png');
      a.download = `${viewData?.name ?? 'pattern'}-stained-glass.png`;
      a.click();
    };

    return () => {
      exportRef.current = null;
    };
  }, [gl, viewData, queryClient, exportRef]);

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
  exportRef: React.MutableRefObject<(() => Promise<void>) | null>;
  viewData: TypePatternResponse | undefined;
  onColorUsed: (hex: string, label: string) => void;
  onColorsCleared: () => void;
  onUndoStackChange: (canUndo: boolean) => void;
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
  viewData,
  onColorUsed,
  onColorsCleared,
  onUndoStackChange,
}: SceneProps) => (
  <>
    {/* HDR environment - acts as both background and ambient light.
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
      onUndoStackChange={onUndoStackChange}
    />

    {/* Camera orbit - disabled pan, limited polar range so glass stays upright */}
    <OrbitControls
      enablePan={false}
      minDistance={1.2}
      maxDistance={8}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={(5 * Math.PI) / 6}
    />

    <ExportWirer exportRef={exportRef} viewData={viewData} />
  </>
);

// ─── Main export ──────────────────────────────────────────────────────────────

type PatternViewer3DProps = {
  viewData: TypePatternResponse | undefined;
  hiddenLayers?: Set<string>;
};

export const PatternViewer3D = ({ viewData, hiddenLayers }: PatternViewer3DProps) => {
  const { hitData, exteriorMask, svgOverlayCanvas, colorCanvas, canvasW, canvasH, loading, error } =
    usePatternRasterizer(viewData, hiddenLayers);

  const [paintColor, setPaintColor] = useState<string>(STAINED_GLASS_COLORS[0].hex);
  const [usedColors, setUsedColors] = useState<Map<string, string>>(new Map());
  const [bgPreset, setBgPreset] = useState<EnvPreset>('apartment');
  const [canUndo, setCanUndo] = useState<boolean>(false);

  const glassRef = useRef<StainedGlassHandle>(null);
  const exportRef = useRef<(() => Promise<void>) | null>(null);

  // Reset used-colors and undo stack when the pattern changes
  React.useEffect(() => {
    setUsedColors(new Map());
    setCanUndo(false);
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

  const handleUndo = useCallback(() => {
    glassRef.current?.undo();
  }, []);

  const handleUndoStackChange = useCallback((available: boolean) => {
    setCanUndo(available);
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
              viewData={viewData}
              onColorUsed={handleColorUsed}
              onColorsCleared={handleColorsCleared}
              onUndoStackChange={handleUndoStackChange}
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
        canUndo={canUndo}
        onUndo={handleUndo}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        Click any region to fill it · Drag to orbit · Scroll to zoom
      </Typography>
    </Box>
  );
};
