import React from 'react';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { muiTheme } from '../data/mui-theme';
import { SnackbarProvider } from 'notistack';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { RateLimitModal } from '@/components/RateLimitModal';
import { useBootstrapAuth } from '@/data/auth-data';

const RootLayout = () => {
  // Refresh the PocketBase session once per visit (client-only effect)
  useBootstrapAuth();

  return (
    <RootDocument>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />

        <SnackbarProvider autoHideDuration={6000} anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Outlet />
            <RateLimitModal />
          </LocalizationProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </RootDocument>
  );
};

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Pattern Archive' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/images/icons/favicon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap',
      },
      { rel: 'stylesheet', href: '/stylesheet.css' },
    ],
  }),
  component: RootLayout,
});
