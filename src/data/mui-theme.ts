import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';
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
});

const componentTheme = createTheme(baseTheme, {
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
        root: {},
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
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'capitalize',
          borderColor: alpha(baseTheme.palette.primary.main, 0.3),
          color: baseTheme.palette.primary.main,
          px: 1.25,
          fontSize: '0.72rem',
          '&.Mui-selected': {
            bgcolor: alpha(baseTheme.palette.primary.main, 0.15),
            color: baseTheme.palette.primary.main,
            borderColor: alpha(baseTheme.palette.primary.main, 0.5),
            '&:hover': { bgcolor: alpha(baseTheme.palette.primary.main, 0.2) },
          },
          '&:hover': { bgcolor: alpha(baseTheme.palette.primary.main, 0.07) },
        },
      },
    },
  },
});

export const muiTheme = responsiveFontSizes(componentTheme);
