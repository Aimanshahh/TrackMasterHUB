import { useCallback, useEffect, useState } from 'react';

import { createUser, fetchUsers } from '../lib/api.js';

export function useUsers() {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchUsers({ signal });
      setState({ status: 'ready', rows: payload.data?.users ?? [], error: null });
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

  const create = useCallback(async (input) => {
    await createUser(input);
    await load();
  }, [load]);

  return { ...state, refresh: () => load(), create };
}
