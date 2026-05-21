import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generatePbImage } from '@/functions/utilities/generate-pb-image.ts';
import { useQueryGetComplaints, type TypeComplaintsResponse } from '@/functions/database/complaints.ts';
import { useQueryGetContentReports, type TypeContentReportResponse, CONTENT_TYPE_META } from '@/functions/database/content-reports.ts';
import { AdminComplaintsModal } from '@/components/admin/AdminComplaintsModal.tsx';
import { AdminContentReportModal } from '@/components/admin/AdminContentReportModal.tsx';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer.tsx';
import { generatePatternLink } from '@/functions/utilities/generate-pattern-link';

import {
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/complaints/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Complaints - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = React.useState(0);

  // ── Pattern reports ──────────────────────────────────────────────────────────
  const { isLoading: patternLoading, data: patternData } = useQueryGetComplaints();
  const [patternDialogOpen, setPatternDialogOpen] = React.useState(false);
  const [selectedPattern, setSelectedPattern] = React.useState<TypeComplaintsResponse | null>(null);

  function openPatternReview(complaint: TypeComplaintsResponse) {
    setSelectedPattern(complaint);
    setPatternDialogOpen(true);
  }

  // ── Content reports ──────────────────────────────────────────────────────────
  const { isLoading: contentLoading, data: contentData } = useQueryGetContentReports();
  const [contentDialogOpen, setContentDialogOpen] = React.useState(false);
  const [selectedContent, setSelectedContent] = React.useState<TypeContentReportResponse | null>(null);

  function openContentReview(report: TypeContentReportResponse) {
    setSelectedContent(report);
    setContentDialogOpen(true);
  }

  const pendingPatternCount = patternData?.length ?? 0;
  const pendingContentCount = contentData?.length ?? 0;

  return (
    <Box>
      <AdminHeaderContainer
        title="Complaints & Reports"
        subtitle="Pending Review"
        action={() => navigate({ to: '/space-command/complaints/reviewed' })}
        actionText="Reviewed Issues"
      />

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>Pattern Reports</span>
              {pendingPatternCount > 0 && (
                <Chip label={pendingPatternCount} size="small" color="warning" sx={{ height: 18, fontSize: 11 }} />
              )}
            </Stack>
          }
        />
        <Tab
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>Content Reports</span>
              {pendingContentCount > 0 && (
                <Chip label={pendingContentCount} size="small" color="warning" sx={{ height: 18, fontSize: 11 }} />
              )}
            </Stack>
          }
        />
      </Tabs>

      {/* ── Pattern Reports tab ─────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Pattern</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Reporter</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Submitted</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>

            <TableBody>
              {patternLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : patternData?.map((complaint) => {
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
                              <a href={generatePatternLink(pattern?.id || '')} target="_blank">
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
                            {complaint.category}
                          </Typography>
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
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => openPatternReview(complaint)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Content Reports tab ─────────────────────────────────────────────── */}
      {activeTab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Content</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Reporter</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Submitted</TableCell>
                <TableCell sx={{ fontWeight: 500, fontSize: 11, letterSpacing: '0.05em' }}>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>

            <TableBody>
              {contentLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : contentData?.map((report) => {
                    const typeMeta =
                      CONTENT_TYPE_META[report.content_type] ??
                      { label: report.content_type, color: 'default' as const };

                    return (
                      <TableRow key={report.id} hover>
                        <TableCell>
                          <Chip label={typeMeta.label} color={typeMeta.color} size="small" sx={{ fontSize: 11 }} />
                        </TableCell>

                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography fontSize={13} fontWeight={500} noWrap>
                            {report.content_name || '—'}
                          </Typography>
                          <Typography fontSize={11} color="text.disabled" fontFamily="monospace">
                            {report.content_id}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ maxWidth: 180 }}>
                          <Typography fontSize={13} color="text.secondary" noWrap>
                            {report.category}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ maxWidth: 220 }}>
                          <Typography fontSize={13} color="text.secondary" noWrap>
                            {report.reason}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography fontSize={12} color="text.secondary">
                            {report.email}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography fontSize={12} color="text.disabled" noWrap>
                            {new Date(report.created).toLocaleDateString()}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={report.reviewed ? 'Reviewed' : 'Pending'}
                            size="small"
                            color={report.reviewed ? 'success' : 'warning'}
                            variant="outlined"
                            sx={{ fontSize: 11 }}
                          />
                        </TableCell>

                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => openContentReview(report)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AdminComplaintsModal
        open={patternDialogOpen}
        onClose={() => setPatternDialogOpen(false)}
        complaint={selectedPattern}
        key={selectedPattern?.id || ''}
      />

      <AdminContentReportModal
        open={contentDialogOpen}
        onClose={() => setContentDialogOpen(false)}
        report={selectedContent}
        key={selectedContent?.id || 'content'}
      />
    </Box>
  );
}
