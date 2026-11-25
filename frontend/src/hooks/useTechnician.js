import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchTechnicianEarnings,
  fetchTechnicianJob,
  fetchTechnicianJobs,
  fetchTechnicianStock,
  fetchTechnicianSummary,
} from '../lib/api.js';

/**
 * Technician portal data. Every call is scoped by the session cookie: the
 * browser never sends a technician id, so one technician cannot read another's
 * installations, stock or earnings.
 */
function useResource(loader, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({ status: previous.data ? 'refreshing' : 'loading', data: previous.data, error: null }));

    try {
      const payload = await loader(controller.signal);
      setState({ status: 'ready', data: payload.data ?? payload, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}

export function useTechnicianSummary() {
  return useResource((signal) => fetchTechnicianSummary({ signal }));
}

export function useTechnicianJobs(params = {}) {
  const serialized = JSON.stringify(params);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchTechnicianJobs(JSON.parse(serialized), { signal: controller.signal });
      setState({ status: 'ready', rows: payload.data ?? [], meta: payload.meta ?? null, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [serialized]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}

export function useTechnicianJob(id) {
  return useResource((signal) => fetchTechnicianJob(id, { signal }), [id]);
}

export function useTechnicianStock() {
  return useResource((signal) => fetchTechnicianStock({ signal }));
}

export function useTechnicianEarnings() {
  return useResource((signal) => fetchTechnicianEarnings({ signal }));
}
