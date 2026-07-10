import React from 'react';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { Header } from '@/components/layout/Header/Header';
import { Footer } from '@/components/layout/Footer';
import { Box } from '@mui/material';
import { AccountVerificationBox } from '@/components/layout/AccountVerificationBox.tsx';

export const GeneralLayout = (props: TypeComponentWithChildrenProps) => {
  return (
    <Box sx={{ pb: 4 }}>
      <Header />

      <Box component="main" sx={{ minHeight: 'calc(100svh - 88px)' }}>
        {props.children}
      </Box>

      <AccountVerificationBox />

      <Footer />
    </Box>
  );
};
