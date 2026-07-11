import React from 'react';
import { atom, useAtom } from 'jotai';

const globalIsViewOpenAtom = atom(false);

export const useGlobalIsViewOpen = () => {
  const [isViewOpen, setIsViewOpen] = useAtom(globalIsViewOpenAtom);

  // Stable identities (jotai setters never change) so these are safe to list
  // in effect dependency arrays without re-triggering the effect every render.
  const handleOpenView = React.useCallback(() => {
    setIsViewOpen(true);
  }, [setIsViewOpen]);

  const handleCloseView = React.useCallback(() => {
    setIsViewOpen(false);
  }, [setIsViewOpen]);

  return { isViewOpen, setIsViewOpen, handleOpenView, handleCloseView };
};
