import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchVehicles, refreshVehicleStatus } from '../lib/api.js';

const SEARCH_DEBOUNCE_MS = 320;

/** Installed vehicles with their live tracking status. */
export function useVehicles({ q = '', status = '' } = {}) {
  const [debounced, setDebounced] = useState(q);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null, refreshing: false });
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
      const payload = await fetchVehicles({ q: debounced, status, limit: 200 }, { signal: controller.signal });
      setState((previous) => ({ ...previous, status: 'ready', rows: payload.data, meta: payload.meta, error: null }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [debounced, status]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  /** Ask the backend to read the tracking server now, then reload the list. */
  const refreshStatus = useCallback(async () => {
    setState((previous) => ({ ...previous, refreshing: true }));
    try {
      await refreshVehicleStatus();
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message }));
    }
    await load();
    setState((previous) => ({ ...previous, refreshing: false }));
  }, [load]);

  return { ...state, refresh: load, refreshStatus };
}
