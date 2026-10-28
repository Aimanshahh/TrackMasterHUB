import { useCallback, useEffect, useState } from 'react';

import {
  bootstrapRequest,
  fetchAuthStatus,
  fetchMe,
  loginRequest,
  logoutRequest,
} from '../lib/api.js';
import { AuthContext } from './auth.js';

/** One session for the whole client. The cookie itself is httpOnly and never
 * readable here; the server is the only source of truth about who is signed in. */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, error: null });

  const refresh = useCallback(async (signal) => {
    try {
      const payload = await fetchMe({ signal });
      setState({ status: 'authenticated', user: payload.data.user, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;

      setState({
        status: 'anonymous',
        user: null,
        // A 401 is the normal signed-out answer, not an error worth showing.
        error: error.status === 401 ? null : error.message,
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const payload = await loginRequest(email, password);
    setState({ status: 'authenticated', user: payload.data.user, error: null });
    return payload.data.user;
  }, []);

  const completeFirstRun = useCallback(async (input) => {
    const payload = await bootstrapRequest(input);
    setState({ status: 'authenticated', user: payload.data.user, error: null });
    return payload.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Clear local state regardless so the UI never shows a stale identity.
    } finally {
      setState({ status: 'anonymous', user: null, error: null });
    }
  }, []);

  const value = { ...state, refresh, login, completeFirstRun, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
