import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material';
import { DISCORD_SERVER_LINK } from '@/data/constants';
import { formatRetryCountdown } from '@/functions/utilities/rate-limit';

let shownThisSession = 0;

// How long the "Got it..." button stays disabled for when we don't know the real
// rate-limit window (a CORS error, or a 429 we couldn't parse a retry time from) -
// just a short pause before letting the user dismiss the dialog.
const FALLBACK_WAIT_SECONDS = { first: 5, repeat: 10 } as const;

interface RateLimitedDetail {
  /** Seconds until the server's rate limit clears, or null when unknown (e.g. a CORS error). */
  retryAfterSeconds: number | null;
}

export const RateLimitModal = () => {
  const [open, setOpen] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [dismissCountdown, setDismissCountdown] = useState<number>(FALLBACK_WAIT_SECONDS.first);
  // Real wait time the server reported, ticking down live once a second; stays
  // null when we don't have one, in which case the copy below falls back to
  // generic "a few seconds" / "a couple of minutes" wording.
  const [retrySecondsLeft, setRetrySecondsLeft] = useState<number | null>(null);
  const openRef = useRef(false);
  const retryClearsAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      if (openRef.current) return;
      shownThisSession += 1;
      const repeat = shownThisSession > 1;
      const retryAfterSeconds = (event as CustomEvent<RateLimitedDetail>).detail?.retryAfterSeconds;

      setIsRepeat(repeat);
      setDismissCountdown(repeat ? FALLBACK_WAIT_SECONDS.repeat : FALLBACK_WAIT_SECONDS.first);

      if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
        retryClearsAtRef.current = Date.now() + retryAfterSeconds * 1000;
        setRetrySecondsLeft(Math.round(retryAfterSeconds));
      } else {
        retryClearsAtRef.current = null;
        setRetrySecondsLeft(null);
      }

      setOpen(true);
      openRef.current = true;
    };
    window.addEventListener('app:rate-limited', handler);
    return () => window.removeEventListener('app:rate-limited', handler);
  }, []);

  // Single ticker drives both countdowns. The real one is recomputed from a fixed
  // clock-time target rather than just decremented, so it can't drift while the
  // tab is backgrounded/throttled - it just jumps to the correct value on resume.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      setDismissCountdown((n) => Math.max(0, n - 1));
      if (retryClearsAtRef.current !== null) {
        setRetrySecondsLeft(Math.max(0, Math.round((retryClearsAtRef.current - Date.now()) / 1000)));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [open]);

  function handleClose() {
    setOpen(false);
    openRef.current = false;
  }

  const retryKnown = retrySecondsLeft !== null;
  const dismissLabel = retryKnown ? "Got it, I'll wait" : "Got it, I'll give it another shot";

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0,0,0,0.4)',
          },
        },
        paper: { sx: { borderRadius: 4 } },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        {isRepeat ? (
          <>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
              Still catching up 🐢
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7, mb: 1 }}>
              {retryKnown
                ? 'The server is still working through a backlog. Sit tight until the timer below runs out, then give it another try.'
                : 'The server is still working through a backlog. Give it a couple of minutes before trying again, it just needs a moment to catch its breath.'}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
              If things aren't better after a few minutes, come find us in Discord and we'll help sort you out.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
              The server needs a breather 😮‍💨
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {retryKnown
                ? "We're getting more love than the server can handle right now. Sit tight until the timer below runs out, then it'll be ready to go."
                : "We're getting more love than the server can handle right now. Wait just a few seconds and try again, it'll bounce right back on its own."}
            </Typography>
          </>
        )}

        {retrySecondsLeft !== null && (
          <Box
            sx={{
              mt: 2,
              py: 1.5,
              px: 2,
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {retrySecondsLeft > 0 ? 'Try again in' : 'Ready when you are'}
            </Typography>
            {retrySecondsLeft > 0 && (
              <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatRetryCountdown(retrySecondsLeft)}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={dismissCountdown > 0}
            onClick={handleClose}
            sx={{ borderRadius: 2, py: 1.25 }}
          >
            {dismissCountdown > 0 ? `Hold on… ${dismissCountdown}s` : dismissLabel}
          </Button>

          {isRepeat && (
            <Button
              variant="outlined"
              fullWidth
              component="a"
              href={DISCORD_SERVER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: 2 }}
            >
              Get help in Discord →
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
