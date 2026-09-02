import type { TypeTagV2Record, TypeTagTypeRecord } from '@/functions/database/tags';

export interface TypeTagGroup {
  /**
   * The tag's Type row, or null when the tag has no synced tags_v2 row yet.
   * This happens for a tag typed moments ago, before /api/sync-tag-catalog
   * has caught up (see TAG_REDESIGN_PROJECT_NOTES.md, Phase 1). Both this
   * and a tag whose Type is the default "General" row count as untyped for
   * display purposes - see isDefaultTagType below.
   */
  type: TypeTagTypeRecord | null;
  /** Tag strings in this group, in their original relative order. */
  tags: string[];
}

/**
 * Groups a pattern's flat tag list by each tag's Type, for display. See
 * TAG_REDESIGN_PROJECT_NOTES.md, Phase 3c. One group exists per distinct
 * Type present in `tags`, plus one group (type: null) for every tag with no
 * matching row in `tagsV2`. A tag missing from `tagsV2` still renders, in
 * this untyped group, rather than being silently dropped.
 *
 * Groups sort by tag_types.sort_order (ties break on Type name); the
 * untyped group always sorts last. Tags keep their original relative order
 * inside their own group.
 *
 * This function only groups and sorts. A caller decides how to render each
 * group's tags, based on group.type?.display_mode
 * ("standard" | "author" | "block") and group.type?.color.
 */
export function groupTagsByType(tags: string[], tagsV2: TypeTagV2Record[]): TypeTagGroup[] {
  const byTag = new Map<string, TypeTagV2Record>();
  for (const row of tagsV2) {
    byTag.set(row.tag.toLowerCase(), row);
  }

  const groups = new Map<string, TypeTagGroup>();
  const UNTYPED_KEY = '';

  for (const tag of tags) {
    const row = byTag.get(tag.toLowerCase());
    const type = row?.expand?.type ?? null;
    const key = type?.id ?? UNTYPED_KEY;
    let group = groups.get(key);
    if (!group) {
      group = { type, tags: [] };
      groups.set(key, group);
    }
    group.tags.push(tag);
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.type && !b.type) return 0;
    if (!a.type) return 1;
    if (!b.type) return -1;
    return a.type.sort_order - b.type.sort_order || a.type.name.localeCompare(b.type.name);
  });
}

/**
 * Looks up a single tag's Type row. The single-tag equivalent of
 * groupTagsByType, for a component that colors or labels each tag
 * individually instead of grouping tags into sections - e.g. Sidebar.tsx's
 * facet list, which keeps its own count-based sort instead of clustering by
 * Type (see TAG_REDESIGN_PROJECT_NOTES.md, Phase 3c). Returns null under
 * the same conditions groupTagsByType's untyped fallback group does: no
 * matching tags_v2 row, or that row has no Type assigned.
 */
export function getTagType(tag: string, tagsV2: TypeTagV2Record[]): TypeTagTypeRecord | null {
  const norm = tag.toLowerCase();
  const row = tagsV2.find((r) => r.tag.toLowerCase() === norm);
  return row?.expand?.type ?? null;
}

/**
 * True when a group's Type should render with no label or badge: either no
 * synced tags_v2 row (type: null) or the default "General" Type every tag
 * starts with (see Phase 1). Matches the rule already used by the per-tag
 * Definition Page (src/routes/tags/$slug.tsx's showTypeBadge) - kept as one
 * function so the two places cannot drift on what counts as "the default
 * type".
 */
export function isDefaultTagType(type: TypeTagTypeRecord | null): boolean {
  return !type?.name || type.name.toLowerCase() === 'general';
}
