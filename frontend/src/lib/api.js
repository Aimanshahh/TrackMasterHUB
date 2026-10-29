const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message,
    { status = 0, code = 'NETWORK_ERROR', requestId = null, details = null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

/** Single place for API calls so base URL, headers and error shapes stay
 * consistent as modules are added. */
export async function apiRequest(path, { signal, headers, ...options } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
      // Session cookie is httpOnly; sent automatically on same-origin or
      // credentialed cross-origin requests when VITE_API_BASE_URL is set.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the API. Check that the backend is running.');
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}.`,
      {
        status: response.status,
        code: payload?.error?.code,
        requestId: payload?.error?.requestId,
        details: payload?.error?.details ?? null,
      },
    );
  }

  // A static host can answer an unknown /api path with an HTML fallback and a
  // 200. Never treat that as a valid API response.
  if (payload === null) {
    throw new ApiError('The API returned a response that could not be read as JSON.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }

  return payload;
}

export function fetchHealth({ signal } = {}) {
  return apiRequest('/api/health', { signal });
}

export function fetchDashboard({ signal } = {}) {
  return apiRequest('/api/dashboard', { signal });
}

export function fetchActivity(params = {}, { signal } = {}) {
  const query = params instanceof URLSearchParams ? params : new URLSearchParams();

  if (!(params instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
  }

  const search = query.toString();
  return apiRequest(`/api/activity${search ? `?${search}` : ''}`, { signal });
}

export function fetchUsers({ signal } = {}) {
  return apiRequest('/api/users', { signal });
}

export function createUser(input) {
  return apiRequest('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/* ---------------- Authentication ---------------- */

export function fetchAuthStatus({ signal } = {}) {
  return apiRequest('/api/auth/setup-status', { signal });
}

export function fetchMe({ signal } = {}) {
  return apiRequest('/api/auth/me', { signal });
}

export function loginRequest(email, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function bootstrapRequest({ name, email, password }) {
  return apiRequest('/api/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}

export function logoutRequest() {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export function fetchCustomer(id, { signal } = {}) {
  return apiRequest(`/api/customers/${encodeURIComponent(id)}`, { signal });
}

export function fetchCustomers(params = {}, { signal } = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }

  const search = query.toString();

  return apiRequest(`/api/customers${search ? `?${search}` : ''}`, { signal });
}

export function createCustomer(input) {
  return apiRequest('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
