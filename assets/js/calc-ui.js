/* calc-ui.js — small shared DOM/format helpers for the calculator pages.
   Math lives in tax-engine.js; this only handles input parsing and stub messaging. */

export function parseMoney(v) {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
}

/* Message shown when a user picks a province this build can't compute yet. All 13
   jurisdictions (Quebec included — QPP/QPIP/abatement/brackets now wired) are live, so
   nothing is gated. Kept as a hook in case a future jurisdiction ships behind a gate. */
export function provinceStub(code) {
  return null;
}

export function el(id) { return document.getElementById(id); }

/** Label every cell of a script-filled table body with its column's header (data-label), so
 *  the table can stack into labelled cards on phones (.compare-table.stack). Follows colspans;
 *  a cell spanning several columns is left unlabelled. Attributes only — contents untouched. */
export function labelCells(tbody) {
  const heads = [...(tbody.closest('table')?.tHead?.rows[0]?.cells || [])].map((th) => th.textContent.trim());
  for (const row of tbody.rows) {
    let col = 0;
    for (const cell of row.cells) {
      if (cell.colSpan === 1 && heads[col]) cell.dataset.label = heads[col];
      col += cell.colSpan;
    }
  }
}
