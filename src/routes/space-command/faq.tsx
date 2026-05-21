import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetAllFAQ, useMutationDeleteFAQ, type TypeFAQItem } from '@/functions/database/faq';
import { AdminFAQEditorModal } from '@/components/admin/AdminFAQEditorModal';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import { Box, Typography, Card, CardContent, IconButton, Tooltip, Skeleton, Alert, Stack } from '@mui/material';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { enqueueSnackbar } from 'notistack';

export const Route = createFileRoute('/space-command/faq')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('FAQ - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.FAQ_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.FAQ_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.FAQ_AD);

  const [isDeleteLoading, setIsDeleteLoading] = React.useState(false);

  const { data: faqs, isPending, isError, refetch } = useQueryGetAllFAQ();
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

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Delete '${title}'?`)) {
      try {
        setIsDeleteLoading(true);
        await deleteFaq.mutateAsync(id);
        await refetch();
      } catch (error: any) {
        enqueueSnackbar(`Unable to delete FAQ item: ${error.message}`, { variant: 'error' });
      }

      setIsDeleteLoading(false);
    }
  };

  return (
    <>
      <AdminHeaderContainer
        title="FAQ Editor"
        subtitle={
          <>
            {faqs?.length} item{faqs?.length !== 1 ? 's' : ''}
          </>
        }
        action={openCreate}
        actionText="Add FAQ"
        actionIcon={<AddIcon />}
        disabled={!canAdd}
      />

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

      {isPending ? (
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
                      <IconButton disabled={!canEdit} size="small" onClick={() => openEdit(faq)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete">
                      <IconButton
                        loading={isDeleteLoading}
                        size="small"
                        color="error"
                        onClick={() => handleDelete(faq.id, faq.title)}
                        disabled={deleteFaq.isPending || !canDelete}
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

      <AdminFAQEditorModal open={dialogOpen} onClose={() => setDialogOpen(false)} faq={selected} />
    </>
  );
}
