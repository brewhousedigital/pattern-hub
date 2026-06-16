import React from 'react';
import {
  useMutationCreateWikiCategory,
  useMutationUpdateWikiCategory,
  useMutationCreateWikiPage,
  useMutationUpdateWikiPage,
  useQueryGetAllWikiCategories,
  useQueryGetAllWikiPages,
  type TypeWikiCategory,
  type TypeWikiPage,
} from '@/functions/database/wiki';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';

import CloseIcon from '@mui/icons-material/Close';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { enqueueSnackbar } from 'notistack';
import { useAdminLogger } from '@/functions/database/admin-logs';

// ─── Shared helper ────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── Category modal ───────────────────────────────────────────────────────────

type AdminWikiCategoryModalProps = {
  open: boolean;
  onClose: () => void;
  category: TypeWikiCategory | null; // null = create mode
};

export const AdminWikiCategoryModal = (props: AdminWikiCategoryModalProps) => {
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [order, setOrder] = React.useState('0');
  const [slugTouched, setSlugTouched] = React.useState(false);

  const { refetch } = useQueryGetAllWikiCategories();
  const create = useMutationCreateWikiCategory();
  const update = useMutationUpdateWikiCategory();
  const { log } = useAdminLogger();
  const isPending = create.isPending || update.isPending;
  const isEdit = props.category !== null;

  React.useEffect(() => {
    if (props.open) {
      setName(props.category?.name ?? '');
      setSlug(props.category?.slug ?? '');
      setOrder(String(props.category?.order ?? 0));
      setSlugTouched(isEdit);
    }
  }, [props.open, props.category]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) setSlug(toSlug(val));
  };

  async function handleSubmit() {
    if (!name.trim() || !slug.trim()) return;
    const payload = { id: props.category?.id, name: name.trim(), slug: slug.trim(), order: Number(order) || 0 };
    try {
      if (isEdit) {
        await update.mutateAsync(payload);
        log({
          action: 'Wiki Category Updated',
          entity_type: 'Wiki Category',
          entity_id: props.category?.id ?? '',
          entity_name: name.trim(),
          changes: {
            name: { from: props.category?.name ?? '', to: name.trim() },
            slug: { from: props.category?.slug ?? '', to: slug.trim() },
          },
          metadata: {},
        });
      } else {
        const created = await create.mutateAsync(payload);
        log({
          action: 'Wiki Category Created',
          entity_type: 'Wiki Category',
          entity_id: (created as any)?.id ?? '',
          entity_name: name.trim(),
          changes: {},
          metadata: { slug: slug.trim() },
        });
      }
      await refetch();
      props.onClose();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Failed to save category.', { variant: 'error' });
    }
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <>{isEdit ? 'Edit Category' : 'New Category'}</>

        <IconButton onClick={props.onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
        <TextField
          label="Name"
          variant="filled"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          fullWidth
          size="small"
          required
        />

        <TextField
          label="Slug"
          variant="filled"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          fullWidth
          size="small"
          required
          helperText="URL-safe identifier - auto-generated from name, editable"
          slotProps={{ htmlInput: { pattern: '[a-z0-9-]+' } }}
        />

        <TextField
          label="Sort Order"
          variant="filled"
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          size="small"
          sx={{ width: 140 }}
          helperText="Lower = appears first"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit" disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="success"
          disabled={isPending || !name.trim() || !slug.trim()}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {isEdit ? 'Save changes' : 'Create Category'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Page modal ───────────────────────────────────────────────────────────────

type AdminWikiPageModalProps = {
  open: boolean;
  onClose: () => void;
  page: TypeWikiPage | null; // null = create mode
  defaultCategoryId?: string; // pre-select a category when creating from accordion
};

export const AdminWikiPageModal = (props: AdminWikiPageModalProps) => {
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [content, setContent] = React.useState('');
  const [order, setOrder] = React.useState('0');
  const [slugTouched, setSlugTouched] = React.useState(false);

  const { data: categories = [] } = useQueryGetAllWikiCategories();
  const { refetch } = useQueryGetAllWikiPages();
  const create = useMutationCreateWikiPage();
  const update = useMutationUpdateWikiPage();
  const { log } = useAdminLogger();
  const isPending = create.isPending || update.isPending;
  const isEdit = props.page !== null;

  React.useEffect(() => {
    if (props.open) {
      setTitle(props.page?.title ?? '');
      setSlug(props.page?.slug ?? '');
      setCategoryId(props.page?.category ?? props.defaultCategoryId ?? '');
      setContent(props.page?.content ?? '');
      setOrder(String(props.page?.order ?? 0));
      setSlugTouched(isEdit);
    }
  }, [props.open, props.page, props.defaultCategoryId]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugTouched) setSlug(toSlug(val));
  };

  async function handleSubmit() {
    if (!title.trim() || !slug.trim() || !categoryId) return;
    const payload = {
      id: props.page?.id,
      title: title.trim(),
      slug: slug.trim(),
      content,
      category: categoryId,
      order: Number(order) || 0,
    };
    try {
      if (isEdit) {
        await update.mutateAsync(payload);
        log({
          action: 'Wiki Page Updated',
          entity_type: 'Wiki Page',
          entity_id: props.page?.id ?? '',
          entity_name: title.trim(),
          changes: {
            title: { from: props.page?.title ?? '', to: title.trim() },
            slug: { from: props.page?.slug ?? '', to: slug.trim() },
          },
          metadata: { category_id: categoryId },
        });
      } else {
        const created = await create.mutateAsync(payload);
        log({
          action: 'Wiki Page Created',
          entity_type: 'Wiki Page',
          entity_id: (created as any)?.id ?? '',
          entity_name: title.trim(),
          changes: {},
          metadata: { slug: slug.trim(), category_id: categoryId },
        });
      }
      await refetch();
      props.onClose();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Failed to save page.', { variant: 'error' });
    }
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xl">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <>{isEdit ? 'Edit Wiki Page' : 'New Wiki Page'}</>

        <IconButton onClick={props.onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
        {/* Row 1: title + category + slug + order */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr 100px', gap: 2, alignItems: 'flex-start' }}>
          <TextField
            label="Title"
            variant="filled"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            fullWidth
            size="small"
            required
          />

          <TextField
            select
            label="Category"
            variant="filled"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            fullWidth
            size="small"
            required
          >
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Slug"
            variant="filled"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            fullWidth
            size="small"
            required
            helperText="Auto-generated · editable"
          />

          <TextField
            label="Order"
            variant="filled"
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            size="small"
            helperText="Lower first"
          />
        </Box>

        {/* Internal link syntax hint */}
        <Alert severity="info" sx={{ fontSize: '0.8rem', py: 0.5, '& .MuiAlert-message': { py: 0.5 } }}>
          <strong>Internal links:</strong>
          <br /> use{' '}
          <Box
            component="code"
            sx={{
              fontSize: '0.8em',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: alpha('#1976d2', 0.08),
            }}
          >
            {'[[category-slug]]'} or {` `}
            {'[[category-slug/page-slug]]'}
          </Box>{' '}
          in the content to link to another wiki page.
        </Alert>

        {/* Markdown editor (no practical character limit) */}
        <GenericMarkdownEditor content={content} setContent={setContent} characterLimit={100000} />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit" disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="success"
          disabled={isPending || !title.trim() || !slug.trim() || !categoryId}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {isEdit ? 'Save changes' : 'Create Page'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
