import { useCallback, useEffect, useState } from 'react';

import { decidePriceApproval, fetchApprovals } from '../lib/api.js';

/**
 * Price approvals for the admin. Requests are created by the backend when a
 * salesperson quotes below the package rate; this hook only reads them and
 * records the decision.
 */
export function useApprovals({ status = 'pending' } = {}) {
  const [state, setState] = useState({ status: 'loading', rows: [], meta: null, error: null, busyId: null });

  const load = useCallback(async (signal) => {
    setState((previous) => ({ ...previous, status: previous.rows.length ? 'ready' : 'loading', error: null }));
    try {
      const payload = await fetchApprovals({ status, limit: 50 }, { signal });
      setState({ status: 'ready', rows: payload.data, meta: payload.meta, error: null, busyId: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((previous) => ({ ...previous, status: 'error', error: error.message, busyId: null }));
    }
  }, [status]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const decide = useCallback(async (id, decision, note) => {
    setState((previous) => ({ ...previous, busyId: id, error: null }));
    try {
      const payload = await decidePriceApproval(id, { decision, note });
      const approval = payload.data.approval;
      setState((previous) => ({
        ...previous,
        rows: previous.rows.filter((row) => row.id !== id),
        meta: previous.meta ? { ...previous.meta, pending: Math.max(0, previous.meta.pending - 1), total: Math.max(0, previous.meta.total - 1) } : previous.meta,
        busyId: null,
        lastDecision: approval,
      }));
    } catch (error) {
      setState((previous) => ({ ...previous, busyId: null, error: error.message }));
      throw error;
    }
  }, []);

  return { ...state, refresh: () => load(), decide };
}
