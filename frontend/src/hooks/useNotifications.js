import { useCallback, useEffect, useState } from 'react';

import { fetchNotifications } from '../lib/api.js';

const REFRESH_MS = 60_000;

export function useNotifications() {
  const [state, setState] = useState({ status: 'loading', rows: [], unread: 0, error: null });

  const load = useCallback(async (signal) => {
    try {
      const payload = await fetchNotifications({ signal });
      setState({ status: 'ready', rows: payload.data ?? [], unread: payload.meta?.unread ?? 0, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);

    const timer = setInterval(() => load(), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  return { ...state, refresh: () => load() };
}
