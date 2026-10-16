/* lead-config.js — shared by the lead form (assets/js/lead-block.js), the markup generator
   (scripts/sync-lead-block.mjs) and the Worker that receives submissions (worker/index.js),
   so the browser and the server can never disagree about what a valid lead looks like.

   Consent wording: change CONSENT_TEXT → bump CONSENT_VERSION → run
   `node scripts/sync-lead-block.mjs`. The Worker rejects any other version and stores the
   version with each lead, so every row says which wording that person agreed to. */

export const CONSENT_VERSION = '2026-10-16a';

/* Plain text. "privacy policy" is linked to /privacy-policy/ when rendered. */
export const CONSENT_TEXT =
  'I agree that calc-hq.ca may send my name, contact details and request to Elliott Accounting Group Inc., who will contact me about it. See the privacy policy.';

/* Same order as the calculators' province dropdowns. */
export const LEAD_PROVINCES = [
  ['ON', 'Ontario'], ['AB', 'Alberta'], ['BC', 'British Columbia'], ['SK', 'Saskatchewan'],
  ['MB', 'Manitoba'], ['NS', 'Nova Scotia'], ['NB', 'New Brunswick'],
  ['NL', 'Newfoundland and Labrador'], ['PE', 'Prince Edward Island'], ['YT', 'Yukon'],
  ['NT', 'Northwest Territories'], ['NU', 'Nunavut'], ['QC', 'Quebec'],
];

export const LEAD_NEEDS = [
  ['filings', 'Behind on tax filings'],
  ['cra', 'Got a CRA letter or notice'],
  ['self-employed', 'Self-employed or incorporated, need an accountant'],
  ['bookkeeping', 'Monthly bookkeeping, GST/HST or payroll'],
  ['other', 'Something else'],
];

export const LEAD_LIMITS = { name: 100, email: 254, phone: 30, message: 500 };

/* Provinces with no partner accountant yet. A request from one of these records ONLY the
   province, the source page and the time: the form hides the name, email, phone, need,
   message and consent fields, and the Worker discards them if they are sent anyway. */
export const NO_PARTNER_PROVINCES = ['QC'];

export const noPartnerNote = place =>
  `calc-hq.ca doesn't have a partner accountant in ${place} yet, so this can't put you in touch with anyone. If you'd use one, send it anyway: it records only that someone in ${place} asked, and from which page — no name or contact details.`;

export const noPartnerDone = place =>
  `calc-hq.ca doesn't have a partner accountant in ${place} yet, so no one will contact you, and nothing has been passed to anyone.`;
