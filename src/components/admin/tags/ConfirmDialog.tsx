import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import type { OperationType } from '@/functions/database/tags-admin/satellite-sync';

interface ConfirmDialogProps {
  open: boolean;
  type: OperationType;
  tag: string;
  newTag?: string;
  affectedCount: number;
  childTags?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const operationMeta: Record<OperationType, { color: 'error' | 'warning' | 'info'; verb: string }> = {
  delete: { color: 'error', verb: 'Delete' },
  rename: { color: 'warning', verb: 'Rename' },
  merge: { color: 'info', verb: 'Merge' },
};

export function ConfirmDialog({ open, type, tag, newTag, affectedCount, childTags, onConfirm, onCancel }: ConfirmDialogProps) {
  const meta = operationMeta[type];

  const description = {
    delete: (
      <>
        Remove <strong>"{tag}"</strong> from {affectedCount} pattern{affectedCount !== 1 ? 's' : ''}. This cannot be
        undone.
      </>
    ),
    rename: (
      <>
        Rename <strong>"{tag}"</strong> → <strong>"{newTag}"</strong>. {affectedCount} pattern
        {affectedCount !== 1 ? 's currently use' : ' currently uses'} this tag.
      </>
    ),
    merge: (
      <>
        Merge <strong>"{tag}"</strong> into <strong>"{newTag}"</strong> across {affectedCount} pattern
        {affectedCount !== 1 ? 's' : ''}. The old tag will be removed.
      </>
    ),
  }[type];

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color={meta.color} />
        Confirm {meta.verb}
      </DialogTitle>
      <DialogContent>
        <Alert severity={meta.color} sx={{ mb: childTags && childTags.length > 0 ? 1.5 : 0 }}>
          {description}
        </Alert>

        {childTags && childTags.length > 0 && (
          <Alert severity="warning" icon={<AccountTreeIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {childTags.length} child tag{childTags.length !== 1 ? 's' : ''} will become orphaned:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {childTags.map((t) => (
                <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
              ))}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color={meta.color} autoFocus>
          {meta.verb}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
