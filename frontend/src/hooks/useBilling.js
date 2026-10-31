import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createInvoiceRecord,
  fetchBillingQueue,
  fetchBillingSeries,
  fetchBillingSummary,
  fetchInvoices,
  fetchPayments,
  issueInvoiceRecord,
  recordInvoicePayment,
} from '../lib/api.js';

/** Totals for the money strip. Refreshed after any payment or invoice change. */
export function useBillingSummary() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.data ? 'ready' : 'loading' }));
    try {
      const payload = await fetchBillingSummary({ signal });
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

export function useMonthlySeries(months = 6) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  useEffect(() => {
    const controller = new AbortController();

    fetchBillingSeries(months, { signal: controller.signal })
      .then((payload) => setState({ status: 'ready', rows: payload.data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', rows: [], error: error.message });
      });

    return () => controller.abort();
  }, [months]);

  return state;
}

const SEARCH_DEBOUNCE_MS = 320;

/**
 * Invoice list. The list keeps its rows while a refetch runs so issuing an
 * invoice or recording a payment does not blank the table.
 */
export function useInvoices({ q = '', status = '', paymentState = '' } = {}) {
  const [debounced, setDebounced] = useState(q);
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null, busyId: null });
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
      const payload = await fetchInvoices(
        { q: debounced, status, paymentState, limit: 50 },
        { signal: controller.signal },
      );
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null, busyId: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message, busyId: null }));
    }
  }, [debounced, status, paymentState]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const issue = useCallback(async (id) => {
    setState((previous) => ({ ...previous, busyId: id, error: null }));
    try {
      const payload = await issueInvoiceRecord(id);
      setState((previous) => ({
        ...previous,
        busyId: null,
        rows: previous.rows.map((row) => (row.id === id ? payload.data.invoice : row)),
      }));
      return payload.data.invoice;
    } catch (error) {
      setState((previous) => ({ ...previous, busyId: null, error: error.message }));
      throw error;
    }
  }, []);

  const recordPayment = useCallback(async (id, input) => {
    setState((previous) => ({ ...previous, busyId: id, error: null }));
    try {
      const payload = await recordInvoicePayment(id, input);
      setState((previous) => ({
        ...previous,
        busyId: null,
        rows: previous.rows.map((row) => (row.id === id ? payload.data.invoice : row)),
      }));
      return payload.data;
    } catch (error) {
      setState((previous) => ({ ...previous, busyId: null, error: error.message }));
      throw error;
    }
  }, []);

  return { ...state, refresh: load, issue, recordPayment };
}

export function usePayments({ q = '', method = '', from = '', to = '' } = {}) {
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
      const payload = await fetchPayments(
        { q: debounced, method, from, to, limit: 50 },
        { signal: controller.signal },
      );
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, [debounced, method, from, to]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, refresh: load };
}

/** Finished installations with no invoice yet. */
export function useBillingQueue() {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading' }));
    try {
      const payload = await fetchBillingQueue({ limit: 20 });
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const draft = useCallback(async (jobId) => {
    const payload = await createInvoiceRecord({ jobId });
    await load();
    return payload.data.invoice;
  }, [load]);

  return { ...state, refresh: load, draft };
}
