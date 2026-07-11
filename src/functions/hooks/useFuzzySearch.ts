import { useState, useMemo } from 'react';
import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';

// NOTE: pass stable (module-level) `keys`/`options` values - inline literals
// would recreate the Fuse index on every render.
export function useFuzzySearch<T>(data: T[] | undefined, keys: IFuseOptions<T>['keys'], options?: IFuseOptions<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>(data ?? []);

  const [prevItems, setPrevItems] = useState(data);
  if (data !== prevItems) {
    setPrevItems(data);
    setResults(data ?? []);
  }

  const fuse = useMemo(
    () =>
      new Fuse(data ?? [], {
        keys,
        threshold: 0.35,
        ignoreLocation: true,
        ...options,
      }),
    [data, keys, options],
  );

  function search(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setResults(data ?? []);
      return;
    }

    setResults(fuse.search(value).map((r: FuseResult<T>) => r.item));
  }

  return { query, search, results };
}
