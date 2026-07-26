/**
 * check-constants.mjs — staleness + stamp checker for the provenance file.
 *
 * Walks every leaf of TAX_CONSTANTS_2026 and reports:
 *   UNSTAMPED — a leaf that is a bare value instead of a { value, source_url,
 *               last_verified } node. This is the failure the July 2026 audit was
 *               built to catch: a number nobody can re-verify.
 *   NO-SOURCE — a node with no source_url.
 *   UNVERIFIED — last_verified is missing or the literal "UNVERIFIED …" placeholder.
 *   STALE     — the value's update cadence has rolled over since last_verified.
 *
 * CADENCE (see the header of tax-constants-2026.js):
 *   'january'   annual CRA/payroll indexation — the DEFAULT when unspecified.
 *   'july'      re-indexed each July on a July–June benefit year (CCB).
 *   'quarterly' re-indexed Jan/Apr/Jul/Oct (GIS/OAS, CPP averages).
 *   'statutory' changes only by legislation — never stale on a calendar.
 * A node's own `cadence` wins; otherwise it inherits its block's `_cadence`.
 *
 * USAGE
 *   node scripts/check-constants.mjs [--as-of YYYY-MM-DD] [--verbose]
 * There is no Node runtime on the build machine, so it is also importable from a
 * browser console against the dev server:
 *   const { report } = await import('/scripts/check-constants.mjs'); report();
 *
 * Exits 1 when anything is UNSTAMPED, NO-SOURCE, UNVERIFIED or STALE — so it can gate CI.
 */
import { TAX_CONSTANTS_2026, TAX_YEAR } from '../data/tax-constants-2026.js';

const DEFAULT_CADENCE = 'january';
const CADENCES = ['january', 'july', 'quarterly', 'statutory'];

/**
 * STRUCTURAL EXEMPTIONS — leaves that are labels or model flags rather than sourceable
 * facts, so they are allowed to be bare values. This is an explicit allowlist of exact leaf
 * key names, NOT a blanket "ignore unstamped" switch: anything not named here is still
 * reported as UNSTAMPED. Adding a key here is a deliberate, reviewable act.
 *
 *   name                          display label, e.g. 'Ontario'
 *   indexation                    the indexation factor we applied when deriving a table;
 *                                 documentation of our own working, not a CRA-published value
 *   bpaBundlesContributions       model flag — Quebec's BPA already embeds QPP/QPIP/EI
 *   includesCanadaEmploymentAmount model flag — Yukon mirrors the federal CEA
 */
export const STRUCTURAL_EXEMPT = new Set([
  'name',
  'indexation',
  'bpaBundlesContributions',
  'includesCanadaEmploymentAmount',
]);

/**
 * NEVER_EXEMPT — material constants that feed tax output. If one of these ever appears in
 * STRUCTURAL_EXEMPT the checker refuses to run, so the exemption mechanism can never be
 * widened to hide a real figure (the specific risk flagged when bpaCreditRate was found
 * unstamped in July 2026). Extend this list whenever a new material constant is added.
 */
export const NEVER_EXEMPT = new Set([
  'bpaCreditRate', 'healthPremiumMax', 'selfEmployedMultiplier', 'bpa', 'brackets',
  'surtax', 'healthPremium', 'taxReduction', 'bpaPhaseOut', 'workerDeduction',
  'rate', 'maxContribution', 'exemption', 'ympe', 'yampe', 'maxInsurableEarnings',
]);

for (const key of NEVER_EXEMPT) {
  if (STRUCTURAL_EXEMPT.has(key)) {
    throw new Error(
      `check-constants: "${key}" is a material constant and must never be structurally ` +
      `exempt. Remove it from STRUCTURAL_EXEMPT and stamp it with a source instead.`);
  }
}

/** Start of the most recent period for `cadence`, relative to `asOf`. */
function periodStart(cadence, asOf) {
  const y = asOf.getUTCFullYear(), m = asOf.getUTCMonth();
  switch (cadence) {
    case 'statutory': return null;                                  // never stale on a calendar
    case 'january':   return new Date(Date.UTC(y, 0, 1));
    case 'july':      return m >= 6 ? new Date(Date.UTC(y, 6, 1))   // July 1 this year
                                    : new Date(Date.UTC(y - 1, 6, 1));
    case 'quarterly': return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
    default:          return new Date(Date.UTC(y, 0, 1));
  }
}

