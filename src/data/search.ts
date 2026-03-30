import { atom, useAtom } from 'jotai';

const globalSearchPaginationNumber = atom(1);

export const useGlobalSearchPagination = () => {
  const [page, setPage] = useAtom(globalSearchPaginationNumber);
  return { page, setPage };
};
