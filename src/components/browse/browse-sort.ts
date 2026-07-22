import type { TypePatternResponse } from '@/functions/database/patterns';

export const BROWSE_SORT_OPTIONS = [
  { value: '-created', label: 'Last added' },
  { value: 'created', label: 'First added' },
  { value: '-design_date', label: 'Newest design' },
  { value: 'design_date', label: 'Oldest design' },
  { value: '-updated', label: 'Recently updated' },
  { value: 'updated', label: 'Oldest updated' },
  { value: 'name', label: 'A → Z' },
  { value: '-name', label: 'Z → A' },
  { value: '-pieces', label: 'Most pieces' },
  { value: 'pieces', label: 'Fewest pieces' },
  { value: '-design_height', label: 'Tallest' },
  { value: '-design_width', label: 'Widest' },
] as const;

export type BrowseSortValue = (typeof BROWSE_SORT_OPTIONS)[number]['value'];

export function applyBrowseSort(patterns: TypePatternResponse[], sort: BrowseSortValue): TypePatternResponse[] {
  const desc = sort.startsWith('-');
  const field = (desc ? sort.slice(1) : sort) as keyof TypePatternResponse;
  return [...patterns].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const aEmpty = av == null || av === '';
    const bEmpty = bv == null || bv === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const cmp =
      (av as string | number) < (bv as string | number)
        ? -1
        : (av as string | number) > (bv as string | number)
          ? 1
          : 0;
    return desc ? -cmp : cmp;
  });
}