const isNode = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  Object.prototype.hasOwnProperty.call(x, 'value');

/** Walk the tree and return one record per leaf. */
export function collect(root = TAX_CONSTANTS_2026) {
  const out = [];
  (function walk(obj, path, inheritedCadence) {
    const cadence = obj._cadence ?? inheritedCadence;
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_cadence') continue;
      const p = path ? `${path}.${key}` : key;
      if (isNode(val)) {
        out.push({
          path: p,
          value: val.value,
          source_url: val.source_url ?? null,
          last_verified: val.last_verified ?? null,
          cadence: val.cadence ?? cadence ?? DEFAULT_CADENCE,
          explicitCadence: val.cadence ?? obj._cadence ?? null,
        });
      } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        walk(val, p, cadence);
      } else {
        // A bare scalar/array leaf — no provenance at all. Exempt only if its exact key
        // name is on the structural allowlist above.
        out.push({ path: p, value: val, source_url: null, last_verified: null,
                   cadence: cadence ?? DEFAULT_CADENCE, unstamped: true,
                   exempt: STRUCTURAL_EXEMPT.has(key) });
      }
    }
  })(root, '', undefined);
  return out;
}

/** Classify one record. Returns an array of issue strings (empty = clean). */
function issues(rec, asOf) {
  const found = [];
  if (rec.exempt) return found;                        // structural label/flag, by allowlist
  if (rec.unstamped) { found.push('UNSTAMPED'); return found; }
  if (!rec.source_url) found.push('NO-SOURCE');
  if (!rec.last_verified || String(rec.last_verified).startsWith('UNVERIFIED')) {
    found.push('UNVERIFIED');
    return found;
  }
  if (!CADENCES.includes(rec.cadence)) found.push(`BAD-CADENCE:${rec.cadence}`);
  const start = periodStart(rec.cadence, asOf);
  if (start && new Date(`${rec.last_verified}T00:00:00Z`) < start) {
    found.push(`STALE(${rec.cadence}, due ${start.toISOString().slice(0, 10)})`);
  }
  return found;
}

/**
 * Cross-field invariants — things that must hold between constants, which a per-value stamp
 * cannot catch. Returns an array of violation strings.
 */
