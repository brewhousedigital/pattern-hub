import React, { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  useQueryGetAllWikiCategories,
  useQueryGetAllWikiPages,
  useMutationDeleteWikiCategory,
  useMutationDeleteWikiPage,
  useMutationReorderWikiCategories,
  useMutationReorderWikiPages,
  type TypeWikiCategory,
  type TypeWikiPage,
} from '@/functions/database/wiki';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { AdminWikiCategoryModal, AdminWikiPageModal } from '@/components/admin/AdminWikiEditorModal';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { generateSEO } from '@/functions/utilities/seo';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import FileOpenIcon from '@mui/icons-material/FileOpen';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Fade,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { enqueueSnackbar } from 'notistack';

export const Route = createFileRoute('/space-command/wiki/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Wiki - Admin', '', match.pathname),
  }),
});

// ─── Sortable category wrapper ────────────────────────────────────────────────

type DragHandleProps = {
  listeners: React.HTMLAttributes<HTMLElement> | undefined;
  attributes: React.HTMLAttributes<HTMLElement>;
};

const SortableCategoryWrapper = ({
  id,
  children,
}: {
  id: string;
  children: (props: { dragHandleProps: DragHandleProps; isDragging: boolean }) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

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
      {children({ dragHandleProps: { listeners, attributes }, isDragging })}
    </div>
  );
};

// ─── Sortable page row ────────────────────────────────────────────────────────

type SortablePageRowProps = {
  page: TypeWikiPage;
  pageIndex: number;
  cat: TypeWikiCategory;
  canEdit: boolean;
  canDelete: boolean;
  onEditPage: (page: TypeWikiPage) => void;
  onDeletePage: (page: TypeWikiPage) => void;
};

const SortablePageRow = (props: SortablePageRowProps) => {
  const { page, pageIndex, cat } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          '&:hover': { backgroundColor: alpha('#C8A96E', 0.06) },
        }}
      >
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
          <DragIndicatorRoundedIcon sx={{ fontSize: '0.85rem', color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 500, minWidth: 16 }}>
            #{pageIndex + 1}
          </Typography>
        </Box>

        <ArticleIcon sx={{ color: 'text.disabled', fontSize: '0.9rem', flexShrink: 0 }} />

        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          {page.title}
        </Typography>

        <Chip label={page.slug} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 18 }} />

        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          <Tooltip title="View page">
            <IconButton size="small" component={Link as any} to={`/wiki/${cat.slug}/${page.slug}`} target="_blank">
              <FileOpenIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Edit page">
            <span>
              <IconButton size="small" disabled={!props.canEdit} onClick={() => props.onEditPage(page)}>
                <EditIcon sx={{ fontSize: '0.9rem' }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Delete page">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={!props.canDelete}
                onClick={() => props.onDeletePage(page)}
              >
                <DeleteIcon sx={{ fontSize: '0.9rem' }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </div>
  );
};

// ─── Category accordion row ───────────────────────────────────────────────────

type CategoryAccordionProps = {
  category: TypeWikiCategory;
  categoryIndex: number;
  dragHandleProps: DragHandleProps;
  pages: TypeWikiPage[];
  canEdit: boolean;
  canDelete: boolean;
  canAdd: boolean;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddPage: () => void;
  onEditPage: (page: TypeWikiPage) => void;
  onDeletePage: (page: TypeWikiPage) => void;
  onRefetchPages: () => void;
};

