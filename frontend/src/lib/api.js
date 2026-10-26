const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', requestId = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * Single place for API calls so base URL, headers and error shapes stay
 * consistent as modules are added.
 */
export async function apiRequest(path, { signal, headers, ...options } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
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
    throw new ApiError(payload?.error?.message ?? `Request failed with status ${response.status}.`, {
      status: response.status,
      code: payload?.error?.code,
      requestId: payload?.error?.requestId,
    });
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
