import { useState } from 'react';
import { useQueryGetRandomPattern } from '@/functions/database/patterns';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { Box } from '@mui/material';

/**
 * A single random pattern rendered full-screen behind the homepage content,
 * faded down to near-invisible. Purely decorative: the query runs client-side
 * and isn't awaited by the route loader, so it never blocks the initial paint
 * - it just fades in from 0 opacity once the image has actually loaded.
 */
export const HomepageBackgroundPattern = () => {
  const { data: pattern } = useQueryGetRandomPattern();
  const [loaded, setLoaded] = useState(false);

  const src = pattern ? generatePbImage(pattern) : null;
  if (!src) return null;

  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden="true"
      onLoad={() => setLoaded(true)}
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: -1,
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: loaded ? 0.04 : 0,
        transition: 'opacity 1.5s ease',
      }}
    />
  );
};
