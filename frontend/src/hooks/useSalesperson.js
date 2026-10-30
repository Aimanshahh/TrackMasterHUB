import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMyJobs, fetchSalespersonSummary } from '../lib/api.js';

/**
 * Summary counts for the signed-in salesperson. The backend scopes every figure
 * to the session owner, so nothing here can leak another salesperson's desk.
 */
export function useSalespersonSummary() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({
      status: previous.data ? 'refreshing' : 'loading',
      data: previous.data,
      error: null,
    }));

    try {
      const payload = await fetchSalespersonSummary({ signal: controller.signal });
      setState({ status: 'ready', data: payload.data, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ status: 'error', data: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}

/** Installation and follow-up requests this salesperson pushed to operations. */
export function useMyJobs({ status = '' } = {}) {
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading', error: null }));

    try {
      const payload = await fetchMyJobs({ status, limit: 50 }, { signal: controller.signal });
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [status]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}
