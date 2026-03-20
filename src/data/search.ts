import React from 'react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { atom, useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useDebounce } from '@/functions/hooks/useDebounce';

const globalSearchAtom = atomWithStorage('globalSearchAtom', '');

export const useGlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useAtom(globalSearchAtom);
  return { searchTerm, setSearchTerm, resetSearchTerm: () => setSearchTerm('') };
};

const globalReadyToSearchAtom = atomWithStorage('globalReadyToSearchAtom', '');
//const globalReadyToSearchAtom = atom('');

export const useGlobalReadyToSearch = () => {
  const [readyToSearchTerm, setReadyToSearchTerm] = useAtom(globalReadyToSearchAtom);

  const { searchTerm } = useGlobalSearch();

  const debouncedSearchTerm = useDebounce(searchTerm, 600);

  const navigate = useNavigate();

  React.useEffect(() => {
    setReadyToSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  // When the search term is updated, push it to the URL
  React.useEffect(() => {
    if (readyToSearchTerm) {
      navigate({
        to: '/',
        search: (prev) => ({ ...prev, q: readyToSearchTerm }),
      }).then();
    }
  }, [readyToSearchTerm]);

  return { readyToSearchTerm, setReadyToSearchTerm, resetReadyToSearchTerm: () => setReadyToSearchTerm('') };
};
