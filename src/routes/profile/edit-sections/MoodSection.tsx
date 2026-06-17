import React from 'react';
import { Grid, TextField } from '@mui/material';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

export const MoodSection = ({ customization, setCust, onReset }: SectionCustProps) => (
  <SectionCard elevation={0}>
    <SectionHeader title="Status" onReset={onReset} />
    <Grid container spacing={2}>
      <Grid size={{ xs: 3, sm: 2 }}>
        <TextField
          label="Emoji"
          variant="filled"
          fullWidth
          value={customization.profile_mood_emoji}
          onChange={(e) => setCust('profile_mood_emoji', e.target.value)}
          slotProps={{ htmlInput: { maxLength: 4 } }}
          helperText="emoji"
        />
      </Grid>
      <Grid size={{ xs: 9, sm: 10 }}>
        <TextField
          label="Status text"
          variant="filled"
          fullWidth
          placeholder="Working on a new piece…"
          value={customization.profile_mood_text}
          onChange={(e) => setCust('profile_mood_text', e.target.value.slice(0, 50))}
          slotProps={{ htmlInput: { maxLength: 50 } }}
          helperText={`${customization.profile_mood_text.length}/50`}
        />
      </Grid>
    </Grid>
  </SectionCard>
);
