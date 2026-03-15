import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { PRIMARY_COLOR } from '@/data/constants';

const baseTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f4f7f5',
    },
    primary: {
      main: PRIMARY_COLOR,
      contrastText: '#fff',
    },
  },
  typography: {
    fontFamily: '"Google Sans Flex", system-ui',
    h1: {
      fontFamily: '"Protest Guerrilla", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
    h2: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
    h3: {
      fontFamily: '"Protest Guerrilla", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
    h4: {
      fontFamily: '"Protest Guerrilla", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
    h5: {
      fontFamily: '"Protest Guerrilla", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
    h6: {
      fontFamily: '"Protest Guerrilla", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          padding: '6px 24px',
          letterSpacing: '1px',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#fff',

          borderRadius: 36,
          '&::before': {
            border: 0,
          },
          '& svg': {
            opacity: 0.6,
          },
          '& fieldset': {
            borderColor: 'transparent',
          },
          '& input': {
            paddingLeft: '6px',
          },
        },
      },
    },
    MuiListItemSecondaryAction: {
      styleOverrides: {
        root: {
          opacity: 0.6,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `0px solid ${PRIMARY_COLOR}`,
          borderRadius: 24,
        },
      },
    },
  },
});

export const muiTheme = responsiveFontSizes(baseTheme);
