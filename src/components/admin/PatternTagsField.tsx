import React from 'react';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useQueryAdminTagStatsPaginated, useQueryGetTagHierarchy, getAncestors } from '@/functions/database/tags';
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
};

// Shared by AdminEditPatternModal and the user-submission review page so tag
// search + hierarchy behavior can't drift between the two editing surfaces.
export const PatternTagsField = (props: PatternTagsFieldProps) => {
  const { value, onChange } = props;

  const [tagInput, setTagInput] = React.useState('');
  const debouncedTagSearch = useDebounce(tagInput, 400);
  const { data: tagSearchData, isFetching: tagSearchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedTagSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  const { data: hierarchyData = [] } = useQueryGetTagHierarchy();

  /**
   * Set of tag names that were auto-added as ancestors of a primary tag.
   * Used to render inherited chips differently and to clean them up when their
   * primary tag is removed.
   */
  const [inheritedTags, setInheritedTags] = React.useState<Set<string>>(new Set());

  // Once the hierarchy loads (or the underlying record changes), mark which
  // existing tags are ancestors of other tags already in the set so they
  // render as inherited chips.
  React.useEffect(() => {
    if (value.length === 0) {
      setInheritedTags(new Set());
      return;
    }
    const inherited = new Set<string>();
    for (const tag of value) {
      for (const ancestor of getAncestors(tag, hierarchyData)) {
        if (value.includes(ancestor)) inherited.add(ancestor);
      }
    }
    setInheritedTags(inherited);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyData.length, props.resetKey]);

  /**
   * Smart tag change handler.
   * When a new tag is added, its full ancestor chain is auto-added as inherited tags.
   * When a primary tag is removed, its orphaned ancestors are cleaned up.
   */
  const handleChange = React.useCallback(
    (newValue: string[]) => {
      const added = newValue.filter((t) => !value.includes(t));
      const removed = value.filter((t) => !newValue.includes(t));

      let result = [...newValue];
      const newInherited = new Set(inheritedTags);

      // Auto-add ancestors for any newly added tags
      for (const tag of added) {
        newInherited.delete(tag); // Explicitly added → promote to primary
        for (const ancestor of getAncestors(tag, hierarchyData)) {
          if (!result.includes(ancestor)) {
            result.push(ancestor);
            newInherited.add(ancestor);
          }
        }
      }

      // When a primary tag is removed, clean up orphaned inherited ancestors
      for (const tag of removed) {
        if (!newInherited.has(tag)) {
          // It was primary - check each of its ancestors
          for (const ancestor of getAncestors(tag, hierarchyData)) {
            const stillNeeded = result
              .filter((t) => !newInherited.has(t) && t !== tag)
              .some((primary) => getAncestors(primary, hierarchyData).includes(ancestor));
            if (!stillNeeded) {
              result = result.filter((t) => t !== ancestor);
              newInherited.delete(ancestor);
            }
          }
        }
        newInherited.delete(tag);
      }

      onChange(result);
      setInheritedTags(newInherited);
    },
    [value, inheritedTags, hierarchyData, onChange],
  );

  return (
    <FancyAutocomplete
      label="Tags"
      freeSolo
      serverSide
      data={tagSearchData?.items ?? []}
      value={value}
      onChange={handleChange}
      inputValue={tagInput}
      onInputChange={setTagInput}
      inheritedValues={inheritedTags}
      loading={tagSearchFetching}
    />
  );
};
