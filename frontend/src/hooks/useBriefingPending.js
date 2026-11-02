import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchBriefingPending } from '../lib/api.js';

const SEARCH_DEBOUNCE_MS = 320;

/** Customers installed but still waiting on their security briefing. */
export function useBriefingPending({ q = '' } = {}) {
  const [debounced, setDebounced] = useState(q);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });
  const controllerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading', error: null }));

    try {
      const payload = await fetchBriefingPending({ q: debounced, limit: 100 }, { signal: controller.signal });
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [debounced]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}
