// Mode simulation : aucun compte Zendesk nécessaire
if (process.env.ZENDESK_MODE === 'mock') {
  console.log('Mode SIMULATION Zendesk activé (données en mémoire)');
  module.exports = require('./zendeskMock');
  return;
}

const { HttpError } = require('./errors');

const { ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN } = process.env;
if (!ZENDESK_SUBDOMAIN || !ZENDESK_EMAIL || !ZENDESK_API_TOKEN) {
  console.error('Variables ZENDESK_* manquantes (voir .env.example) ou mettez ZENDESK_MODE=mock');
  process.exit(1);
}

const BASE = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
// Authentification officielle : email/token:TOKEN encodé en Base64
const AUTH = 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function zd(path, { method = 'GET', body, retries = 2 } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new HttpError(502, 'Service Zendesk injoignable');
    err.fromZendesk = true;
    throw err;
  }
  // Rate limit : on attend Retry-After puis on réessaie
  if (res.status === 429 && retries > 0) {
    await sleep((Number(res.headers.get('retry-after')) || 1) * 1000);
    return zd(path, { method, body, retries: retries - 1 });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.error || data.description || `Erreur Zendesk ${res.status}`;
    const status = [400, 404, 422, 429].includes(res.status) ? (res.status === 422 ? 400 : res.status) : 502;
    const err = new HttpError(status, typeof msg === 'string' ? msg : JSON.stringify(msg), data.details);
    err.fromZendesk = true;
    throw err;
  }
  return data;
}

module.exports = {
  search: (query, page = 1, perPage = 25) =>
    zd(`/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc&page=${page}&per_page=${perPage}`),
  count: (query) => zd(`/search/count.json?query=${encodeURIComponent(query)}`),
  getTicket: (id) => zd(`/tickets/${id}.json`),
  getComments: (id) => zd(`/tickets/${id}/comments.json`),
  createTicket: (ticket) => zd('/tickets.json', { method: 'POST', body: { ticket } }),
  updateTicket: (id, ticket) => zd(`/tickets/${id}.json`, { method: 'PUT', body: { ticket } }),
  deleteTicket: (id) => zd(`/tickets/${id}.json`, { method: 'DELETE' }),
};
