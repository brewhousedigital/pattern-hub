import React, { Suspense, useState } from 'react';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { LayerSelectionHint } from '@/components/PatternUtilities/LayerSelectionHint';
import type { TypePatternResponse } from '@/functions/database/patterns';

import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Button, Skeleton, Typography } from '@mui/material';

const ExportWizard = React.lazy(() => import('./ExportWizard').then((m) => ({ default: m.ExportWizard })));
const ExportPatternForSVG = React.lazy(() =>
  import('./ExportPatternForSVG').then((m) => ({ default: m.ExportPatternForSVG })),
);
const ExportPatternForPrintV3 = React.lazy(() =>
  import('./ExportPatternForPrintV3').then((m) => ({ default: m.ExportPatternForPrintV3 })),
);
const ExportPatternForImage = React.lazy(() =>
  import('./ExportPatternForImage').then((m) => ({ default: m.ExportPatternForImage })),
);

type ExportView = 'quick' | 'svg' | 'print' | 'image';

type ExportSectionProps = {
  viewData: TypePatternResponse | undefined;
  hiddenLayers: Set<string>;
};

// Single "Export" card: the Quick Export wizard by default, or one of the
// three advanced panels when the wizard's "prefer to do it yourself?" links
// are used. No tab bar - the wizard and each advanced panel drive navigation
// via onOpenAdvanced / the "Quick Export" footer link below.
export const ExportSection = ({ viewData, hiddenLayers }: ExportSectionProps) => {
  const [view, setView] = useState<ExportView>('quick');

  return (
    <BorderedCard>
      {/* Header - matches the line/label/line title treatment used by CollapsibleCard */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ height: '1px', width: 20, flexShrink: 0, backgroundColor: alpha('#C8A96E', 0.2) }} />
        <Typography
          variant="caption"
          sx={{
            color: 'primary.main',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            whiteSpace: 'nowrap',
          }}
        >
          Export
        </Typography>
        <Box sx={{ height: '1px', flex: 1, backgroundColor: alpha('#C8A96E', 0.2) }} />
      </Box>

      {viewData?.has_layers && (viewData.layers_map?.length ?? 0) > 0 && <LayerSelectionHint sx={{ mb: 2 }} />}

      <Suspense fallback={<Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />}>
        {view === 'quick' && <ExportWizard viewData={viewData} hiddenLayers={hiddenLayers} onOpenAdvanced={setView} />}
        {view === 'svg' && <ExportPatternForSVG viewData={viewData} hiddenLayers={hiddenLayers} />}
        {view === 'print' && <ExportPatternForPrintV3 viewData={viewData} hiddenLayers={hiddenLayers} />}
        {view === 'image' && <ExportPatternForImage viewData={viewData} hiddenLayers={hiddenLayers} />}
      </Suspense>

      {view !== 'quick' && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Button
            size="small"
            startIcon={<ArrowBackRoundedIcon fontSize="small" />}
            onClick={() => setView('quick')}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Quick Export
          </Button>
        </Box>
      )}
    </BorderedCard>
  );
};
