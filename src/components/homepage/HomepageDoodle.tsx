import { Box, Typography } from '@mui/material';
import { PRIMARY_COLOR } from '@/data/constants';
import dayjs from 'dayjs';

// ─── Doodle configuration ─────────────────────────────────────────────────────
// Google-doodle-style celebration slot for the homepage hero. When a doodle is
// active (today falls inside its start/end window, inclusive), it replaces the
// default "Pattern Archive" wordmark; otherwise the wordmark shows.
//
// To run one: drop an image in public/images/doodles/, add an entry here, and
// deploy. Entries whose window has passed are harmless - feel free to keep
// them around as history/examples.

type DoodleConfig = {
  id: string;
  /** First day the doodle shows, local time, 'YYYY-MM-DD' (inclusive) */
  start: string;
  /** Last day the doodle shows, local time, 'YYYY-MM-DD' (inclusive) */
  end: string;
  /** Image under public/, e.g. '/images/doodles/glass-day-2026.png'. Shown ~140px tall. */
  imageUrl: string;
  /** Alt text + hover title, e.g. 'Celebrating National Stained Glass Day' */
  title: string;
  /** Optional small caption rendered under the doodle */
  caption?: string;
  /** Optional link when the doodle is clicked (internal path or external URL) */
  href?: string;
};

const DOODLES: DoodleConfig[] = [
  // Examples:
  // {
  //   id: 'stained-glass-day-2027',
  //   start: '2027-06-10',
  //   end: '2027-06-10',
  //   imageUrl: '/images/doodles/stained-glass-day.png',
  //   title: 'Celebrating National Stained Glass Day',
  //   caption: 'Happy National Stained Glass Day!',
  //   href: '/news',
  // },
  // {
  //   id: 'reddit-winner-2026',
  //   start: '2027-01-01',
  //   end: '2027-01-14',
  //   imageUrl: '/images/doodles/reddit-winner-2026.png',
  //   title: 'r/StainedGlass 2026 design winner',
  //   caption: 'Congratulations to the r/StainedGlass 2026 design winner!',
  //   href: '/pattern?tags=challenge pattern',
  // },
];

const getActiveDoodle = (): DoodleConfig | undefined => {
  const today = dayjs().format('YYYY-MM-DD');
  return DOODLES.find((d) => d.start <= today && today <= d.end);
};

// ─── Component ────────────────────────────────────────────────────────────────

export const HomepageDoodle = () => {
  const doodle = getActiveDoodle();

  if (!doodle) {
    return (
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: 44, sm: 64 },
          fontWeight: 800,
          letterSpacing: '-2px',
          color: PRIMARY_COLOR,
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        Pattern Archive
      </Typography>
    );
  }

  const image = (
    <Box
      component="img"
      src={doodle.imageUrl}
      alt={doodle.title}
      title={doodle.title}
      sx={{ maxHeight: 140, maxWidth: '100%', display: 'block', mx: 'auto' }}
    />
  );

  return (
    <Box sx={{ textAlign: 'center' }}>
      {/* Keep the site name in the document for screen readers + SEO */}
      <Typography variant="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Pattern Archive
      </Typography>

      {doodle.href ? (
        <a href={doodle.href} style={{ display: 'inline-block' }}>
          {image}
        </a>
      ) : (
        image
      )}

      {doodle.caption && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {doodle.caption}
        </Typography>
      )}
    </Box>
  );
};
