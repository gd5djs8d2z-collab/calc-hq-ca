/* province-table.js — live 13-jurisdiction comparison rows for a calculator page.
   Fills a .compare-table <tbody> using the page's own engine call, one row per option in
   the page's province <select>, sorted high to low, with the selected one highlighted.
   No figures live here: every cell comes from rowFor(code). */

export function renderProvinceTable(tbody, select, rowFor) {
  const rows = [...select.options].map(o => ({ code: o.value, name: o.textContent, ...rowFor(o.value) }));
  rows.sort((a, b) => b.sort - a.sort);
  tbody.innerHTML = rows.map(r =>
    `<tr${r.code === select.value ? ' class="highlight"' : ''}><td>${r.name}</td>${r.cells.map(c => `<td>${c}</td>`).join('')}</tr>`
  ).join('');
}
