/* ============================================================
   CLOTHINA — CHECKOUT
   بيانات العميل → مقاسات → طريقة الدفع → BUY
   ثم: رسالة واتساب كاملة + حفظ الطلب في Supabase (اختياري)
   ============================================================ */
const { CFG, $, $$, ON, util, cart, sb, toast, modal, buildOrderMessage, waLink, icons, coupons } = window.JL;

const measures = [];   // صور المقاسات (تُرفع قبل الإرسال)
function readMeasureFields() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  return {
    height: v('mHeight'), bust: v('mBust'), waist: v('mWaist'),
    hips: v('mHips'), shoulder: v('mShoulder'), sleeve: v('mSleeve'),
    notes: v('mNotes')
  };
}
let payMethod = (CFG.PAYMENT_METHODS || [])[0] || null;
const depositAmount = () => Math.ceil(cart.total() * (Number(CFG.DEPOSIT_PERCENT) || 50) / 100);

/* ---------- رسم ---------- */
function renderSummary() {
  const items = cart.get();
  if (!items.length) { location.replace('cart.html'); return; }
  $('#miniList').innerHTML = items.map(i => `
    <div class="mini">
      <img src="${util.img(i.image || i.image_url, true)}" alt="">
      <div>
        <b>${util.esc(i.title)} <span class="muted">×${i.qty || 1}</span></b>
        <span>${[i.size ? 'Size ' + i.size : '', i.color || ''].filter(Boolean).join(' · ')}</span>
      </div>
      <b style="font-size:13px">${util.money((i.price || 0) * (i.qty || 1))}</b>
    </div>`).join('');
  $('#cSub').textContent = util.money(cart.subtotal());
  $('#cShip').textContent = cart.shipping() ? util.money(cart.shipping()) : 'Free';

  /* الكوبون */
  $('#cCouponBlock').innerHTML = window.JL.couponBoxHTML();
  const bd = coupons.breakdown(items);
  const row = $('#cDiscountRow');
  if (bd.discount > 0) {
    row.classList.remove('hide');
    $('#cCouponCode').textContent = bd.coupon.code;
    $('#cDiscount').textContent = '− ' + util.money(bd.discount);
  } else {
    row.classList.add('hide');
  }
  $('#cTotal').textContent = util.money(cart.total());
  window.JL.bindCouponBox($('#cCouponBlock'), renderSummary);
}

function renderPay() {
  const methods = (CFG.PAYMENT_METHODS || []).slice(0, 1);   // فودافون كاش فقط
  $('#payGrid').innerHTML = methods.map((m, i) => `
    <label class="pay ${i === 0 ? 'is-on' : ''}" data-pay="${util.esc(m.id)}">
      <input type="radio" name="pay" value="${util.esc(m.id)}" ${i === 0 ? 'checked' : ''}>
      <span class="radio"></span>
      <span class="pay-txt"><b>${util.esc(m.title)}</b><span>${util.esc(m.sub || '')}</span></span>
      <span class="pay-logo">${util.esc(m.logo || '')}</span>
    </label>`).join('') + `
    <div class="pay-note" id="payNote"></div>`;
  payMethod = methods[0];
  renderPayNote();
  $$('.pay[data-pay]').forEach(el => ON(el, 'click', () => {
    payMethod = methods.find(m => m.id === el.dataset.pay);
    $$('.pay[data-pay]').forEach(x => x.classList.toggle('is-on', x === el));
    el.querySelector('input').checked = true;
    renderPayNote();
  }));
}

function renderPayNote() {
  const host = $('#payNote');
  if (!host || !payMethod) return;
  const deposit = depositAmount();
  const remaining = Math.max(0, cart.total() - deposit);
  const percent = Number(CFG.DEPOSIT_PERCENT) || 50;
  host.innerHTML = `
    <div class="deposit-box">
      <div class="deposit-head">
        <span class="deposit-ico">${icons.cash || ''}</span>
        <b>${percent}% deposit to confirm your order</b>
      </div>
      <p>${util.esc(payMethod.note || '')}</p>
      <div class="vodafone-number">
        <span>Vodafone Cash transfer number</span>
        <b class="en" dir="ltr">${util.esc(CFG.VODAFONE_CASH_NUMBER || '')}</b>
      </div>
      <div class="deposit-split">
        <span>Amount due now: <b>${util.moneyAr(deposit)}</b></span>
        <span>Balance due on delivery: <b>${util.moneyAr(remaining)}</b></span>
      </div>
    </div>`;
  const hint = $('#depositHint');
  if (hint) hint.classList.remove('hide');
}

function renderMeasures() {
  $('#previewMeasure').innerHTML = measures.map((m, i) =>
    `<img src="${m.local}" alt="Measurement ${i + 1}" data-rm="${i}" title="Click to remove">`).join('');
  $$('#previewMeasure img').forEach(img => ON(img, 'click', () => {
    measures.splice(+img.dataset.rm, 1); renderMeasures();
  }));
}

