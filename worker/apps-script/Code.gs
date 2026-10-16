/* Code.gs — Google Apps Script bound to the calc-hq lead Sheet.

   Deployed as a web app (Execute as: me, Who has access: Anyone). The calc-hq Worker is the
   only caller; every request must carry SHARED_SECRET. For each lead it:
     1. appends the row to the "Leads" tab (the record of truth),
     2. emails the partner, unless the lead is a test or has no partner (Quebec for now),
     3. emails the owner a copy of every lead,
     4. sets email_failed = TRUE on the row if any email throws.
   The row is written before any email is attempted, so a mail failure never loses a lead.

   Script properties (Project Settings → Script properties):
     SHARED_SECRET  same value as the Worker's LEADS_WEBHOOK_SECRET
     OWNER_EMAIL    gets a copy of every lead, test and Quebec included
     PARTNER_EMAIL  gets non-test leads that have a partner

   A lead from a province with no partner (no_partner) arrives with only the province, the
   source page and the time — the Worker strips everything else — and goes to the owner only.

   Run setup() once from the editor — that is also what grants the script its Sheets and
   send-mail permissions. worker/apps-script/deploy.sh pushes a temporary Config.gs that
   defines setupProperties_() so setup() can fill the script properties itself; the next
   push removes it. Nothing here writes lead contents to Logger or console. */

var SHEET_NAME = 'Leads';
var COLUMNS = ['id', 'received_at', 'name', 'email', 'phone', 'province', 'need', 'message',
  'source_page', 'consent_version', 'status', 'is_test', 'no_partner', 'email_failed', 'notes'];
var STATUSES = ['sent', 'contacted', 'confirmed closed', 'not closed'];

function setup() {
  if (typeof setupProperties_ === 'function') setupProperties_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  var status = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sheet.getRange(2, col_('status'), sheet.getMaxRows() - 1, 1).setDataValidation(status);
  ['is_test', 'no_partner', 'email_failed'].forEach(function (name) {
    sheet.getRange(2, col_(name), sheet.getMaxRows() - 1, 1).insertCheckboxes();
  });
  var props = PropertiesService.getScriptProperties();
  ['SHARED_SECRET', 'OWNER_EMAIL', 'PARTNER_EMAIL'].forEach(function (k) {
    if (!props.getProperty(k)) throw new Error('Missing script property ' + k);
  });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'json' }); }
  var props = PropertiesService.getScriptProperties();
  if (!secretMatches_(req.secret, props.getProperty('SHARED_SECRET'))) return out_({ ok: false, error: 'auth' });

  if (req.action === 'add') return out_(addLead_(req.lead, props));
  if (req.action === 'test_get') return out_(testGet_(req.id));
  if (req.action === 'test_delete') return out_(testDelete_(req.id));
  return out_({ ok: false, error: 'action' });
}

function addLead_(lead, props) {
  var sheet = sheet_();
  var row = {
    id: lead.id,
    received_at: new Date(lead.received_at),
    name: text_(lead.name),
    email: text_(lead.email),
    phone: lead.phone ? "'" + lead.phone : '',
    province: lead.province,
    need: text_(lead.need_label),
    message: text_(lead.message),
    source_page: text_(lead.source_page),
    consent_version: text_(lead.consent_version),
    status: 'sent',
    is_test: lead.is_test === true,
    no_partner: lead.no_partner === true,
    email_failed: false,
    notes: ''
  };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet.appendRow(COLUMNS.map(function (c) { return row[c]; }));
  } finally {
    lock.releaseLock();
  }

  var failed = false;
  var partner = props.getProperty('PARTNER_EMAIL');
  var toPartner = !row.is_test && !row.no_partner && !!partner;
  if (toPartner) {
    try {
      MailApp.sendEmail({
        to: partner,
        replyTo: lead.email,
        name: 'calc-hq.ca',
        subject: 'New calc-hq.ca request ' + lead.id + ' — ' + lead.province_name + ' — ' + lead.need_label,
        body: partnerBody_(lead)
      });
    } catch (err) { failed = true; }
  }
  try {
    var mail = {
      to: props.getProperty('OWNER_EMAIL'),
      name: 'calc-hq.ca leads',
      subject: (row.is_test ? '[TEST] ' : '') + (row.no_partner ? '[NO PARTNER] ' : '') +
        'Lead ' + lead.id + ' — ' + lead.province_name + (lead.need_label ? ' — ' + lead.need_label : ''),
      body: ownerBody_(lead, toPartner, failed)
    };
    if (lead.email) mail.replyTo = lead.email;
    MailApp.sendEmail(mail);
  } catch (err) { failed = true; }

  if (failed) {
    var r = findRow_(sheet, lead.id);
    if (r) sheet.getRange(r, col_('email_failed')).setValue(true);
  }
  return { ok: true, stored: true, email_failed: failed };
}

