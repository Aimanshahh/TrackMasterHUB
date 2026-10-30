import { useCallback, useEffect, useState } from 'react';

import { fetchPackages, updatePackagePricing } from '../lib/api.js';

/**
 * The three service packages as the admin has priced them. A package that has
 * no rate yet comes back with price null — quoting stays closed for it until
 * the admin sets one, rather than defaulting to a number nobody chose.
 */
export function usePackages() {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading' }));
    try {
      const payload = await fetchPackages({ signal });
      setState({ status: 'ready', rows: payload.data, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const save = useCallback(async (key, input) => {
    const payload = await updatePackagePricing(key, input);
    const pkg = payload.data.package;
    setState((previous) => ({
      ...previous,
      rows: previous.rows.map((row) => (row.key === key ? pkg : row)),
    }));
    return pkg;
  }, []);

  return { ...state, refresh: () => load(), save };
}
