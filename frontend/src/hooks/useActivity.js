import { useCallback, useEffect, useState } from 'react';

import { fetchActivity } from '../lib/api.js';

export function useActivity() {
  const [state, setState] = useState({
    status: 'loading',
    rows: [],
    error: null,
    filter: 'all',
    search: '',
  });

  const load = useCallback(async (signal, filter = state.filter, search = state.search) => {
    setState((previous) => ({
      ...previous,
      status: 'loading',
      filter,
      search,
    }));

    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (search.trim()) params.set('q', search.trim());

      const payload = await fetchActivity(params.toString(), { signal });
      setState({ status: 'ready', rows: payload.data.activity, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [state.filter, state.search]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = () => load();

  return { ...state, refresh, setFilter: (filter) => load(null, filter), setSearch: (search) => load(null, null, search) };
}
