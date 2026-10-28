/* ============================================================
   JORLINA — HOME PAGE
   ============================================================ */
const { $, $$, ON, util, products, cart, toast, cardHTML, offer } = window.JL;
const initSilk = (window.JLSilk && window.JLSilk.initSilk) || (() => ({ destroy() {} }));

/* ---------- تشغيل ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  /* Silk في التحميل والهيرو */
  const loaderCv = document.getElementById('jl-loader-canvas');
  const heroCv = document.getElementById('hero-canvas');
  initSilk(loaderCv, { opacity: .92, amp: 1, colorA: '#FFFFFF', colorB: '#EFEAE0', colorC: '#C9CBBE' });
  initSilk(heroCv, { opacity: 1, amp: 1.25, tilt: .1, colorA: '#FFFFFF', colorB: '#EDE9DF', colorC: '#C2C5B6' });

  /* المنتجات */
  const grid = $('#homeGrid');
  const list = await products.all();
  grid.innerHTML = list.slice(0, 8).map((p, i) => cardHTML(p, i, { quick: true })).join('');
  window.JL.initCountdowns();
  if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.fromTo('#homeGrid .card',
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: .07,
        scrollTrigger: { trigger: '#homeGrid', start: 'top 85%' } });
  } else {
    $$('#homeGrid .card').forEach(c => { c.style.opacity = 1; c.style.transform = 'none'; });
  }

  /* نظرة سريعة */
  $$('[data-quick]').forEach(b => ON(b, 'click', e => {
    e.preventDefault();
    const id = b.dataset.quick;
    const p = list.find(x => String(x.id) === String(id));
    if (!p) return;
    quickView(p);
  }));

  /* hero parallax ناعم */
  if (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to('.hero-media img', {
      yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }
});

/* ---------- نافذة النظرة السريعة ---------- */
function quickView(p) {
  const id = 'quickModal';
  let m = document.getElementById(id);
  if (!m) {
    m = document.createElement('div');
    m.className = 'modal'; m.id = id;
    document.body.appendChild(m);
    ON(m, 'click', e => { if (e.target === m) window.JL.modal.close(m); });
  }
  const sizes = (p.sizes || []).map((s, i) => `<button class="opt-btn ${i === 0 ? 'is-on' : ''}" data-q-size="${util.esc(s)}">${util.esc(s)}</button>`).join('');
  const colors = (p.colors || []).map((c, i) => `
    <button class="swatch ${i === 0 ? 'is-on' : ''}" data-q-color="${util.esc(c.name)}" title="${util.esc(c.name)}">
      <i style="background:${util.esc(c.hex || '#EFECE6')}"></i>
    </button>`).join('');

  m.innerHTML = `
    <div class="modal-card" style="width:min(760px,100%)">
      <div class="modal-head">
        <h3>${util.esc(p.title)}</h3>
        <button class="modal-close" data-close>✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px" class="quick-grid">
        <div style="aspect-ratio:4/5;border-radius:16px;overflow:hidden;background:var(--bg-swirl)">
          <img src="${util.img(p.image_url)}" alt="${util.esc(p.title)}" style="width:100%;height:100%;object-fit:cover">
        </div>
        <div style="display:grid;gap:14px;align-content:start">
          <div class="card-meta"><span class="card-price" style="font-size:18px">${util.money(p.price)}</span>
            ${offer.state(p) === 'live' ? `<span class="card-price-old">${util.money(p.old_price)}</span><span class="save" style="font-size:11px;background:var(--bg-swirl);color:var(--accent-olive-dark);padding:3px 9px;border-radius:999px">-${offer.pct(p)}%</span>` : ''}</div>
          ${offer.state(p) === 'live' && offer.endsAt(p) ? `<div class="offer-strip" style="font-size:12px"><span class="dot-live"></span>عرض محدود ينتهي خلال <span class="cd" data-offer-end="${offer.endsAt(p).toISOString()}"></span></div>` : ''}
          <p class="tiny muted" style="line-height:1.9">${util.esc((p.description || '').slice(0, 130))}${(p.description || '').length > 130 ? '…' : ''}</p>
          ${sizes ? `<div class="opt"><span class="opt-label">المقاس</span><div class="opt-grid">${sizes}</div></div>` : ''}
          ${colors ? `<div class="opt"><span class="opt-label">اللون</span><div class="opt-grid">${colors}</div></div>` : ''}
          <button class="btn btn--block" id="quickAdd">أضيفي للسلة</button>
          <a class="link-u" href="product.html?id=${encodeURIComponent(p.id)}" style="justify-self:start">كل التفاصيل <span class="en">→</span></a>
        </div>
      </div>
    </div>`;

  window.JL.modal.open(m);
  ON(m.querySelector('[data-close]'), 'click', () => window.JL.modal.close(m));
  m.querySelectorAll('[data-q-size]').forEach(b => ON(b, 'click', () => {
    m.querySelectorAll('[data-q-size]').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
  }));
  m.querySelectorAll('[data-q-color]').forEach(b => ON(b, 'click', () => {
    m.querySelectorAll('[data-q-color]').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
  }));
  ON(m.querySelector('#quickAdd'), 'click', () => {
    const size = m.querySelector('[data-q-size].is-on')?.dataset.qSize || '';
    const color = m.querySelector('[data-q-color].is-on')?.dataset.qColor || '';
    cart.add({
      id: p.id, title: p.title, title_en: p.title_en, price: p.price, qty: 1,
      size, color, image: p.image_url
    });
    toast('تمت الإضافة للسلة', 'ok');
    window.JL.modal.close(m);
  });
}
