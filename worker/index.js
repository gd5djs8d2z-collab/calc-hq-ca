/* worker/index.js — the only server code on calc-hq.ca.

   Everything except /api/lead* is served straight from static assets (run_worker_first in
   wrangler.jsonc limits this Worker to /api/*). POST /api/lead validates a lead-form
   submission and hands it to the Google Apps Script web app behind the lead Sheet
   (worker/apps-script/Code.gs), which stores the row first and then sends the emails.

   Nothing here logs request bodies, names, emails, phones or IPs. Errors are logged by kind
   and lead ID only.

   Config (wrangler.jsonc vars): ALLOWED_ORIGINS. Which provinces have no partner lives in
   assets/js/lead-config.js, shared with the form.
   Secrets (dashboard / wrangler secret put): LEADS_WEBHOOK_URL, LEADS_WEBHOOK_SECRET,
   LEAD_TEST_TOKEN. Local only (.dev.vars): LEAD_TEST_MODE=1 marks every lead as a test. */

import { CONSENT_VERSION, LEAD_PROVINCES, LEAD_NEEDS, LEAD_LIMITS, NO_PARTNER_PROVINCES } from '../assets/js/lead-config.js';

const PROVINCES = new Map(LEAD_PROVINCES);
const NEEDS = new Map(LEAD_NEEDS);
const MAX_BODY = 8192;
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const PHONE_RE = /^[0-9+().\-\s]{7,30}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/lead') return handleLead(request, env);
    if (pathname === '/api/lead/test') return handleTestAdmin(request, env);
    return env.ASSETS.fetch(request);
  },
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return origin !== null && allowed.includes(origin) ? origin : null;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/* Short, unambiguous ID: L- plus 6 Crockford base32 characters. */
function leadId() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'L-' + [...bytes].map(b => alphabet[b & 31]).join('');
}

function clean(v) {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}

/* Returns { lead, errors } — errors maps field name → message shown next to that field. */
export function validate(body) {
  const errors = {};
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const province = clean(body.province);
  const need = clean(body.need);
  const message = typeof body.message === 'string' ? body.message.trim().replace(/\r\n?/g, '\n') : '';

  if (!name) errors.name = 'Enter your name.';
  else if (name.length > LEAD_LIMITS.name || CONTROL_RE.test(name)) errors.name = 'Enter a shorter name.';
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > LEAD_LIMITS.email || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a phone number using digits only, or leave it blank.';
  if (!PROVINCES.has(province)) errors.province = 'Choose your province or territory.';
  if (!NEEDS.has(need)) errors.need = 'Choose what you need help with.';
  if (message.length > LEAD_LIMITS.message || CONTROL_RE.test(message)) errors.message = `Keep the message under ${LEAD_LIMITS.message} characters.`;
  if (body.consent !== true) errors.consent = 'Tick the box to agree before sending.';

  return { errors, lead: { name, email, phone, province, need, message } };
}

/* Only a same-origin page path is kept — never a query string or fragment. */
function sourcePage(raw, origin) {
  try {
    const u = new URL(String(raw || ''), origin);
    if (u.origin !== origin || u.pathname.length > 200) return '';
    return u.origin + u.pathname;
  } catch { return ''; }
}

async function handleLead(request, env) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  const origin = allowedOrigin(request, env);
  if (!origin) return json(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
    return json(415, { ok: false, error: 'type' });
  }

  if (env.LEAD_RATE_LIMITER) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { success } = await env.LEAD_RATE_LIMITER.limit({ key: ip });
    if (!success) return json(429, { ok: false, error: 'rate' });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'size' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'json' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: 'json' });

  // Honeypot: a filled "website" field is a bot. Answer like a success and store nothing.
  if (clean(body.website)) return json(200, { ok: true, id: leadId(), no_partner: false });

  // No partner in this province: there is nothing to consent to and nothing personal is
  // kept — only the province, the page and the time, as evidence of demand.
  const noPartner = NO_PARTNER_PROVINCES.includes(clean(body.province));
  if (!noPartner && body.consent_version !== CONSENT_VERSION) return json(409, { ok: false, error: 'consent_version' });

  // A test token that doesn't match is refused outright — it must never fall through to a
  // real lead that gets emailed to the partner.
  let isTest = env.LEAD_TEST_MODE === '1';
  if (body.test_token !== undefined && body.test_token !== '') {
    if (!safeEqual(String(body.test_token), env.LEAD_TEST_TOKEN)) return json(403, { ok: false, error: 'test_token' });
    isTest = true;
  }

  let lead;
  if (noPartner) {
    lead = { name: '', email: '', phone: '', province: clean(body.province), need: '', message: '' };
  } else {
    const v = validate(body);
    if (Object.keys(v.errors).length) return json(422, { ok: false, error: 'invalid', errors: v.errors });
    lead = v.lead;
  }

  if (!env.LEADS_WEBHOOK_URL || !env.LEADS_WEBHOOK_SECRET) {
    console.error('lead: webhook not configured');
    return json(503, { ok: false, error: 'unavailable' });
  }

  const record = {
    ...lead,
    id: leadId(),
    received_at: new Date().toISOString(),
    province_name: PROVINCES.get(lead.province),
    need_label: noPartner ? '' : NEEDS.get(lead.need),
    source_page: sourcePage(body.source_page, origin),
    consent_version: noPartner ? '' : CONSENT_VERSION,
    is_test: isTest,
    no_partner: noPartner,
  };

  const res = await callSheet(env, { action: 'add', lead: record });
  if (!res || res.ok !== true) {
    console.error(`lead: store failed ${record.id}`);
    return json(502, { ok: false, error: 'store' });
  }
  if (res.email_failed) console.error(`lead: email failed ${record.id}`);
  return json(200, noPartner ? { ok: true, no_partner: true } : { ok: true, id: record.id, no_partner: false });
}

async function callSheet(env, payload) {
  try {
    const r = await fetch(env.LEADS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.LEADS_WEBHOOK_SECRET, ...payload }),
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* Lets the post-deploy check confirm a test lead was stored, then delete it. Bearer
   LEAD_TEST_TOKEN only, and the Apps Script side refuses any row not marked is_test. */
async function handleTestAdmin(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!env.LEAD_TEST_TOKEN || !safeEqual(auth.replace(/^Bearer /, ''), env.LEAD_TEST_TOKEN)) {
    return json(404, { ok: false });
  }
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^L-[0-9A-Z]{6}$/.test(id)) return json(400, { ok: false, error: 'id' });
  const action = request.method === 'GET' ? 'test_get' : request.method === 'DELETE' ? 'test_delete' : null;
  if (!action) return json(405, { ok: false });
  const res = await callSheet(env, { action, id });
  return json(res ? 200 : 502, res || { ok: false, error: 'store' });
}