function addMeasureFiles(files) {
  [...files].filter(f => f.type.startsWith('image/')).forEach(f => {
    measures.push({ file: f, local: URL.createObjectURL(f), url: null });
  });
  renderMeasures();
}

/* ---------- إرسال ---------- */
async function placeOrder() {
  const err = $('#ckErr');
  err.textContent = '';
  const name = $('#cName').value.trim();
  const phone = $('#cPhone').value.trim();
  const city = $('#cCity').value.trim();
  const address = $('#cAddress').value.trim();
  const notes = $('#cNotes').value.trim();
  const confirm = $('#cConfirm').checked;
  const items = cart.get();

  if (!items.length) return (err.textContent = 'Your bag is empty.');
  if (name.length < 2) return (err.textContent = 'Please enter your full name.');
  if (!/^[0-9+\s-]{8,}$/.test(phone)) return (err.textContent = 'Please enter a valid phone number.');
  if (!payMethod) return (err.textContent = 'Please select a payment method.');
  if (!confirm) return (err.textContent = 'Please confirm your order details.');

  const btn = $('#placeOrder');
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = 'Preparing your order…';

  const code = util.uid();

  /* رفع صور المقاسات (اختياري — لو الـ bucket مش جاهز بنكمل عادي) */
  const uploaded = [];
  if (measures.length) {
    try {
      for (const m of measures) {
        if (!m.url) m.url = await sb.upload(CFG.BUCKET_MEASUREMENTS, m.file);
        uploaded.push(m.url);
      }
    } catch (e) {
      console.warn('measurements upload skipped:', e.message);
      toast('Measurement photos could not be uploaded; we will request them via WhatsApp.', 'warn');
    }
  }

  /* حفظ الطلب في القاعدة */
  const measureData = readMeasureFields();
  const order = { code, customers: { name, phone, city, address, notes, confirm } };
  try {
    await sb.insert(CFG.TABLE_ORDERS, {
      code,
      customer_name: name,
      phone,
      city: city || null,
      address: address || null,
      notes: notes || null,
      payment_method: payMethod ? payMethod.title : null,
      deposit: depositAmount(),
      items: items.map(i => ({
        id: i.id, title: i.title, size: i.size, color: i.color,
        qty: i.qty, price: i.price, image: i.image
      })),
      subtotal: cart.subtotal(),
      discount: coupons.breakdown(items).discount,
      coupon_code: coupons.get()?.code || null,
      total: cart.total(),
      measurement_urls: uploaded
    });
  } catch (e) {
    console.warn('order save skipped:', e.message);
  }

  /* رسالة واتساب — تشمل المقاسات وطريقة الدفع والعربون */
  const msg = buildOrderMessage({
    code, name, phone, city, address, notes,
    items: items.map(i => ({ ...i, note: [i.size ? 'Size ' + i.size : '', i.color || ''].filter(Boolean).join(' · ') })),
    total: cart.total(),
    subtotal: cart.subtotal(),
    discount: coupons.breakdown(items).discount,
    couponCode: coupons.get()?.code || null,
    shipping: cart.shipping(),
    payment: payMethod ? payMethod.title : 'Not specified',
    paymentId: payMethod ? payMethod.id : '',
    deposit: depositAmount(),
    measurements: { ...measureData, images: uploaded }
  });

  const link = waLink(msg);
  $('#orderCodeOut').textContent = code;
  $('#waAgain').href = link;

  modal.open('doneModal');
  // محاولة فتح واتساب تلقائياً
  setTimeout(() => {
    window.open(link, '_blank', 'noopener');
  }, 500);

  cart.clear();
  coupons.clear();
  btn.disabled = false;
  btn.innerHTML = original;
  setTimeout(() => { location.href = 'shop.html'; }, 20000);
}

/* ---------- تشغيل ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderSummary();
  renderPay();
  ON($('#fileMeasure'), 'change', e => addMeasureFiles(e.target.files));

  const zone = $('#dropMeasure');
  ON(zone, 'click', () => $('#fileMeasure').click());
  ['dragenter', 'dragover'].forEach(ev => ON(zone, ev, e => { e.preventDefault(); zone.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach(ev => ON(zone, ev, e => { e.preventDefault(); zone.classList.remove('is-drag'); }));
  ON(zone, 'drop', e => addMeasureFiles(e.dataTransfer?.files || []));

  ON($('#placeOrder'), 'click', placeOrder);

  /* تحقق بسيط من التأكيد */
  const c = $('#cConfirm');
  ON(c, 'change', () => {
    const radio = c.closest('.pay');
    radio.querySelector('.radio').style.background = c.checked ? 'var(--text-main)' : '';
    radio.classList.toggle('is-on', c.checked);
  });
});
