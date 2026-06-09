import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { DISCORD_SERVER_LINK } from '@/data/constants';
import { useGlobalAuthData } from '@/data/auth-data';
import { Turnstile } from '@marsidev/react-turnstile';
import { enqueueSnackbar } from 'notistack';

import { Box, Typography, TextField, Button, Alert, CircularProgress, Container, Link } from '@mui/material';

export const Route = createFileRoute('/help/contact')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Contact', '', match.pathname),
  }),
});

const COOLDOWN_KEY = 'contact_last_submit';
const COOLDOWN_MS = 60 * 1000; // 1 minute

function RouteComponent() {
  const [formState, setFormState] = useState<FormState>(() => {
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (last && Date.now() - parseInt(last) < COOLDOWN_MS) return 'cooldown';
    return 'idle';
  });

  const [fields, setFields] = useState({ name: '', email: '', message: '' });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const formOpenTime = React.useRef(Date.now());

  const { authData } = useGlobalAuthData();

  React.useEffect(() => {
    if (authData?.email) {
      setFields((prev) => ({ ...prev, email: authData.email || '' }));
    }
  }, [authData]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();

    // Client-side bot guards (silent fails)
    if (honeypot) return;
    const elapsed = Date.now() - formOpenTime.current;
    if (elapsed < 2000) return;

    if (!turnstileToken) {
      enqueueSnackbar('Security check not complete yet — wait a moment and try again.', { variant: 'warning' });
      return;
    }

    setFormState('loading');

    try {
      const res = await fetch('/api/submit-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          token: turnstileToken,
          hp: honeypot,
          ts: formOpenTime.current,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setFormState('success');
      setFields({ name: '', email: '', message: '' });
    } catch {
      setFormState('error');
    }
  }

  return (
    <GeneralLayout>
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 3,
            mb: 5,
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              backgroundColor: '#5865f2',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="26" height="20" viewBox="0 0 26 20" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.003 1.67A21.48 21.48 0 0 0 16.67.002a.08.08 0 0 0-.084.04c-.23.41-.485.944-.664 1.365a19.84 19.84 0 0 0-5.843 0A13.84 13.84 0 0 0 9.41.043.083.083 0 0 0 9.326 0 21.436 21.436 0 0 0 3.99 1.67a.075.075 0 0 0-.035.03C.578 6.343-.346 10.9.108 15.394a.087.087 0 0 0 .033.059 21.59 21.59 0 0 0 6.467 3.243.084.084 0 0 0 .091-.03c.498-.675.942-1.387 1.322-2.134a.081.081 0 0 0-.044-.113 14.21 14.21 0 0 1-2.024-.956.082.082 0 0 1-.008-.137c.136-.101.272-.206.402-.312a.08.08 0 0 1 .083-.011c4.247 1.927 8.845 1.927 13.043 0a.08.08 0 0 1 .084.01c.13.106.266.212.403.313a.082.082 0 0 1-.007.137c-.647.374-1.32.692-2.025.955a.082.082 0 0 0-.043.114c.387.746.83 1.458 1.32 2.133a.082.082 0 0 0 .09.03 21.546 21.546 0 0 0 6.476-3.243.083.083 0 0 0 .033-.057c.54-5.517-.902-10.033-3.82-14.174a.065.065 0 0 0-.034-.03ZM8.68 12.647c-1.26 0-2.3-1.149-2.3-2.56 0-1.41.02-2.56 2.3-2.56 1.26 0 2.3 1.148 2.3 2.56 0 1.411-1.04 2.56-2.3 2.56Zm8.502 0c-1.26 0-2.3-1.149-2.3-2.56 0-1.41.02-2.56 2.3-2.56 1.261 0 2.3 1.148 2.3 2.56 0 1.411-1.03 2.56-2.3 2.56Z" />
            </svg>
          </Box>

          <Box sx={{ maxWidth: 365 }}>
            <Typography fontWeight={500} fontSize={15} gutterBottom>
              Join our Discord community
            </Typography>

            <Typography variant="body2" color="text.secondary" mb={1}>
              Get help from other members, share your patterns, and stay up to date.
            </Typography>

            <Button
              href={DISCORD_SERVER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              component={Link}
              size="small"
              variant="outlined"
              sx={{
                borderColor: '#5865f2',
                color: '#5865f2',
                '&:hover': { borderColor: '#4752c4', backgroundColor: '#f0f1ff' },
              }}
            >
              Join the server
            </Button>
          </Box>
        </Box>

        <Typography variant="h5" fontWeight={500} gutterBottom>
          Contact us
        </Typography>

        <Typography variant="body2" color="text.secondary" mb={4}>
          Have a question or feedback? Fill out the form below and we'll get back to you.
        </Typography>

        {formState === 'success' ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography fontSize={40} mb={2}>
              ✓
            </Typography>
            <Typography variant="h6" fontWeight={500} gutterBottom>
              Message sent
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Thanks for reaching out — we'll get back to you soon.
            </Typography>
            <Button variant="outlined" color="success" onClick={() => setFormState('idle')}>
              Send another message
            </Button>
          </Box>
        ) : formState === 'cooldown' ? (
          <Alert severity="info">
            You've already sent a message recently. Please wait a few minutes before sending another.
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {formState === 'error' && (
              <Alert severity="error" onClose={() => setFormState('idle')}>
                Something went wrong — please try again or reach out on Discord.
              </Alert>
            )}

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
              label="Name"
              name="name"
              variant="filled"
              value={fields.name}
              onChange={handleChange}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              variant="filled"
              value={fields.email}
              onChange={handleChange}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Message"
              name="message"
              variant="filled"
              value={fields.message}
              onChange={handleChange}
              required
              fullWidth
              multiline
              minRows={5}
              size="small"
            />

            <Turnstile
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
            />

            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={formState === 'loading' || !turnstileToken}
              startIcon={formState === 'loading' ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ alignSelf: 'flex-start', px: 4 }}
            >
              {formState === 'loading' ? 'Sending…' : 'Send message'}
            </Button>
          </Box>
        )}
      </Container>
    </GeneralLayout>
  );
}

type FormState = 'idle' | 'loading' | 'success' | 'error' | 'cooldown';
