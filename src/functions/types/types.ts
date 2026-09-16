import React from 'react';
import type { TypePatternResponse } from '@/functions/database/patterns';

export type TypeComponentWithChildrenProps = {
  children?: React.ReactNode;
};

export type TypePaginationDatabaseResponse<PassThrough> = {
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  items: PassThrough[];
};

export type TypeReadOnlyDatabaseItem = {
  id: string;
  tag: string;
  count: number;
  manual?: number;
  user_id?: string;
  /** tags_v2.type relation id - present on `tag_usage` rows once that view's query selects it. */
  type?: string;
};

export type TypeTagObject = {
  tag: string;
  count: number;
  /** This tag's Type color, when the caller already knows it (e.g. Sidebar.tsx's drawer-mode groups, each already resolved by id upstream). */
  color?: string | null;
};

// This is shared between Favorites | Marked Done | Ratings
export type TypeFavoriteDoneRatingsResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  owner_id: string;
  pattern_id: string;
  rating: number;
  rating_notes: string;
  created: Date;
  updated: Date;
  expand: {
    pattern_id: TypePatternResponse;
  };
};

export type TypeViewData = {
  viewData: TypePatternResponse | undefined;
};
