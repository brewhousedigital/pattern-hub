import React from 'react';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { Header } from '@/components/layout/Header/Header';
import { Footer } from '@/components/layout/Footer';
import { Box } from '@mui/material';
import { AccountVerificationBox } from '@/components/layout/AccountVerificationBox.tsx';

export const AdminLayout = (props: TypeComponentWithChildrenProps) => {
  return (
    <Box>
      <Box component="main" sx={{ minHeight: 'calc(100svh - 88px)' }}>
        {props.children}
      </Box>
    </Box>
  );
};
