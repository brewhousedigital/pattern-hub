import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { PRIMARY_COLOR, SECONDARY_COLOR } from '@/data/constants';

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
    secondary: {
      main: SECONDARY_COLOR,
    },
  },
  typography: {
    fontFamily: '"Google Sans Flex", system-ui',
    h1: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 600,
      fontStyle: 'normal',
    },
    h2: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
    },
    h3: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 600,
      fontStyle: 'normal',
    },
    h4: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 600,
      fontStyle: 'normal',
    },
    h5: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 600,
      fontStyle: 'normal',
    },
    h6: {
      fontFamily: '"Google Sans Flex", sans-serif',
      fontWeight: 600,
      fontStyle: 'normal',
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
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
