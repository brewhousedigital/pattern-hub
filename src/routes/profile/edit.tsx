import React, { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { PRIMARY_COLOR, SECONDARY_COLOR } from '@/data/constants';
import { useMutationAuthGetUser, useMutationAuthUpdateUser } from '@/functions/database/authentication';
import { enqueueSnackbar } from 'notistack';

import { styled, alpha } from '@mui/material/styles';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';

import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment,
  Skeleton,
} from '@mui/material';

export const Route = createFileRoute('/profile/edit')({
  component: RouteComponent,
});

function RouteComponent() {
  const { authData, setAuthData } = useGlobalAuthData();

  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileFormData>({
    username: '',
    about: '',
    interests: '',
    site_color: '',
    site_color_secondary: '',
  });

  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const getUserData = useMutationAuthGetUser();
  const updateUserData = useMutationAuthUpdateUser();

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);

      try {
        setForm({
          username: authData?.name || '',
          about: authData?.about || '',
          interests: authData?.interests || '',
          site_color: authData?.site_color || PRIMARY_COLOR,
          site_color_secondary: authData?.site_color_secondary || SECONDARY_COLOR,
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile().then();
  }, [authData]);

  const handleChange =
    (field: keyof ProfileFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = e.target.value;

      // Auto-prepend # for hex fields
      if ((field === 'site_color' || field === 'site_color_secondary') && value && !value.startsWith('#')) {
        value = `#${value}`;
      }

      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSaveError(null);

    setSaving(true);

    try {
      await updateUserData.mutateAsync({
        id: authData?.id || '',
        name: form.username.trim(),
        about: form.about.trim(),
        interests: form.interests,
        site_color: form.site_color,
        site_color_secondary: form.site_color_secondary,
      });

      const userData = await getUserData.mutateAsync({ userId: authData?.id || '' });
      setAuthData(userData);

      enqueueSnackbar('Successfully updated your profile!', { variant: 'success' });

      navigate({ to: '/profile' }).then();
    } catch {
      setSaveError('Failed to save changes. Please try again.');
      enqueueSnackbar('Something went wrong trying to save your profile. Try again in a few minutes.', {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const interestChips = parseInterests(form.interests);
  const primaryValid = isValidHex(form.site_color);
  const secondaryValid = isValidHex(form.site_color_secondary);

  return (
    <PageWrapper>
      <Container maxWidth="sm">
        {/* Header */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
            Edit Profile
          </Typography>
        </Box>

        {loading ? (
          <EditProfileSkeleton />
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            {/* ── Username ── */}
            <SectionCard elevation={0}>
              <SectionLabel>
                <PersonOutlinedIcon />
                <Typography variant="overline" fontWeight={700} letterSpacing={1}>
                  Username
                </Typography>
              </SectionLabel>

              <StyledTextField
                fullWidth
                value={form.username}
                onChange={handleChange('username')}
                error={!!errors.username}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography variant="caption" color="text.disabled">
                          {form.username.length}/32
                        </Typography>
                      </InputAdornment>
                    ),
                  },
                  htmlInput: {
                    maxLength: 32,
                  },
                }}
              />
            </SectionCard>

            {/* ── About ── */}
            <SectionCard elevation={0}>
              <SectionLabel>
                <NotesOutlinedIcon />
                <Typography variant="overline" fontWeight={700} letterSpacing={1}>
                  About
                </Typography>
              </SectionLabel>

              <StyledTextField
                fullWidth
                multiline
                minRows={4}
                maxRows={8}
                placeholder="Tell the community a little about yourself and your stained glass journey..."
                value={form.about}
                onChange={handleChange('about')}
                error={!!errors.about}
                helperText={
                  errors.about ?? (
                    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Optional. Shown on your public profile.</span>
                      <span style={{ color: form.about.length > 999 ? 'orange' : 'inherit' }}>
                        {form.about.length}/1000
                      </span>
                    </Box>
                  )
                }
                slotProps={{
                  htmlInput: {
                    maxLength: 1000,
                  },
                }}
              />
            </SectionCard>

            {/* ── Interests ── */}
            <SectionCard elevation={0}>
              <SectionLabel>
                <TagOutlinedIcon />

                <Typography variant="overline" fontWeight={700} letterSpacing={1}>
                  Interests
                </Typography>
              </SectionLabel>

              <StyledTextField
                fullWidth
                placeholder="Geometric, Floral, Art Nouveau, Mosaics..."
                value={form.interests}
                onChange={handleChange('interests')}
                error={!!errors.interests}
                helperText={errors.interests ?? 'Comma-separated list. Each entry becomes a chip on your profile.'}
                slotProps={{
                  htmlInput: {
                    maxLength: 1000,
                  },
                }}
              />

              {interestChips.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                  {interestChips.map((chip, index) => (
                    <Chip
                      key={chip + index}
                      label={chip}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{ borderRadius: '8px', fontWeight: 500 }}
                    />
                  ))}
                </Box>
              )}
            </SectionCard>

            {/* ── Colors ── */}
            {/*<SectionCard elevation={0}>
              <SectionLabel>
                <PaletteOutlinedIcon />
                <Typography variant="overline" fontWeight={700} letterSpacing={1}>
                  Site Colors
                </Typography>
              </SectionLabel>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7 }}>
                Personalize your profile with custom accent colors. Use valid hex codes like{' '}
                <code style={{ fontSize: '0.8em' }}>#1A2B3C</code>.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                 Primary color
                <StyledTextField
                  fullWidth
                  type="color"
                  label="Primary color"
                  placeholder="#1976D2"
                  value={form.site_color}
                  onChange={handleChange('site_color')}
                  error={!!errors.site_color}
                  helperText={errors.site_color}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <ColorPreviewSwatch hexcolor={form.site_color} valid={primaryValid} />
                        </InputAdornment>
                      ),
                    },
                    htmlInput: {
                      maxLength: 7,
                      spellCheck: false,
                    },
                  }}
                />

                 Secondary color
                <StyledTextField
                  fullWidth
                  type="color"
                  label="Secondary color"
                  placeholder="#9C27B0"
                  value={form.site_color_secondary}
                  onChange={handleChange('site_color_secondary')}
                  error={!!errors.site_color_secondary}
                  helperText={errors.site_color_secondary}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <ColorPreviewSwatch hexcolor={form.site_color_secondary} valid={secondaryValid} />
                        </InputAdornment>
                      ),
                    },
                    htmlInput: {
                      maxLength: 7,
                      spellCheck: false,
                    },
                  }}
                />

                 Live preview
                {(primaryValid || secondaryValid) && (
                  <Box
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        height: 10,
                        background:
                          primaryValid && secondaryValid
                            ? `linear-gradient(90deg, ${form.site_color} 0%, ${form.site_color_secondary} 100%)`
                            : primaryValid
                              ? form.site_color
                              : form.site_color_secondary,
                      }}
                    />
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {primaryValid && (
                        <Chip
                          label="Primary"
                          size="small"
                          sx={{
                            backgroundColor: form.site_color,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            border: 'none',
                          }}
                        />
                      )}
                      {secondaryValid && (
                        <Chip
                          label="Secondary"
                          size="small"
                          sx={{
                            backgroundColor: form.site_color_secondary,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            border: 'none',
                          }}
                        />
                      )}
                      <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
                        Preview
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </SectionCard>*/}

            {/* ── Feedback & Actions ── */}
            {saveError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {saveError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                component={Link}
                variant="outlined"
                to="/profile"
                sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>

              <Button disableElevation type="submit" variant="contained" loading={saving}>
                {saving ? <CircularProgress size={20} color="inherit" /> : 'Save changes'}
              </Button>
            </Box>
          </Box>
        )}
      </Container>
    </PageWrapper>
  );
}

interface ProfileFormData {
  username: string;
  about: string;
  interests: string; // comma-separated raw input
  site_color: string;
  site_color_secondary: string;
}

interface ProfileFormErrors {
  username?: string;
  about?: string;
  interests?: string;
  site_color?: string;
  site_color_secondary?: string;
}

const isValidHex = (value: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);

const normalizeHex = (value: string): string => {
  const stripped = value.startsWith('#') ? value : `#${value}`;
  return stripped.toUpperCase();
};

const parseInterests = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const PageWrapper = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(12),
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3.5, 4),
  marginBottom: theme.spacing(3),
  boxShadow: 'none',
}));

const SectionLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2.5),
  color: theme.palette.text.secondary,
  '& svg': { fontSize: 18 },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 10,
    border: '1px solid #eee',
    transition: 'box-shadow 0.2s ease',
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
    },
  },
}));

const ColorPreviewSwatch = styled(Box)<{ hexcolor: string; valid: boolean }>(({ theme, hexcolor, valid }) => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  backgroundColor: valid ? hexcolor : theme.palette.action.disabledBackground,
  border: `2px solid ${theme.palette.divider}`,
  flexShrink: 0,
  transition: 'background-color 0.2s ease',
}));

const EditProfileSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    {[120, 200, 80, 100].map((h, i) => (
      <Paper key={i} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 4, boxShadow: 'none' }}>
        <Skeleton variant="text" width={140} height={24} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={h} />
      </Paper>
    ))}
  </Box>
);
