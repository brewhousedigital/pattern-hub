import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  learningResourceSearchSchema,
  type TypeLearningResourceSearch,
  type TypeResourceSortValue,
} from '@/functions/utilities/learning-resources-search';

export function useLearningResourceSearch() {
  const search = useSearch({ from: '/learning-resources/' }) as TypeLearningResourceSearch;
  const navigate = useNavigate({ from: '/learning-resources/' });

  const { q, sort, page } = search;

  function updateSearch(partial: Partial<TypeLearningResourceSearch>) {
    navigate({
      search: (prev) => learningResourceSearchSchema.parse({ ...prev, ...partial }),
      resetScroll: true,
    }).then();
  }

  function setQ(next: string) {
    updateSearch({ q: next, page: 1 });
  }

  function setSort(next: TypeResourceSortValue) {
    updateSearch({ sort: next, page: 1 });
  }

  function setPage(next: number) {
    updateSearch({ page: next });
  }

  return { q, sort, page, setQ, setSort, setPage };
}
