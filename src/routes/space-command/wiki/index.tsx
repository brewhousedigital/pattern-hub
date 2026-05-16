import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetAllWikiCategories,
  useQueryGetAllWikiPages,
  useMutationDeleteWikiCategory,
  useMutationDeleteWikiPage,
  type TypeWikiCategory,
  type TypeWikiPage,
} from '@/functions/database/wiki';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { AdminWikiCategoryModal, AdminWikiPageModal } from '@/components/admin/AdminWikiEditorModal';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { generateSEO } from '@/functions/utilities/seo';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

export const Route = createFileRoute('/space-command/wiki/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Wiki - Admin', '', match.pathname),
  }),
});

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
    await deleteCategory.mutateAsync(cat.id);
    refetchCats();
    refetchPages();
  }

  async function handleDeletePage(page: TypeWikiPage) {
    if (!confirm(`Delete page "${page.title}"?`)) return;
    await deletePage.mutateAsync(page.id);
    refetchPages();
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
          <Stack direction="row" gap={1}>
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
        <Stack gap={1.5}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} />
          ))}
        </Stack>
      ) : categories.length === 0 ? (
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
        <Stack gap={1}>
          {categories.map((cat) => {
            const catPages = pages.filter((p) => p.category === cat.id);
            return (
              <CategoryAccordion
                key={cat.id}
                category={cat}
                pages={catPages}
                canEdit={canEdit}
                canDelete={canDelete}
                canAdd={canAdd}
                onEditCategory={() => openEditCategory(cat)}
                onDeleteCategory={() => handleDeleteCategory(cat)}
                onAddPage={() => openCreatePage(cat.id)}
                onEditPage={openEditPage}
                onDeletePage={handleDeletePage}
              />
            );
          })}
        </Stack>
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

// ─── Category accordion row ───────────────────────────────────────────────────

type CategoryAccordionProps = {
  category: TypeWikiCategory;
  pages: TypeWikiPage[];
  canEdit: boolean;
  canDelete: boolean;
  canAdd: boolean;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddPage: () => void;
  onEditPage: (page: TypeWikiPage) => void;
  onDeletePage: (page: TypeWikiPage) => void;
};

const CategoryAccordion = (props: CategoryAccordionProps) => {
  const { category: cat, pages } = props;

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
          <FolderIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />

          <Typography fontWeight={600}>{cat.name}</Typography>

          <Chip label={cat.slug} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />

          <Chip
            label={`${pages.length} page${pages.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
          {pages.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1, pl: 1 }}>
              No pages yet —{' '}
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
            <Stack gap={0.5}>
              {pages.map((page) => (
                <Box
                  key={page.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    '&:hover': { bgcolor: alpha('#C8A96E', 0.06) },
                  }}
                >
                  <ArticleIcon sx={{ color: 'text.disabled', fontSize: '0.9rem', flexShrink: 0 }} />

                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                    {page.title}
                  </Typography>

                  <Chip label={page.slug} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 18 }} />

                  <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
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
              ))}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Category actions — stop accordion toggle propagation */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', height: 'auto', p: 1 }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
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
