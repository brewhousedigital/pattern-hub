import React from 'react';
import {
  type TypeContactResponse,
  useMutationUpdateContactSubmission,
  useQueryGetPendingContactSubmissions,
} from '@/functions/database/contact';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';

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
  IconButton,
} from '@mui/material';

type AdminContactModalProps = {
  open: boolean;
  onClose: () => void;
  submission: TypeContactResponse | null;
  key: React.Key;
};

export const AdminContactModal = (props: AdminContactModalProps) => {
  const [notes, setNotes] = React.useState(props?.submission?.review_notes || '');
  const [isLoading, setIsLoading] = React.useState(false);

  const { checkAccess } = useCheckAdminAccess();
  const canEdit = checkAccess(EnumLevelsAdmin.CONTACT_AU);

  const { authData } = useGlobalAuthData();

  const { refetch } = useQueryGetPendingContactSubmissions();
  const updateSubmission = useMutationUpdateContactSubmission();

  async function handleSubmit() {
    if (!props.submission) return;

    if (notes.length < 6) {
      enqueueSnackbar('Write a brief note for historical reference', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await updateSubmission.mutateAsync({
        id: props.submission.id,
        reviewed: true,
        review_notes: notes,
        reviewed_by: authData?.id || '',
      });

      await refetch();

      props.onClose();

      enqueueSnackbar('Marked as reviewed', { variant: 'success' });
    } catch {
      enqueueSnackbar('Something went wrong - try again in a few minutes', { variant: 'error' });
    }

    setIsLoading(false);
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 500 }}>
          Review submission
        </Typography>

        <IconButton onClick={props.onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Sender info */}
        <Box sx={{ p: 1.5, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography sx={{ fontWeight: 500, fontSize: 14 }}>
            {props.submission?.name ?? '-'}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {props.submission?.email}
          </Typography>

          <Typography variant="body2" color="text.disabled">
            Submitted: {props.submission ? new Date(props.submission.created).toLocaleDateString() : '-'}
          </Typography>
        </Box>

        {/* Message */}
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.75, fontWeight: 500 }}
          >
            Message
          </Typography>

          <Box
            sx={{
              borderLeft: '3px solid',
              borderColor: 'primary.light',
              pl: 1.5,
              py: 0.5,
              fontSize: 13,
              color: 'text.secondary',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {props.submission?.message}
          </Box>
        </Box>

        <TextField
          variant="filled"
          label="Review notes"
          multiline
          minRows={3}
          maxRows={8}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          size="small"
          placeholder="Document your response or any action taken…"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit">
          Cancel
        </Button>

        <Button onClick={handleSubmit} variant="contained" color="success" loading={isLoading} disabled={!canEdit}>
          Mark as reviewed
        </Button>
      </DialogActions>
    </Dialog>
  );
};
