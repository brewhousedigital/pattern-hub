import { PRIMARY_COLOR } from '@/data/constants';

export const subLinkStyles = {
  color: 'text.primary',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: '0.875rem',
  letterSpacing: '0.01em',
  transition: 'color 0.15s',
  '&:hover': {
    color: PRIMARY_COLOR,
    textDecoration: 'none',
  },
  '&:focus-visible': {
    color: PRIMARY_COLOR,
    outline: `2px solid ${PRIMARY_COLOR}`,
    outlineOffset: 2,
    borderRadius: 1,
  },
};
