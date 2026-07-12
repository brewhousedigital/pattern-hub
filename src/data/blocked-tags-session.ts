import { useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

// Blocked tags the user has temporarily un-blocked for this browsing session
// (via the BlockedTagsBanner dropdown). Backed by sessionStorage so the
// overrides survive SPA navigation and refreshes, but reset once the browser
// tab is closed - the permanent list on the user's profile is never touched.
//
// SSR-safe: jotai's atomWithStorage renders the initial value ([]) on the
// server and first client render, then syncs from sessionStorage after mount.
const sessionUnblockedTagsAtom = atomWithStorage<string[]>(
  'pa_session_unblocked_tags',
  [],
  createJSONStorage(() => sessionStorage),
);

export const useSessionUnblockedTags = () => {
  const [unblockedTags, setUnblockedTags] = useAtom(sessionUnblockedTagsAtom);

  const isUnblocked = (tag: string) => unblockedTags.some((t) => t.toLowerCase() === tag.toLowerCase());

  /** Toggle a single blocked tag's session override. */
  const toggleTag = (tag: string) => {
    setUnblockedTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag],
    );
  };

  /** Temporarily un-block every tag in the given list. */
  const unblockAll = (tags: string[]) => setUnblockedTags(tags);

  /** Clear all session overrides - every blocked tag filters again. */
  const reblockAll = () => setUnblockedTags([]);

  return { unblockedTags, isUnblocked, toggleTag, unblockAll, reblockAll };
};
