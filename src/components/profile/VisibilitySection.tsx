import React from 'react';
import { FormControlLabel, Grid, Switch, Typography } from '@mui/material';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

const VISIBILITY_FIELDS = [
  { key: 'tab_show_favorites', label: 'Favorites' },
  { key: 'tab_show_done', label: 'Completed' },
  { key: 'tab_show_ratings', label: 'Ratings' },
  { key: 'tab_show_difficulty', label: 'Difficulty Votes' },
  { key: 'tab_show_gallery', label: 'Gallery' },
  { key: 'tab_show_collections', label: 'Collections' },
] as const;

export const VisibilitySection = ({ customization, setCust, onReset }: SectionCustProps) => (
  <SectionCard elevation={0}>
    <SectionHeader title="Section Visibility" onReset={onReset} />
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
      Toggle which activity tabs appear on your public profile.
    </Typography>
    <Grid container spacing={1.5}>
      {VISIBILITY_FIELDS.map(({ key, label }) => (
        <Grid key={key} size={{ xs: 12, sm: 6 }}>
          <FormControlLabel
            control={
              <Switch checked={customization[key]} onChange={(e) => setCust(key, e.target.checked)} size="small" />
            }
            label={<Typography variant="body2">{label}</Typography>}
            sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
          />
        </Grid>
      ))}
    </Grid>
  </SectionCard>
);
