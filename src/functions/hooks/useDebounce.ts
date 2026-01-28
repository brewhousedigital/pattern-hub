import { useEffect, useState } from 'react';

/**
 * A custom React hook that debounces a value over a specified delay.
 * Useful for limiting the rate of updates, such as in search inputs or API calls.
 * It returns a React state so you can watch for updates on it
 *
 * @param {any} value - The value to debounce (string, number, object, etc.).
 * @param {number} [delay=500] - The delay in milliseconds before updating the debounced value.
 * @returns {any} - The debounced value that updates after the specified delay.
 *
 * @example
 * // Import the hook
 * import useDebounce from './useDebounce';
 *
 * // Usage inside a component
 * import { useState } from 'react';
 *
 * const SearchComponent = () => {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 *   useEffect(() => {
 *     if (debouncedSearchTerm) {
 *       // Trigger API call or heavy computation here
 *       console.log('Searching for:', debouncedSearchTerm);
 *     }
 *   }, [debouncedSearchTerm]);
 *
 *   return (
 *     <input
 *       type="text"
 *       value={searchTerm}
 *       onChange={(e) => setSearchTerm(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * };
 */
export const useDebounce = (value: any, delay: number = 500): any => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};
