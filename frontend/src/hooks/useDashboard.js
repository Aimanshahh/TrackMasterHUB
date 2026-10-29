import { useCallback, useEffect, useState } from 'react';

import { fetchDashboard } from '../lib/api.js';

export function useDashboard() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.data ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchDashboard({ signal });
      setState({ status: 'ready', data: payload.data, error: null });
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

  return { ...state, refresh: () => load() };
}