export function invariants(root = TAX_CONSTANTS_2026, taxYear = TAX_YEAR) {
  const bad = [];
  for (const [code, p] of Object.entries(root.provinces ?? {})) {
    const brackets = p.brackets?.value;
    const credit = p.bpaCreditRate?.value ?? p.bpaCreditRate;
    if (!Array.isArray(brackets) || typeof credit !== 'number') continue;
    // Non-refundable credits are valued at the lowest rate (CRA T4032: "multiply ... by the
    // lowest provincial tax rate"). A January bracket update that misses bpaCreditRate would
    // silently under/over-state tax for every filer in that jurisdiction.
    if (credit !== brackets[0].rate) {
      bad.push(`provinces.${code}: bpaCreditRate ${credit} !== brackets[0].rate ${brackets[0].rate}`);
    }
  }

  // ── DTC year/rate pairing ────────────────────────────────────────────────────
  // The DTC values a disability amount at the lowest rate FOR THAT TAX YEAR. Two ways to get
  // that wrong, both of which look perfectly stamped per-value:
  //   1. Applying the CURRENT year's rate to historical years. This is the Alberta near-miss
  //      (AB cut 10% -> 8% for 2026 ONLY); see MAINTENANCE.md 2026-07-24.
  //   2. Letting the CURRENT-year DTC rate drift from the live bracket table it must equal.
  // (1) can't be checked offline for closed years — the source is the archive, not this file.
  // (2) can, and is checked here — but ONLY for the tax year the bracket tables actually
  // describe. `provinces.*.brackets` is the TAX_YEAR table (2026); dtc.currentTaxYear is the
  // latest year with published PROVINCIAL amounts (2025 while CRA lags). Comparing across
  // those two years is exactly the year/rate mix-up this invariant exists to catch: Alberta's
  // 2025 DTC rate is 10% and its 2026 bracket is 8%, and BOTH are right. So compare only when
  // the years coincide — which they will once the 2026 provincial packages land and the
  // y2026 rows are added.
  const dtc = root.dtc;
  if (dtc?.provincial && root.provinces && taxYear != null) {
    for (const [code, years] of Object.entries(dtc.provincial)) {
      const node = years?.[`y${taxYear}`];          // the DTC row FOR THE BRACKET TABLE'S YEAR
      const dtcRate = node?.value?.rate;
      const live = root.provinces[code]?.brackets?.value?.[0]?.rate;
      if (typeof dtcRate !== 'number' || typeof live !== 'number') continue;
      if (dtcRate !== live) {
        bad.push(`dtc.provincial.${code}.y${taxYear}: rate ${dtcRate} !== provinces.${code}.brackets[0].rate ${live}`);
      }
    }
  }

  // ── CDB / CCB threshold coincidence ─────────────────────────────────────────
  // The child disability benefit's phase-out threshold and the CCB's SECOND threshold have
  // been the same number in every published benefit year (2023-2026), but CRA publishes them
  // as separate figures in separate sections. They are stamped separately (the CDB block must
  // never reference the ccb nodes — its reduction is single-tier with only two rate brackets,
  // where the CCB's tier 2 has four). This asserts they stay equal so a future DIVERGENCE is
  // caught rather than silently assumed away.
  //
  // Compared ONLY when both blocks describe the SAME benefit year. Comparing a CDB threshold
  // for one benefit year against a CCB threshold for another is the year/value mix-up that
  // MAINTENANCE.md records as the Alberta near-miss — the check would be meaningless and, in
  // the July window where one block is updated before the other, actively misleading.
  const cdb = root.cdb, ccb = root.ccb;
  if (cdb?.years && ccb?.threshold2) {
    const startYear = cdb.currentBenefitYearStart?.value;
    const cdbYear = cdb.years?.[`y${startYear}`]?.value;
    const cdbLabel = cdbYear?.benefitYear;
    const ccbLabel = ccb.benefitYear?.value;
    if (cdbLabel && ccbLabel && cdbLabel === ccbLabel) {
      if (cdbYear.threshold !== ccb.threshold2.value) {
        bad.push(`cdb.years.y${startYear}.threshold ${cdbYear.threshold} !== ccb.threshold2 ` +
          `${ccb.threshold2.value} (both describe ${cdbLabel}) — if CRA genuinely split these ` +
          `figures, update this invariant deliberately; do not "fix" one value to match.`);
      }
    }
  }
  // ── RDSP threshold linkages — THREE SEPARATE checks, one per pair ───────────
  // The Canada Disability Savings Act keys its income thresholds off Income Tax Act amounts,
  // so each RDSP threshold equals a figure already stamped elsewhere in this file. The RDSP
  // block stamps its own values independently (it never references another block's nodes);
  // these assert the linkages still hold.
  //
  // Kept as three checks rather than one loop so a failure NAMES WHICH LINKAGE BROKE — the
  // grant tier boundary, the bond's nil point, and the bond's full-amount point are set by
  // different provisions and can move independently.
  //
  // IF ONE FIRES: verify against the Canada Disability Savings Act and re-read the ESDC
  // "how much" page for the affected threshold. Do NOT edit one value to match the other —
  // these are separately sourced on purpose, and silently syncing them destroys the only
  // signal that a linkage changed. A genuine legislative de-linking means deleting the
  // specific check here, deliberately, with a note.
  const rdsp = root.rdsp;
  if (rdsp) {
    const fedBrackets = root.federal?.brackets?.value;
    const pairs = [
      ['grantThreshold', rdsp.grantThreshold?.value, 'federal.brackets[1].max', fedBrackets?.[1]?.max,
        'grant 300%/200% tier boundary'],
      ['bondZeroThreshold', rdsp.bondZeroThreshold?.value, 'federal.brackets[0].max', fedBrackets?.[0]?.max,
        'income at which the bond reaches nil'],
      ['bondFullThreshold', rdsp.bondFullThreshold?.value, 'ccb.threshold1', root.ccb?.threshold1?.value,
        'income up to which the full bond is paid'],
    ];
    for (const [ourKey, ourVal, theirKey, theirVal, what] of pairs) {
      if (typeof ourVal !== 'number' || typeof theirVal !== 'number') continue;
      if (ourVal !== theirVal) {
        bad.push(`rdsp.${ourKey} ${ourVal} !== ${theirKey} ${theirVal} — the ${what} has ` +
          `de-linked. Verify against the Canada Disability Savings Act; do NOT edit one value ` +
          `to match the other.`);
      }
    }
  }
  return bad;
}

