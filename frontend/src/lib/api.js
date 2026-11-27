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

export function setUserPassword(id, password) {
  return sendJson(`/api/users/${encodeURIComponent(id)}/password`, 'PATCH', { password });
}

export function createUser(input) {
  return apiRequest('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchSalespersonPerformance(id, { signal } = {}) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}/performance`, { signal });
}

export function fetchCustomerMessages(customerId, { signal } = {}) {
  return apiRequest(`/api/messages/customers/${encodeURIComponent(customerId)}`, { signal });
}

export function sendCustomerWhatsAppMessage(customerId, body) {
  return apiRequest(`/api/messages/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export function sendWhatsAppBroadcast(body) {
  return apiRequest('/api/messages/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

/* ---------------- Operations desk: customers and WhatsApp templates ---------------- */

export function searchDeskCustomers(search, { signal } = {}) {
  return apiRequest(withQuery('/api/operations/customers', { search, limit: 20 }), { signal });
}

export function fetchDeskCustomer(id, { signal } = {}) {
  return apiRequest(`/api/operations/customers/${encodeURIComponent(id)}`, { signal });
}

export function fetchMessageTemplates({ signal } = {}) {
  return apiRequest('/api/operations/message-templates', { signal });
}

export function createMessageTemplate(input) {
  return sendJson('/api/operations/message-templates', 'POST', input);
}

export function previewTemplateMessage(input, { signal } = {}) {
  return apiRequest('/api/operations/whatsapp/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
}

export function sendTemplateMessage(input) {
  return sendJson('/api/operations/whatsapp/send', 'POST', input);
}

export function fetchMySales({ signal } = {}) {
  return apiRequest('/api/sales/mine', { signal });
}

export function cancelSale(id, input) {
  return apiRequest(`/api/sales/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function restoreSale(id) {
  return apiRequest(`/api/sales/${id}/restore`, { method: 'POST' });
}

export function fetchSalesOverview({ signal } = {}) {
  return apiRequest('/api/sales/overview', { signal });
}

export function fetchShezzPreview() {
  return apiRequest('/api/operations/shezz/preview');
}

export function runShezzSync(mappings) {
  return sendJson('/api/operations/shezz/sync', 'POST', { mappings });
}

export function fetchStockPortalPreview() {
  return apiRequest('/api/operations/stock-portal/preview');
}

export function runStockPortalSync(mappings) {
  return sendJson('/api/operations/stock-portal/sync', 'POST', { mappings });
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

export function checkDuplicateCustomers(phone, { signal } = {}) {
  return apiRequest(`/api/customers/check-duplicate?phone=${encodeURIComponent(phone)}`, { signal });
}

export function setSalespersonTarget(id, target) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}/target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
}

export function updateCustomer(id, input) {
  return apiRequest(`/api/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteCustomerRecord(id) {
  return apiRequest(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

export function updateEngineKill(jobId, input) {
  return sendJson(`/api/operations/jobs/${encodeURIComponent(jobId)}/engine-kill`, 'PATCH', input);
}

export function fetchVehicleProfile(id, { signal, lookup } = {}) {
  const query = lookup ? `?lookup=${encodeURIComponent(lookup)}` : '';
  return apiRequest(`/api/vehicles/${encodeURIComponent(id)}/profile${query}`, { signal });
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

export function recordAmcPayment(customerId, input) {
  return sendJson(`/api/billing/customers/${encodeURIComponent(customerId)}/amc-payment`, 'POST', input);
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

export function fetchImportFields({ signal } = {}) {
  return apiRequest('/api/imports/fields', { signal });
}

export function fetchImportRows(id, params = {}, { signal } = {}) {
  return apiRequest(withQuery(`/api/imports/${encodeURIComponent(id)}/rows`, params), { signal });
}

export function deleteImportBatch(id) {
  return apiRequest(`/api/imports/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

export function updateVehicleInspection(id, input) {
  return sendJson(`/api/vehicles/${encodeURIComponent(id)}/inspection`, 'PATCH', input);
}

export function exportPendingInspections() {
  return fetchBlob('/api/vehicles/export/pending-inspections.csv');
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

/* ---------------- Technician portal ---------------- */

export function fetchTechnicianSummary({ signal } = {}) {
  return apiRequest('/api/technician/summary', { signal });
}

export function fetchTechnicianJobs(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/technician/jobs', params), { signal });
}

export function fetchTechnicianJob(id, { signal } = {}) {
  return apiRequest(`/api/technician/jobs/${encodeURIComponent(id)}`, { signal });
}

export function selectTechnicianStock(id, input) {
  return sendJson(`/api/technician/jobs/${encodeURIComponent(id)}/stock`, 'POST', input);
}

export function saveTechnicianTest(id, input) {
  return sendJson(`/api/technician/jobs/${encodeURIComponent(id)}/tests`, 'PATCH', input);
}

export function requestEngineKillTest(id, input = {}) {
  return sendJson(`/api/technician/jobs/${encodeURIComponent(id)}/engine-kill-request`, 'POST', input);
}

export function runTechnicianPortalCheck(id) {
  return sendJson(`/api/technician/jobs/${encodeURIComponent(id)}/portal-check`, 'POST', {});
}

export function markEngineKillUnsupported(id, input = {}) {
  return sendJson(`/api/technician/jobs/${encodeURIComponent(id)}/engine-kill-unsupported`, 'POST', input);
}

export function refreshInstallationReview(id) {
  return sendJson(`/api/operations/jobs/${encodeURIComponent(id)}/review/refresh`, 'POST', {});
}

export function submitInstallationForReview(id) {
  return sendJson(`/api/technician/jobs/${encodeURIComponent(id)}/submit`, 'POST', {});
}

export function fetchTechnicianStock({ signal } = {}) {
  return apiRequest('/api/technician/stock', { signal });
}

export function fetchTechnicianEarnings({ signal } = {}) {
  return apiRequest('/api/technician/earnings', { signal });
}

/* ---------------- Operations: testing review, schedule, microphones ---------------- */

export function fetchTestingReviews({ signal } = {}) {
  return apiRequest('/api/operations/reviews', { signal });
}

export function reviewInstallation(id, input) {
  return sendJson(`/api/operations/jobs/${encodeURIComponent(id)}/review`, 'POST', input);
}

export function updateInstallationSchedule(id, input) {
  return sendJson(`/api/operations/jobs/${encodeURIComponent(id)}/schedule`, 'PATCH', input);
}

export function fetchMicrophones({ signal } = {}) {
  return apiRequest('/api/operations/microphones', { signal });
}

export function createMicrophone(input) {
  return sendJson('/api/operations/microphones', 'POST', input);
}

export function assignMicrophone(id, input) {
  return sendJson(`/api/operations/microphones/${encodeURIComponent(id)}/assign`, 'POST', input);
}

export function releaseMicrophone(id, input = {}) {
  return sendJson(`/api/operations/microphones/${encodeURIComponent(id)}/release`, 'POST', input);
}

export function fetchMicrophoneTasks({ signal } = {}) {
  return apiRequest('/api/operations/microphone-tasks', { signal });
}

export function updateTechnicianRates(id, input) {
  return sendJson(`/api/operations/technicians/${encodeURIComponent(id)}/rates`, 'PATCH', input);
}

/* ---------------- Technician payments (admin) ---------------- */

export function fetchTechnicianPayments({ signal } = {}) {
  return apiRequest('/api/technician-payments', { signal });
}

export function fetchTechnicianPaymentAccount(id, { signal } = {}) {
  return apiRequest(`/api/technician-payments/${encodeURIComponent(id)}`, { signal });
}

export function recordTechnicianPayment(id, input) {
  return sendJson(`/api/technician-payments/${encodeURIComponent(id)}/payments`, 'POST', input);
}

export function reverseTechnicianEarning(id, input) {
  return sendJson(`/api/technician-payments/earnings/${encodeURIComponent(id)}/reverse`, 'POST', input);
}

/* ---------------- Hot leads and agent commissions ---------------- */

export function fetchHotLeads(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/customers/hot-leads', params), { signal });
}

export function setCustomerHotLead(id, input) {
  return sendJson(`/api/customers/${encodeURIComponent(id)}/hot-lead`, 'POST', input);
}

export function clearCustomerHotLead(id, input = {}) {
  return sendJson(`/api/customers/${encodeURIComponent(id)}/hot-lead`, 'DELETE', input);
}

export function fetchAgentCommissions(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/sales/agents', params), { signal });
}

export function fetchSalesPerformance(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/sales/performance', params), { signal });
}

export function setAgentCommissionPaid(id, paid) {
  return sendJson(`/api/sales/agents/${encodeURIComponent(id)}/commission`, 'POST', { paid });
}

/* ---------------- Quotations ---------------- */

export function fetchQuotations(params = {}, { signal } = {}) {
  return apiRequest(withQuery('/api/quotations', params), { signal });
}

export function fetchQuotation(id, { signal } = {}) {
  return apiRequest(`/api/quotations/${encodeURIComponent(id)}`, { signal });
}

export function createQuotation(input) {
  return sendJson('/api/quotations', 'POST', input);
}

export function updateQuotation(id, input) {
  return sendJson(`/api/quotations/${encodeURIComponent(id)}`, 'PATCH', input);
}

export function sendQuotation(id) {
  return sendJson(`/api/quotations/${encodeURIComponent(id)}/send`, 'POST', {});
}

export function decideQuotation(id, input) {
  return sendJson(`/api/quotations/${encodeURIComponent(id)}/decision`, 'POST', input);
}

export function reviseQuotation(id, input = {}) {
  return sendJson(`/api/quotations/${encodeURIComponent(id)}/revise`, 'POST', input);
}
