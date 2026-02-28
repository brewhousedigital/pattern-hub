import { atom, useAtom } from 'jotai';
import { useDebounce } from '@/functions/hooks/useDebounce';
import type { GridFilterModel } from '@mui/x-data-grid';

const globalAdminSearchTerm = atom('');

export const useGlobalAdminSearchTerm = () => {
  const [searchTerm, setSearchTerm] = useAtom(globalAdminSearchTerm);

  const debouncedSearchTerm = useDebounce(searchTerm, 600);

  return { searchTerm, setSearchTerm, debouncedSearchTerm };
};

const globalAdminFilter = atom<GridFilterModel>();

export const useGlobalAdminFilter = () => {
  const [filterModel, setFilterModel] = useAtom(globalAdminFilter);

  const searchResult = filterModel?.quickFilterValues?.join(' ') || '';

  return { filterModel, setFilterModel, searchResult };
};

const globalAdminPagination = atom({
  page: 1,
  pageSize: 25,
});

export const useGlobalAdminPagination = () => {
  const [paginationModel, setPaginationModel] = useAtom(globalAdminPagination);
  return { paginationModel, setPaginationModel };
};
