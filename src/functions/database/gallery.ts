import type { TypePaginationDatabaseResponse } from '@/functions/types/types';

export type TypeGalleryResponse = {
  id: string;
  title: string;
  description: string;
  src: string;
  pattern_id: string;
  owner_id: string;
  created: Date;
  updated: Date;
};
