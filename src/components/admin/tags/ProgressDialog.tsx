import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';

interface ProgressDialogProps {
  open: boolean;
  title: string;
  completed: number;
  total: number;
  done: boolean;
  error?: string;
  onClose: () => void;
  /**
   * Overrides the default "{completed} record(s) updated" success text. A
   * rename no longer touches any pattern record at all, so "0 records
   * updated" would read as if nothing happened rather than as the
   * (correct, and now much faster) outcome it actually is.
   */
  successMessage?: string;
}

export function ProgressDialog({ open, title, completed, total, done, error, onClose, successMessage }: ProgressDialogProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : done ? (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
            {successMessage ?? `Operation complete - ${completed} record${completed !== 1 ? 's' : ''} updated.`}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Processing {completed} of {total} records…
            </Typography>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {pct}% - records are sent one after the other to avoid overloading the server
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!done && !error}>
          {done || error ? 'Close' : 'Running…'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
