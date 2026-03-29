import { useState, useRef, useEffect } from 'react';
import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';

export function useFuzzySearch<T>(data: T[] | undefined, keys: IFuseOptions<T>['keys'], options?: IFuseOptions<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>(data ?? []);
  const fuseRef = useRef<Fuse<T> | null>(null);

  const [prevItems, setPrevItems] = useState(data);
  if (data !== prevItems) {
    setPrevItems(data);
    setResults(data ?? []);
  }

  useEffect(() => {
    fuseRef.current = new Fuse(data ?? [], {
      keys,
      threshold: 0.35,
      ignoreLocation: true,
      ...options,
    });
  }, [data]);

  function search(value: string) {
    setQuery(value);

    if (!value.trim() || !fuseRef.current) {
      setResults(data ?? []);
      return;
    }

    setResults(fuseRef.current.search(value).map((r: FuseResult<T>) => r.item));
  }

  return { query, search, results };
}
