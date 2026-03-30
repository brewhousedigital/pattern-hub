import { atom, useAtom } from 'jotai';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';

const globalIsViewOpenAtom = atom(false);

export const useGlobalIsViewOpen = () => {
  const [isViewOpen, setIsViewOpen] = useAtom(globalIsViewOpenAtom);

  const { setPatternId } = usePatternSearch();

  const handleOpenView = () => {
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setIsViewOpen(false);

    setTimeout(() => {
      setPatternId(undefined);
    }, 600);
  };

  return { isViewOpen, setIsViewOpen, handleOpenView, handleCloseView };
};

const globalViewData = atom<TypePatternResponse>();

/** @deprecated */
export const useGlobalViewData = () => {
  const [viewData, setViewData] = useAtom(globalViewData);

  return {
    viewData,
    setViewData,
  };
};
