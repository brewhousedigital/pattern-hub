import React from 'react';
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
import { useAdminLogger } from '@/functions/database/admin-logs';

type AdminFAQEditorModalProps = {
  open: boolean;
  onClose: () => void;
  faq: TypeFAQItem | null; // null = create mode
};

export const AdminFAQEditorModal = (props: AdminFAQEditorModalProps) => {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');

  const { refetch } = useQueryGetAllFAQ();

  const create = useMutationCreateFAQ();
  const update = useMutationUpdateFAQ();
  const { log } = useAdminLogger();

  const isPending = create.isPending || update.isPending;
  const isEdit = props.faq !== null;

  React.useEffect(() => {
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
        log({
          action: 'FAQ Updated',
          entity_type: 'FAQ',
          entity_id: props.faq?.id ?? '',
          entity_name: title,
          changes: {
            title: { from: props.faq?.title ?? '', to: title },
            content: { from: props.faq?.content ?? '', to: content },
          },
          metadata: {},
        });
      } else {
        const created = await create.mutateAsync({ title, content });
        log({
          action: 'FAQ Created',
          entity_type: 'FAQ',
          entity_id: (created as any)?.id ?? '',
          entity_name: title,
          changes: {},
          metadata: {},
        });
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
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
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
