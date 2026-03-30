import { atom, useAtom } from 'jotai';
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
