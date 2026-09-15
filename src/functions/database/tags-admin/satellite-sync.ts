import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import {
  escapeTagFilterValue,
  findTagV2Record,
  uniqueSlugFor,
  type TypePatternRecord,
  type TypeTagHierarchyRecord,
  type TypeTagV2Record,
  type TypeImpliedTagRecord,
  type TypeTagAliasRecord,
} from '@/functions/database/tags';
import { slugifyTag } from '@/functions/utilities/slugify-tag';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';

export type OperationType = 'rename' | 'delete' | 'merge';

/**
 * Fetch ALL patterns whose tag_refs contains a specific tags_v2 id. Uses the
 * `~`-on-a-multi-relation-column idiom already proven live for
 * patterns.authors (`authors ~ id`), not a quote-wrapped match - ids are
 * opaque, fixed-length strings, not human text a substring match could
 * accidentally over-match the way a tag name could.
 *
 * This is the only reliable way to find every pattern carrying a tag -
 * patterns.tags (the older, now-frozen string field) stops being written on
 * a normal edit, so a tag added since then reaches tag_refs only and a
 * string search against patterns.tags would silently miss it.
 */
export async function fetchPatternsWithTagRef(tagId: string): Promise<TypePatternRecord[]> {
  const records: TypePatternRecord[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const result = await pocketbase
      .collection('patterns')
      .getList<TypePatternRecord>(page, perPage, { filter: `tag_refs ~ '${tagId}'`, fields: 'id,tag_refs,name' });
    records.push(...result.items);
    if (records.length >= result.totalItems) break;
    page++;
  }

  return records;
}

/**
 * Repoints (merge) or removes (delete) a tags_v2 id across every pattern's
 * tag_refs. Pass a real `toId` to swap `fromId` for it (deduping if a
 * pattern already carried both - merge's case); pass `null` to just remove
 * `fromId` (delete's case, no replacement).
 *
 * Runs server-side via /api/admin-repoint-pattern-tag-refs (see
 * pb_hooks/main.pb.js) instead of looping over patterns.update() calls
 * from the browser. That older version needed a 3-second delay between
 * every single pattern purely to stay under PocketHost's rate limit on
 * requests from the browser (see processSequentially's own doc comment) -
 * for a tag used on a few hundred patterns, that meant several minutes.
 * The hook does the same writes in-process, in one transaction, with no
 * such delay needed - PocketHost's rate limiter applies to that
 * browser-facing HTTP layer, not to a hook writing directly to its own
 * database. There's no onProgress parameter anymore either - this is one
 * request now, not N throttled ones, so there's nothing to report
 * mid-flight; callers still get the same final affected-patterns list.
 *
 * Returns the affected patterns (id + name) so the caller can still build
 * an accurate admin-log entry without a second fetch.
 */
