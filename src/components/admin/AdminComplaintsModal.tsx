import React from 'react';
import {
  type TypeComplaintsResponse,
  useMutationUpdateComplaint,
  useQueryGetComplaints,
} from '@/functions/database/complaints';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';

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
  FormGroup,
  Checkbox,
  FormControlLabel,
} from '@mui/material';

type AdminComplaintsModalProps = {
  open: boolean;
  onClose: () => void;
  complaint: TypeComplaintsResponse | null;
  key: React.Key;
};

export const AdminComplaintsModal = (props: AdminComplaintsModalProps) => {
  const [notes, setNotes] = React.useState('');
  const [isSpam, setIsSpam] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const { authData } = useGlobalAuthData();

  const { refetch } = useQueryGetComplaints();

  const updateComplaint = useMutationUpdateComplaint();

  const pattern = props.complaint?.expand?.pattern_id;
  const thumbUrl = generatePbImage(pattern);

  async function handleSubmit() {
    if (!props.complaint) return;

    if (!isSpam && notes.length < 6) {
      enqueueSnackbar('Write a bit more info for historical reference', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await updateComplaint.mutateAsync({
        id: props.complaint.id,
        reviewed: true,
        review_notes: notes,
        reviewed_by: authData?.id || '',
        spam: isSpam,
      });

      await refetch();

      props.onClose();

      enqueueSnackbar('Updated', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar('Something went wrong updating this issue... try again in a few minutes', { variant: 'error' });
    }

    setIsLoading(false);
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight={500}>
          Review complaint
        </Typography>

        <IconButton onClick={props.onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Box
            component={thumbUrl ? 'img' : 'div'}
            src={thumbUrl ?? undefined}
            sx={{
              width: 52,
              height: 52,
              borderRadius: 1,
              flexShrink: 0,
              backgroundColor: 'success.50',
              border: '1px solid',
              borderColor: 'divider',
              objectFit: 'cover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />

          <Box>
            <Typography fontWeight={500} fontSize={14}>
              {pattern?.name ?? props.complaint?.pattern_id}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
              Reporter: {props.complaint?.email}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              Submitted: {props.complaint ? new Date(props.complaint.created).toLocaleDateString() : '—'}
            </Typography>
          </Box>
        </Box>

        {/* Reason */}
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={500}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.75 }}
          >
            Complaint reason
          </Typography>

          <Box
            sx={{
              borderLeft: '3px solid',
              borderColor: 'error.light',
              pl: 1.5,
              py: 0.5,
              fontSize: 13,
              color: 'text.secondary',
              lineHeight: 1.7,
            }}
          >
            {props.complaint?.reason}
          </Box>
        </Box>

        <FormGroup>
          <FormControlLabel
            control={<Checkbox value={isSpam} onChange={(e) => setIsSpam(e.target.checked)} />}
            label="Spam?"
          />
        </FormGroup>

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
          placeholder="Document what you found and any steps taken…"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit">
          Cancel
        </Button>

        <Button onClick={handleSubmit} variant="contained" color="success" loading={isLoading}>
          Mark as reviewed
        </Button>
      </DialogActions>
    </Dialog>
  );
};
