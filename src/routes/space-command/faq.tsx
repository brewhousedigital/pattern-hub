import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetAllFAQ,
  useMutationDeleteFAQ,
  useMutationReorderFAQItems,
  type TypeFAQItem,
} from '@/functions/database/faq';
import { AdminFAQEditorModal } from '@/components/admin/AdminFAQEditorModal';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { stripMarkdown } from '@/functions/utilities/markdown';

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
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Stack,
  LinearProgress,
  Fade,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
  isSaving: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const SortableFAQCard = (props: SortableFAQCardProps) => {
  const { faq, index, isSaving } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: faq.id });

  const preview = stripMarkdown(faq.content);

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
      <Card
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: isSaving ? 'primary.light' : 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            borderColor: 'primary.light',
            boxShadow: (t) => `0 4px 16px ${alpha(t.palette.common.black, 0.06)}`,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Drag zone */}
          <Box
            {...attributes}
            {...listeners}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              width: 52,
              flexShrink: 0,
              cursor: isDragging ? 'grabbing' : 'grab',
              backgroundColor: (t) => alpha(t.palette.text.primary, 0.02),
              borderRight: '1px solid',
              borderColor: 'divider',
              py: 2,
              touchAction: 'none',
              color: 'text.disabled',
              transition: 'background-color 0.15s, color 0.15s',
              '&:hover': {
                backgroundColor: (t) => alpha(t.palette.primary.main, 0.05),
                color: 'text.secondary',
              },
            }}
          >
            <DragIndicatorRoundedIcon sx={{ fontSize: '1rem' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', letterSpacing: 0.5 }}>
              #{index + 1}
            </Typography>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, px: 2.5, py: 2, minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: preview ? 0.5 : 0, lineHeight: 1.4 }}>
                  {faq.title}
                </Typography>
                {preview && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.55,
                    }}
                  >
                    {preview}
                  </Typography>
                )}
              </Box>

              <Stack direction="row" sx={{ gap: 0.5, flexShrink: 0, mt: -0.5 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" disabled={!props.canEdit} onClick={props.onEdit}>
                    <EditIcon sx={{ fontSize: '0.95rem' }} />
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
                    <DeleteIcon sx={{ fontSize: '0.95rem' }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        </Box>

        <Fade in={isSaving} unmountOnExit>
          <LinearProgress sx={{ height: 2 }} />
        </Fade>
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

      reordered[newIndex] = { ...reordered[newIndex], order: newOrder };
      reorderFaqs.mutate([{ id: active.id as string, order: newOrder }]);
      return reordered;
    });
  }

  const pendingSaveId = reorderFaqs.isPending ? reorderFaqs.variables?.[0]?.id : undefined;

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

      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ mb: 2 }}>
          Need help with Markdown?{' '}
          <a href="https://www.markdownguide.org/cheat-sheet/" target="_blank">
            Use this cheatsheet
          </a>
          .
        </Typography>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load FAQ items.
        </Alert>
      )}

      {isPending ? (
        <Stack sx={{ gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 3 }} />
          ))}
        </Stack>
      ) : localFaqs.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            No FAQ items yet.
          </Typography>
          <Typography
            variant="body2"
            color="text.disabled"
            component="a"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (canAdd) openCreate();
            }}
            sx={{ textDecoration: 'underline', cursor: canAdd ? 'pointer' : 'default' }}
          >
            Add the first one
          </Typography>
        </Box>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localFaqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <Stack sx={{ gap: 1.5 }}>
              {localFaqs.map((faq, index) => (
                <SortableFAQCard
                  key={faq.id}
                  faq={faq}
                  index={index}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isDeleteLoading={isDeleteLoading}
                  isSaving={pendingSaveId === faq.id}
                  onEdit={() => openEdit(faq)}
                  onDelete={() => handleDelete(faq.id, faq.title)}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <AdminFAQEditorModal open={dialogOpen} onClose={() => setDialogOpen(false)} faq={selected} />
    </>
  );
}
