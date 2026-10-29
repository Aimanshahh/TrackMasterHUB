import { useCallback, useEffect, useState } from 'react';

import { fetchCustomers } from '../lib/api.js';

const SEARCH_DEBOUNCE_MS = 320;

export function useCustomers({ search = '', category = '', priority = '', followUp = '', sort = 'createdAt', direction = 'desc', page = 1, limit = 20 } = {}) {
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchCustomers({ q: debouncedSearch, category, priority, followUp, sort, direction, page, limit }, { signal });
      setState({ status: 'ready', rows: payload.data ?? [], meta: payload.meta ?? null, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [debouncedSearch, category, priority, followUp, sort, direction, page, limit]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { ...state, refresh: () => load() };
}
