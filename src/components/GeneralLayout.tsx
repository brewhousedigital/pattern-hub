import React from 'react';
import type { TypeComponentWithChildrenProps } from '../functions/types/types';
import { useRefreshAuth } from '@/data/auth-data';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

import { Box } from '@mui/material';

export const GeneralLayout = (props: TypeComponentWithChildrenProps) => {
  // Check if the user is logged in on load
  useRefreshAuth();

  return (
    <>
      <Header />

      <Box component="main" sx={{ minHeight: 'calc(100svh - 88px)' }}>
        {props.children}
      </Box>

      <Footer />
    </>
  );
};
