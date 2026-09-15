import { atom, useAtom } from 'jotai';

// Shared across the tags admin page and its RenamePanel/CleanupPanel
// sub-components - a jotai atom rather than page state passed down as
// props, since RenamePanel/CleanupPanel only ever read it (to show a
// loading spinner while any pattern-touching operation is in flight) while
// the page itself only ever writes it.
const globalIsFetchingPatterns = atom(false);

export const useGlobalIsFetchingPatterns = () => {
  const [isFetchingPatterns, setIsFetchingPatterns] = useAtom(globalIsFetchingPatterns);
  return { isFetchingPatterns, setIsFetchingPatterns };
};
