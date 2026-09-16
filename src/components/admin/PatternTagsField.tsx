import React from 'react';
import { useDebounce } from '@/functions/hooks/useDebounce';
import {
  useQueryAdminTagStatsPaginated,
  useQuerySearchTagsV2,
  useQueryGetImpliedTags,
  useQueryGetAllTagAliases,
  useQueryAuthorTagIds,
  useQueryGetAllTagsV2,
  deriveHierarchyInherited,
  applyManualTagChange,
  applyKeyTagChange,
  type TypeTagTypeRecord,
} from '@/functions/database/tags';
import { FancyAutocomplete } from '@/components/FancyAutocomplete';

type PatternTagsFieldProps = {
  value: string[];
  /**
   * `preferredTagRefs` is a norm(tag) -> tags_v2 id map, protecting a tag
   * this pattern is already linked to (passed in via the caller's own `initialValues`, see
   * AdminEditPatternModal.tsx) from being silently re-resolved to a
   * different row of the same name on an unrelated save. Pass straight
   * through to resolveOrCreateTagRefs's own `preferredIds` parameter at
   * save time, unmodified. Always the complete, current map for `newValue`
   * as a whole, not a delta - safe to just store and forward.
   */
  onChange: (newValue: string[], preferredTagRefs: Map<string, string>) => void;
  /**
   * Identifies the record currently being edited (e.g. a pattern or
   * submission id). When this changes, the inherited-tag set is recomputed
   * from scratch instead of carrying over from whatever was previously loaded.
   */
  resetKey?: string;
  /**
   * Live union of tags carried by the pattern's currently-assigned pattern
   * keys (see useResolveKeyTags in functions/database/patterns.ts). Tags no
   * longer covered by any assigned key are dropped automatically, mirroring
   * this field's own implied-tag cleanup below.
   */
  keyTags?: string[];
};

