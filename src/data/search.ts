import { atom, useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

const globalSearchAtom = atomWithStorage('globalSearchAtom', '');
//const globalSearchAtom = atom('');

export const useGlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useAtom(globalSearchAtom);
  return { searchTerm, setSearchTerm };
};

const globalReadyToSearchAtom = atomWithStorage('globalReadyToSearchAtom', '');
//const globalReadyToSearchAtom = atom('');

export const useGlobalReadyToSearch = () => {
  const [readyToSearchTerm, setReadyToSearchTerm] = useAtom(globalReadyToSearchAtom);
  return { readyToSearchTerm, setReadyToSearchTerm };
};
