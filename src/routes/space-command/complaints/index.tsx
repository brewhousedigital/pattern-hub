import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generatePbImage } from '@/functions/utilities/generate-pb-image.ts';
import { useQueryGetComplaints, type TypeComplaintsResponse } from '@/functions/database/complaints.ts';
import { AdminComplaintsModal } from '@/components/admin/AdminComplaintsModal.tsx';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer.tsx';

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
  Avatar,
  Button,
  Skeleton,
} from '@mui/material';

export const Route = createFileRoute('/space-command/complaints/')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  const { isLoading, isError, data } = useQueryGetComplaints();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TypeComplaintsResponse | null>(null);

  function openReview(complaint: TypeComplaintsResponse) {
    setSelected(complaint);
    setDialogOpen(true);
  }

  return (
    <Box>
      <AdminHeaderContainer
        title="Complaints & Reports"
        subtitle="Pending Review"
        action={() => navigate({ to: '/space-command/complaints/reviewed' })}
        actionText="Reviewed Issues"
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Pattern</TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Reason</TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Reporter</TableCell>
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
              : data?.map((complaint) => {
                  const pattern = complaint.expand?.pattern_id;
                  const thumbUrl = generatePbImage(pattern);

                  return (
                    <TableRow key={complaint.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar
                            src={thumbUrl ?? undefined}
                            variant="rounded"
                            sx={{
                              width: 40,
                              height: 40,
                              backgroundColor: 'success.50',
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          />

                          <Box>
                            <a href={`/pattern/${pattern?.id}`} target="_blank">
                              <Typography fontSize={13} fontWeight={500} lineHeight={1.3}>
                                {pattern?.name ?? '—'}
                              </Typography>
                            </a>

                            <Typography fontSize={11} color="text.disabled" fontFamily="monospace">
                              {complaint?.pattern_id}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography fontSize={13} color="text.secondary" noWrap>
                          {complaint.reason}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography fontSize={12} color="text.secondary">
                          {complaint.email}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography fontSize={12} color="text.disabled" noWrap>
                          {new Date(complaint.created).toLocaleDateString()}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={complaint.reviewed ? 'Reviewed' : 'Pending'}
                          size="small"
                          color={complaint.reviewed ? 'success' : 'warning'}
                          variant="outlined"
                          sx={{ fontSize: 11 }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Button size="small" variant="contained" color="success" onClick={() => openReview(complaint)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </TableContainer>

      <AdminComplaintsModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        complaint={selected}
        key={selected?.id || ''}
      />
    </Box>
  );
}
