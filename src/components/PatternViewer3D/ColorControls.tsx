import React from 'react';
import { STAINED_GLASS_COLORS, ENV_OPTIONS, type EnvPreset } from './ColorPalette';
import {
  Box,
  Button,
  Typography,
  Tooltip,
  IconButton,
  Divider,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UndoIcon from '@mui/icons-material/Undo';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import LandscapeIcon from '@mui/icons-material/Landscape';
import WeekendIcon from '@mui/icons-material/Weekend';

type ColorControlsProps = {
  paintColor: string;
  onPaintColorChange: (hex: string) => void;
  onFillAll: (color: string) => void;
  onClearAll: () => void;
  onExport: () => void;
  usedColors: Map<string, string>;
  bgPreset: EnvPreset;
  onBgPresetChange: (preset: EnvPreset) => void;
  canUndo: boolean;
  onUndo: () => void;
};

export const ColorControls = ({
  paintColor,
  onPaintColorChange,
  onFillAll,
  onClearAll,
  onExport,
  usedColors,
  bgPreset,
  onBgPresetChange,
  canUndo,
  onUndo,
}: ColorControlsProps) => {
  const [fillAllAnchor, setFillAllAnchor] = React.useState<null | HTMLElement>(null);
  const [envTab, setEnvTab] = React.useState<'outdoor' | 'indoor'>('indoor');

  const filteredEnv = ENV_OPTIONS.filter((e) => (envTab === 'outdoor' ? e.outdoor : !e.outdoor));

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Header row */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: { xs: 2, sm: 1 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: paintColor,
              border: '2px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          />
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Click any region to fill
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: { xs: 3, sm: 1 }, alignItems: 'center' }}>
          <Tooltip title="Fill all regions with a color">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FormatColorFillIcon fontSize="small" />}
              onMouseDown={(e) => setFillAllAnchor(e.currentTarget)}
              sx={{ borderRadius: 1.5, fontSize: '0.75rem' }}
            >
              Fill All
            </Button>
          </Tooltip>
          <Tooltip title="Undo last fill">
            <span>
              <IconButton size="small" onClick={onUndo} disabled={!canUndo} sx={{ color: 'text.secondary' }}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear all filled regions">
            <IconButton size="small" onClick={onClearAll} sx={{ color: 'text.secondary' }}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export as PNG with color legend">
            <IconButton size="small" onClick={onExport} sx={{ color: 'text.secondary' }}>
              <FileDownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>

      <Divider sx={{ mb: 1.5 }} />

      {/* Preset color swatches */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
        {STAINED_GLASS_COLORS.map((c) => (
          <Tooltip key={c.hex} title={c.label} placement="top">
            <Box
              component="button"
              onClick={() => onPaintColorChange(c.hex)}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: paintColor === c.hex ? '2.5px solid' : '2px solid transparent',
                borderColor: paintColor === c.hex ? 'primary.main' : 'transparent',
                outline: '1.5px solid',
                outlineColor: (t) => alpha(t.palette.divider, 0.8),
                backgroundColor: c.hex,
                cursor: 'pointer',
                p: 0,
                transition: 'transform 0.1s',
                '&:hover': { transform: 'scale(1.18)' },
              }}
            />
          </Tooltip>
        ))}
      </Box>

      {/* Custom hex input */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: usedColors.size > 0 ? 0 : 0 }}>
        <Typography variant="caption" color="text.secondary">
          Custom:
        </Typography>
        <Box
          component="input"
          type="color"
          value={paintColor}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPaintColorChange(e.target.value)}
          sx={{
            width: 36,
            height: 28,
            p: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            cursor: 'pointer',
            backgroundColor: 'transparent',
          }}
        />
        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
          {paintColor}
        </Typography>
      </Box>

      {/* Colors used */}
      {usedColors.size > 0 && (
        <>
          <Divider sx={{ mt: 1.5, mb: 1.5 }} />
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Colors used:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {Array.from(usedColors.entries()).map(([hex, label]) => (
              <Tooltip key={hex} title={`Select ${label}`} placement="top">
                <Box
                  component="button"
                  onClick={() => onPaintColorChange(hex)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.5,
                    borderRadius: 10,
                    border: '1px solid',
                    borderColor: paintColor === hex ? 'primary.main' : 'divider',
                    backgroundColor: 'background.default',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: hex,
                      border: '1px solid',
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </>
      )}

      <Divider sx={{ mt: 1.5, mb: 1.5 }} />

      {/* Background environment selector */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Background scene:
          </Typography>
          <ToggleButtonGroup
            value={envTab}
            exclusive
            onChange={(_, v) => {
              if (v) setEnvTab(v);
            }}
            size="small"
          >
            <ToggleButton value="outdoor" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>
              <LandscapeIcon sx={{ fontSize: 14, mr: 0.5 }} /> Outdoor
            </ToggleButton>
            <ToggleButton value="indoor" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>
              <WeekendIcon sx={{ fontSize: 14, mr: 0.5 }} /> Indoor
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {filteredEnv.map((env) => (
            <Button
              key={env.preset}
              size="small"
              variant={bgPreset === env.preset ? 'contained' : 'outlined'}
              onClick={() => onBgPresetChange(env.preset)}
              sx={{ borderRadius: 1.5, fontSize: '0.72rem', py: 0.4, px: 1.25, minWidth: 0 }}
            >
              {env.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Fill-All color picker dropdown */}
      <Menu anchorEl={fillAllAnchor} open={Boolean(fillAllAnchor)} onClose={() => setFillAllAnchor(null)}>
        {STAINED_GLASS_COLORS.map((c) => (
          <MenuItem
            key={c.hex}
            onClick={() => {
              onPaintColorChange(c.hex);
              onFillAll(c.hex);
              setFillAllAnchor(null);
            }}
            sx={{ gap: 1.5 }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: c.hex,
                border: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            />
            <Typography variant="body2">{c.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
