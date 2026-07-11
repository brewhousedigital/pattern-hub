import { useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';

const SESSION_FLAG = 'pa_visit_counted';

// Retro footer visitor counter (see pb_hooks/main.pb.js /api/count-visit).
//
// Counts one visit per browser session: the first fetch of a session POSTs
// (atomic increment + read) and sets a sessionStorage flag; every fetch after
// that - including hard refreshes in the same tab - only GETs the current
// count. The flag is the literal string '1' in storage that dies with the tab,
// so nothing identifying is ever stored on either end.
//
// The POST side effect inside a queryFn is deliberate: it guarantees exactly
// one request per session (increment and read are the same round trip). With
// retry disabled and staleTime Infinity the queryFn runs once per page load,
// and even a defensive re-run would only GET because the flag is already set.
export const useVisitCounter = () => {
  return useQuery({
    queryKey: ['VisitCount'],
    queryFn: async (): Promise<number> => {
      const alreadyCounted = sessionStorage.getItem(SESSION_FLAG) === '1';

      const res = await fetch(`${pocketbaseDomain}/api/count-visit`, {
        method: alreadyCounted ? 'GET' : 'POST',
      });
      if (!res.ok) throw new Error('Failed to load visit count');

      const data = (await res.json()) as { count?: number };
      if (!alreadyCounted) sessionStorage.setItem(SESSION_FLAG, '1');

      return data.count ?? 0;
    },
    staleTime: Infinity,
    retry: 0,
  });
};
