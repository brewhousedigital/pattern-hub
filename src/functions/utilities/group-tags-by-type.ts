import type { TypeTagV2Record, TypeTagTypeRecord } from '@/functions/database/tags';

export interface TypeTagGroup {
  /**
   * The tag's Type row, or null when this group's tags have no Type
   * assigned (the default "General" case). See groupTagsByType's own
   * comment for the one other, now-rare way a group can end up untyped.
   */
  type: TypeTagTypeRecord | null;
  /** Tag strings in this group, in their original relative order. */
  tags: string[];
}

/**
 * Groups a pattern's tag_refs by each tag's Type, for display. Groups by a
 * `tag_refs` id[] through an id-keyed lookup, which needs no case
 * normalization at all - an id either matches or it doesn't.
 *
 * An id with no matching row in `tagsV2` is skipped, not rendered in an
 * untyped fallback group: a relation can only ever hold a real id, so this
 * can only happen if the tags_v2 row it pointed at was deleted after the
 * fact (a narrow merge/delete-ordering gap, rare) - and showing a raw id in
 * place of a name would be worse than not rendering it at all.
 *
 * Groups sort by tag_types.sort_order (ties break on Type name); the
 * untyped group (a real tag with no Type assigned) always sorts last. Tags
 * keep their original relative order inside their own group.
 *
 * This function only groups and sorts. A caller decides how to render each
 * group's tags, based on group.type?.display_mode
 * ("standard" | "author" | "block") and group.type?.color.
 */
export function groupTagsByType(tagRefs: string[], tagsV2: TypeTagV2Record[]): TypeTagGroup[] {
  const byId = new Map<string, TypeTagV2Record>();
  for (const row of tagsV2) {
    byId.set(row.id, row);
  }

  const groups = new Map<string, TypeTagGroup>();
  const UNTYPED_KEY = '';

  for (const tagId of tagRefs) {
    const row = byId.get(tagId);
    if (!row) continue;
    const type = row.expand?.type ?? null;
    const key = type?.id ?? UNTYPED_KEY;
    let group = groups.get(key);
    if (!group) {
      group = { type, tags: [] };
      groups.set(key, group);
    }
    group.tags.push(row.tag);
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.type && !b.type) return 0;
    if (!a.type) return 1;
    if (!b.type) return -1;
    return a.type.sort_order - b.type.sort_order || a.type.name.localeCompare(b.type.name);
  });
}

/**
 * True when a group's Type uses the "author" display mode - every tag in
 * it represents a person. A generic tag-display surface that already shows
 * a pattern's author(s) some other way - the Attribution panel on
 * PatternViewContent.tsx, for example,
 * which reads patterns.authors/author_manual directly, not tags - should
 * filter these groups out before rendering, rather than showing the same
 * name a second time next to the tags that actually describe the pattern.
 */
export function isAuthorDisplayType(type: TypeTagTypeRecord | null): boolean {
  return type?.display_mode === 'author';
}

/**
 * Looks up a single tags_v2 row's Type, by id. The single-tag equivalent
 * of groupTagsByType, for a component that colors or labels each tag
 * individually instead of grouping tags into sections - e.g. Sidebar.tsx's
 * facet list, which keeps its own count-based sort instead of clustering by
 * Type. Takes a tags_v2 id, not a tag name. Returns null under the same
 * conditions groupTagsByType's untyped case does: no matching row, or a
 * matching row with no Type assigned.
 */
export function getTagType(tagId: string, tagsV2: TypeTagV2Record[]): TypeTagTypeRecord | null {
  const row = tagsV2.find((r) => r.id === tagId);
  return row?.expand?.type ?? null;
}

/**
 * True when a group's Type should render with no label or badge: either no
 * synced tags_v2 row (type: null) or the default "General" Type every tag
 * starts with. Matches the rule already used by the per-tag
 * Definition Page (src/routes/tags/$slug.tsx's showTypeBadge) - kept as one
 * function so the two places cannot drift on what counts as "the default
 * type".
 */
export function isDefaultTagType(type: TypeTagTypeRecord | null): boolean {
  return !type?.name || type.name.toLowerCase() === 'general';
}
