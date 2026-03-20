import { PRIMARY_COLOR } from '@/data/constants';

export const subLinkStyles = {
  color: '#222',
  textDecoration: 'none',
  fontWeight: 500,
  '&:hover': {
    color: PRIMARY_COLOR,
    textDecoration: 'underline',
  },
  '&:focus': {
    color: PRIMARY_COLOR,
    textDecoration: 'underline',
  },
};
