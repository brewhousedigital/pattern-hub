import React from 'react';
import { alpha, useTheme } from '@mui/material/styles';

import UploadFileIcon from '@mui/icons-material/UploadFile';

import { Avatar, Box, CircularProgress, Typography } from '@mui/material';

type SvgDropZoneProps = {
  /** MIME type(s) passed to the hidden <input accept="...">. E.g. ".svg,image/svg+xml" */
  accept: string;
  /** Short label shown beneath the icon. E.g. ".svg only" */
  acceptLabel?: string;
  /** Primary click-to-upload label. Defaults to "Click to upload or drag and drop". */
  label?: string;
  /** Called with the selected File. Validation (type check, etc.) is the caller's responsibility. */
  onFile: (file: File) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export const SvgDropZone = ({
  accept,
  acceptLabel,
  label = 'Click to upload or drag and drop',
  onFile,
  isLoading = false,
  disabled = false,
}: SvgDropZoneProps) => {
  const theme = useTheme();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onFile(file);
    // Reset so the same file can be re-selected immediately
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClick = () => {
    if (disabled || isLoading) return;
    inputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || isLoading) return;
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !isLoading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      sx={{
        border: '1.5px dashed',
        borderColor: dragOver ? 'primary.main' : alpha(theme.palette.primary.main, 0.35),
        borderRadius: 3,
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.15s, border-color 0.15s',
        bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        '&:hover': disabled || isLoading ? {} : { bgcolor: alpha(theme.palette.primary.main, 0.04) },
      }}
    >
      <Avatar
        sx={{
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main',
          width: 40,
          height: 40,
        }}
      >
        {isLoading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon sx={{ fontSize: 20 }} />}
      </Avatar>

      <Typography variant="body2" fontWeight={500} color={disabled ? 'text.disabled' : 'text.primary'}>
        {isLoading ? 'Uploading…' : label}
      </Typography>

      {acceptLabel && (
        <Typography variant="caption" color="text.disabled">
          {acceptLabel}
        </Typography>
      )}

      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => handleFile(e.target.files?.[0])} />
    </Box>
  );
};
