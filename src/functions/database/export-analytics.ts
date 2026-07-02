import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';

// ─── Export analytics ──────────────────────────────────────────────────────────
//
// Records an event every time a user exports/downloads a pattern. Mirrors the
// Audit Log system (admin-logs.ts): writes are fire-and-forget and swallow all
// errors so a logging failure can never block the export or the render flow.
//
// PocketBase `analytics_exports` collection rules:
//   • Create: open (public) — fires for both authenticated and anonymous users
//   • List / View / Update / Delete: restricted to admins (same as `admin_logs`)
//
// `user_id` is resolved from the auth store at call time: the signed-in user's
// id when authenticated, or '' for anonymous visitors.

export const EXPORT_EVENTS_QUERY_KEY = ['ExportEvents'] as const;

export type ExportFileType = 'pdf' | 'png' | 'jpg' | 'webp' | 'svg';
export type ExportPdfMode = 'single' | 'tiled';

/**
 * Known download "flows" — the intended use of the export. Stored as a plain
 * string so new flows can be added without a schema/type change; this const is
 * the canonical list for the upcoming multistep export flow.
 */
export const EXPORT_FLOWS = ['cricut', 'craft cutter', 'printing', 'saving for later', 'editing', 'generic'] as const;
export type ExportFlow = (typeof EXPORT_FLOWS)[number];

export type TypeExportEventCreate = {
  /** PocketBase user id, or '' for anonymous visitors. Resolved automatically. */
  user_id: string;
  /** The pattern that was exported. */
  pattern_id: string;
  /** Download file type. */
  file_type: ExportFileType | string;
  /** Intended use of the export (e.g. 'cricut', 'printing'). '' until selected. */
  flow: string;
  /** Output width in `size_unit` (0 when not applicable). */
  width: number;
  /** Output height in `size_unit` (0 when not applicable). */
  height: number;
  /** Unit of width/height: 'in' | 'cm' | 'mm' | 'px'. */
  size_unit: string;
  /** Resolution for raster exports (0 when not applicable). */
  dpi: number;
  /** Paper preset for PDF exports, e.g. 'Letter' / 'A4' ('' when not a PDF). */
  page_size: string;
  /** PDF layout: 'single' | 'tiled' ('' when not a PDF). */
  pdf_mode: ExportPdfMode | '';
  /** Whether the legend was included in the export. */
  legend_included: boolean;
  /** Whether instructions were appended to the export. */
  instructions_included: boolean;
};

export type TypeExportEvent = TypeExportEventCreate & {
  id: string;
  created: string;
};

/**
 * Caller-facing input. Everything except `file_type` is optional — the upcoming
 * multi-step export flow fills fields in progressively, and `user_id` is always
 * resolved internally from the auth store (never passed by the caller).
 */
export type TypeExportEventInput = Partial<Omit<TypeExportEventCreate, 'user_id'>> &
  Pick<TypeExportEventCreate, 'file_type'>;

/**
 * Fire-and-forget. Records a single export event. Never throws and never blocks
 * the export — call it without awaiting (e.g. `void trackExportEvent({ ... })`).
 */
export async function trackExportEvent(event: TypeExportEventInput): Promise<void> {
  try {
    const payload: TypeExportEventCreate = {
      user_id: pocketbase.authStore.record?.id ?? '',
      pattern_id: event.pattern_id ?? '',
      file_type: event.file_type,
      flow: event.flow ?? '',
      width: event.width ?? 0,
      height: event.height ?? 0,
      size_unit: event.size_unit ?? '',
      dpi: event.dpi ?? 0,
      page_size: event.page_size ?? '',
      pdf_mode: event.pdf_mode ?? '',
      legend_included: event.legend_included ?? false,
      instructions_included: event.instructions_included ?? false,
    };
    await pocketbase.collection('analytics_exports').create(payload);
  } catch (e) {
    // Analytics must never affect the user-facing export flow.
    console.warn('[ExportAnalytics] Failed to record export event:', e);
  }
}

// ─── Admin read access ──────────────────────────────────────────────────────────

export type TypeExportEventsQueryParams = {
  page: number;
  pageSize: number;
  /** Free-text match against pattern_id / user_id. */
  search: string;
  fileType: string;
  flow: string;
};

/**
 * Admin-only listing of export events. The collection's List rule restricts
 * access to admins server-side; this hook is for the future analytics view.
 */
export const useQueryGetExportEvents = (params: TypeExportEventsQueryParams) => {
  return useQuery({
    queryKey: [...EXPORT_EVENTS_QUERY_KEY, params],
    queryFn: async () => {
      const filters: string[] = [];
      if (params.search.trim()) {
        const safe = params.search.trim().replace(/"/g, '\\"');
        filters.push(`(pattern_id ~ "${safe}" || user_id ~ "${safe}")`);
      }
      if (params.fileType) filters.push(`file_type = "${params.fileType}"`);
      if (params.flow) filters.push(`flow = "${params.flow}"`);

      return await pocketbase
        .collection('analytics_exports')
        .getList<TypeExportEvent>(params.page + 1, params.pageSize, {
          sort: '-created',
          ...(filters.length ? { filter: filters.join(' && ') } : {}),
        });
    },
    placeholderData: (prev) => prev,
  });
};
