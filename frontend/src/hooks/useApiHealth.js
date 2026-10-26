import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchHealth } from '../lib/api.js';

const REFRESH_INTERVAL_MS = 45_000;
const REQUEST_TIMEOUT_MS = 6_000;

/**
 * Reads /api/health and keeps it fresh. Consumed once by the system health
 * provider so every surface shares the same snapshot and request.
 */
export function useApiHealth({ autoRefresh = true } = {}) {
  const [state, setState] = useState({
    status: 'loading', // loading | online | offline
    data: null,
    error: null,
    latencyMs: null,
    checkedAt: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const startedAt = performance.now();

    setIsRefreshing(true);

    try {
      const data = await fetchHealth({ signal: controller.signal });

      // A newer request (or an unmount) makes this response irrelevant.
      if (!mountedRef.current || controllerRef.current !== controller) return;

      setState({
        status: 'online',
        data,
        error: null,
        latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
        checkedAt: new Date(),
      });
    } catch (error) {
      if (!mountedRef.current || controllerRef.current !== controller) return;

      setState({
        status: 'offline',
        data: null,
        error: timedOut
          ? 'The API did not respond within six seconds.'
          : 'The API is unreachable. The web client is running, but the backend is not responding.',
        latencyMs: null,
        checkedAt: new Date(),
      });
    } finally {
      clearTimeout(timeout);

      if (mountedRef.current && controllerRef.current === controller) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check();

    if (!autoRefresh) {
      return () => {
        mountedRef.current = false;
        controllerRef.current?.abort();
      };
    }

    const interval = setInterval(check, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, [autoRefresh, check]);

  return { ...state, isRefreshing, refresh: check, refreshIntervalMs: REFRESH_INTERVAL_MS };
}
