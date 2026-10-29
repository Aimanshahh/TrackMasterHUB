import { useCallback, useEffect, useState } from 'react';

import { fetchActivity } from '../lib/api.js';

export function useActivity() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('type', filter);
    if (search.trim()) params.set('q', search.trim());

    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    fetchActivity(params, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', rows: payload.data?.activity ?? payload.data ?? [], error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((previous) => ({ ...previous, status: 'error', error: error.message }));
      });
    return () => controller.abort();
  }, [filter, search, refreshIndex]);

  const refresh = useCallback(() => setRefreshIndex((value) => value + 1), []);
  return { ...state, filter, search, refresh, setFilter, setSearch };
}
