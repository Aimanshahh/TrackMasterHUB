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
      // Identity-dependent answers must never come from the HTTP cache: a
      // cached /auth/me would keep reporting the account we just signed out of.
      cache: 'no-store',
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

/* ---------------- Money records: invoices, payments and the manager desk ---------------- */

export function fetchBillingSummary({ signal } = {}) {
  return apiRequest('/api/billing/summary', { signal });
}

export function fetchBillingSeries(months = 6, { signal } = {}) {
  return apiRequest(withQuery('/api/billing/series', { months }), { signal });
}

export function fetchInvoices(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/billing/invoices', params), { signal });
}

export function fetchInvoiceDetail(id, { signal } = {}) {
  return apiRequest(`/api/billing/invoices/${encodeURIComponent(id)}`, { signal });
}

export function issueCreditNoteRecord(id, input) {
  return sendJson(`/api/billing/invoices/${encodeURIComponent(id)}/credit-notes`, 'POST', input);
}

export function recordRefundRecord(id, input) {
  return sendJson(`/api/billing/invoices/${encodeURIComponent(id)}/refunds`, 'POST', input);
}

export function fetchAdjustmentDetail(id, { signal } = {}) {
  return apiRequest(`/api/billing/adjustments/${encodeURIComponent(id)}`, { signal });
}

export function fetchCustomerHistory(id, { signal } = {}) {
  return apiRequest(`/api/customers/${encodeURIComponent(id)}/history`, { signal });
}

export function fetchComplaintMessages(id, { signal } = {}) {
  return apiRequest(`/api/complaints/${encodeURIComponent(id)}/messages`, { signal });
}

export function retryMessageRecord(messageId) {
  return sendJson(`/api/complaints/messages/${encodeURIComponent(messageId)}/retry`, 'POST', {});
}

export function markMessageManualRecord(messageId, note) {
  return sendJson(`/api/complaints/messages/${encodeURIComponent(messageId)}/manual`, 'POST', { note });
}

export function createInvoiceRecord(input) {
  return sendJson('/api/billing/invoices', 'POST', input);
}

export function issueInvoiceRecord(id) {
  return apiRequest(`/api/billing/invoices/${encodeURIComponent(id)}/issue`, { method: 'POST' });
}

export function cancelInvoiceRecord(id, reason) {
  return sendJson(`/api/billing/invoices/${encodeURIComponent(id)}/cancel`, 'POST', { reason });
}

export function fetchInvoicePayments(id, { signal } = {}) {
  return apiRequest(`/api/billing/invoices/${encodeURIComponent(id)}/payments`, { signal });
}

export function fetchPayments(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/billing/payments', params), { signal });
}

export function recordInvoicePayment(id, input) {
  return sendJson(`/api/billing/invoices/${encodeURIComponent(id)}/payments`, 'POST', input);
}

export function fetchManagerSummary({ signal } = {}) {
  return apiRequest('/api/manager/summary', { signal });
}

/* ---- certificates ---- */

export function fetchCertificateCustomers(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/certificates/customers', params), { signal });
}

export function fetchCertificates(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/certificates', params), { signal });
}

export function fetchCertificate(id, { signal } = {}) {
  return apiRequest(`/api/certificates/${encodeURIComponent(id)}`, { signal });
}

export function issueCertificatesRecord(input) {
  return sendJson('/api/certificates', 'POST', input);
}

export function reissueCertificateRecord(id, input) {
  return sendJson(`/api/certificates/${encodeURIComponent(id)}/reissue`, 'POST', input);
}

export function cancelCertificateRecord(id, input) {
  return sendJson(`/api/certificates/${encodeURIComponent(id)}/cancel`, 'POST', input);
}

/** Fetch a binary file with the session cookie and return it as a Blob. */
async function fetchBlob(path) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', cache: 'no-store' });
  } catch {
    throw new ApiError('Could not reach the API. Check that the backend is running.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.error?.message ?? `Request failed with status ${response.status}.`, { status: response.status });
  }
  return response.blob();
}

export function fetchCertificatePdf(id) {
  return fetchBlob(`/api/certificates/${encodeURIComponent(id)}/pdf`);
}

/* ---- customer import ---- */

export function fetchImports(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/imports', params), { signal });
}

export function fetchImportBatch(id, { signal } = {}) {
  return apiRequest(`/api/imports/${encodeURIComponent(id)}`, { signal });
}

export function fetchImportRows(id, params = {}, { signal } = {}) {
  return apiRequest(withQuery(`/api/imports/${encodeURIComponent(id)}/rows`, params), { signal });
}

/** The file goes up as raw bytes; its name travels in a header. */
export function uploadImportFile(file) {
  return apiRequest('/api/imports/upload', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
  });
}

export function previewImportBatch(id, input) {
  return sendJson(`/api/imports/${encodeURIComponent(id)}/preview`, 'POST', input);
}

export function confirmImportBatch(id, input) {
  return sendJson(`/api/imports/${encodeURIComponent(id)}/confirm`, 'POST', input);
}

export function fetchImportReport(id) {
  return fetchBlob(`/api/imports/${encodeURIComponent(id)}/report.csv`);
}

export function fetchCalls(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/calls', params), { signal });
}

export function fetchVehicles(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/vehicles', params), { signal });
}

export function refreshVehicleStatus() {
  return apiRequest('/api/vehicles/refresh', { method: 'POST' });
}

export function fetchBriefingPending(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/manager/briefing-pending', params), { signal });
}

export function fetchManagerCustomers(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/manager/customers', params), { signal });
}

export function fetchManagerCustomer(id, { signal } = {}) {
  return apiRequest(`/api/manager/customers/${encodeURIComponent(id)}`, { signal });
}

export function saveSecurityBriefing(id, input) {
  return sendJson(`/api/manager/customers/${encodeURIComponent(id)}/briefing`, 'PATCH', input);
}

export function fetchBillingQueue(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/manager/billing-queue', params), { signal });
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
