import React from 'react';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';

import { TextField, Box, Typography } from '@mui/material';

type GenericMarkdownEditorProps = {
  content: string;
  setContent: (val: string) => void;
  characterLimit?: number;
};

export const GenericMarkdownEditor = (props: GenericMarkdownEditorProps) => {
  const maxCharacterLimit = props.characterLimit ? props.characterLimit : 5000;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
        Content —{' '}
        <a href="https://www.markdownguide.org/cheat-sheet/" target="_blank">
          Markdown supported
        </a>
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        {/* Editor pane */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: -16,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              py: 0.75,
              backgroundColor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              color: 'text.secondary',
            }}
          >
            Markdown
          </Typography>

          <TextField
            multiline
            value={props.content}
            onChange={(e) => props.setContent(e.target.value)}
            minRows={12}
            maxRows={35}
            variant="outlined"
            slotProps={{
              input: {
                sx: {
                  fontFamily: 'monospace',
                  fontSize: 13,
                  alignItems: 'flex-start',
                  border: 'none',
                  borderRadius: 0,
                  '& fieldset': { border: 'none' },
                },
              },
            }}
            sx={{ flex: 1 }}
          />
        </Box>

        {/* Preview pane */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderLeft: '1px solid #eee',
            maxHeight: '70vh',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              py: 0.75,
              backgroundColor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              color: 'text.secondary',
            }}
          >
            Preview
          </Typography>

          <Box
            sx={{
              flex: 1,
              p: 1.5,
              overflowY: 'auto',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'text.primary',
              '& h1,h2,h3,h4': { fontWeight: 500, mt: 1.5, mb: 0.5 },
              '& h1': { fontSize: '1.25em' },
              '& h2': { fontSize: '1.1em' },
              '& ul,ol': { pl: 2.5 },
              '& blockquote': {
                borderLeft: '3px solid',
                borderColor: 'success.light',
                pl: 1.5,
                my: 1,
                color: 'text.secondary',
                fontStyle: 'italic',
              },
              '& code': {
                fontFamily: 'monospace',
                backgroundColor: 'grey.100',
                px: 0.5,
                borderRadius: 0.5,
                fontSize: '0.9em',
              },
              '& pre': {
                backgroundColor: 'grey.100',
                p: 1.5,
                borderRadius: 1,
                overflowX: 'auto',
                '& code': { backgroundColor: 'transparent', p: 0 },
              },
              '& a': { color: 'success.dark' },
              '& table': { width: '100%', borderCollapse: 'collapse' },
              '& th,td': { border: '1px solid', borderColor: 'divider', p: 0.75, fontSize: 13 },
              '& th': { backgroundColor: 'grey.50', fontWeight: 500 },
            }}
          >
            {props.content.trim() ? (
              <MarkdownWrapper>{props.content}</MarkdownWrapper>
            ) : (
              <Typography variant="body2" color="text.disabled" fontStyle="italic">
                Preview will appear here…
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Typography variant="caption">
        {props?.content?.length || 0}/{maxCharacterLimit} characters
      </Typography>
    </Box>
  );
};
