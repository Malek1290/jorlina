/* ============================================================
   CLOTHINA — SHOP PAGE (المتجر)
   ============================================================ */
const { $, $$, ON, util, products, cardHTML } = window.JL;

document.addEventListener('DOMContentLoaded', async () => {
  const grid = $('#shopGrid');
  const chipsBox = $('#catChips');
  const sortSel = $('#sortSel');
  const countEl = $('#resCount');
  const params = new URLSearchParams(location.search);
  let list = await products.all();
  let cat = params.get('cat') || '';

  /* الأقسام */
  const cats = ['', ...new Set(list.map(p => p.category).filter(Boolean))];
  chipsBox.innerHTML = cats.map(c => `
    <button class="chip ${c === cat ? 'is-on' : ''}" data-cat="${util.esc(c)}">${c ? util.esc(c) : 'كل الفساتين'}</button>`).join('');
  $$('.chip', chipsBox).forEach(b => ON(b, 'click', () => {
    cat = b.dataset.cat;
    $$('.chip', chipsBox).forEach(x => x.classList.toggle('is-on', x === b));
    history.replaceState({}, '', cat ? `?cat=${encodeURIComponent(cat)}` : location.pathname);
    render();
  }));

  function render() {
    let rows = cat ? list.filter(p => p.category === cat) : list.slice();
    const sort = sortSel.value;
    if (sort === 'price-asc') rows.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') rows.sort((a, b) => b.price - a.price);
    if (sort === 'new') rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    if (!rows.length) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <b>ما فيه منتجات في هذا القسم حالياً</b>
          <span class="tiny">جرّبي قسم ثاني أو شوفي كل الفساتين.</span>
          <a class="btn btn--ghost btn--sm" href="shop.html">كل الفساتين</a>
        </div>`;
    } else {
      grid.innerHTML = rows.map((p, i) => cardHTML(p, i)).join('');
      window.JL.initCountdowns();
      if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo('#shopGrid .card', { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: .8, ease: 'power3.out', stagger: .05 });
      } else {
        $$('#shopGrid .card').forEach(c => { c.style.opacity = 1; c.style.transform = 'none'; });
      }
    }
    countEl.textContent = rows.length + ' قطعة';
  }

  ON(sortSel, 'change', render);
  render();
});
