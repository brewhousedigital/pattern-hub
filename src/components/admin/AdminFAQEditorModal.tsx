import { useEffect, useState } from 'react';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import {
  useMutationCreateFAQ,
  useMutationUpdateFAQ,
  type TypeFAQItem,
  useQueryGetAllFAQ,
} from '@/functions/database/faq';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';

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

        <GenericMarkdownEditor content={content} setContent={setContent} />
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
