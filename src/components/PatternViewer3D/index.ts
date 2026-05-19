import React from 'react';

export const PatternViewer3DLazy = React.lazy(() =>
  import('./PatternViewer3D').then((m) => ({ default: m.PatternViewer3D })),
);
