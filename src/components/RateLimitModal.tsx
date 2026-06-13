import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material';
import { DISCORD_SERVER_LINK } from '@/data/constants';

let shownThisSession = 0;

export const RateLimitModal = () => {
  const [open, setOpen] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const openRef = useRef(false);

  useEffect(() => {
    const handler = () => {
      if (openRef.current) return;
      shownThisSession += 1;
      const repeat = shownThisSession > 1;
      setIsRepeat(repeat);
      setCountdown(repeat ? 10 : 5);
      setOpen(true);
      openRef.current = true;
    };
    window.addEventListener('app:rate-limited', handler);
    return () => window.removeEventListener('app:rate-limited', handler);
  }, []);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [open, countdown]);

  function handleClose() {
    setOpen(false);
    openRef.current = false;
  }

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0,0,0,0.4)',
          },
        },
      }}
      PaperProps={{ sx: { borderRadius: 4 } }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        {isRepeat ? (
          <>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Still catching up 🐢
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7, mb: 1 }}>
              The server is still working through a backlog. Give it a couple of minutes before trying again, it just
              needs a moment to catch its breath.
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
              If things aren't better after a few minutes, come find us in Discord and we'll help sort you out.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              The server needs a breather 😮‍💨
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
              We're getting more love than the server can handle right now. Wait just a few seconds and try again, it'll
              bounce right back on its own.
            </Typography>
          </>
        )}

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={countdown > 0}
            onClick={handleClose}
            sx={{ borderRadius: 2, py: 1.25 }}
          >
            {countdown > 0 ? `Hold on… ${countdown}s` : "Got it, I'll give it another shot"}
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
