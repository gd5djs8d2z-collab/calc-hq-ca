#!/usr/bin/env node
/* mock-apps-script.mjs — runs the real worker/apps-script/Code.gs locally, against an
   in-memory Sheet and a MailApp that records instead of sending, so `wrangler dev` can be
   tested end to end without touching the live Sheet or emailing anyone.

     node worker/test/mock-apps-script.mjs            listens on 127.0.0.1:8799
     .dev.vars:  LEADS_WEBHOOK_URL=http://127.0.0.1:8799/exec
                 LEADS_WEBHOOK_SECRET=local-test-secret

   Control endpoints (local only):
     GET  /__state             rows + recorded emails
     POST /__mail-fail?on=1    make every MailApp.sendEmail throw (on=0 to stop)
     POST /__reset             clear rows and emails
     POST /__fault?f=<name>    stage a failure for the health check: sheet (appendRow throws),
                               nodelete (deleteRow does nothing), nomail (MailApp quota call
                               throws), quota0 (no mail quota left), old (script predates the
                               'health' action), none (clear) */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const PORT = Number(process.env.PORT || 8799);
const PROPS = {
  SHARED_SECRET: process.env.MOCK_SHARED_SECRET || 'local-test-secret',   // override to simulate a mismatch
  OWNER_EMAIL: 'owner@example.invalid',
  PARTNER_EMAIL: 'partner@example.invalid',
};

let rows, mails, mailFail = false, fault = 'none';
function reset() { rows = [null]; mails = []; }   // rows[0] = header, set by setup-equivalent
reset();

function range(r, c, nr = 1, nc = 1) {
  return {
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
    getValue: () => (rows[r - 1] || [])[c - 1] ?? '',
    setValue: v => { rows[r - 1][c - 1] = v; },
  };
}
const sheet = {
  appendRow: v => { if (fault === 'sheet') throw new Error('You do not have permission to access the requested document.'); rows.push([...v]); },
  getLastRow: () => rows.length,
  getRange: range,
  deleteRow: r => { if (fault !== 'nodelete') rows.splice(r - 1, 1); },
};
const ctx = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => PROPS[k] ?? null }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  MailApp: {
    sendEmail: m => { if (mailFail) throw new Error('mail down'); mails.push(m); },
    getRemainingDailyQuota: () => { if (fault === 'nomail') throw new Error('Authorization is required to perform that action.'); return fault === 'quota0' ? 0 : 1500; },
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ body: s }) }) },
  JSON, Date, String,
});
vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);
rows[0] = vm.runInContext('COLUMNS', ctx);

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let data = '';
  req.on('data', c => { data += c; });
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (url.pathname === '/__state') return res.end(JSON.stringify({ rows, mails }, null, 2));
    if (url.pathname === '/__mail-fail') { mailFail = url.searchParams.get('on') === '1'; return res.end(JSON.stringify({ mailFail })); }
    if (url.pathname === '/__fault') { fault = url.searchParams.get('f') || 'none'; return res.end(JSON.stringify({ fault })); }
    if (url.pathname === '/exec' && req.method === 'POST' && fault === 'old' && JSON.parse(data || '{}').action === 'health') {
      return res.end(JSON.stringify({ ok: false, error: 'action' }));
    }
    if (url.pathname === '/__reset') { reset(); rows[0] = vm.runInContext('COLUMNS', ctx); return res.end('{}'); }
    if (url.pathname === '/exec' && req.method === 'POST') {
      try { return res.end(ctx.doPost({ postData: { contents: data } }).body); }
      catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: String(e.message) })); }
    }
    res.statusCode = 404; res.end('{}');
  });
}).listen(PORT, '127.0.0.1', () => console.log(`mock Apps Script on http://127.0.0.1:${PORT}/exec`));
