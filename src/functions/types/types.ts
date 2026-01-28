import React from 'react';

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
