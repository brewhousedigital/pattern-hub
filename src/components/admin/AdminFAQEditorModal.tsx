import { useEffect, useState } from 'react';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import {
  useMutationCreateFAQ,
  useMutationUpdateFAQ,
  type TypeFAQItem,
  useQueryGetAllFAQ,
} from '@/functions/database/faq';

import CloseIcon from '@mui/icons-material/Close';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Divider,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';

type AdminFAQEditorModalProps = {
  open: boolean;
  onClose: () => void;
  faq: TypeFAQItem | null; // null = create mode
};

export const AdminFAQEditorModal = (props: AdminFAQEditorModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { refetch } = useQueryGetAllFAQ();

  const create = useMutationCreateFAQ();
  const update = useMutationUpdateFAQ();

  const isPending = create.isPending || update.isPending;
  const isEdit = props.faq !== null;

  useEffect(() => {
    if (props.open) {
      setTitle(props.faq?.title ?? '');
      setContent(props.faq?.content ?? '');
    }
  }, [props.open, props.faq]);

  async function handleSubmit() {
    if (!title.trim()) return;

    try {
      if (isEdit) {
        await update.mutateAsync({ id: props.faq?.id, title, content });
      } else {
        await create.mutateAsync({ title, content });
      }

      await refetch();

      props.onClose();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'An error occurred while saving the FAQ.', { variant: 'error' });
      return;
    }
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xl">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight={500}>
          {isEdit ? 'Edit FAQ' : 'New FAQ'}
        </Typography>

        <IconButton onClick={props.onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField
          label="Title"
          variant="filled"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          size="small"
          required
        />

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
            Content — Markdown supported
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              //gap: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              //overflow: 'hidden',
            }}
          >
            {/* Editor pane */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                position: 'sticky',
                top: -16,
                maxHeight: '100vh',
                overflowY: 'auto',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'grey.50',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  color: 'text.secondary',
                }}
              >
                Markdown
              </Typography>

              <TextField
                multiline
                value={content}
                onChange={(e) => setContent(e.target.value)}
                minRows={12}
                maxRows={20}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #eee' }}>
              <Typography
                variant="caption"
                sx={{
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'grey.50',
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
                    bgcolor: 'grey.100',
                    px: 0.5,
                    borderRadius: 0.5,
                    fontSize: '0.9em',
                  },
                  '& pre': {
                    bgcolor: 'grey.100',
                    p: 1.5,
                    borderRadius: 1,
                    overflowX: 'auto',
                    '& code': { bgcolor: 'transparent', p: 0 },
                  },
                  '& a': { color: 'success.dark' },
                  '& table': { width: '100%', borderCollapse: 'collapse' },
                  '& th,td': { border: '1px solid', borderColor: 'divider', p: 0.75, fontSize: 13 },
                  '& th': { bgcolor: 'grey.50', fontWeight: 500 },
                }}
              >
                {content.trim() ? (
                  <MarkdownWrapper>{content}</MarkdownWrapper>
                ) : (
                  <Typography variant="body2" color="text.disabled" fontStyle="italic">
                    Preview will appear here…
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit" disabled={isPending}>
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          variant="contained"
          color="success"
          disabled={isPending || !title.trim()}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {isEdit ? 'Save changes' : 'Create FAQ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