export async function repointPatternTagRefs(
  fromId: string,
  toId: string | null,
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${pocketbaseDomain}/api/admin-repoint-pattern-tag-refs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`,
    },
    body: JSON.stringify({ fromId, toId }),
  });
  if (!res.ok) throw new Error('Failed to repoint patterns');
  const data: { patternsAffected: { id: string; name: string }[] } = await res.json();
  return data.patternsAffected;
}

// ─── tags_v2 lookup + slug helpers ─────────────────────────────────────────────
//
// tags_v2 is the canonical tag-metadata table - a row here holds a tag's
// Type, Definition, and disambiguation note. syncSatelliteTablesForOp below
// keeps it in sync with tag_hierarchy whenever an admin renames, merges, or
// deletes a tag, so those satellite fields never silently detach from the
// live tag string. Uses the full TypeTagV2Record imported from
// functions/database/tags.ts (the same type the tag metadata dialog
// reads/writes) rather than a narrower local shape.

// findTagV2Record/isSlugTaken/uniqueSlugFor/resolveOrCreateTagV2Row now all
// live in functions/database/tags.ts, so resolveOrCreateTagRefs there can
// share them too - imported above instead of defined here.

// ─── implied_tags / tag_aliases sync helpers ───────────────────────────────────
//
// Re-points every implied_tags edge mentioning `oldTag` (on either side) to
// mention `newTag` instead. Used for both rename and merge - from this
// table's perspective the two have the same effect: oldTag stops existing
// as a distinct tag, and every fact recorded about it should transfer to
// newTag rather than vanish. Skips (deletes, rather than creating) an edge
// that would become a self-loop (newTag implies newTag) or a duplicate of
// an edge newTag already has - both are meaningless once merged, and the
// unique index on (tag, implies_tag) would reject the duplicate anyway.
//
// newTagId is optional, merge-only. A rename never
// needs it - the underlying tags_v2 row keeps its own id, so tag_ref/
// implies_tag_ref already point at the right row and don't need touching.
// A merge does change which row an edge should point at (the source row
// gets deleted), so the caller passes the target's real id there, and this
// sets it in the SAME update call as the string retarget - not a second,
// separate pass over these rows, which could race against this function's
// own delete-on-self-loop/duplicate branches below (a second pass trying
// to update a row this pass just deleted would fail outright).
export async function retargetImpliedTagEdges(oldTag: string, newTag: string, newTagId?: string) {
  // A rename/merge where the tag didn't actually change (oldTag and newTag
  // normalize to the same string - a case-only edit, say) has nothing to
  // retarget. Without this guard, the query below for "every edge already
  // touching newTag" is identical to "every edge touching oldTag", so every
  // edge in outgoing/incoming would incorrectly look like a pre-existing
  // duplicate of itself and get deleted - silently wiping the tag's whole
  // implied-tags graph. Found and fixed via code review.
  if (oldTag === newTag) return;

  const oldSafe = escapeTagFilterValue(oldTag);
  const newSafe = escapeTagFilterValue(newTag);
  // requestKey: null on all three - PocketBase auto-derives a request key
  // from method + collection path alone, ignoring the filter (same
  // mechanism useQueryAdminTagStats's own comment in
  // functions/database/tags.ts documents), so three concurrent getFullList
  // calls against the same collection would otherwise share one key and
  // silently auto-cancel each other. Found via a live "request was
  // aborted" error on rename.
  const [outgoingRaw, incomingRaw, newTagEdges] = await Promise.all([
    pocketbase
      .collection('implied_tags')
      .getFullList<TypeImpliedTagRecord>({ filter: `tag = "${oldSafe}"`, requestKey: null }),
    pocketbase
      .collection('implied_tags')
      .getFullList<TypeImpliedTagRecord>({ filter: `implies_tag = "${oldSafe}"`, requestKey: null }),
    pocketbase.collection('implied_tags').getFullList<TypeImpliedTagRecord>({
      filter: `tag = "${newSafe}" || implies_tag = "${newSafe}"`,
      requestKey: null,
    }),
  ]);

  // A self-loop row (tag === implies_tag === oldTag) matches both queries
  // above as two separate snapshots of the same record. Handle it once,
  // here, by deleting it outright - a tag implying itself is never
  // meaningful, rename or not - rather than letting the two loops below
  // each independently update their own stale copy and resurrect it as a
  // self-loop under the new name.
  const selfLoopIds = new Set(outgoingRaw.filter((e) => e.implies_tag === oldTag).map((e) => e.id));
  for (const id of selfLoopIds) {
    await pocketbase.collection('implied_tags').delete(id);
  }
  const outgoing = outgoingRaw.filter((e) => !selfLoopIds.has(e.id));
  const incoming = incomingRaw.filter((e) => !selfLoopIds.has(e.id));

  const existingEdgeKeys = new Set(newTagEdges.map((e) => `${e.tag} ${e.implies_tag}`));

  for (const edge of outgoing) {
    const key = `${newTag} ${edge.implies_tag}`;
    if (edge.implies_tag === newTag || existingEdgeKeys.has(key)) {
      await pocketbase.collection('implied_tags').delete(edge.id);
    } else {
      await pocketbase
        .collection('implied_tags')
        .update(edge.id, newTagId ? { tag: newTag, tag_ref: newTagId } : { tag: newTag });
      existingEdgeKeys.add(key);
    }
  }
  for (const edge of incoming) {
    const key = `${edge.tag} ${newTag}`;
    if (edge.tag === newTag || existingEdgeKeys.has(key)) {
      await pocketbase.collection('implied_tags').delete(edge.id);
    } else {
      await pocketbase
        .collection('implied_tags')
        .update(edge.id, newTagId ? { implies_tag: newTag, implies_tag_ref: newTagId } : { implies_tag: newTag });
      existingEdgeKeys.add(key);
    }
  }
}

export async function deleteImpliedTagEdgesFor(deletedTag: string) {
  const safe = escapeTagFilterValue(deletedTag);
  const edges = await pocketbase
    .collection('implied_tags')
    .getFullList<TypeImpliedTagRecord>({ filter: `tag = "${safe}" || implies_tag = "${safe}"` });
  for (const edge of edges) {
    await pocketbase.collection('implied_tags').delete(edge.id);
  }
}

// Same substitution principle as retargetImpliedTagEdges, for tag_aliases.
// `target_tag` has no unique constraint (many aliases can share a root), so
// re-pointing every alias that pointed at oldTag is unconditional. `alias`
// does have a unique constraint - if newTag is already registered as some
// other alias, that's a real conflict, not something to silently resolve,
// so the old row is left as-is for an admin to sort out by hand, the same
// "flag for review" principle used elsewhere for an author-name collision.
// newTagId is optional, merge-only, same reasoning as
// retargetImpliedTagEdges's own newTagId parameter. Only ever applied to the
// asTarget loop below - target_tag_ref exists because a target is always a
// real tag, but alias itself never gets a ref field (deliberately: an alias
// like "orca" is allowed to have no tags_v2 row of its own), so the
// asAlias loop has nothing to repoint regardless of rename or merge.
export async function retargetTagAliases(oldTag: string, newTag: string, newTagId?: string) {
  if (oldTag === newTag) return; // see retargetImpliedTagEdges - nothing changed, nothing to retarget

  const oldSafe = escapeTagFilterValue(oldTag);
  // requestKey: null on both - same same-collection auto-cancellation
  // hazard as retargetImpliedTagEdges above.
  const [asAliasRaw, asTargetRaw] = await Promise.all([
    pocketbase
      .collection('tag_aliases')
      .getFullList<TypeTagAliasRecord>({ filter: `alias = "${oldSafe}"`, requestKey: null }),
    pocketbase
      .collection('tag_aliases')
      .getFullList<TypeTagAliasRecord>({ filter: `target_tag = "${oldSafe}"`, requestKey: null }),
  ]);

  // A row aliased to itself (alias === target_tag === oldTag) matches both
  // queries above as two separate snapshots of the same record - same
  // self-reference hazard as retargetImpliedTagEdges above. Handle it once,
  // here, by deleting it outright, rather than letting both loops below
  // process their own stale copy and resurrect it as a self-alias under
  // the new name.
  const selfAliasIds = new Set(asAliasRaw.filter((r) => r.target_tag === oldTag).map((r) => r.id));
  for (const id of selfAliasIds) {
    await pocketbase.collection('tag_aliases').delete(id);
  }
  const asAlias = asAliasRaw.filter((r) => !selfAliasIds.has(r.id));
  const asTarget = asTargetRaw.filter((r) => !selfAliasIds.has(r.id));

  for (const row of asTarget) {
    if (row.alias === newTag) {
      // Would become a no-op self-reference (newTag aliased to itself) -
      // same guard the asAlias loop below already had; this loop was
      // missing it (found via code review).
      await pocketbase.collection('tag_aliases').delete(row.id);
      continue;
    }
    await pocketbase
      .collection('tag_aliases')
      .update(row.id, newTagId ? { target_tag: newTag, target_tag_ref: newTagId } : { target_tag: newTag });
  }
  for (const row of asAlias) {
    if (row.target_tag === newTag) {
      // Would become a no-op self-reference (newTag aliased to itself).
      await pocketbase.collection('tag_aliases').delete(row.id);
      continue;
    }
    const conflict = await pocketbase
      .collection('tag_aliases')
      .getFirstListItem(`alias = "${escapeTagFilterValue(newTag)}"`)
      .catch(() => null);
    if (conflict) continue; // leave for manual review - see comment above
    await pocketbase.collection('tag_aliases').update(row.id, { alias: newTag });
  }
}

export async function deleteTagAliasesFor(deletedTag: string) {
  const safe = escapeTagFilterValue(deletedTag);
  const rows = await pocketbase
    .collection('tag_aliases')
    .getFullList<TypeTagAliasRecord>({ filter: `alias = "${safe}" || target_tag = "${safe}"` });
  for (const row of rows) {
    await pocketbase.collection('tag_aliases').delete(row.id);
  }
}

// ─── Satellite-table sync ──────────────────────────────────────────────────────
//
// Always fetches fresh records from PocketBase so stale React Query cache
// can never cause a missed update. Called for every rename / merge / delete
// operation. Keeps five things in sync with the tag string itself - four
// satellite tables, plus patterns.tag_refs directly, since a merge or
// delete can change or remove which tags_v2 row a pattern's own tag_refs
// should point at:
//
//   tag_hierarchy (parent/child, superseded by the implied-tags graph below
//   but still kept in sync, since the admin hierarchy editor still reads it):
//     rename  - updates the tag's own name in its parent record and updates
//               every child's parent_tag reference to the new name.
//     merge   - removes the source tag's own parent record (it no longer
//               exists) and re-parents its children to the merge target.
//     delete  - removes the tag's own parent record and removes the parent
//               records of any children (they become root tags).
//
//   tags_v2 (Type, Definition, disambiguation note - see the section above):
//     rename  - updates the row's `tag` to the new name. If the new name
//               slugifies to something different, assigns a fresh unique
//               slug and files the old slug into `previous_slugs`, so a
//               bookmarked or indexed Definition Page URL still redirects
//               instead of 404ing.
//     merge   - carries the source's slug (and its own previous_slugs) into
//               the target's previous_slugs, creating a minimal target row
//               first if one doesn't exist yet, then deletes the source
//               row - preserving the same redirect-instead-of-404 guarantee
//               rename gets, without transferring Type/Definition (the two
//               tags may not actually mean the same thing, so only the URL
//               history carries over, not the content). Every id reference
//               to the source row - patterns.tag_refs, and implied_tags/
//               tag_aliases' ref fields - is repointed to the target BEFORE
//               this delete runs, never after or concurrently with it; a
//               dangling reference to an id that no longer exists is a real
//               hazard this order exists specifically to avoid.
//     delete  - repoints (see above) removes the id from every referencing
//               row first, same ordering reasoning as merge, then deletes
//               the row.
//
//   patterns.tag_refs:
//     rename  - untouched. The tags_v2 row keeps its own id when renamed,
//               so every pattern already pointing at it is still correct.
//     merge   - every pattern found via tag_refs ~ sourceId gets the source
//               id swapped for the target's (deduped, in case a pattern
//               already carried both).
//     delete  - every pattern found via tag_refs ~ deletedId gets that id
//               removed, no replacement.
//
//   implied_tags (the multi-parent graph - see the helpers above):
//     rename  - retargets every edge's tag/implies_tag string mentioning the
//               old name to the new one. Never touches tag_ref/
//               implies_tag_ref - see retargetImpliedTagEdges' own comment
//               on why a rename never needs to.
//     merge   - same string retarget as rename, plus (unlike rename)
//               repoints tag_ref/implies_tag_ref from the source id to the
//               target's, in the same update call - see
//               retargetImpliedTagEdges' own comment.
//     delete  - removes every edge mentioning the deleted tag outright (both
//               string and id fields go with the row - nothing is left to
//               go stale).
//
//   tag_aliases (see the helpers above):
//     rename  - retargets every alias/target_tag string reference to the new
//               name. Same as implied_tags: never touches target_tag_ref -
//               a rename never needs to.
//     merge   - same string retarget as rename, plus repoints
//               target_tag_ref from the source id to the target's.
//     delete  - removes every alias/target reference to the deleted tag
//               outright, same reasoning as implied_tags' delete case.
//
// Returns the patterns a merge or delete's tag_refs repoint actually
// touched (id + name), so the caller can build an accurate admin-log entry
// without a second fetch. Always empty for rename, which touches no
// patterns at all.
export async function syncSatelliteTablesForOp(
  type: OperationType,
  tag: string,
  newTag?: string,
): Promise<{ patternsAffected: { id: string; name: string }[]; mergedInstead?: boolean }> {
  // normalizeTagName (not a local .toLowerCase().trim()) so this always
  // agrees with what every pattern-save path stores - collapsing internal
  // whitespace too, not just casing. Found via code review: the old local
  // normalization let a tag with doubled internal spaces fork into a clean
  // form in patterns.tags and a stale, never-matching tags_v2 row.
  const safe = normalizeTagName(tag);
  const safeFilter = escapeTagFilterValue(safe);

  // requestKey: null on both tag_hierarchy calls - same same-collection
  // auto-cancellation hazard as retargetImpliedTagEdges above (getFirstListItem
  // and getFullList against the same collection still share PocketBase's
  // default request key, ignoring the fact that one filters on `tag` and the
  // other on `parent_tag`).
  const [ownRecord, childRecords, tagV2Record] = await Promise.all([
    pocketbase
      .collection('tag_hierarchy')
      .getFirstListItem<TypeTagHierarchyRecord>(`tag = "${safeFilter}"`, { requestKey: null })
      .catch(() => null),
    pocketbase
      .collection('tag_hierarchy')
      .getFullList<TypeTagHierarchyRecord>({ filter: `parent_tag = "${safeFilter}"`, requestKey: null }),
    findTagV2Record(safe),
  ]);

  if (type === 'rename' && newTag && tagV2Record) {
    const safeNewCheck = normalizeTagName(newTag);
    // (tag, type) is what's actually unique on tags_v2, not tag alone - a
    // different-typed row sharing this name isn't a collision at all, it's
    // the exact disambiguation this whole system exists to support (a
    // General "autumn" and an Author "autumn" coexisting, say). Only a
    // same-typed row would make the update below fail PocketBase's own
    // unique index with validation_not_unique - found via a live rename
    // that hit exactly that. When one exists, the right move is the one
    // the user already gets when picking an existing name in the merge
    // flow: repoint everything at it and retire this row, not fail. Reuses
    // the merge branch below wholesale rather than duplicating its
    // repoint-then-delete ordering here.
    if (safeNewCheck !== safe) {
      const collision = await pocketbase
        .collection('tags_v2')
        .getFirstListItem<TypeTagV2Record>(
          `tag = "${escapeTagFilterValue(safeNewCheck)}" && type = "${tagV2Record.type}" && id != "${tagV2Record.id}"`,
          { requestKey: null },
        )
        .catch(() => null);
      if (collision) {
        const result = await syncSatelliteTablesForOp('merge', tag, newTag);
        return { ...result, mergedInstead: true };
      }
    }
  }

  if (type === 'rename' && newTag) {
    const safeNew = normalizeTagName(newTag);
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').update(ownRecord.id, { tag: safeNew });
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }
    if (tagV2Record) {
      const candidateSlug = slugifyTag(safeNew);
      const slugChanged = candidateSlug !== '' && candidateSlug !== tagV2Record.slug;
      const newSlug = slugChanged ? await uniqueSlugFor(candidateSlug, tagV2Record.id) : tagV2Record.slug;
      const previousSlugs = slugChanged
        ? [...new Set([...tagV2Record.previous_slugs, tagV2Record.slug])]
        : tagV2Record.previous_slugs;
      await pocketbase
        .collection('tags_v2')
        .update(tagV2Record.id, { tag: safeNew, slug: newSlug, previous_slugs: previousSlugs });
    }
    await retargetImpliedTagEdges(safe, safeNew);
    await retargetTagAliases(safe, safeNew);
    return { patternsAffected: [] };
  } else if (type === 'merge' && newTag) {
    const safeNew = normalizeTagName(newTag);
    // Merging a tag into itself (the same normalized name - a case-only
    // "merge," say) is meaningless, the same guard retargetImpliedTagEdges/
    // retargetTagAliases already apply. Without it, the tags_v2 branch
    // below would find its own row as `targetRecord`, update it, then
    // immediately delete that same row (tagV2Record.id === targetRecord.id)
    // as its own "source" cleanup - meaningfully worse now that patterns
    // reference tags by id: every pattern's tag_refs would get "repointed"
    // to the id of the row that just got deleted out from under it, going
    // dangling. RenamePanel's own canSubmit already disables the button for
    // this input, so this specific trigger isn't reachable through the live
    // admin UI today - this guard is defense in depth, not a fix for a
    // reachable path, and stays regardless in case a future caller of this
    // function doesn't carry the same UI-level guard.
    if (safe === safeNew) return { patternsAffected: [] };
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }

    let patternsAffected: { id: string; name: string }[] = [];
    if (tagV2Record) {
      const carriedSlugs = [tagV2Record.slug, ...tagV2Record.previous_slugs];
      const targetRecord = await findTagV2Record(safeNew);
      let targetId: string;
      if (targetRecord) {
        await pocketbase.collection('tags_v2').update(targetRecord.id, {
          previous_slugs: [...new Set([...targetRecord.previous_slugs, ...carriedSlugs])],
        });
        targetId = targetRecord.id;
      } else {
        const baseSlug = slugifyTag(safeNew);
        const targetSlug = baseSlug ? await uniqueSlugFor(baseSlug, '') : safeNew;
        const created = await pocketbase
          .collection('tags_v2')
          .create<TypeTagV2Record>({ tag: safeNew, slug: targetSlug, previous_slugs: [...new Set(carriedSlugs)] });
        targetId = created.id;
      }

      // Every id reference to the source row must be repointed to targetId
      // before the source row is deleted below - see this function's own
      // doc comment.
      patternsAffected = await repointPatternTagRefs(tagV2Record.id, targetId);
      await retargetImpliedTagEdges(safe, safeNew, targetId);
      await retargetTagAliases(safe, safeNew, targetId);

      await pocketbase.collection('tags_v2').delete(tagV2Record.id);
    } else {
      await retargetImpliedTagEdges(safe, safeNew);
      await retargetTagAliases(safe, safeNew);
    }
    return { patternsAffected };
  } else if (type === 'delete') {
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').delete(child.id);
    }

    let patternsAffected: { id: string; name: string }[] = [];
    if (tagV2Record) {
      // Same ordering discipline as merge: every pattern's tag_refs loses
      // this id before the tags_v2 row itself is deleted.
      patternsAffected = await repointPatternTagRefs(tagV2Record.id, null);
      await pocketbase.collection('tags_v2').delete(tagV2Record.id);
    }
    await deleteImpliedTagEdgesFor(safe);
    await deleteTagAliasesFor(safe);
    return { patternsAffected };
  }

  return { patternsAffected: [] };
}
