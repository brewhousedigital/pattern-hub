import { z } from 'zod';

export const RESOURCE_SORT_OPTIONS = [
  { value: '-created', label: 'Newest' },
  { value: 'created', label: 'Oldest' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
] as const;

export type TypeResourceSortValue = (typeof RESOURCE_SORT_OPTIONS)[number]['value'];

// 1-indexed, matching PaginationBox / PocketBase's getList(page, ...) - not
// the 0-indexed convention MUI DataGrid's paginationModel uses elsewhere.
export const learningResourceSearchSchema = z.object({
  q: z.string().default(''),
  sort: z.enum(['-created', 'created', 'title', '-title']).default('-created'),
  page: z.coerce.number().int().min(1).default(1),
});

export type TypeLearningResourceSearch = z.infer<typeof learningResourceSearchSchema>;
