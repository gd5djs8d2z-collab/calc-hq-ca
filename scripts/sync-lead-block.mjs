#!/usr/bin/env node
/* sync-lead-block.mjs — writes the partner-accountant lead block into the calculator pages.

   The block is static HTML in each page (so it is in the server response and causes no
   layout shift), but it is generated from ONE template here plus assets/js/lead-config.js.
   Never hand-edit the block in a page: edit this file or lead-config.js and re-run.

     node scripts/sync-lead-block.mjs           rewrite every listed page
     node scripts/sync-lead-block.mjs --check   exit 1 if any page differs from the template,
                                                lacks its block, or has a block it shouldn't

   A page's block sits between <!-- lead-block:start --> and <!-- lead-block:end -->,
   directly after the page's .calc-card section. */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSENT_TEXT, CONSENT_VERSION, LEAD_PROVINCES, LEAD_NEEDS, LEAD_LIMITS, noPartnerNote } from '../assets/js/lead-config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* variant: 'full' shows the form; 'compact' shows one line and a button that reveals it;
   'quebec' is for a Quebec-only page — no partner there yet, so it is one line and a button
   that records the province and page only, with no form and no personal details.
   source: id of the calculator's own province <select>, used to pre-fill the form.
   after: the block normally follows the .calc-card section; where the calculator's results
   continue into a separate section below the card, name an id inside that section and the
   block goes after it instead. */
export const LEAD_PAGES = {
  'payroll/self-employed-tax':          { variant: 'full', source: 'province' },
  'tax-on-extra-income/bonus':          { variant: 'full', source: 'province' },
  'tax-on-extra-income/commission':     { variant: 'full', source: 'province' },
  'tax-on-extra-income/capital-gains':  { variant: 'full', source: 'province' },
  'payroll/take-home-pay':              { variant: 'full', source: 'province' },
  'payroll/payroll-deductions':         { variant: 'full', source: 'province' },
  'payroll/pay-raise':                  { variant: 'full', source: 'province' },
  'payroll/quebec-income-tax':          { variant: 'quebec', after: 'brackets' },
  'payroll/hourly-to-salary':           { variant: 'compact' },
  'business/profit-margin':             { variant: 'compact' },
  'business/markup':                    { variant: 'compact' },
  'benefits/dtc':                       { variant: 'compact', source: 'prov' },
  'benefits/cdb':                       { variant: 'compact' },
  'benefits/rdsp':                      { variant: 'compact', after: 'carryforward-note' },
  'benefits/oas':                       { variant: 'compact' },
  'benefits/ccb':                       { variant: 'compact' },
  'benefits/cpp':                       { variant: 'compact' },
  'benefits/cpp-60-vs-65':              { variant: 'compact' },
  'benefits/ei-maternity-parental':     { variant: 'compact' },
  'benefits/ei':                        { variant: 'compact' },
  'employment-standards/overtime-pay':  { variant: 'compact' },
  'property/land-transfer-tax':         { variant: 'compact' },
};

/* Deferred, not forgotten:
   - employment-standards/vacation-pay: crawled 2026-09-28 but not indexed, and changed on
     2026-10-12 (4798568) while it is being re-evaluated. Leave the page untouched until Search
     Console shows "URL is on Google", then add it here as { variant: 'compact' } in its own
     commit.
   Excluded on purpose:
   - benefits/gis: GIS is a benefit for low-income seniors. A paid referral pitch is the wrong
     fit for that audience, so this page gets no block. (benefits/oas keeps its compact block.) */

const START = '<!-- lead-block:start -->';
const END = '<!-- lead-block:end -->';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PARTNER_LINK =
  '<a href="https://www.ryanelliott.ca/" target="_blank" rel="sponsored nofollow noopener">Elliott Accounting Group Inc.</a>';

function intro() {
  return `    <p class="lead-partner">Partner accountant: ${PARTNER_LINK}</p>
    <p>They take on late and multi-year tax filings, CRA notices, small-business bookkeeping, GST/HST and payroll, for clients across Canada. Send a request and they aim to respond within one business day.</p>
    <p class="lead-note">calc-hq.ca is a calculator site and does not give tax or accounting advice. calc-hq.ca is paid a referral fee if you become a client of Elliott Accounting Group Inc. through this form.</p>`;
}

function form() {
  const consent = esc(CONSENT_TEXT).replace('privacy policy', '<a href="/privacy-policy/">privacy policy</a>');
  const provinces = LEAD_PROVINCES.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
  const needs = LEAD_NEEDS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  const err = f => `<p class="lead-error" id="lead-${f}-error" hidden></p>`;
  return `    <form class="lead-form" id="lead-form" method="post" action="/api/lead" novalidate data-consent-version="${CONSENT_VERSION}">
      <div class="field">
        <label for="lead-province">Province or territory</label>
        <select class="input" id="lead-province" name="province" required aria-describedby="lead-province-error"><option value="">Choose one</option>${provinces}</select>
        ${err('province')}
      </div>
      <p class="lead-qc-note" id="lead-qc-note" hidden>${esc(noPartnerNote('Quebec'))}</p>
      <div class="lead-personal" id="lead-personal">
        <div class="field-row">
          <div class="field">
            <label for="lead-name">Name</label>
            <input class="input" id="lead-name" name="name" type="text" autocomplete="name" maxlength="${LEAD_LIMITS.name}" required aria-describedby="lead-name-error">
            ${err('name')}
          </div>
          <div class="field">
            <label for="lead-email">Email</label>
            <input class="input" id="lead-email" name="email" type="email" autocomplete="email" maxlength="${LEAD_LIMITS.email}" required aria-describedby="lead-email-error">
            ${err('email')}
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="lead-phone">Phone <span class="hint">Optional</span></label>
            <input class="input" id="lead-phone" name="phone" type="tel" autocomplete="tel" maxlength="${LEAD_LIMITS.phone}" aria-describedby="lead-phone-error">
            ${err('phone')}
          </div>
          <div class="field">
            <label for="lead-need">What do you need help with?</label>
            <select class="input" id="lead-need" name="need" required aria-describedby="lead-need-error"><option value="">Choose one</option>${needs}</select>
            ${err('need')}
          </div>
        </div>
        <div class="field">
          <label for="lead-message">Anything they should know first? <span class="hint">Optional — up to ${LEAD_LIMITS.message} characters</span></label>
          <textarea class="input" id="lead-message" name="message" rows="3" maxlength="${LEAD_LIMITS.message}" aria-describedby="lead-message-error"></textarea>
          ${err('message')}
        </div>
        <div class="field checkbox">
          <input type="checkbox" id="lead-consent" name="consent" required aria-describedby="lead-consent-error">
          <label for="lead-consent">${consent}</label>
        </div>
        ${err('consent')}
      </div>
      <div class="lead-hp" aria-hidden="true">
        <label for="lead-website">Leave this field empty</label>
        <input id="lead-website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>
      <button class="btn" id="lead-submit" type="submit" disabled>Send my request</button>
      <p class="lead-status" id="lead-status" role="status" aria-live="polite" hidden></p>
    </form>`;
}

