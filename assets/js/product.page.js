/* ============================================================
   CLOTHINA — PRODUCT PAGE
   جاليري موحّد + ثامبنيل + اختيار مقاس/لون + دليل قياسات + إضافة للسلة
   ============================================================ */
const { $, $$, ON, util, products, cart, toast, modal, waLink, icons, offer } = window.JL;

const state = { product: null, imgIndex: 0, size: '', color: '', qty: 1 };

/* ---------- كارت مشابه ---------- */
function miniCard(p) {
  return `
    <article class="card reveal">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-media">
        <img src="${util.img(p.image_url, true)}" alt="${util.esc(p.title)}" loading="lazy">
      </a>
      <div class="card-body">
        <a class="card-title" href="product.html?id=${encodeURIComponent(p.id)}">${util.esc(p.title)}</a>
        <div class="card-meta"><span class="card-price">${util.money(p.price)}</span></div>
      </div>
    </article>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');
  const p = await products.one(id);

  if (!p) {
    $('#pdp').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <b>Product not found</b>
        <span class="tiny">This link may be outdated or the item may have been removed.</span>
        <a class="btn btn--ghost btn--sm" href="shop.html">Back to shop</a>
      </div>`;
    return;
  }

  state.product = p;
  state.size = (p.sizes || [])[0] || '';
  state.color = (p.colors || [])[0]?.name || '';

  document.title = `${p.title} · CLOTHINA`;
  $('#crumbName').textContent = p.title;
  $('#pdpCat').textContent = [p.title_en || '', p.category || ''].filter(Boolean).join(' · ') || 'CLOTHINA';
  $('#pdpTitle').textContent = p.title;

  /* السعر + العرض المحدود */
  const st = offer.state(p);
  const off = offer.pct(p);
  $('#pdpPrice').innerHTML = `
    <span>${util.money(p.price)}</span>
    ${st === 'live' ? `<span class="old">${util.money(p.old_price)}</span><span class="save">Save ${off}%</span>` : ''}`;

  /* شريط العرض المحدود (كان بكذا now كذا — لفترة محدودة) */
  const offerHost = document.createElement('div');
  offerHost.style.display = 'grid';
  offerHost.style.gap = '8px';
  if (st === 'live' && offer.endsAt(p)) {
    offerHost.innerHTML = `
      <div class="offer-strip">
        <span class="dot-live"></span>
        <span>Limited-time offer — was <b>${util.money(p.old_price)}</b> now <b>${util.money(p.price)}</b></span>
        <span class="cd" data-offer-end="${offer.endsAt(p).toISOString()}"></span>
      </div>`;
    setTimeout(() => window.JL.initCountdowns(), 0);
  } else if (st === 'live') {
    offerHost.innerHTML = `
      <div class="offer-strip"><span class="dot-live"></span>
      <span>Was <b>${util.money(p.old_price)}</b> — now <b>${util.money(p.price)}</b></span></div>`;
  }
  $('#pdpPrice').after(offerHost);

  /* الوصف */
  $('#pdpDesc').textContent = p.description || 'A CLOTHINA piece with considered details and a comfortable fit.';

  /* الجاليري */
  const stage = $('#stage');
  const images = p.images?.length ? p.images : [p.image_url];
  stage.insertAdjacentHTML('afterbegin', images.map((src, i) =>
    `<img src="${util.img(src)}" alt="${util.esc(p.title)} — Image ${i + 1}" class="${i === 0 ? 'is-on' : ''}" data-i="${i}" loading="${i === 0 ? 'eager' : 'lazy'}" fetchpriority="${i === 0 ? 'high' : 'auto'}" decoding="async">`).join(''));
  stage.querySelector('.skeleton')?.remove();

  $('#thumbs').innerHTML = images.map((src, i) =>
    `<button class="${i === 0 ? 'is-on' : ''}" data-thumb="${i}" aria-label="Image ${i + 1}">
       <img src="${util.img(src, true)}" alt="" loading="lazy">
     </button>`).join('');

  const showImg = (i) => {
    const n = images.length;
    state.imgIndex = (i + n) % n;
    $$('#stage img[data-i]').forEach(im => im.classList.toggle('is-on', +im.dataset.i === state.imgIndex));
    $$('#thumbs button').forEach(b => b.classList.toggle('is-on', +b.dataset.thumb === state.imgIndex));
  };
  ON($('#prevImg'), 'click', () => showImg(state.imgIndex - 1));
  ON($('#nextImg'), 'click', () => showImg(state.imgIndex + 1));
  $$('#thumbs button').forEach(b => ON(b, 'click', () => showImg(+b.dataset.thumb)));
  // سحب بالإصبع
  let sx = null;
  ON(stage, 'touchstart', e => sx = e.touches[0].clientX, { passive: true });
  ON(stage, 'touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 45) showImg(state.imgIndex + (dx > 0 ? -1 : 1));
    sx = null;
  });

  /* المقاسات */
  const sizes = p.sizes || [];
  $('#sizeBtns').innerHTML = sizes.map(s =>
    `<button class="opt-btn ${s === state.size ? 'is-on' : ''}" data-size="${util.esc(s)}">${util.esc(s)}</button>`).join('');
  $$('#sizeBtns .opt-btn').forEach(b => ON(b, 'click', () => {
    state.size = b.dataset.size;
    $$('#sizeBtns .opt-btn').forEach(x => x.classList.toggle('is-on', x === b));
    $('#sizeHint').textContent = state.size;
    $('#sizeHint').classList.remove('muted');
  }));
  $('#sizeHint').textContent = state.size || 'Choose a size';

  /* الألوان */
  const colors = p.colors || [];
  if (colors.length) {
    $('#colorBtns').innerHTML = colors.map(c =>
      `<button class="swatch ${c.name === state.color ? 'is-on' : ''}" data-color="${util.esc(c.name)}" title="${util.esc(c.name)}">
         <i style="background:${util.esc(c.hex || '#EFECE6')}"></i>
       </button>`).join('');
    $$('#colorBtns .swatch').forEach(b => ON(b, 'click', () => {
      state.color = b.dataset.color;
      $$('#colorBtns .swatch').forEach(x => x.classList.toggle('is-on', x === b));
      $('#colorHint').textContent = state.color;
    }));
    $('#colorHint').textContent = state.color;
  } else {
    $('#optColors').remove();
  }

  /* الكمية */
  ON($('#qtyMinus'), 'click', () => { state.qty = Math.max(1, state.qty - 1); $('#qtyVal').textContent = state.qty; });
  ON($('#qtyPlus'), 'click', () => { state.qty = Math.min(99, state.qty + 1); $('#qtyVal').textContent = state.qty; });

  /* تفاصيل */
  $('#accDetails').innerHTML = `
    <ul>
      ${p.fabric ? `<li>Fabric: ${util.esc(p.fabric)}</li>` : ''}
      ${p.category ? `<li>Collection: ${util.esc(p.category)}</li>` : ''}
      ${p.title_en ? `<li>Name: ${util.esc(p.title_en)}</li>` : ''}
      <li>Fit: comfortable and fully lined.</li>
      <li>Packaging: fabric box and tissue paper, ready for gifting.</li>
      <li>Deposit: 50% via Vodafone Cash, with the balance due on delivery.</li>
    </ul>`;

  /* دليل القياسات */
  ON($('#openGuide'), 'click', () => {
    const body = $('#sizeModalBody');
    if (p.size_guide_url) {
      body.innerHTML = `<img src="${p.size_guide_url}" alt="Size guide for ${util.esc(p.title)}" style="width:100%;border-radius:14px">`;
    } else {
      body.innerHTML = document.querySelector('#guideModal').innerHTML;
      body.querySelector('.modal-head')?.remove();
    }
    modal.open('sizeModal');
  });
  ON($('[data-close-guide]'), 'click', () => modal.close('sizeModal'));
  ON($('#sizeModal'), 'click', e => { if (e.target.id === 'sizeModal') modal.close('sizeModal'); });

  /* السلة */
  const itemToAdd = () => ({
    id: p.id,
    title: p.title,
    title_en: p.title_en,
    price: p.price,
    qty: state.qty,
    size: state.size,
    color: state.color,
    image: p.image_url
  });

  ON($('#addToCart'), 'click', () => {
    if (!state.size) return toast('Please choose a size first.', 'warn');
    cart.add(itemToAdd());
    toast('Added to your bag.', 'ok');
    bumpCart();
  });

  ON($('#buyNow'), 'click', () => {
    if (!state.size) return toast('Please choose a size first.', 'warn');
    cart.add(itemToAdd());
    location.href = 'cart.html';
  });

  /* استفسار على واتساب */
  const ask = `Hello CLOTHINA ✦\nI have a question about: ${p.title}${p.title_en ? ' / ' + p.title_en : ''}\n${location.href}`;
  $('#waAsk').href = waLink(ask);

  /* المشابهة */
  const all = await products.all();
  const related = all.filter(x => String(x.id) !== String(p.id))
    .sort((a, b) => (a.category === p.category ? -1 : 0) - (b.category === p.category ? -1 : 0))
    .slice(0, 4);
  $('#relatedGrid').innerHTML = related.map(miniCard).join('');
  window.JL.revealWithin($('#relatedGrid'));

  $('.gallery')?.classList.add('reveal');
  $$('#pdp .pdp-info > *').forEach((element, index) => {
    element.classList.add('reveal');
    element.dataset.delay = String(Math.min(index * .045, .25));
  });
  window.JL.revealWithin($('#pdp'));
});

function bumpCart() {
  const badge = document.querySelector('.cart-count');
  if (!badge || !badge.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  badge.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' }
  );
}
