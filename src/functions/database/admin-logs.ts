import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useGlobalAuthData } from '@/data/auth-data';

export const ADMIN_LOGS_QUERY_KEY = ['AdminLogs'] as const;

export type TypeAdminLogChanges = Record<string, { from: unknown; to: unknown }>;

export type TypeAdminLogCreate = {
  admin_id: string;
  admin_name: string;
  /** Human-readable action label, e.g. "Pattern Updated", "Admin Deleted" */
  action: string;
  /** Area of the admin tool, e.g. "Pattern", "Tag", "Admin User" */
  entity_type: string;
  /** PocketBase record ID of the affected entity (empty string for bulk ops) */
  entity_id: string;
  /** Snapshot of the entity name/title at the time of the action */
  entity_name: string;
  /** Field-level diff: { fieldName: { from: oldValue, to: newValue } } */
  changes: TypeAdminLogChanges;
  /** Additional context that doesn't fit in changes (file uploads, bulk counts, etc.) */
  metadata: Record<string, unknown>;
};

export type TypeAdminLog = TypeAdminLogCreate & {
  id: string;
  created: string;
};

export type TypeAdminLogsQueryParams = {
  page: number;
  pageSize: number;
  search: string;
  entityType: string;
  adminId: string;
};

// Fire-and-forget — swallows errors so a logging failure never blocks the UI
export async function createAdminLog(payload: TypeAdminLogCreate): Promise<void> {
  try {
    await pocketbase.collection('admin_logs').create(payload);
  } catch (e) {
    console.warn('[AdminLog] Failed to write log entry:', e);
  }
}

/**
 * Compares two plain objects and returns only the fields that changed.
 * File fields are recorded as "[file uploaded]" rather than binary content.
 */
export function diffAdminChanges<T extends Record<string, unknown>>(
  before: T,
  after: T,
  textFields: (keyof T)[],
  fileFields: (keyof T)[] = [],
): TypeAdminLogChanges {
  const changes: TypeAdminLogChanges = {};
  for (const field of textFields) {
    const prev = before[field];
    const next = after[field];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes[String(field)] = { from: prev ?? null, to: next ?? null };
    }
  }
  for (const field of fileFields) {
    if (after[field]) {
      changes[String(field)] = {
        from: before[field] ? '[existing file]' : null,
        to: '[file uploaded]',
      };
    }
  }
  return changes;
}

/**
 * Hook that returns a `log()` function with admin identity pre-filled from
 * the current auth context. The call is fire-and-forget — no need to await.
 */
export function useAdminLogger() {
  const { authData } = useGlobalAuthData();

  const log = useCallback(
    (entry: Omit<TypeAdminLogCreate, 'admin_id' | 'admin_name'>) => {
      if (!authData) return;
      createAdminLog({
        ...entry,
        admin_id: authData.id,
        admin_name: authData.name || authData.email || authData.id,
      });
    },
    [authData],
  );

  return { log };
}

export const useQueryGetAdminLogs = (params: TypeAdminLogsQueryParams) => {
  return useQuery({
    queryKey: [...ADMIN_LOGS_QUERY_KEY, params],
    queryFn: async () => {
      const filters: string[] = [];
      if (params.search.trim()) {
        const safe = params.search.trim().replace(/"/g, '\\"');
        filters.push(
          `(action ~ "${safe}" || entity_name ~ "${safe}" || admin_name ~ "${safe}" || entity_type ~ "${safe}")`,
        );
      }
      if (params.entityType) filters.push(`entity_type = "${params.entityType}"`);
      if (params.adminId) filters.push(`admin_id = "${params.adminId}"`);

      return await pocketbase.collection('admin_logs').getList<TypeAdminLog>(params.page + 1, params.pageSize, {
        sort: '-created',
        ...(filters.length ? { filter: filters.join(' && ') } : {}),
      });
    },
    placeholderData: (prev) => prev,
  });
};
