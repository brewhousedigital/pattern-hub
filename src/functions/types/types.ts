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
};

export type TypeTagObject = {
  tag: string;
  count: number;
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