export function check({ asOf = new Date(), root = TAX_CONSTANTS_2026 } = {}) {
  const records = collect(root);
  const violations = invariants(root);
  const flagged = [];
  const byCadence = {}, byBlock = {};
  for (const rec of records) {
    byCadence[rec.cadence] = (byCadence[rec.cadence] || 0) + 1;
    const block = rec.path.split('.')[0];
    byBlock[block] = byBlock[block] || { total: 0, flagged: 0 };
    byBlock[block].total++;
    const found = issues(rec, asOf);
    if (found.length) {
      flagged.push({ ...rec, issues: found });
      byBlock[block].flagged++;
    }
  }
  return { records, flagged, violations, byCadence, byBlock, asOf };
}

export function report({ asOf = new Date(), verbose = false } = {}) {
  const r = check({ asOf });
  const exempt = r.records.filter((x) => x.exempt);
  const lines = [];
  lines.push(`constants stamp + staleness check — as of ${asOf.toISOString().slice(0, 10)}`);
  lines.push(`${r.records.length - exempt.length} stamped values across ` +
    `${Object.keys(r.byBlock).length} blocks, plus ${exempt.length} structurally exempt ` +
    `(${[...new Set(exempt.map((x) => x.path.split('.').pop()))].sort().join(', ')})`);
  lines.push('');
  lines.push('by cadence: ' + Object.entries(r.byCadence)
    .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join('  '));
  lines.push('');
  lines.push('by block:');
  for (const [block, s] of Object.entries(r.byBlock).sort()) {
    lines.push(`  ${s.flagged ? 'FAIL' : ' ok '}  ${block.padEnd(24)} ${String(s.total).padStart(4)} values` +
      (s.flagged ? `  — ${s.flagged} flagged` : ''));
  }
  lines.push('');
  lines.push(r.violations.length
    ? `${r.violations.length} INVARIANT VIOLATION(S):\n` + r.violations.map((x) => `  ${x}`).join('\n')
    : `invariants: ok (bpaCreditRate === brackets[0].rate for all ${Object.keys(TAX_CONSTANTS_2026.provinces).length} jurisdictions)`);
  if (r.flagged.length) {
    lines.push('');
    lines.push(`${r.flagged.length} ISSUE(S):`);
    for (const f of r.flagged) lines.push(`  ${f.issues.join(' ')}  ${f.path}`);
  } else if (!r.violations.length) {
    lines.push('');
    lines.push('PASS — every value is stamped, sourced, within its cadence, and consistent.');
  }
  if (verbose) {
    lines.push('');
    for (const rec of r.records) {
      lines.push(`  ${rec.last_verified ?? '—'}  ${rec.cadence.padEnd(9)}  ${rec.path}`);
    }
  }
  const text = lines.join('\n');
  if (typeof console !== 'undefined') console.log(text);
  return { text, ...r };
}

// Node entry point (no-op in the browser).
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('check-constants.mjs')) {
  const argv = process.argv.slice(2);
  const asOfArg = argv.includes('--as-of') ? argv[argv.indexOf('--as-of') + 1] : null;
  const r = report({
    asOf: asOfArg ? new Date(`${asOfArg}T00:00:00Z`) : new Date(),
    verbose: argv.includes('--verbose'),
  });
  // Set exitCode rather than calling process.exit(): console.log to a PIPE is asynchronous,
  // and process.exit() can truncate it mid-write. CI pipes this through `tee`, so exiting
  // eagerly would risk losing the very report we exit non-zero to draw attention to.
  process.exitCode = r.flagged.length || r.violations.length ? 1 : 0;
}
