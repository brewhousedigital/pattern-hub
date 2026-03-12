import { atom, useAtom } from 'jotai';
import { useNavigate } from '@tanstack/react-router';
import type { TypePatternResponse } from '@/functions/database/patterns';

const globalIsViewOpenAtom = atom(false);

export const useGlobalIsViewOpen = () => {
  const [isViewOpen, setIsViewOpen] = useAtom(globalIsViewOpenAtom);

  const navigate = useNavigate();

  const handleOpenView = () => {
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setIsViewOpen(false);

    navigate({
      to: '/',
      search: (prev: { view?: string; q?: string }) => {
        const { view, ...rest } = prev;
        return rest;
      },
    }).then();
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