// Shared by AdminEditPatternModal and the user-submission review page so tag
// search + implied-tag behavior can't drift between the two editing surfaces.
export const PatternTagsField = (props: PatternTagsFieldProps) => {
  const { value, onChange } = props;
  const keyTags = props.keyTags ?? [];

  const [tagInput, setTagInput] = React.useState('');
  const debouncedTagSearch = useDebounce(tagInput, 400);

  // An empty search still shows the most-used tags first, from tag_usage
  // (unchanged) - useful, and tags_v2 has no usage-count column to
  // reproduce that with. Once there's
  // something typed, tags_v2 takes over: it surfaces every real tag,
  // including one with no published-pattern usage yet (created directly
  // through ImpliedTagsDialog/AliasDialog, or only present on a draft),
  // which tag_usage - like the `tags` view before it - never would.
  const isSearching = debouncedTagSearch.trim() !== '';
  const { data: tagUsageData, isFetching: tagUsageFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: '',
    sortField: 'count',
    sortDir: 'desc',
  });
  const { data: tagsV2SearchData = [], isFetching: tagsV2SearchFetching } = useQuerySearchTagsV2(
    debouncedTagSearch,
    isSearching,
  );

  // An Author-typed tag is meant to be entirely derived from
  // patterns.authors/author_manual via the account-name cascade, never
  // picked directly here - filtered out
  // of both option sources below rather than shown disambiguated (a
  // dropdown label showing "(artist)" was tried first, then dropped once it
  // was clear the dedicated author autocomplete already covers this and
  // filtering removes the ambiguity outright instead of labelling around
  // it). tagUsageData has no Type column of its own to filter by directly,
  // hence the separate id lookup.
  const { data: authorTagIds = new Set<string>() } = useQueryAuthorTagIds();
  const searchOptions = React.useMemo(
    () => tagsV2SearchData.filter((row) => !authorTagIds.has(row.id)),
    [tagsV2SearchData, authorTagIds],
  );
  const tagUsageOptions = React.useMemo(
    () => (tagUsageData?.items ?? []).filter((item) => !authorTagIds.has(item.id)),
    [tagUsageData, authorTagIds],
  );

  // Full-list fetch, same convention as the admin tag manager's tagsV2ById
  // (see space-command/tags.tsx) - keyed by name here rather than id since
  // this field's value is plain tag strings, not ids. First match wins for
  // the rare name shared across types (Author-typed rows are filtered out
  // above, so in practice this only matters for two non-Author types
  // sharing a name, an edge case not worth a full id-aware rework here).
  const { data: tagsV2List = [] } = useQueryGetAllTagsV2();
  const typeInfoByTag = React.useMemo(() => {
    const map = new Map<string, TypeTagTypeRecord>();
    for (const t of tagsV2List) {
      const type = t.expand?.type;
      if (type && !map.has(t.tag)) map.set(t.tag, type);
    }
    return map;
  }, [tagsV2List]);
  const getChipBorderColor = React.useCallback(
    (tag: string) => typeInfoByTag.get(tag)?.color || undefined,
    [typeInfoByTag],
  );
  const getChipTooltip = React.useCallback((tag: string) => typeInfoByTag.get(tag)?.name, [typeInfoByTag]);

  // implied_tags + tag_aliases replace tag_hierarchy as the source for
  // auto-added tags and alias resolution on this entry surface.
  const { data: impliedTagsData = [] } = useQueryGetImpliedTags();
  const { data: aliasesData = [] } = useQueryGetAllTagAliases();

  /**
   * Tags present only because they're implied by another tag currently
   * present. Rendered as inherited chips and cleaned up when their primary
   * tag is removed.
   */
  const [hierarchyInherited, setHierarchyInherited] = React.useState<Set<string>>(new Set());
  /** Tags present only because a currently-assigned pattern key carries them. */
  const [keyInherited, setKeyInherited] = React.useState<Set<string>>(new Set());
  /**
   * norm(tag) -> tags_v2 id for a tag this pattern is already linked to,
   * seeded from the caller's own initial value (see the onChange prop's own
   * doc comment) - seeded from the pattern's own existing tag_refs (an
   * untouched tag can't be picked wrong), and gains a new entry whenever
   * applyManualTagChange/applyKeyTagChange resolve an incoming tag through
   * a known alias with a populated target_tag_ref (typing the alias itself
   * still can't be picked from the dropdown - Author-typed rows are
   * filtered out entirely - but free-solo typing the alias text directly
   * remains possible, and now resolves correctly too). Never populated by
   * anything else picked this session, since the dropdown no longer offers
   * an ambiguous option to pick in the first place. Pruned whenever its tag
   * is no longer in `value`, so removing a protected tag and typing the
   * same name back in fresh resolves normally again, rather than keeping a
   * stale pin.
   */
  const [preferredTagRefs, setPreferredTagRefs] = React.useState<Map<string, string>>(new Map());

  const prunePreferred = React.useCallback((refs: Map<string, string>, tags: string[]) => {
    const present = new Set(tags.map((t) => t.trim().toLowerCase()));
    const next = new Map(refs);
    for (const norm of next.keys()) {
      if (!present.has(norm)) next.delete(norm);
    }
    return next;
  }, []);

  // Merges applyManualTagChange/applyKeyTagChange's own aliasPreferredRefs
  // into the existing map before pruning - an alias resolved this same
  // call must survive its own prune step below, not be dropped for having "just
  // appeared" rather than already being present.
  const mergePreferred = React.useCallback((base: Map<string, string>, incoming: Map<string, string>) => {
    return incoming.size > 0 ? new Map([...base, ...incoming]) : base;
  }, []);

  // Once the implied-tags graph loads (or the underlying record changes),
  // mark which existing tags are implied by other tags already in the set
  // so they render as inherited chips. keyInherited always resets to empty
  // here - key provenance can't be honestly re-derived from the flat tag
  // list alone, so only tags this component itself adds via keyTags get
  // tracked.
  React.useEffect(() => {
    setHierarchyInherited(value.length === 0 ? new Set() : deriveHierarchyInherited(value, impliedTagsData));
    setKeyInherited(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impliedTagsData.length, props.resetKey]);

  // The tags Autocomplete's onChange - the user typed a new tag or removed a chip.
  const handleChange = React.useCallback(
    (newValue: string[]) => {
      const next = applyManualTagChange(
        { tags: value, hierarchyInherited, keyInherited },
        newValue,
        impliedTagsData,
        aliasesData,
      );
      const prunedPreferred = prunePreferred(mergePreferred(preferredTagRefs, next.aliasPreferredRefs), next.tags);
      onChange(next.tags, prunedPreferred);
      setPreferredTagRefs(prunedPreferred);
      setHierarchyInherited(next.hierarchyInherited);
      setKeyInherited(next.keyInherited);
    },
    [
      value,
      hierarchyInherited,
      keyInherited,
      impliedTagsData,
      aliasesData,
      onChange,
      preferredTagRefs,
      prunePreferred,
      mergePreferred,
    ],
  );

  // Reconciles whenever the live key-tags union changes (a pattern key was
  // added, removed, or quick-applied elsewhere in the form). Guarded so a
  // keyTags array that's new-by-reference but unchanged in content (e.g.
  // after the pattern-key catalog query refetches) doesn't churn state.
  React.useEffect(() => {
    const next = applyKeyTagChange(
      { tags: value, hierarchyInherited, keyInherited },
      keyTags,
      impliedTagsData,
      aliasesData,
    );
    const unchanged =
      next.tags.length === value.length &&
      next.tags.every((t, i) => t === value[i]) &&
      next.hierarchyInherited.size === hierarchyInherited.size &&
      next.keyInherited.size === keyInherited.size;
    if (unchanged) return;
    const prunedPreferred = prunePreferred(mergePreferred(preferredTagRefs, next.aliasPreferredRefs), next.tags);
    onChange(next.tags, prunedPreferred);
    setPreferredTagRefs(prunedPreferred);
    setHierarchyInherited(next.hierarchyInherited);
    setKeyInherited(next.keyInherited);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyTags, impliedTagsData, aliasesData]);

  const inheritedValues = React.useMemo(
    () => new Set([...hierarchyInherited, ...keyInherited]),
    [hierarchyInherited, keyInherited],
  );

  return (
    <FancyAutocomplete
      label="Tags"
      freeSolo
      serverSide
      data={isSearching ? searchOptions : tagUsageOptions}
      value={value}
      onChange={handleChange}
      inputValue={tagInput}
      onInputChange={setTagInput}
      inheritedValues={inheritedValues}
      getChipBorderColor={getChipBorderColor}
      getChipTooltip={getChipTooltip}
      loading={isSearching ? tagsV2SearchFetching : tagUsageFetching}
    />
  );
};
