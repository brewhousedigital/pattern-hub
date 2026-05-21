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

const globalAdminFilterComplaints = atom<GridFilterModel>();

export const useGlobalAdminFilterComplaints = () => {
  const [filterModel, setFilterModel] = useAtom(globalAdminFilterComplaints);

  const searchResult = filterModel?.quickFilterValues?.join(' ') || '';

  return { filterModel, setFilterModel, searchResult };
};

const globalAdminPaginationComplaints = atom({
  page: 1,
  pageSize: 25,
});

export const useGlobalAdminPaginationComplaints = () => {
  const [paginationModel, setPaginationModel] = useAtom(globalAdminPaginationComplaints);
  return { paginationModel, setPaginationModel };
};

const globalAdminFilterContact = atom<GridFilterModel>();

export const useGlobalAdminFilterContact = () => {
  const [filterModel, setFilterModel] = useAtom(globalAdminFilterContact);

  const searchResult = filterModel?.quickFilterValues?.join(' ') || '';

  return { filterModel, setFilterModel, searchResult };
};

const globalAdminPaginationContact = atom({
  page: 1,
  pageSize: 25,
});

export const useGlobalAdminPaginationContact = () => {
  const [paginationModel, setPaginationModel] = useAtom(globalAdminPaginationContact);
  return { paginationModel, setPaginationModel };
};

// ─── Content reports (store / wiki / faq / other) ─────────────────────────────

const globalAdminFilterContentReports = atom<GridFilterModel>();

export const useGlobalAdminFilterContentReports = () => {
  const [filterModel, setFilterModel] = useAtom(globalAdminFilterContentReports);
  const searchResult = filterModel?.quickFilterValues?.join(' ') || '';
  return { filterModel, setFilterModel, searchResult };
};

const globalAdminPaginationContentReports = atom({
  page: 1,
  pageSize: 25,
});

export const useGlobalAdminPaginationContentReports = () => {
  const [paginationModel, setPaginationModel] = useAtom(globalAdminPaginationContentReports);
  return { paginationModel, setPaginationModel };
};
