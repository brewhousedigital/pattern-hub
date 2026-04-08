import React from 'react';

import { Box, Button, Typography, Stack } from '@mui/material';

type TypeHeaderProps = {
  title: string;
  subtitle?: string | React.ReactNode;
  action?: () => void;
  actionText?: string;
  actionIcon?: React.ReactNode;
  disabled?: boolean;
  actionNode?: React.ReactNode;
};

export const AdminHeaderContainer = (props: TypeHeaderProps) => {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      sx={{ alignItems: 'center', justifyContent: { xs: 'center', md: 'space-between' }, mb: 3 }}
    >
      <Box>
        <Typography variant="h5" fontWeight={500}>
          {props.title}
        </Typography>

        {props.subtitle && (
          <Typography variant="body2" color="text.secondary">
            {props.subtitle}
          </Typography>
        )}
      </Box>

      {props.actionNode && props.actionNode}

      {props.action && (
        <Button
          variant="contained"
          color="success"
          startIcon={props.actionIcon}
          onClick={props.action}
          disabled={props.disabled}
        >
          {props.actionText}
        </Button>
      )}
    </Stack>
  );
};
