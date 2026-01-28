import { createRootRoute, Outlet } from '@tanstack/react-router';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { muiTheme } from '../data/mui-theme';
import { SnackbarProvider } from 'notistack';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { GeneralLayout } from '../components/GeneralLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const RootLayout = () => (
  <ThemeProvider theme={muiTheme}>
    <CssBaseline />

    <SnackbarProvider autoHideDuration={10000} anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
      <QueryClientProvider client={queryClient}>
        <GeneralLayout>
          <Outlet />
        </GeneralLayout>
      </QueryClientProvider>
    </SnackbarProvider>
  </ThemeProvider>
);

export const Route = createRootRoute({ component: RootLayout });
