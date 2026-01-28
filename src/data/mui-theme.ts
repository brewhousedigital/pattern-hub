import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const baseTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0F1D21',
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
  },
});

export const muiTheme = responsiveFontSizes(baseTheme);
