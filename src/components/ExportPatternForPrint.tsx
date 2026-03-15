import React, { useState } from 'react';
import { DecorativeTitle, SectionLabel } from '@/components/ViewHelpers';
import { useGlobalViewData } from '@/data/view';

import { alpha } from '@mui/material/styles';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import DownloadIcon from '@mui/icons-material/Download';

import { Box, Button, Collapse, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';

export const ExportPatternForPrint = () => {
  const { viewData } = useGlobalViewData();

  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageWidth, setPageWidth] = useState('');
  const [pageHeight, setPageHeight] = useState('');

  const canDownload = pageWidth.trim() !== '' && pageHeight.trim() !== '';

  const handleOrientationChange = (_: React.MouseEvent<HTMLElement>, val: 'portrait' | 'landscape' | null) => {
    if (val) setOrientation(val);
  };

  const handlePrint = () => {
    alert('Printed!');
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${alpha('#C8A96E', 0.18)}`,
        borderRadius: 1,
        p: 3,
        mb: 3,
      }}
    >
      <DecorativeTitle>Export Pattern for Print</DecorativeTitle>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto auto' },
          gap: 2,
          alignItems: 'flex-end',
        }}
      >
        <Box>
          <TextField
            label="Page Width"
            size="small"
            variant="filled"
            fullWidth
            placeholder="e.g. 8.5 in"
            value={pageWidth}
            onChange={(e) => setPageWidth(e.target.value)}
          />
        </Box>

        <Box>
          <TextField
            label="Page Height"
            size="small"
            variant="filled"
            fullWidth
            placeholder="e.g. 11 in"
            value={pageHeight}
            onChange={(e) => setPageHeight(e.target.value)}
          />
        </Box>

        <Box>
          <SectionLabel>Orientation</SectionLabel>

          <ToggleButtonGroup
            value={orientation}
            exclusive
            onChange={handleOrientationChange}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                borderColor: alpha('#C8A96E', 0.3),
                color: 'text.secondary',
                px: 1.5,
                '&.Mui-selected': {
                  bgcolor: alpha('#C8A96E', 0.15),
                  color: 'primary.main',
                  borderColor: alpha('#C8A96E', 0.5),
                  '&:hover': { bgcolor: alpha('#C8A96E', 0.2) },
                },
                '&:hover': { bgcolor: alpha('#C8A96E', 0.07) },
              },
            }}
          >
            <ToggleButton value="portrait">
              <Tooltip title="Portrait">
                <CropPortraitIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>

            <ToggleButton value="landscape">
              <Tooltip title="Landscape">
                <CropLandscapeIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Button variant="contained" disabled={!canDownload} startIcon={<DownloadIcon />} onClick={handlePrint}>
          Download PDF
        </Button>
      </Box>

      <Collapse in={!canDownload}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1.5, display: 'block' }}>
          Enter page dimensions to enable export.
        </Typography>
      </Collapse>
    </Box>
  );
};