function fields_(lead) {
  if (lead.no_partner) {
    return ['Lead ID: ' + lead.id, 'Province: ' + lead.province_name + ' (' + lead.province + ')',
      'Sent from: ' + lead.source_page, 'Received: ' + lead.received_at,
      'No name or contact details are collected for a province without a partner.'].join('\n');
  }
  return [
    'Lead ID: ' + lead.id,
    'Name: ' + lead.name,
    'Email: ' + lead.email,
    'Phone: ' + (lead.phone || '(not given)'),
    'Province: ' + lead.province_name + ' (' + lead.province + ')',
    'Needs help with: ' + lead.need_label,
    'Message: ' + (lead.message || '(none)'),
    'Sent from: ' + lead.source_page,
    'Received: ' + lead.received_at
  ].join('\n');
}

function partnerBody_(lead) {
  return 'A visitor to calc-hq.ca asked to be contacted by Elliott Accounting Group Inc.\n\n' +
    fields_(lead) + '\n\n' +
    'They ticked a consent box agreeing that calc-hq.ca may send these details to you so you can contact them about this request (consent wording ' +
    lead.consent_version + '). Replying to this email goes to them.\n\n' +
    'Please quote the lead ID when you confirm contact or a close.';
}

function ownerBody_(lead, sentToPartner, failed) {
  var routing = lead.is_test ? 'TEST lead — not sent to the partner.'
    : lead.no_partner ? 'No partner for ' + lead.province_name + ' — demand signal only, not sent to anyone.'
    : sentToPartner ? 'Sent to the partner.' : 'NOT sent to the partner (no PARTNER_EMAIL set).';
  return routing + (failed ? '\nAn email FAILED — the row is flagged email_failed; resend by hand.' : '') +
    '\n\n' + fields_(lead) + (lead.consent_version ? '\n\nConsent wording: ' + lead.consent_version : '');
}

function testGet_(id) {
  var sheet = sheet_();
  var r = findRow_(sheet, id);
  if (!r) return { ok: false, error: 'not_found' };
  var v = sheet.getRange(r, 1, 1, COLUMNS.length).getValues()[0];
  if (v[col_('is_test') - 1] !== true) return { ok: false, error: 'not_test' };
  return {
    ok: true, id: id, province: v[col_('province') - 1], status: v[col_('status') - 1],
    is_test: true, no_partner: v[col_('no_partner') - 1] === true,
    email_failed: v[col_('email_failed') - 1] === true, consent_version: v[col_('consent_version') - 1]
  };
}

function testDelete_(id) {
  var sheet = sheet_();
  var r = findRow_(sheet, id);
  if (!r) return { ok: false, error: 'not_found' };
  if (sheet.getRange(r, col_('is_test')).getValue() !== true) return { ok: false, error: 'not_test' };
  sheet.deleteRow(r);
  return { ok: true, deleted: id };
}

function sheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Run setup() first');
  return sheet;
}

function findRow_(sheet, id) {
  var ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) if (ids[i][0] === id) return i + 1;
  return 0;
}

function col_(name) { return COLUMNS.indexOf(name) + 1; }

/* A value starting with = + - @ would be run as a formula by Sheets. */
function text_(v) {
  v = v == null ? '' : String(v);
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function secretMatches_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
