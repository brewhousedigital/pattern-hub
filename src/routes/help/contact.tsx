import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { DISCORD_SERVER_LINK } from '@/data/constants';

import { Box, Typography, TextField, Button, Alert, CircularProgress, Container, Link } from '@mui/material';

export const Route = createFileRoute('/help/contact')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Contact', '', match.pathname),
  }),
});

function RouteComponent() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [fields, setFields] = useState({ name: '', email: '', message: '' });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setFormState('loading');

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': 'contact', ...fields }),
      });
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
              bgcolor: '#5865f2',
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
                '&:hover': { borderColor: '#4752c4', bgcolor: '#f0f1ff' },
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

        {/* Hidden form for Netlify's build-time detection */}
        <form name="contact" data-netlify="true" hidden>
          <input type="text" name="name" />
          <input type="email" name="email" />
          <textarea name="message" />
        </form>

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
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {formState === 'error' && (
              <Alert severity="error" onClose={() => setFormState('idle')}>
                Something went wrong — please try again or reach out on Discord.
              </Alert>
            )}

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

            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={formState === 'loading'}
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

type FormState = 'idle' | 'loading' | 'success' | 'error';

function encode(data: Record<string, string>) {
  return Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}