export function block({ variant, source }) {
  const src = source ? ` data-province-source="${source}"` : '';
  const script = '  <script type="module" src="/assets/js/lead-block.js"></script>';
  if (variant === 'full') {
    return `${START}
  <aside class="lead-block" id="lead-block" data-variant="full"${src} aria-labelledby="lead-title">
    <h2 class="lead-title" id="lead-title">Want an accountant to take it from here?</h2>
${intro()}
${form()}
  </aside>
${script}
  ${END}`;
  }
  if (variant === 'quebec') {
    return `${START}
  <aside class="lead-block lead-block-compact" id="lead-block" data-variant="quebec" data-province="QC" aria-label="Partner accountant">
    <div class="lead-compact-row">
      <p class="lead-compact-line" id="lead-qc-line">${esc(noPartnerNote('Quebec'))}</p>
      <button class="lead-toggle" id="lead-qc-send" type="button" disabled>Send</button>
    </div>
  </aside>
${script}
  ${END}`;
  }
  return `${START}
  <aside class="lead-block lead-block-compact" id="lead-block" data-variant="compact"${src} aria-label="Partner accountant">
    <div class="lead-compact-row">
      <p class="lead-compact-line">Behind on filings, holding a CRA letter, or need a bookkeeper? Our partner accountant can contact you.</p>
      <button class="lead-toggle" id="lead-toggle" type="button" aria-expanded="false" aria-controls="lead-panel">Ask to be contacted</button>
    </div>
    <div class="lead-panel" id="lead-panel" hidden>
${intro()}
${form()}
    </div>
  </aside>
${script}
  ${END}`;
}

/* Index just past the </section> that closes the page's .calc-card — or, with `after`, the
   section that contains id="<after>". */
function placementEnd(html, after) {
  let open;
  if (after) {
    const at = html.indexOf(`id="${after}"`);
    if (at < 0) return -1;
    open = html.lastIndexOf('<section', at);
  } else {
    open = html.search(/<section[^>]*class="[^"]*\bcalc-card\b/);
  }
  if (open < 0) return -1;
  const re = /<section\b|<\/section>/g;
  re.lastIndex = open;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</section>' ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

function allPages(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) allPages(p, out);
    else if (name === 'index.html') out.push(p);
  }
  return out;
}

function run(check) {
  const problems = [];
  let written = 0;
  for (const file of allPages()) {
    const rel = relative(ROOT, file).replace(/\/?index\.html$/, '');
    const spec = LEAD_PAGES[rel];
    const html = readFileSync(file, 'utf8');
    const s = html.indexOf(START), e = html.indexOf(END);
    if (!spec) {
      if (s >= 0 || html.includes('lead-block.js') || html.includes('id="lead-block"')) problems.push(`${rel || '/'}: has a lead block but is not in LEAD_PAGES`);
      continue;
    }
    const want = block(spec);
    // Take any existing block out (with the blank line and indent inserted before it), then
    // place it fresh, so moving a page's anchor moves its block.
    const bare = s >= 0 && e > s ? html.slice(0, s).replace(/\n\n  $/, '') + html.slice(e + END.length) : html;
    const at = placementEnd(bare, spec.after);
    if (at < 0) { problems.push(`${rel}: no ${spec.after ? '#' + spec.after : '.calc-card'} section to place the block after`); continue; }
    const next = bare.slice(0, at) + '\n\n  ' + want + bare.slice(at);
    if (spec.source && !new RegExp(`<select[^>]*id="${spec.source}"`).test(html)) {
      problems.push(`${rel}: province source #${spec.source} not found`);
    }
    if (next !== html) {
      if (check) problems.push(`${rel}: lead block missing or out of date — run node scripts/sync-lead-block.mjs`);
      else { writeFileSync(file, next); written++; }
    }
  }
  for (const rel of Object.keys(LEAD_PAGES)) {
    try { statSync(join(ROOT, rel, 'index.html')); } catch { problems.push(`${rel}: listed in LEAD_PAGES but has no index.html`); }
  }
  if (!check) console.log(`sync-lead-block: ${written} page(s) written, ${Object.keys(LEAD_PAGES).length} listed`);
  for (const p of problems) console.log('  ' + p);
  if (check && !problems.length) console.log(`sync-lead-block --check: ${Object.keys(LEAD_PAGES).length} pages match the template`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(run(process.argv.includes('--check')));
}
