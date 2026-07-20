/**
 * gen-history.mjs — regenerates data/constant-history.json, the append-only value-change
 * audit trail for the tax constants. One row per stamped, non-exempt leaf whose cadence
 * has a derivable period start; the 49 statutory-cadence leaves (period start not derivable)
 * are left out and reported. See MAINTENANCE.md and check-constants.mjs.
 *
 * REUSE, DON'T REIMPLEMENT
 *   collect() and STRUCTURAL_EXEMPT come straight from check-constants.mjs, so the key
 *   scheme (the dotted leaf path) and the stamped/exempt partition are the checker's,
 *   not a second copy that could drift. check-history.mjs imports the helpers below for
 *   the same reason.
 *
 * IDEMPOTENCY
 *   effective_from is anchored on each leaf's own `last_verified` stamp — NOT wall-clock
 *   time — so running this against unchanged stamps produces a byte-identical file whenever
 *   it runs. Row order is collect()'s deterministic tree walk; JSON is 2-space + trailing
 *   newline. Nothing here reads the clock.
 *
 * USAGE
 *   node scripts/gen-history.mjs            # rewrites data/constant-history.json + prints a report
 *   import { buildHistory, decodeInfinity } from './gen-history.mjs'   # reuse (writes nothing)
 *
 * Touches data/constant-history.json ONLY. Never writes tax-constants-2026.js, rates-2026.js,
 * or any calculator.
 */
import { writeFileSync } from 'node:fs';
import { collect, STRUCTURAL_EXEMPT } from './check-constants.mjs';

const HISTORY_PATH = new URL('../data/constant-history.json', import.meta.url);

/** Start of the most recent period for `cadence`, relative to `asOf`. Copied verbatim from
 *  check-constants.mjs so effective_from is derived by the identical rule the checker uses.
 *  statutory => null => period start is not derivable from the cadence. */
export function periodStart(cadence, asOf) {
  const y = asOf.getUTCFullYear(), m = asOf.getUTCMonth();
  switch (cadence) {
    case 'statutory': return null;
    case 'january':   return new Date(Date.UTC(y, 0, 1));
    case 'july':      return m >= 6 ? new Date(Date.UTC(y, 6, 1))
                                    : new Date(Date.UTC(y - 1, 6, 1));
    case 'quarterly': return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
    default:          return new Date(Date.UTC(y, 0, 1));
  }
}

/** The current period start for a leaf, as an ISO date, or null when not derivable
 *  (statutory). Anchored on the leaf's last_verified stamp — the value is in force for the
 *  period that contains the date it was confirmed. This is what makes the file idempotent. */
export function effectiveFrom(rec) {
  const start = periodStart(rec.cadence, new Date(`${rec.last_verified}T00:00:00Z`));
  return start ? start.toISOString().slice(0, 10) : null;
}

/* ---- Infinity sentinel codec ---------------------------------------------------------
 * Bracket ceilings are the real JS number Infinity (unbounded top bracket). JSON has no
 * Infinity literal and JSON.stringify would coerce it to null, silently destroying the
 * "no upper bound" fact. Store the reversible string sentinel "Infinity" instead so the
 * value stays verbatim. check-history.mjs decodes it back before comparing. */
export const INFINITY_SENTINEL = 'Infinity';
export const NEG_INFINITY_SENTINEL = '-Infinity';

export function encodeInfinity(v) {
  if (v === Infinity) return INFINITY_SENTINEL;
  if (v === -Infinity) return NEG_INFINITY_SENTINEL;
  if (Array.isArray(v)) return v.map(encodeInfinity);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = encodeInfinity(x);
    return o;
  }
  return v;
}

export function decodeInfinity(v) {
  if (v === INFINITY_SENTINEL) return Infinity;
  if (v === NEG_INFINITY_SENTINEL) return -Infinity;
  if (Array.isArray(v)) return v.map(decodeInfinity);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = decodeInfinity(x);
    return o;
  }
  return v;
}

/** The stamped, non-exempt leaves — the checker's own partition (bare allowlisted leaves
 *  carry rec.exempt; the structural allowlist is applied by exact key name, as in collect). */
export function stampedLeaves(records = collect()) {
  return records.filter(
    (r) => !r.exempt && !STRUCTURAL_EXEMPT.has(r.path.split('.').pop()));
}

/** Partition the stamped leaves into emitted history rows and skipped (non-derivable) leaves.
 *  This is the single definition of "what gen-history emits"; check-history.mjs reuses it. */
export function buildHistory(records = collect()) {
  const rows = [], skipped = [];
  for (const rec of stampedLeaves(records)) {
    const ef = effectiveFrom(rec);
    if (!ef) { skipped.push(rec); continue; }   // statutory — out of the file, by the same rule
    rows.push({
      key: rec.path,
      value: encodeInfinity(rec.value),
      effective_from: ef,
      effective_to: null,
      source_url: rec.source_url,
      verified_at: rec.last_verified,
      cadence: rec.cadence,
    });
  }
  return { rows, skipped };
}

/** Byte-for-byte the file's serialization: 2-space indent, trailing newline. */
export function serialize(rows) {
  return JSON.stringify(rows, null, 2) + '\n';
}

// ---- CLI entry point (writes the file; no-op when imported) --------------------------
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('gen-history.mjs')) {
  const all = collect();
  const { rows, skipped } = buildHistory(all);
  writeFileSync(HISTORY_PATH, serialize(rows));

  const stampedCount = stampedLeaves(all).length;
  const infRows = rows.filter((r) => serialize([r]).includes(`"${INFINITY_SENTINEL}"`));
  const byBucket = {};
  for (const r of rows) {
    const k = `${r.effective_from} / ${r.cadence}`;
    byBucket[k] = (byBucket[k] || 0) + 1;
  }
  const lines = [];
  lines.push('constant-history backfill — regenerated data/constant-history.json');
  lines.push(`${rows.length} rows written from ${stampedCount} stamped leaves ` +
    `(${skipped.length} statutory skipped — period start not derivable)`);
  lines.push('');
  lines.push('rows by effective_from / cadence:');
  for (const [k, n] of Object.entries(byBucket).sort()) lines.push(`  ${String(n).padStart(4)}  ${k}`);
  lines.push('');
  lines.push(`Infinity-bearing leaves stored as "${INFINITY_SENTINEL}" sentinel: ${infRows.length}`);
  lines.push('');
  lines.push(`reconcile: rows + skipped == stamped -> ${rows.length} + ${skipped.length} = ` +
    `${rows.length + skipped.length} (${rows.length + skipped.length === stampedCount ? 'ok' : 'MISMATCH'})`);
  console.log(lines.join('\n'));
}
