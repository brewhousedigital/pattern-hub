import { useCallback, useEffect, useState } from 'react';

// Flat, undecorated snake_case key - matches this codebase's existing
// localStorage convention (e.g. 'contact_last_submit', 'report_last_submit').
const STORAGE_KEY = 'db_stats_card_prefs';

type CardPrefs = {
  order: string[];
  hidden: string[];
};

const EMPTY_PREFS: CardPrefs = { order: [], hidden: [] };

const readPrefs = (): CardPrefs => {
  if (typeof window === 'undefined') return EMPTY_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw);
    return {
      order: Array.isArray(parsed?.order) ? parsed.order : [],
      hidden: Array.isArray(parsed?.hidden) ? parsed.hidden : [],
    };
  } catch {
    return EMPTY_PREFS;
  }
};

/**
 * Per-admin, this-browser-only card ordering + show/hide for the Database
 * Stats page, persisted to localStorage. `allCardIds` is the full registry's
 * natural order - used to seed cards the stored prefs don't know about yet
 * (a newly added card type ships visible, appended at the end) and to drop
 * ids for cards that no longer exist.
 */
export const useDatabaseStatsCardPrefs = (allCardIds: string[]) => {
  const [prefs, setPrefs] = useState<CardPrefs>(readPrefs);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const knownIds = new Set(prefs.order);
  const stillValidOrder = prefs.order.filter((id) => allCardIds.includes(id));
  const unseenIds = allCardIds.filter((id) => !knownIds.has(id));
  const orderedIds = [...stillValidOrder, ...unseenIds];

  const hiddenIds = new Set(prefs.hidden.filter((id) => allCardIds.includes(id)));

  const setOrder = useCallback((nextOrder: string[]) => {
    setPrefs((prev) => ({ ...prev, order: nextOrder }));
  }, []);

  const toggleHidden = useCallback((id: string) => {
    setPrefs((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden.filter((h) => h !== id) : [...prev.hidden, id],
    }));
  }, []);

  return { orderedIds, hiddenIds, setOrder, toggleHidden };
};
