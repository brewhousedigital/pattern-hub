import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryGetPendingContactSubmissions, type TypeContactResponse } from '@/functions/database/contact';
import { AdminContactModal } from '@/components/admin/AdminContactModal';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { generateSEO } from '@/functions/utilities/seo';

import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Button,
  Skeleton,
} from '@mui/material';

export const Route = createFileRoute('/space-command/contact/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Contact Submissions - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const navigate = useNavigate();

  const { isLoading, data } = useQueryGetPendingContactSubmissions();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TypeContactResponse | null>(null);

  function openReview(submission: TypeContactResponse) {
    setSelected(submission);
    setDialogOpen(true);
  }

  return (
    <Box>
      <AdminHeaderContainer
        title="Contact Submissions"
        subtitle="Pending Review"
        action={() => navigate({ to: '/space-command/contact/reviewed' })}
        actionText="Reviewed Submissions"
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Message</TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Submitted</TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.map((submission) => (
                  <TableRow key={submission.id} hover>
                    <TableCell>
                      <Typography fontSize={13} fontWeight={500}>
                        {submission.name}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography fontSize={12} color="text.secondary">
                        {submission.email}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography fontSize={13} color="text.secondary" noWrap>
                        {submission.message}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography fontSize={12} color="text.disabled" noWrap>
                        {new Date(submission.created).toLocaleDateString()}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label="Pending"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Button size="small" variant="contained" color="success" onClick={() => openReview(submission)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>

      <AdminContactModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        submission={selected}
        key={selected?.id || ''}
      />
    </Box>
  );
}