const CategoryAccordion = (props: CategoryAccordionProps) => {
  const { category: cat, pages, categoryIndex, dragHandleProps } = props;

  const [localPages, setLocalPages] = useState<TypeWikiPage[]>(pages);
  const reorderPages = useMutationReorderWikiPages();
  const pageSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!pages.length) return;
    if (pages.length > 1 && pages.every((p) => !p.order)) {
      const initialized = pages.map((p, i) => ({ ...p, order: (i + 1) * 1000 }));
      setLocalPages(initialized);
      reorderPages.mutate(initialized.map((p) => ({ id: p.id, order: p.order })));
    } else {
      setLocalPages(pages);
    }
  }, [pages]);

  function handlePageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalPages((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
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
      reorderPages.mutate([{ id: active.id as string, order: newOrder }]);
      return reordered;
    });
  }

  return (
    <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
      <Accordion
        disableGutters
        defaultExpanded
        sx={{
          flex: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '10px !important',
          boxShadow: 'none',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { borderColor: alpha('#C8A96E', 0.4) },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ px: 2, minHeight: 52, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 } }}
        >
          <Box
            component="span"
            {...(dragHandleProps.attributes as any)}
            {...(dragHandleProps.listeners as any)}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'grab',
              flexShrink: 0,
              touchAction: 'none',
              mr: -0.5,
            }}
          >
            <DragIndicatorRoundedIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 500 }}>
              #{categoryIndex + 1}
            </Typography>
          </Box>

          <FolderIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />

          <Typography sx={{ fontWeight: 600 }}>{cat.name}</Typography>

          <Chip label={cat.slug} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />

          <Chip
            label={`${pages.length} page${pages.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
          <Fade in={reorderPages.isPending} unmountOnExit>
            <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
          </Fade>
          {localPages.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1, pl: 1 }}>
              No pages yet -{' '}
              <Box
                component="span"
                onClick={props.canAdd ? props.onAddPage : undefined}
                sx={{
                  color: 'primary.main',
                  cursor: props.canAdd ? 'pointer' : 'default',
                  textDecoration: 'underline',
                }}
              >
                add one
              </Box>
            </Typography>
          ) : (
            <DndContext sensors={pageSensors} collisionDetection={closestCenter} onDragEnd={handlePageDragEnd}>
              <SortableContext items={localPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <Stack sx={{ gap: 0.5 }}>
                  {localPages.map((page, pageIndex) => (
                    <SortablePageRow
                      key={page.id}
                      page={page}
                      pageIndex={pageIndex}
                      cat={cat}
                      canEdit={props.canEdit}
                      canDelete={props.canDelete}
                      onEditPage={props.onEditPage}
                      onDeletePage={props.onDeletePage}
                    />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Category actions */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', height: 'auto', p: 1 }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="View Category">
            <IconButton size="small" component={Link as any} to={`/wiki/${cat.slug}`} target="_blank">
              <FileOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Add page to this category">
            <span>
              <IconButton size="small" disabled={!props.canAdd} onClick={props.onAddPage}>
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Edit category">
            <span>
              <IconButton size="small" disabled={!props.canEdit} onClick={props.onEditCategory}>
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Delete category">
            <span>
              <IconButton size="small" color="error" disabled={!props.canDelete} onClick={props.onDeleteCategory}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Paper>
    </Stack>
  );
};

// ─── Route ────────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canAdd = checkAccess(EnumLevelsAdmin.WIKI_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.WIKI_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.WIKI_AD);

  const {
    data: categories = [],
    isLoading: catsLoading,
    isError: catsError,
    refetch: refetchCats,
  } = useQueryGetAllWikiCategories();
  const {
    data: pages = [],
    isLoading: pagesLoading,
    isError: pagesError,
    refetch: refetchPages,
  } = useQueryGetAllWikiPages();

  const deleteCategory = useMutationDeleteWikiCategory();
  const deletePage = useMutationDeleteWikiPage();
  const reorderCategories = useMutationReorderWikiCategories();

  const [localCategories, setLocalCategories] = useState<TypeWikiCategory[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!categories.length) return;
    if (categories.length > 1 && categories.every((c) => !c.order)) {
      const initialized = categories.map((c, i) => ({ ...c, order: (i + 1) * 1000 }));
      setLocalCategories(initialized);
      reorderCategories.mutate(initialized.map((c) => ({ id: c.id, order: c.order })));
    } else {
      setLocalCategories(categories);
    }
  }, [categories]);

  // Category modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<TypeWikiCategory | null>(null);

  // Page modal state
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<TypeWikiPage | null>(null);
  const [defaultCatId, setDefaultCatId] = useState('');

  function openCreateCategory() {
    setSelectedCat(null);
    setCatModalOpen(true);
  }
  function openEditCategory(cat: TypeWikiCategory) {
    setSelectedCat(cat);
    setCatModalOpen(true);
  }

  function openCreatePage(catId = '') {
    setSelectedPage(null);
    setDefaultCatId(catId);
    setPageModalOpen(true);
  }
  function openEditPage(page: TypeWikiPage) {
    setSelectedPage(page);
    setPageModalOpen(true);
  }

  async function handleDeleteCategory(cat: TypeWikiCategory) {
    const pagesInCat = pages.filter((p) => p.category === cat.id);
    const warning = pagesInCat.length > 0 ? ` This will also delete ${pagesInCat.length} page(s) inside it.` : '';
    if (!confirm(`Delete category "${cat.name}"?${warning}`)) return;

    try {
      await deleteCategory.mutateAsync(cat.id);
      await refetchCats();
      await refetchPages();
    } catch (error: any) {
      enqueueSnackbar(`Unable to delete the category: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: 'error',
      });
    }
  }

  async function handleDeletePage(page: TypeWikiPage) {
    if (!confirm(`Delete page "${page.title}"?`)) return;

    try {
      await deletePage.mutateAsync(page.id);
      await refetchPages();
    } catch (error) {
      enqueueSnackbar(`Unable to delete the page: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: 'error',
      });
    }
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalCategories((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
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
      reorderCategories.mutate([{ id: active.id as string, order: newOrder }]);
      return reordered;
    });
  }

  const isLoading = catsLoading || pagesLoading;
  const isError = catsError || pagesError;
  const totalPages = pages.length;

  return (
    <>
      <AdminHeaderContainer
        title="Wiki"
        subtitle={`${categories.length} categor${categories.length !== 1 ? 'ies' : 'y'} · ${totalPages} page${totalPages !== 1 ? 's' : ''}`}
        actionNode={
          <Stack direction="row" sx={{ gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={openCreateCategory}
              disabled={!canAdd}
            >
              Add Category
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openCreatePage()}
              disabled={!canAdd}
            >
              Add Page
            </Button>
          </Stack>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load wiki data.
        </Alert>
      )}

      {isLoading ? (
        <Stack sx={{ gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} />
          ))}
        </Stack>
      ) : localCategories.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            border: '1px dashed',
            borderColor: alpha('#C8A96E', 0.3),
            borderRadius: 3,
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            No categories yet.
          </Typography>

          <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateCategory} disabled={!canAdd}>
            Create First Category
          </Button>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <Fade in={reorderCategories.isPending} unmountOnExit>
            <LinearProgress sx={{ position: 'absolute', top: -10, left: 0, right: 0, borderRadius: 1 }} />
          </Fade>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
            <SortableContext items={localCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <Stack sx={{ gap: 1 }}>
                {localCategories.map((cat, catIndex) => {
                  const catPages = pages.filter((p) => p.category === cat.id);
                  return (
                    <SortableCategoryWrapper key={cat.id} id={cat.id}>
                      {({ dragHandleProps }) => (
                        <CategoryAccordion
                          category={cat}
                          categoryIndex={catIndex}
                          dragHandleProps={dragHandleProps}
                          pages={catPages}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canAdd={canAdd}
                          onEditCategory={() => openEditCategory(cat)}
                          onDeleteCategory={() => handleDeleteCategory(cat)}
                          onAddPage={() => openCreatePage(cat.id)}
                          onEditPage={openEditPage}
                          onDeletePage={handleDeletePage}
                          onRefetchPages={refetchPages}
                        />
                      )}
                    </SortableCategoryWrapper>
                  );
                })}
              </Stack>
            </SortableContext>
          </DndContext>
        </Box>
      )}

      <AdminWikiCategoryModal open={catModalOpen} onClose={() => setCatModalOpen(false)} category={selectedCat} />

      <AdminWikiPageModal
        open={pageModalOpen}
        onClose={() => setPageModalOpen(false)}
        page={selectedPage}
        defaultCategoryId={defaultCatId}
      />
    </>
  );
}
