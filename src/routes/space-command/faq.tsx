import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetAllFAQ,
  useMutationDeleteFAQ,
  useMutationReorderFAQItems,
  type TypeFAQItem,
} from '@/functions/database/faq';
import { AdminFAQEditorModal } from '@/components/admin/AdminFAQEditorModal';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';

import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Stack,
  LinearProgress,
  Fade,
} from '@mui/material';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { enqueueSnackbar } from 'notistack';

export const Route = createFileRoute('/space-command/faq')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('FAQ - Admin', '', match.pathname),
  }),
});

// ─── Sortable card ────────────────────────────────────────────────────────────

type SortableFAQCardProps = {
  faq: TypeFAQItem;
  index: number;
  canEdit: boolean;
  canDelete: boolean;
  isDeleteLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const SortableFAQCard = (props: SortableFAQCardProps) => {
  const { faq, index } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: faq.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : 0,
      }}
    >
      <Card variant="outlined" sx={{ '&:hover': { borderColor: 'success.light' } }}>
        <CardContent sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ mb: 2, alignItems: 'center', gap: 1 }}>
            <Box
              {...attributes}
              {...listeners}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: isDragging ? 'grabbing' : 'grab',
                flexShrink: 0,
                touchAction: 'none',
              }}
            >
              <DragIndicatorRoundedIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 500 }}>
                #{index + 1}
              </Typography>
            </Box>

            <Typography fontWeight={500} sx={{ flex: 1, minWidth: 0 }}>
              {faq.title}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <Tooltip title="Edit">
                <IconButton disabled={!props.canEdit} size="small" onClick={props.onEdit}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete">
                <IconButton
                  loading={props.isDeleteLoading}
                  size="small"
                  color="error"
                  onClick={props.onDelete}
                  disabled={props.isDeleteLoading || !props.canDelete}
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
      </Card>
    </div>
  );
};

// ─── Route ────────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.FAQ_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.FAQ_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.FAQ_AD);

  const [isDeleteLoading, setIsDeleteLoading] = React.useState(false);

  const { data: faqs, isPending, isError, refetch } = useQueryGetAllFAQ();
  const deleteFaq = useMutationDeleteFAQ();
  const reorderFaqs = useMutationReorderFAQItems();

  const [localFaqs, setLocalFaqs] = useState<TypeFAQItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<TypeFAQItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!faqs) return;
    if (faqs.length > 1 && faqs.every((f) => !f.order)) {
      // One-time bootstrap: assign wide spacing so fractional drags have room
      const initialized = faqs.map((f, i) => ({ ...f, order: (i + 1) * 1000 }));
      setLocalFaqs(initialized);
      reorderFaqs.mutate(initialized.map((f) => ({ id: f.id, order: f.order })));
    } else {
      setLocalFaqs(faqs);
    }
  }, [faqs]);

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalFaqs((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      const prevItem = reordered[newIndex - 1];
      const nextItem = reordered[newIndex + 1];
      let newOrder: number;
      if (!prevItem) {
        newOrder = (nextItem?.order ?? 1000) - 500;
      } else if (!nextItem) {
        newOrder = (prevItem?.order ?? 0) + 500;
      } else {
        newOrder = (prevItem.order + nextItem.order) / 2;
      }

      // Update order in local state so subsequent drags compute correctly
      reordered[newIndex] = { ...reordered[newIndex], order: newOrder };
      // Only the moved item needs to be updated
      reorderFaqs.mutate([{ id: active.id as string, order: newOrder }]);
      return reordered;
    });
  }

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
        <Box sx={{ position: 'relative' }}>
          <Fade in={reorderFaqs.isPending} unmountOnExit>
            <LinearProgress sx={{ position: 'absolute', top: -10, left: 0, right: 0, borderRadius: 1 }} />
          </Fade>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localFaqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {localFaqs.map((faq, index) => (
                  <SortableFAQCard
                    key={faq.id}
                    faq={faq}
                    index={index}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    isDeleteLoading={isDeleteLoading}
                    onEdit={() => openEdit(faq)}
                    onDelete={() => handleDelete(faq.id, faq.title)}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>
        </Box>
      )}

      <AdminFAQEditorModal open={dialogOpen} onClose={() => setDialogOpen(false)} faq={selected} />
    </>
  );
}
