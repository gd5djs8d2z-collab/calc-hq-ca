/* province-table.js — live 13-jurisdiction comparison rows for a calculator page.
   Fills a .compare-table <tbody> using the page's own engine call, one row per option in
   the page's province <select>, sorted high to low, with the selected one highlighted.
   No figures live here: every cell comes from rowFor(code). */

export function renderProvinceTable(tbody, select, rowFor) {
  const rows = [...select.options].map(o => ({ code: o.value, name: o.textContent, ...rowFor(o.value) }));
  rows.sort((a, b) => b.sort - a.sort);
  // Each cell carries its column's header as data-label, for the stacked (card) layout on phones
  // (.compare-table.stack). Attributes only: the cell contents are exactly what they were.
  const heads = [...(tbody.closest('table')?.tHead?.rows[0]?.cells || [])]
    .map(th => th.textContent.trim().replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
  const td = (i, c) => `<td${heads[i] ? ` data-label="${heads[i]}"` : ''}>${c}</td>`;
  tbody.innerHTML = rows.map(r =>
    `<tr${r.code === select.value ? ' class="highlight"' : ''}>${td(0, r.name)}${r.cells.map((c, i) => td(i + 1, c)).join('')}</tr>`
  ).join('');
}
