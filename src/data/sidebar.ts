import { atom, useAtom } from 'jotai';

const globalIsSidebarOpenAtom = atom(false);

export const useGlobalIsSidebarOpen = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(globalIsSidebarOpenAtom);

  const handleOpenMobileSidebar = () => {
    setIsSidebarOpen(true);
  };

  const handleCloseMobileSidebar = () => {
    setIsSidebarOpen(false);
  };

  return { isSidebarOpen, setIsSidebarOpen, handleOpenMobileSidebar, handleCloseMobileSidebar };
};
