import React from 'react';
import type { TypeViewData } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import { Turnstile } from '@marsidev/react-turnstile';
import { enqueueSnackbar } from 'notistack';

import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';

import { Alert, Box, Button, Collapse, MenuItem, Stack, TextField } from '@mui/material';

const COOLDOWN_KEY = 'report_last_submit';
const COOLDOWN_MS = 30 * 1000; // 30 seconds

export const PatternReportIssue = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState('');

  // Track when the form is opened for the timing guard
  const formOpenTime = React.useRef<number>(0);
  React.useEffect(() => {
    if (isOpen) formOpenTime.current = Date.now();
  }, [isOpen]);

  // Check cooldown on mount — memoised so it only reads localStorage once
  const isInCooldown = React.useMemo(() => {
    const last = localStorage.getItem(COOLDOWN_KEY);
    return !!(last && Date.now() - parseInt(last) < COOLDOWN_MS);
  }, []);

  React.useEffect(() => {
    if (authData?.email) {
      setEmail(authData.email);
    }
  }, [authData]);

  React.useEffect(() => {
    setIsOpen(false);
    setIsDone(false);
  }, [viewData]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (reason.length < 25) {
      enqueueSnackbar('Please make your report more descriptive.', { variant: 'warning' });
      return;
    }

    // Client-side bot guards (silent fails — don't reveal guard logic)
    if (honeypot) return;
    const elapsed = Date.now() - formOpenTime.current;
    if (elapsed < 2000) return;

    if (!turnstileToken) {
      enqueueSnackbar('Security check not complete yet — wait a moment and try again.', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/submit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_id: viewData?.id || '',
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
      setIsOpen(false);
      setIsDone(true);

      setTimeout(() => {
        setReason('');
        setCategory('');
      }, 1000);
    } catch {
      enqueueSnackbar("Couldn't submit your report right now. Try again in a few minutes.", { variant: 'error' });
    }

    setIsLoading(false);
  };

  return (
    <>
      <Collapse in={!isDone && !isInCooldown}>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ReportProblemOutlinedIcon fontSize="small" />}
            size="small"
            onClick={() => setIsOpen(true)}
            color="warning"
          >
            Report an issue
          </Button>
        </Box>
      </Collapse>

      <Collapse in={isOpen}>
        <Stack onSubmit={handleSubmit} gap={2} component="form">
          {/* Honeypot — invisible to humans, traps bots that fill every field */}
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
            label="Contact Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            select
            variant="filled"
            size="small"
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <MenuItem value="broken file">Broken File</MenuItem>
            <MenuItem value="incorrect size">Incorrect Size</MenuItem>
            <MenuItem value="duplicate upload">Duplicate Upload</MenuItem>
            <MenuItem value="Broken Link">Broken Link</MenuItem>
          </TextField>

          <TextField
            multiline
            size="small"
            variant="filled"
            label="Reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <Turnstile
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setTurnstileToken(token)}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
          />

          <Box>
            <Button variant="outlined" type="submit" loading={isLoading} disabled={!turnstileToken}>
              Submit
            </Button>
          </Box>
        </Stack>
      </Collapse>

      <Collapse in={isDone}>
        <Alert severity="info">
          Your issue has been logged. <br />
          We will review it as quickly as possible.
        </Alert>
      </Collapse>
    </>
  );
};
