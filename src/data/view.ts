import { atom, useAtom } from 'jotai';
import type { TypePatternResponse } from '@/functions/database/patterns';

const globalIsViewOpenAtom = atom(false);

export const useGlobalIsViewOpen = () => {
  const [isViewOpen, setIsViewOpen] = useAtom(globalIsViewOpenAtom);

  const handleOpenView = () => {
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setIsViewOpen(false);
  };

  return { isViewOpen, setIsViewOpen, handleOpenView, handleCloseView };
};

const globalViewData = atom<TypePatternResponse>();

export const useGlobalViewData = () => {
  const [viewData, setViewData] = useAtom(globalViewData);

  /*const handleSetViewData = (data: TypePatternResponse) => {
    setViewData(data);
  };*/

  return { viewData, setViewData };
};
