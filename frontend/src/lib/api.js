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

export function updateCustomer(id, input) {
  return apiRequest(`/api/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/* ---------------- Operations, complaints and notifications ---------------- */

function withQuery(path, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }

  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

function sendJson(path, method, input) {
  return apiRequest(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchOperationsSummary({ signal } = {}) {
  return apiRequest('/api/operations/summary', { signal });
}

export function fetchStockByStation({ signal } = {}) {
  return apiRequest('/api/operations/stock-by-station', { signal });
}

export function fetchStockByTechnician({ signal } = {}) {
  return apiRequest('/api/operations/stock-by-technician', { signal });
}

export function fetchJobs(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/operations/jobs', params), { signal });
}

export function createJobRecord(input) {
  return sendJson('/api/operations/jobs', 'POST', input);
}

export function updateJobRecord(id, input) {
  return sendJson(`/api/operations/jobs/${encodeURIComponent(id)}`, 'PATCH', input);
}

export function fetchTechnicians(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/operations/technicians', params), { signal });
}

export function createTechnicianRecord(input) {
  return sendJson('/api/operations/technicians', 'POST', input);
}

export function updateTechnicianRecord(id, input) {
  return sendJson(`/api/operations/technicians/${encodeURIComponent(id)}`, 'PATCH', input);
}

export function fetchDevices(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/operations/devices', params), { signal });
}

export function createDeviceRecord(input) {
  return sendJson('/api/operations/devices', 'POST', input);
}

export function updateDeviceRecord(id, input) {
  return sendJson(`/api/operations/devices/${encodeURIComponent(id)}`, 'PATCH', input);
}

export function fetchSims(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/operations/sims', params), { signal });
}

export function createSimRecord(input) {
  return sendJson('/api/operations/sims', 'POST', input);
}

export function updateSimRecord(id, input) {
  return sendJson(`/api/operations/sims/${encodeURIComponent(id)}`, 'PATCH', input);
}

export function fetchComplaints(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/complaints', params), { signal });
}

export function createComplaintRecord(input) {
  return sendJson('/api/complaints', 'POST', input);
}

export function updateComplaintRecord(id, input) {
  return sendJson(`/api/complaints/${encodeURIComponent(id)}`, 'PATCH', input);
}

/* ---------------- Commercial: packages, quotes and approvals ---------------- */

export function fetchPackages({ signal } = {}) {
  return apiRequest('/api/packages', { signal });
}

export function updatePackagePricing(key, input) {
  return sendJson(`/api/packages/${encodeURIComponent(key)}`, 'PATCH', input);
}

export function fetchApprovals(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/approvals', params), { signal });
}

export function decidePriceApproval(id, input) {
  return sendJson(`/api/approvals/${encodeURIComponent(id)}/decision`, 'POST', input);
}

/* ---------------- Salesperson desk ---------------- */

export function fetchSalespersonSummary({ signal } = {}) {
  return apiRequest('/api/salesperson/summary', { signal });
}

export function fetchMyJobs(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/salesperson/jobs', params), { signal });
}

export function fetchNotifications({ signal } = {}) {
  return apiRequest('/api/notifications?limit=12', { signal });
}

export function markNotificationRead(id) {
  return apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest('/api/notifications/read-all', { method: 'POST' });
}
