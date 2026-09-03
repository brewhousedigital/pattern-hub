import React from 'react';
import { useDebounce } from '@/functions/hooks/useDebounce';
import {
  useQueryAdminTagStatsPaginated,
  useQuerySearchTagsV2,
  useQueryGetImpliedTags,
  useQueryGetAllTagAliases,
  deriveHierarchyInherited,
  applyManualTagChange,
  applyKeyTagChange,
} from '@/functions/database/tags';
import { FancyAutocomplete } from '@/components/FancyAutocomplete';

type PatternTagsFieldProps = {
  value: string[];
  onChange: (newValue: string[]) => void;
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

  // Phase R3.3 of the Tag Relational Refactor (see
  // TAG_RELATIONAL_REFACTOR_NOTES.md): an empty search still shows the
  // most-used tags first, from tag_usage (unchanged) - useful, and tags_v2
  // has no usage-count column to reproduce that with. Once there's
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

  // Phase 3 (see TAG_REDESIGN_PROJECT_NOTES.md): implied_tags + tag_aliases
  // replace tag_hierarchy as the source for auto-added tags and alias
  // resolution on this entry surface.
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
      onChange(next.tags);
      setHierarchyInherited(next.hierarchyInherited);
      setKeyInherited(next.keyInherited);
    },
    [value, hierarchyInherited, keyInherited, impliedTagsData, aliasesData, onChange],
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
    onChange(next.tags);
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
      data={isSearching ? tagsV2SearchData : (tagUsageData?.items ?? [])}
      value={value}
      onChange={handleChange}
      inputValue={tagInput}
      onInputChange={setTagInput}
      inheritedValues={inheritedValues}
      loading={isSearching ? tagsV2SearchFetching : tagUsageFetching}
    />
  );
};
