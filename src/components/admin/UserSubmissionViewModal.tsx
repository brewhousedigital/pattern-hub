import dayjs from 'dayjs';
import type { TypeUserSubmittedPatternResponse } from '@/functions/database/user-submissions';
import { generateUserSubmissionFileUrl } from '@/functions/utilities/generate-pb-image';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';

type Props = {
  submission: TypeUserSubmittedPatternResponse;
  onClose: () => void;
};

// Read-only look at a submission's contents - no edit controls. Used from the
// User Submissions grid's "View" action so an admin can triage without
// claiming the review.
export const UserSubmissionViewModal = ({ submission, onClose }: Props) => {
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {submission.name}
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          <Box
            component="img"
            src={generateUserSubmissionFileUrl(submission)}
            alt={submission.name}
            sx={{
              width: '100%',
              maxHeight: 320,
              objectFit: 'contain',
              backgroundColor: 'grey.50',
              borderRadius: 1,
            }}
          />

          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={submission.file_type === 'svg' ? 'SVG' : 'WebP'} />
            <Chip size="small" label={submission.status} />
            <Chip size="small" label={submission.is_author ? 'Submitted by author' : 'Submitted for another artist'} />
          </Stack>

          {!submission.is_author && submission.author_manual_name && (
            <Typography variant="body2">
              <strong>Original author:</strong> {submission.author_manual_name}
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary">
            {submission.description || 'No description provided.'}
          </Typography>

          <Divider />

          <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              <strong>Pieces:</strong> {submission.pieces}
            </Typography>
            <Typography variant="body2">
              <strong>Size:</strong> {submission.design_width}
              {submission.design_width_unit} x {submission.design_height}
              {submission.design_height_unit}
            </Typography>
            <Typography variant="body2">
              <strong>Line width:</strong> {submission.line_width}
              {submission.line_width_unit}
            </Typography>
          </Stack>

          {submission.tags?.length > 0 && (
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              {submission.tags.map((tag) => (
                <Chip key={tag} size="small" variant="outlined" label={tag} />
              ))}
            </Stack>
          )}

          {submission.custom_pattern_key_requested && (
            <Chip size="small" color="warning" label="Requested a custom pattern key" />
          )}

          <Typography variant="caption" color="text.secondary">
            Submitted {dayjs(submission.created).format('MMM D, YYYY h:mm A')}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
