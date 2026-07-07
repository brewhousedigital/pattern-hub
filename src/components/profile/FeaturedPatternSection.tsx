import React from 'react';
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useQueryGetOwnPatternsForPicker } from '@/functions/database/patterns';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

type FeaturedPatternSectionProps = SectionCustProps & {
  userId: string;
};

// Lets an artist pick one of their own patterns to spotlight above "Contributed
// Patterns" on their profile, plus write their own markdown blurb about it -
// distinct from the pattern's admin-controlled description field.
export const FeaturedPatternSection = ({ customization, setCust, onReset, userId }: FeaturedPatternSectionProps) => {
  const { data: ownPatterns = [], isFetching } = useQueryGetOwnPatternsForPicker(userId);

  const selected = ownPatterns.find((p) => p.id === customization.featured_pattern_id) ?? null;

  return (
    <SectionCard elevation={0}>
      <SectionHeader title="Featured Pattern" onReset={onReset} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Spotlight one of your own patterns above "Contributed Patterns" on your profile.
      </Typography>

      <Autocomplete
        fullWidth
        size="small"
        loading={isFetching}
        options={ownPatterns}
        value={selected}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_, newValue) => setCust('featured_pattern_id', newValue?.id ?? '')}
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <Box
              component="li"
              key={key}
              {...rest}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '6px !important' }}
            >
              <Box
                component="img"
                src={generatePbImage(option)}
                alt=""
                sx={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 0.5, flexShrink: 0 }}
              />
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField {...params} label="Choose a pattern" placeholder="Search your patterns…" />
        )}
        sx={{ mb: selected ? 2 : 0 }}
      />

      {selected && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Box
            component="img"
            src={generatePbImage(selected)}
            alt=""
            sx={{
              width: 56,
              height: 56,
              objectFit: 'contain',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {selected.name}
          </Typography>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
            onClick={() => setCust('featured_pattern_id', '')}
          >
            Remove
          </Button>
        </Box>
      )}

      {selected && (
        <GenericMarkdownEditor
          label="Your notes about this pattern"
          content={customization.featured_pattern_note}
          setContent={(v) => setCust('featured_pattern_note', v)}
          characterLimit={2000}
          minRows={6}
          maxRows={16}
        />
      )}
    </SectionCard>
  );
};
