import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetAllFAQ, useMutationDeleteFAQ, type TypeFAQItem } from '@/functions/database/faq';
import { AdminFAQEditorModal } from '@/components/admin/AdminFAQEditorModal';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Stack,
} from '@mui/material';

export const Route = createFileRoute('/space-command/faq')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: faqs, isLoading, isError } = useQueryGetAllFAQ();
  const deleteFaq = useMutationDeleteFAQ();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<TypeFAQItem | null>(null);

  function openCreate() {
    setSelected(null);
    setDialogOpen(true);
  }

  function openEdit(faq: TypeFAQItem) {
    setSelected(faq);
    setDialogOpen(true);
  }

  function handleDelete(id: string, title: string) {
    if (confirm(`Delete '${title}'?`)) {
      deleteFaq.mutate(id);
    }
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={500}>
            FAQ Editor
          </Typography>

          {faqs && (
            <Typography variant="body2" color="text.secondary">
              {faqs.length} item{faqs.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={openCreate}>
          Add FAQ
        </Button>
      </Box>

      <Typography sx={{ mb: 2 }}>
        Need help with Markdown?{' '}
        <a href="https://www.markdownguide.org/cheat-sheet/" target="_blank">
          Use this cheatsheet
        </a>
        .
      </Typography>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load FAQ items.
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {faqs?.map((faq) => (
            <Card key={faq.id} variant="outlined" sx={{ '&:hover': { borderColor: 'success.light' } }}>
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography fontWeight={500}>{faq.title}</Typography>

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(faq)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(faq.id, faq.title)}
                        disabled={deleteFaq.isPending}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Stack>

                <Box sx={{ maxHeight: 100, overflowY: 'scroll', textOverflow: 'ellipsis' }}>
                  <MarkdownWrapper>{faq.content}</MarkdownWrapper>
                </Box>
              </CardContent>

              {/*<CardActions sx={{ justifyContent: 'space-between', pt: 0, px: 2, pb: 1.5 }}>
                <Typography variant="caption" color="text.disabled">
                  Updated {new Date(faq.updated).toLocaleDateString()}
                </Typography>
              </CardActions>*/}
            </Card>
          ))}
        </Box>
      )}

      {/* @ts-ignore */}
      <AdminFAQEditorModal open={dialogOpen} onClose={() => setDialogOpen(false)} faq={selected} />
    </>
  );
}
