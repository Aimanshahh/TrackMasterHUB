import { useEffect, useState } from 'react';

/** Loads a sales board once; the loader is fetchMySales or fetchSalesOverview. */
export function useSalesBoard(load) {
  const [state, setState] = useState({ status: 'loading', board: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal })
      .then((payload) => setState({ status: 'ready', board: payload.data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', board: null, error: error.message }); });
    return () => controller.abort();
  }, [load, tick]);
  return { ...state, reload: () => setTick((value) => value + 1) };
}
