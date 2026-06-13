import React, { useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { MarkdownWrapper } from './MarkdownWrapper';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  error?: boolean;
  helperText?: React.ReactNode;
};

export const MarkdownEditor = ({
  value,
  onChange,
  label,
  placeholder,
  maxLength = 3000,
  minRows = 8,
  error,
  helperText,
}: MarkdownEditorProps) => {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        {label && (
          <Typography variant="body2" color={error ? 'error' : 'text.secondary'} fontWeight={600}>
            {label}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          {(['write', 'preview'] as const).map((m) => (
            <Box
              key={m}
              component="button"
              type="button"
              onClick={() => setMode(m)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: mode === m ? 'primary.main' : 'divider',
                backgroundColor: mode === m ? 'primary.main' : 'transparent',
                color: mode === m ? 'primary.contrastText' : 'text.secondary',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
                '&:hover': mode !== m ? { borderColor: 'text.secondary', color: 'text.primary' } : {},
              }}
            >
              {m}
            </Box>
          ))}
        </Box>
      </Box>

      {mode === 'write' ? (
        <TextField
          variant="filled"
          fullWidth
          multiline
          minRows={minRows}
          maxRows={24}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          error={error}
          slotProps={{ htmlInput: { maxLength } }}
        />
      ) : (
        <Box
          sx={{
            minHeight: minRows * 26,
            border: '1px solid',
            borderColor: error ? 'error.main' : 'divider',
            borderRadius: 1,
            p: 2.5,
            backgroundColor: 'action.hover',
          }}
        >
          {value.trim() ? (
            <MarkdownWrapper>{value}</MarkdownWrapper>
          ) : (
            <Typography color="text.disabled" variant="body2" fontStyle="italic">
              Nothing to preview yet.
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mt: 0.75, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          {helperText && (
            <Typography variant="caption" color={error ? 'error' : 'text.disabled'}>
              {helperText}
            </Typography>
          )}
        </Box>
        <Typography
          variant="caption"
          sx={{
            flexShrink: 0,
            color: value.length > maxLength * 0.99 ? 'error.main' : value.length > maxLength * 0.88 ? 'warning.main' : 'text.disabled',
          }}
        >
          {value.length.toLocaleString()}/{maxLength.toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};
