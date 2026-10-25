/* lead-block.js — wires the partner-accountant form that scripts/sync-lead-block.mjs writes
   into each calculator page. The markup is already in the page; this only adds behaviour.

   Reads ONE thing from the calculator: the province <select> named by the block's
   data-province-source. Never reads or sends income, hours or any other input.
   Nothing here logs to the console.

   A province with no partner yet (NO_PARTNER_PROVINCES — Quebec for now) switches the form
   to province-only: the name, email, phone, need, message and consent fields are hidden and
   never sent, and the request records only the province and the page. */

import { LEAD_LIMITS, NO_PARTNER_PROVINCES, noPartnerNote, noPartnerDone } from '/assets/js/lead-config.js';

const $ = id => document.getElementById(id);
const block = $('lead-block');

// Optional test flag for checking the live form: #lead_test=<token> in the address bar.
// A fragment never reaches the server or its logs; the Worker verifies the token.
const testToken = new URLSearchParams(location.hash.slice(1)).get('lead_test') || '';

async function post(d) {
  if (testToken) d.test_token = testToken;
  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(d),
      credentials: 'same-origin',
    });
    return { res, body: await res.json().catch(() => ({})) };
  } catch { return { res: null, body: {} }; }
}

const failureText = res =>
  res && res.status === 429 ? 'Too many requests from this connection. Wait a minute, then try again.'
  : res && res.status === 409 ? 'This page is out of date. Reload it, then send your request again.'
  : 'Your request didn’t go through. Please try again in a few minutes.';

/* Fill a confirmation or server error, then bring it on screen and focus it. A successful send
   hides the fields above it, so without this it lands above the viewport. */
function showResult(el, leadIn, msg, kind) {
  el.replaceChildren();
  const lead = document.createElement('strong');
  lead.className = 'lead-status-lead';
  lead.textContent = leadIn;
  el.append(lead, ' ' + msg);
  el.classList.add('lead-status');
  el.classList.remove('lead-status-ok', 'lead-status-error');
  el.classList.add('lead-status-' + kind);
  el.hidden = false;
  el.tabIndex = -1;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
}

if (block && block.dataset.variant === 'quebec') initQuebecPage();
else if (block && $('lead-form')) initForm();

/* Quebec-only page: one line and a button. Records the province and the page, nothing else. */
function initQuebecPage() {
  const send = $('lead-qc-send'), line = $('lead-qc-line');
  send.addEventListener('click', async () => {
    send.disabled = true;
    send.textContent = 'Sending…';
    const { res, body } = await post({ province: block.dataset.province, source_page: location.origin + location.pathname });
    if (res && res.ok && body.ok) {
      line.setAttribute('role', 'status');
      send.hidden = true;
      showResult(line, 'Noted.', noPartnerDone('Quebec'), 'ok');
      return;
    }
    showResult(line, 'Not sent.', failureText(res), 'error');
    send.disabled = false;
    send.textContent = 'Send';
  });
  send.disabled = false;
}

function initForm() {
  const form = $('lead-form');
  const submit = $('lead-submit');
  const status = $('lead-status');
  const province = $('lead-province');
  const personal = $('lead-personal');
  const qcNote = $('lead-qc-note');

  const provinceName = () => province.selectedOptions[0].textContent;
  const noPartner = () => NO_PARTNER_PROVINCES.includes(province.value);

  /* Compact variant: one line and a button that reveals the same form inline. */
  const toggle = $('lead-toggle'), panel = $('lead-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Hide the form' : 'Ask to be contacted';
      panel.hidden = !open;
      if (open) province.focus();
    });
  }

  /* Province-only mode for a province with no partner. */
  function applyMode() {
    const np = noPartner();
    personal.hidden = np;
    qcNote.hidden = !np;
    if (np) qcNote.textContent = noPartnerNote(provinceName());
    submit.textContent = np ? 'Send' : 'Send my request';
  }
  province.addEventListener('change', applyMode);

  /* Province pre-fill. Only a province the visitor actually chose counts: the calculator's
     untouched default (Ontario on most pages) is not a choice, so the form starts empty and
     the visitor must pick. Every later change to the calculator's province updates the form,
     so it is never left showing a stale value. */
  const source = block.dataset.provinceSource && $(block.dataset.provinceSource);
  if (source) {
    const known = code => [...province.options].some(o => o.value && o.value === code);
    const defaultOpt = () => [...source.options].find(o => o.defaultSelected) || source.options[0];
    // A value restored by the browser (back button, reload) differs from the default.
    const d = defaultOpt();
    if (d && source.value && source.value !== d.value && known(source.value)) province.value = source.value;
    source.addEventListener('change', () => { if (known(source.value)) { province.value = source.value; applyMode(); } });
  }
  applyMode();

  const fields = ['name', 'email', 'phone', 'province', 'need', 'message', 'consent'];
  const showError = (f, msg) => {
    const p = $(`lead-${f}-error`), input = $(`lead-${f}`);
    if (!p) return;
    p.textContent = msg || '';
    p.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const clearErrors = () => fields.forEach(f => showError(f));
  fields.forEach(f => $(`lead-${f}`).addEventListener('input', () => showError(f)));

  const clearStatus = () => {
    status.textContent = '';
    status.className = 'lead-status';
    status.hidden = true;
  };

  function localErrors(d) {
    const e = {};
    if (!d.province) e.province = 'Choose your province or territory.';
    if (noPartner()) return e;
    if (!d.name) e.name = 'Enter your name.';
    if (!d.email) e.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.email = 'Enter a valid email address.';
    if (d.phone && !/^[0-9+().\-\s]{7,30}$/.test(d.phone)) e.phone = 'Enter a phone number using digits only, or leave it blank.';
    if (!d.need) e.need = 'Choose what you need help with.';
    if (d.message.length > LEAD_LIMITS.message) e.message = `Keep the message under ${LEAD_LIMITS.message} characters.`;
    if (!d.consent) e.consent = 'Tick the box to agree before sending.';
    return e;
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    clearErrors();
    clearStatus();
    const np = noPartner();
    const d = np
      ? { province: province.value, website: $('lead-website').value, source_page: location.origin + location.pathname }
      : {
          name: $('lead-name').value.trim(),
          email: $('lead-email').value.trim(),
          phone: $('lead-phone').value.trim(),
          province: province.value,
          need: $('lead-need').value,
          message: $('lead-message').value.trim(),
          consent: $('lead-consent').checked,
          website: $('lead-website').value,
          consent_version: form.dataset.consentVersion,
          source_page: location.origin + location.pathname,
        };

    const errs = localErrors(d);
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([f, m]) => showError(f, m));
      $(`lead-${Object.keys(errs)[0]}`).focus();
      return;
    }

    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    const { res, body } = await post(d);
    submit.disabled = false;
    submit.textContent = label;

    if (res && res.ok && body.ok) {
      form.querySelectorAll('.field, .lead-personal, .lead-qc-note, .lead-hp, .lead-error, #lead-submit').forEach(n => { n.hidden = true; });
      if (body.no_partner) showResult(status, 'Noted.', noPartnerDone(provinceName()), 'ok');
      else showResult(status, 'Sent.', `Request sent (reference ${body.id}). Elliott Accounting Group Inc. aims to respond within one business day.`, 'ok');
      return;
    }
    if (res && res.status === 422 && body.errors) {
      Object.entries(body.errors).forEach(([f, m]) => showError(f, m));
      const first = fields.find(f => body.errors[f]);
      if (first) $(`lead-${first}`).focus();
      return;
    }
    showResult(status, 'Not sent.', failureText(res), 'error');
  });

  submit.disabled = false;
}
