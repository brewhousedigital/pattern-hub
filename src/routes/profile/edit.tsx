import React, { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { PRIMARY_COLOR, SECONDARY_COLOR } from '@/data/constants';
import { useMutationAuthUpdateUser } from '@/functions/database/authentication';
import { enqueueSnackbar } from 'notistack';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useRefreshAuth } from '@/data/auth-data';
import { useMutationValidateUsername } from '@/functions/database/users';
import { generateSEO } from '@/functions/utilities/seo.ts';

import { styled, alpha } from '@mui/material/styles';
import ReportRoundedIcon from '@mui/icons-material/ReportRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
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
  Grid,
  Stack,
} from '@mui/material';

export const Route = createFileRoute('/profile/edit')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Edit Profile', '', match.pathname),
  }),
});

function RouteComponent() {
  const { authData, setAuthData } = useGlobalAuthData();

  const navigate = useNavigate();

  const verifyUsername = useMutationValidateUsername();

  const [form, setForm] = useState<ProfileFormData>({
    username: '',
    about: '',
    interests: '',
    site_color: '',
    site_color_secondary: '',
  });

  const hasMetMinLength = form?.username?.length >= 4;

  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const { handleRefresh } = useRefreshAuth();

  const updateUserData = useMutationAuthUpdateUser();

  const [isUserNameAvailable, setIsUserNameAvailable] = React.useState<boolean | undefined>(undefined);

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

    if (authData) {
      loadProfile().then();
    }
  }, [authData]);

  const handleChange =
    (field: keyof ProfileFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = e.target.value;

      setIsUserNameAvailable(undefined);

      // Auto-prepend # for hex fields
      if ((field === 'site_color' || field === 'site_color_secondary') && value && !value.startsWith('#')) {
        value = `#${value}`;
      }

      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleUsernameVerification = async () => {
    if (form.username.trim() === authData?.name) {
      return true;
    }

    try {
      const results = await verifyUsername.mutateAsync(form?.username);

      const foundAMatch = results.find(
        (item) => item.name?.trim()?.toLowerCase() === form.username.trim().toLowerCase(),
      );

      if (foundAMatch) {
        setIsUserNameAvailable(false);
      } else {
        setIsUserNameAvailable(true);
      }
      return false;
    } catch (error: any) {
      setIsUserNameAvailable(true);
      return true;
    }
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSaveError(null);

    setSaving(true);

    // Check the username verification first
    const validUsername = handleUsernameVerification();

    if (!validUsername) return;

    try {
      await updateUserData.mutateAsync({
        id: authData?.id || '',
        name: form.username.trim(),
        about: form.about.trim(),
        interests: form.interests,
        site_color: form.site_color,
        site_color_secondary: form.site_color_secondary,
      });

      await handleRefresh();

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
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="sm">
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
              Edit Profile
            </Typography>
          </Box>

          {loading ? (
            <EditProfileSkeleton />
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <SectionCard elevation={0}>
                <TextField
                  fullWidth
                  required
                  variant="filled"
                  label="Username"
                  value={form.username}
                  onChange={handleChange('username')}
                  error={!!errors.username}
                  helperText="You can only use letters, numbers, and underscores. Must be 4 or more characters."
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
                      minLength: 4,
                      pattern: '^[a-zA-Z0-9_]+$',
                    },
                  }}
                />

                <Grid container sx={{ alignItems: 'center', pt: 2 }}>
                  <Grid size={{ xs: 6 }}>
                    {isUserNameAvailable === true && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <CheckCircleOutlineRoundedIcon color="success" />
                        <Typography color="success">This name is available</Typography>
                      </Stack>
                    )}

                    {isUserNameAvailable === false && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <ReportRoundedIcon color="error" />
                        <Typography color="error">This name is not available</Typography>
                      </Stack>
                    )}
                  </Grid>

                  <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                    <Button
                      disabled={!hasMetMinLength}
                      variant="outlined"
                      loading={verifyUsername.isPending}
                      onClick={handleUsernameVerification}
                      type="button"
                    >
                      Verify Username
                    </Button>
                  </Grid>
                </Grid>
              </SectionCard>

              <SectionCard elevation={0}>
                <TextField
                  label="About"
                  variant="filled"
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
                        <span>
                          Optional. This field supports{' '}
                          <a href="https://www.markdownguide.org/cheat-sheet/" target="_blank">
                            Markdown
                          </a>
                          .
                        </span>
                        <span style={{ color: form.about.length > 2980 ? 'orange' : 'inherit' }}>
                          {form.about.length}/3000
                        </span>
                      </Box>
                    )
                  }
                  slotProps={{
                    htmlInput: {
                      maxLength: 3000,
                    },
                  }}
                />
              </SectionCard>

              <SectionCard elevation={0}>
                <TextField
                  label="Interests"
                  variant="filled"
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

              {/* Feedback & Actions */}
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
    </GeneralLayout>
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
