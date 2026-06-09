import { useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';

type CollapsibleCardProps = TypeComponentWithChildrenProps & {
  title: string;
  defaultOpen?: boolean;
};

export const CollapsibleCard = ({ title, defaultOpen = false, children }: CollapsibleCardProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: '#fff',
        border: (theme) => `2px solid ${theme.palette.primary.main}`,
        borderRadius: 6,
        mb: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: alpha('#C8A96E', 0.04),
          },
        }}
      >
        <Box sx={{ height: '1px', width: 20, flexShrink: 0, backgroundColor: alpha('#C8A96E', 0.2) }} />

        <Typography
          variant="caption"
          sx={{
            color: 'primary.main',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>

        <Box sx={{ height: '1px', flex: 1, backgroundColor: alpha('#C8A96E', 0.2) }} />

        <ExpandMoreIcon
          sx={{
            fontSize: '1.1rem',
            color: 'primary.main',
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Box>

      {/* Content */}
      <Collapse in={open}>
        <Box
          sx={{
            px: 3,
            pb: 3,
            pt: 3,
            borderTop: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};
