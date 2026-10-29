/* ============================================================
   CLOTHINA — STREETWEAR SHOP
   ============================================================ */
const { $, $$, ON, util, products, cardHTML } = window.JL;
const STREET_FILTERS = [
  { label: 'All', key: 'all' },
  { label: 'Oversized', key: 'oversized' },
  { label: 'Hoodies', key: 'hoodies' },
  { label: 'Graphic Tees', key: 'graphic-tees' },
  { label: 'Denim', key: 'denim' }
];

function matchesFilter(product, key) {
  if (key === 'all') return true;
  const text = [product.category, product.title, product.title_en, product.description, product.fabric]
    .filter(Boolean).join(' ').toLowerCase();
  if (key.startsWith('category:')) return String(product.category || '').toLowerCase() === key.slice(9).toLowerCase();
  if (key === 'oversized') return /oversiz|relaxed fit|loose fit/.test(text);
  if (key === 'hoodies') return /hoodie|sweatshirt|hooded/.test(text);
  if (key === 'graphic-tees') return /graphic tee|graphic t-shirt|t-shirt|tee shirt|tee/.test(text);
  if (key === 'denim') return /denim|jeans/.test(text);
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = $('#shopGrid');
  const chipsBox = $('#catChips');
  const sortSel = $('#sortSel');
  const countEl = $('#resCount');
  const params = new URLSearchParams(location.search);
  let list = await products.all();
  const requested = params.get('cat') || '';
  const extraCategories = [...new Set(list.map(p => p.category).filter(Boolean))]
    .filter(category => !STREET_FILTERS.some(f => f.label.toLowerCase() === category.toLowerCase()));
  const filters = [...STREET_FILTERS, ...extraCategories.map(category => ({ label: category, key: `category:${category}` }))];
  let active = requested
    ? (filters.find(f => f.key.toLowerCase() === requested.toLowerCase() || f.label.toLowerCase() === requested.toLowerCase())?.key || `category:${requested}`)
    : 'all';

  chipsBox.innerHTML = filters.map(f => `
    <button class="chip ${f.key === active ? 'is-on' : ''}" type="button" data-filter="${util.esc(f.key)}" aria-pressed="${f.key === active}">${util.esc(f.label)}</button>`).join('');
  $$('.chip', chipsBox).forEach(button => ON(button, 'click', () => {
    active = button.dataset.filter;
    $$('.chip', chipsBox).forEach(chip => {
      const selected = chip === button;
      chip.classList.toggle('is-on', selected);
      chip.setAttribute('aria-pressed', String(selected));
    });
    const selected = filters.find(f => f.key === active);
    if (active === 'all') history.replaceState({}, '', location.pathname);
    else history.replaceState({}, '', `?cat=${encodeURIComponent(selected?.label || active.slice(9))}`);
    render();
  }));

  function render() {
    let rows = list.filter(product => matchesFilter(product, active));
    const sort = sortSel.value;
    if (sort === 'price-asc') rows.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') rows.sort((a, b) => b.price - a.price);
    if (sort === 'new') rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    if (!rows.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>No pieces in this edit yet</b><span class="tiny">Try another filter or browse everything.</span><button class="btn btn--ghost btn--sm" type="button" data-reset-filter>Shop all</button></div>`;
      ON(grid.querySelector('[data-reset-filter]'), 'click', () => chipsBox.querySelector('[data-filter="all"]')?.click());
    } else {
      grid.innerHTML = rows.map((product, index) => cardHTML(product, index)).join('');
      window.JL.initCountdowns();
      window.JL.revealWithin(grid);
    }
    countEl.textContent = `${rows.length} ${rows.length === 1 ? 'piece' : 'pieces'}`;
  }

  ON(sortSel, 'change', render);
  render();
});
