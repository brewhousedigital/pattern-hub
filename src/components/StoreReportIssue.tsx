import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { Turnstile } from '@marsidev/react-turnstile';
import { enqueueSnackbar } from 'notistack';
import type { TypeStoreLocation } from '@/functions/database/stores';

import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Constants ────────────────────────────────────────────────────────────────

const COOLDOWN_KEY = 'store_report_last_submit';
const COOLDOWN_MS = 30 * 1000; // 30 seconds

const STORE_CATEGORIES = [
  { value: 'store closed', label: 'Store Closed' },
  { value: 'store moved', label: 'Store Moved / Relocated' },
  { value: 'changed services', label: 'Changed Services Offered' },
  { value: 'changed name', label: 'Changed Name / Rebranded' },
  { value: 'incorrect info', label: 'Incorrect Contact Info' },
  { value: 'duplicate listing', label: 'Duplicate Listing' },
  { value: 'other', label: 'Other' },
];

// ─── Component ────────────────────────────────────────────────────────────────

type StoreReportIssueProps = {
  store: TypeStoreLocation;
};

export const StoreReportIssue = ({ store }: StoreReportIssueProps) => {
  const { authData } = useGlobalAuthData();

  const [isOpen, setIsOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState('');

  const formOpenTime = React.useRef<number>(0);

  React.useEffect(() => {
    if (isOpen) formOpenTime.current = Date.now();
  }, [isOpen]);

  const isInCooldown = React.useMemo(() => {
    const last = localStorage.getItem(COOLDOWN_KEY);
    return !!(last && Date.now() - parseInt(last) < COOLDOWN_MS);
  }, []);

  React.useEffect(() => {
    if (authData?.email) setEmail(authData.email);
  }, [authData]);

  const handleOpen = () => {
    if (isInCooldown) {
      enqueueSnackbar('You recently submitted a report - please wait a moment before submitting another.', {
        variant: 'warning',
      });
      return;
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setReason('');
    setCategory('');
    setTurnstileToken(null);
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (reason.length < 25) {
      enqueueSnackbar('Please be more descriptive - at least 25 characters.', { variant: 'warning' });
      return;
    }

    // Client-side bot guards (silent fails - don't reveal guard logic)
    if (honeypot) return;
    const elapsed = Date.now() - formOpenTime.current;
    if (elapsed < 2000) return;

    if (!turnstileToken) {
      enqueueSnackbar('Security check not complete yet - wait a moment and try again.', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/submit-content-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: 'store',
          content_id: store.id,
          content_name: store.name,
          owner_id: authData?.id || '',
          email,
          reason,
          category,
          token: turnstileToken,
          hp: honeypot,
          ts: formOpenTime.current,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      handleClose();
      enqueueSnackbar('Thanks for the heads-up - our team will review this shortly.', { variant: 'success' });
    } catch {
      enqueueSnackbar("Couldn't submit your report right now. Try again in a few minutes.", { variant: 'error' });
    }

    setIsLoading(false);
  };

  return (
    <>
      <Tooltip title="Report an issue with this listing" placement="top">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{ color: 'text.disabled', '&:hover': { color: 'warning.main' }, p: 0.25 }}
        >
          <FlagOutlinedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      <Dialog open={isOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1, pr: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              Report Store Issue
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {store.name}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ mt: 0.25 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack component="form" id="store-report-form" onSubmit={handleSubmit} spacing={2} sx={{ pt: 0.5 }}>
            {/* Honeypot - invisible to humans, traps bots that fill every field */}
            <input
              aria-hidden="true"
              tabIndex={-1}
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <TextField
              variant="filled"
              size="small"
              type="email"
              label="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />

            <TextField
              select
              variant="filled"
              size="small"
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              fullWidth
            >
              {STORE_CATEGORIES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              multiline
              size="small"
              variant="filled"
              label="Details"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              fullWidth
              helperText={reason.length < 25 ? `${reason.length} / 25 characters minimum` : undefined}
            />

            <Turnstile
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            form="store-report-form"
            variant="contained"
            color="warning"
            loading={isLoading}
            disabled={!turnstileToken}
          >
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
