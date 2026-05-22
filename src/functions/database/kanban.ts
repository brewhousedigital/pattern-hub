import { pocketbase } from '@/functions/database/authentication-setup';
import { useMutation, useQuery } from '@tanstack/react-query';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const KANBAN_COLUMNS_QUERY_KEY = ['KanbanColumns'] as const;
export const KANBAN_ITEMS_QUERY_KEY = ['KanbanItems'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypeKanbanPriority = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type TypeKanbanColumn = {
  id: string;
  collectionId: string;
  collectionName: string;
  title: string;
  /** Float; determines left-to-right order. */
  position: number;
  /** Optional hex accent color for the column header (e.g. "#4caf50"). */
  color: string;
  /** Marks the special Done column — items are capped to the 5 most-recently updated. */
  is_done: boolean;
  /** Optional; column header turns amber / red when item count reaches / exceeds this. */
  wip_limit: number;
  created: string;
  updated: string;
};

export type TypeKanbanItem = {
  id: string;
  collectionId: string;
  collectionName: string;
  /** FK to kanban_columns */
  column_id: string;
  title: string;
  description: string;
  /** JSON array of label strings */
  labels: string[];
  priority: TypeKanbanPriority;
  /** Float; determines top-to-bottom order within a column. */
  position: number;
  /** ISO date string (YYYY-MM-DD) */
  due_date: string;
  assignee: string;
  created: string;
  updated: string;
};

// ─── Display constants ────────────────────────────────────────────────────────

export const PRIORITY_COLORS: Record<TypeKanbanPriority, string> = {
  none: '#9e9e9e',
  low: '#4caf50',
  medium: '#ff9800',
  high: '#ff6d00',
  critical: '#f44336',
};

export const PRIORITY_LABELS: Record<TypeKanbanPriority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useQueryGetKanbanColumns = () => {
  return useQuery({
    queryKey: KANBAN_COLUMNS_QUERY_KEY,
    queryFn: async (): Promise<TypeKanbanColumn[]> => {
      return await pocketbase.collection('kanban_columns').getFullList<TypeKanbanColumn>({
        sort: 'position',
      });
    },
    refetchOnMount: 'always',
  });
};

export const useQueryGetAllKanbanItems = () => {
  return useQuery({
    queryKey: KANBAN_ITEMS_QUERY_KEY,
    queryFn: async (): Promise<TypeKanbanItem[]> => {
      return await pocketbase.collection('kanban_items').getFullList<TypeKanbanItem>({
        sort: 'position',
      });
    },
    refetchOnMount: 'always',
  });
};

// ─── Column mutations ─────────────────────────────────────────────────────────

type CreateColumnPayload = {
  title: string;
  position: number;
  color?: string;
  is_done?: boolean;
  wip_limit?: number;
};

export const useMutationCreateColumn = () => {
  return useMutation({
    mutationFn: async (payload: CreateColumnPayload): Promise<TypeKanbanColumn> => {
      return await pocketbase.collection('kanban_columns').create<TypeKanbanColumn>(payload);
    },
  });
};

export const useMutationUpdateColumn = () => {
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<TypeKanbanColumn> & { id: string }): Promise<TypeKanbanColumn> => {
      return await pocketbase.collection('kanban_columns').update<TypeKanbanColumn>(id, body);
    },
  });
};

export const useMutationDeleteColumn = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pocketbase.collection('kanban_columns').delete(id);
    },
  });
};

// ─── Item mutations ───────────────────────────────────────────────────────────

type CreateItemPayload = {
  column_id: string;
  title: string;
  description?: string;
  labels?: string[];
  priority?: TypeKanbanPriority;
  position: number;
  due_date?: string;
  assignee?: string;
};

export const useMutationCreateItem = () => {
  return useMutation({
    mutationFn: async (payload: CreateItemPayload): Promise<TypeKanbanItem> => {
      return await pocketbase.collection('kanban_items').create<TypeKanbanItem>(payload);
    },
  });
};

export const useMutationUpdateItem = () => {
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<TypeKanbanItem> & { id: string }): Promise<TypeKanbanItem> => {
      return await pocketbase.collection('kanban_items').update<TypeKanbanItem>(id, body);
    },
  });
};

export const useMutationDeleteItem = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pocketbase.collection('kanban_items').delete(id);
    },
  });
};
