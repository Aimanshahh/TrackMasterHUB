import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchManagerCustomer,
  fetchManagerCustomers,
  fetchManagerSummary,
  saveSecurityBriefing,
} from '../lib/api.js';

/** Manager overview figures, all counted from stored records. */
export function useManagerSummary() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, status: previous.data ? 'ready' : 'loading' }));
    try {
      const payload = await fetchManagerSummary();
      setState({ status: 'ready', data: payload.data, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ status: 'error', data: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

const SEARCH_DEBOUNCE_MS = 320;

/** Global customer lookup for the manager desk. */
export function useManagerCustomers({ q = '', accountStatus = '' } = {}) {
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

    setState((previous) => ({
      ...previous,
      status: previous.rows.length ? 'ready' : 'loading',
      error: null,
    }));

    try {
      const payload = await fetchManagerCustomers(
        { q: debounced, accountStatus, limit: 50 },
        { signal: controller.signal },
      );
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [debounced, accountStatus]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}

/** One customer with vehicles, invoices, payments, complaints and briefing. */
export function useManagerCustomer(id) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null, saving: false });

  const load = useCallback(async (signal) => {
    if (!id) return;
    setState((previous) => ({ ...previous, status: previous.data ? 'ready' : 'loading' }));
    try {
      const payload = await fetchManagerCustomer(id, { signal });
      setState({ status: 'ready', data: payload, error: null, saving: false });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ status: 'error', data: null, error: error.message, saving: false });
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const saveBriefing = useCallback(async (input) => {
    setState((previous) => ({ ...previous, saving: true, error: null }));
    try {
      const payload = await saveSecurityBriefing(id, input);
      setState({ status: 'ready', data: payload, error: null, saving: false });
      return payload;
    } catch (error) {
      setState((previous) => ({ ...previous, saving: false }));
      throw error;
    }
  }, [id]);

  return { ...state, refresh: () => load(), saveBriefing };
}
