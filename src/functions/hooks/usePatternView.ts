import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2.ts';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns.ts';

export const usePatternViewData = (patternId: string | undefined) => {
  const { isPending, data } = useQueryGetAllPatternsByPagination();
  const viewData = data?.items?.find((item) => item.id === patternId);

  return {
    viewData,
    isPending,
  };
};
