import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const baseTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0F1D21',
    },
    primary: {
      main: '#F97316',
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
          backgroundColor: '#15252B',

          borderRadius: 36,
          '&::before': {
            border: 0,
          },
          '& svg': {
            opacity: 0.6,
          },
          '& fieldset': {
            borderColor: '#25424C',
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
          backgroundColor: '#16262C',
          border: '1px solid #25424C',
          borderRadius: 24,
        },
      },
    },
  },
});

export const muiTheme = responsiveFontSizes(baseTheme);
