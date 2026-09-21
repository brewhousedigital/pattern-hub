import { createPrettyCalendarDate } from '@/functions/utilities/dates';

import { Typography } from '@mui/material';

type WikiPageDateProps = {
  /** The "display_date" value of a wiki page. Nothing shows when it is empty. */
  value: string | undefined;
  /** "eyebrow" is bold, green, upper case text. "muted" is small gray text. The default is "eyebrow". */
  variant?: 'eyebrow' | 'muted';
};

// The optional date an admin sets on a wiki page. The page lists and the page itself share it.
// Each style sets its color with sx, because the Typography "color" prop does not accept "text.secondary" in MUI 9.
export const WikiPageDate = ({ value, variant = 'eyebrow' }: WikiPageDateProps) => {
  const label = createPrettyCalendarDate(value);
  if (!label) return null;

  return (
    <Typography
      component="time"
      variant="caption"
      dateTime={value?.slice(0, 10)}
      sx={
        variant === 'eyebrow'
          ? {
              display: 'block',
              mb: 0.75,
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }
          : { display: 'block', mb: 0.5, color: 'text.secondary' }
      }
    >
      {label}
    </Typography>
  );
};
