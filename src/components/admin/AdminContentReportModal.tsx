import React from 'react';
import {
  type TypeContentReportResponse,
  useMutationUpdateContentReport,
  useQueryGetContentReports,
  CONTENT_TYPE_META,
} from '@/functions/database/content-reports';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useAdminLogger } from '@/functions/database/admin-logs';

import CloseIcon from '@mui/icons-material/Close';

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Checkbox,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminContentReportModalProps = {
  open: boolean;
  onClose: () => void;
  report: TypeContentReportResponse | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminContentReportModal = (props: AdminContentReportModalProps) => {
  const [notes, setNotes] = React.useState(props?.report?.review_notes || '');
  const [isSpam, setIsSpam] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const { checkAccess } = useCheckAdminAccess();
  const canEdit = checkAccess(EnumLevelsAdmin.COMPLAINTS_AU);
  const { authData } = useGlobalAuthData();
  const { refetch } = useQueryGetContentReports();
  const updateReport = useMutationUpdateContentReport();
  const { log } = useAdminLogger();

  const typeMeta = CONTENT_TYPE_META[props.report?.content_type ?? ''] ?? {
    label: props.report?.content_type ?? 'Unknown',
    color: 'default' as const,
  };

  async function handleSubmit() {
    if (!props.report) return;

    if (!isSpam && notes.length < 6) {
      enqueueSnackbar('Write a bit more info for historical reference', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await updateReport.mutateAsync({
        id: props.report.id,
        reviewed: true,
        review_notes: notes,
        reviewed_by: authData?.id || '',
        spam: isSpam,
      });

      log({
        action: 'Content Report Reviewed',
        entity_type: 'Content Report',
        entity_id: props.report.id,
        entity_name: props.report.content_name || props.report.content_id,
        changes: {
          reviewed: { from: false, to: true },
          ...(isSpam ? { spam: { from: false, to: true } } : {}),
        },
        metadata: {
          content_type: props.report.content_type,
          category: props.report.category,
          reporter_email: props.report.email,
          review_notes: notes,
        },
      });

      await refetch();
      props.onClose();
      enqueueSnackbar('Updated', { variant: 'success' });
    } catch {
      enqueueSnackbar('Something went wrong updating this report… try again in a few minutes', { variant: 'error' });
    }

    setIsLoading(false);
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 500 }}>
          Review report
        </Typography>
        <IconButton onClick={props.onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Context block */}
        <Box sx={{ p: 1.5, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Box sx={{ mb: 0.75 }}>
            <Chip label={typeMeta.label} color={typeMeta.color} size="small" />
          </Box>

          <Typography sx={{ fontWeight: 500, fontSize: 14 }}>
            {props.report?.content_name || '-'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontFamily: 'monospace' }}>
            ID: {props.report?.content_id || '-'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Reporter: {props.report?.email}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Submitted: {props.report ? new Date(props.report.created).toLocaleDateString() : '-'}
          </Typography>

          {props.report?.expand?.owner_id?.id && (
            <>
              <Typography variant="body2" color="text.secondary">
                Authenticated User ID: {props.report.expand.owner_id.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Authenticated Username: {props.report.expand.owner_id.name}
              </Typography>
            </>
          )}
        </Box>

        {/* Category */}
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.75, fontWeight: 500 }}
          >
            Category
          </Typography>
          <Typography>{props.report?.category}</Typography>
        </Box>

        {/* Reason */}
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.75, fontWeight: 500 }}
          >
            Report / Complaint
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
            {props.report?.reason}
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
        <Button onClick={handleSubmit} variant="contained" color="success" loading={isLoading} disabled={!canEdit}>
          Mark as reviewed
        </Button>
      </DialogActions>
    </Dialog>
  );
};
