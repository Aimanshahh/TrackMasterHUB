import { useCallback, useEffect, useState } from 'react';

import {
  fetchComplaints,
  fetchDevices,
  fetchJobs,
  fetchOperationsSummary,
  fetchSims,
  fetchStockByStation,
  fetchStockByTechnician,
  fetchTechnicians,
} from '../lib/api.js';

const SEARCH_DEBOUNCE_MS = 320;

function useDebouncedValue(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Shared loader for operations collections. The params object is serialised so
 * the request only re-runs when a real query value changes.
 */
function usePagedResource(fetchFn, params) {
  const serialized = JSON.stringify(params);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({
      ...previous,
      status: previous.rows.length ? 'refreshing' : 'loading',
      error: null,
    }));

    try {
      const payload = await fetchFn(JSON.parse(serialized), { signal });
      setState({ status: 'ready', rows: payload.data ?? [], meta: payload.meta ?? null, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [fetchFn, serialized]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { ...state, refresh: () => load() };
}

export function useOperationsSummary() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.data ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchOperationsSummary({ signal });
      setState({ status: 'ready', data: payload.data, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ status: 'error', data: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { ...state, refresh: () => load() };
}

export function useStockByStation() {
  const [state, setState] = useState({ status: 'loading', rows: [], threshold: 3, error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchStockByStation({ signal });
      setState({
        status: 'ready',
        rows: payload.data ?? [],
        threshold: payload.meta?.lowStockThreshold ?? 3,
        error: null,
      });
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

export function useTechnicianStock() {
  const [state, setState] = useState({ status: 'loading', rows: [], threshold: 3, error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'refreshing' : 'loading', error: null }));
    try {
      const payload = await fetchStockByTechnician({ signal });
      setState({
        status: 'ready',
        rows: payload.data ?? [],
        threshold: payload.meta?.lowStockThreshold ?? 3,
        error: null,
      });
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

export function useJobs({ status = '', priority = '', search = '', page = 1, limit = 25 } = {}) {
  const q = useDebouncedValue(search);
  return usePagedResource(fetchJobs, { status, priority, q, page, limit });
}

export function useTechnicians({ search = '', activeOnly = false } = {}) {
  const q = useDebouncedValue(search);
  return usePagedResource(fetchTechnicians, { q, active: activeOnly ? 'true' : '' });
}

export function useDevices({ status = '', search = '', page = 1, limit = 25 } = {}) {
  const q = useDebouncedValue(search);
  return usePagedResource(fetchDevices, { status, q, page, limit });
}

export function useSims({ status = '', search = '', page = 1, limit = 25 } = {}) {
  const q = useDebouncedValue(search);
  return usePagedResource(fetchSims, { status, q, page, limit });
}

export function useComplaints({ status = '', search = '', page = 1, limit = 25 } = {}) {
  const q = useDebouncedValue(search);
  return usePagedResource(fetchComplaints, { status, q, page, limit });
}

/** Unique station names already recorded, used to power station suggestions. */
export function useKnownStations(sources) {
  const names = new Set();

  for (const source of sources) {
    for (const row of source ?? []) {
      const station = typeof row === 'string' ? row : row?.station;
      if (station && station.trim()) names.add(station.trim());
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

export { useDebouncedValue };
