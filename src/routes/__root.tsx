import React from 'react';
import { HeadContent, createRootRoute, Outlet } from '@tanstack/react-router';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { muiTheme } from '../data/mui-theme';
import { SnackbarProvider } from 'notistack';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/functions/database/authentication-setup';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { RateLimitModal } from '@/components/RateLimitModal';

const RootLayout = () => {
  return (
    <>
      <HeadContent />

      <ThemeProvider theme={muiTheme}>
        <CssBaseline />

        <SnackbarProvider autoHideDuration={6000} anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
          <QueryClientProvider client={queryClient}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Outlet />
              <RateLimitModal />
            </LocalizationProvider>
          </QueryClientProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </>
  );
};

export const Route = createRootRoute({ component: RootLayout });
