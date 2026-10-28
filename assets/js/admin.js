/* ============================================================
   JORLINA — ADMIN PANEL (مخفي)
   • إضافة منتج + تعديل منتج موجود
   • عرض سعر لفترة محدودة (كان بكذا والآن كذا)
   • كوبونات / خصومات (نسبة % + اختيار المنتجات)
   • يظهر فقط لو وضع الآدمن مفعّل على المتصفح
   ============================================================ */
(() => {
  'use strict';
  const { CFG, $, $$, ON, util, sb, admin, products, toast, icons } = window.JL;

  if (!admin.isAdmin()) {
    document.addEventListener('jl:open-admin', () => {
      location.href = `index.html?admin=${encodeURIComponent(CFG.ADMIN_TOKEN)}`;
    });
    return;
  }

  /* ============================ الحالة ============================ */
  const state = {
    images: [],       // [{file?, url, existing?}]
    guide: null,      // {file?, url, existing?}
    sizes: new Set(),
    colors: [],
    editingId: null,  // null = منتج جديد
    tab: 'new',
    productsCache: [],
    couponsCache: []
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectUI();
    document.addEventListener('jl:open-admin', openSheet);
  });

  /* ============================ الواجهة ============================ */
  function injectUI() {
    const fab = document.createElement('button');
    fab.className = 'admin-fab on';
    fab.id = 'adminFab';
    fab.setAttribute('aria-label', 'لوحة التحكم — Administrator');
    fab.innerHTML = `${icons.admin}<span>لوحة التحكم</span>`;
    document.body.appendChild(fab);

    const sheet = document.createElement('aside');
    sheet.className = 'admin-sheet';
    sheet.id = 'adminSheet';
    sheet.innerHTML = `
      <div class="admin-head">
        <b>لوحة تحكم جورلينا <span class="tag en">ADMIN</span></b>
        <button class="icon-btn" id="adminClose" aria-label="إغلاق">${icons.close}</button>
      </div>
      <div class="admin-tabs">
        <button class="admin-tab is-on" data-tab="new">منتج جديد</button>
        <button class="admin-tab" data-tab="list">المنتجات</button>
        <button class="admin-tab" data-tab="coupons">الكوبونات <span class="cnt" id="couponsCnt">0</span></button>
        <button class="admin-tab" data-tab="orders">الطلبات</button>
        <button class="admin-tab" data-tab="settings">الإعدادات</button>
      </div>

      <div class="admin-body" id="adminBody">

        <!-- ==================== منتج (جديد / تعديل) ==================== -->
        <div data-panel="new" style="display:grid;gap:14px">
          <div class="editing-banner hide" id="editBanner">
            <span>بتعدّلي الآن: <b id="editName">—</b></span>
            <button class="btn-mini" id="cancelEdit">إلغاء التعديل وبدء منتج جديد</button>
          </div>

          <div class="admin-note">
            الصور تترفع على Supabase Storage (bucket: <b class="en">${util.esc(CFG.BUCKET_PRODUCTS)}</b>) وبعدها بيتحفظ الرابط + البيانات في جدول <b class="en">${util.esc(CFG.TABLE_ITEMS)}</b>.
          </div>

          <div class="field">
            <label>صور المنتج <span class="muted tiny">(أول صورة = الرئيسية)</span></label>
            <div class="dropzone" id="dropProducts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
              <span>اسحبي الصور هنا أو اضغطي للاختيار</span>
              <small>JPG / PNG / WEBP — حتى 6 صور</small>
            </div>
            <input type="file" id="fileProducts" accept="image/*" multiple hidden>
            <div class="preview-strip" id="previewProducts"></div>
          </div>

          <div class="form-grid">
            <div class="field"><label>اسم المنتج بالعربي <span class="req">*</span></label><input class="input" id="fTitle" placeholder="مثال: سيلين"></div>
            <div class="field"><label>الاسم بالإنجليزي</label><input class="input en" id="fTitleEn" placeholder="CELINE" dir="ltr"></div>
            <div class="field"><label>السعر الحالي <span class="req">*</span></label><input class="input" id="fPrice" type="number" min="0" step="50" placeholder="4200"></div>
            <div class="field"><label>السعر قبل الخصم (كان بـ)</label><input class="input" id="fOldPrice" type="number" min="0" step="50" placeholder="4800"></div>
            <div class="field"><label>القسم</label>
              <select class="select-full" id="fCategory">
                <option value="">— اختاري —</option>
                ${(CFG.CATEGORIES || []).map(c => `<option value="${util.esc(c)}">${util.esc(c)}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>الخامة</label><input class="input" id="fFabric" placeholder="ساتان حريري"></div>
          </div>

          <!-- ============ عرض لفترة محدودة ============ -->
          <div class="field">
            <label>عرض لفترة محدودة</label>
            <div class="offer-toggle">
              <button type="button" class="sz is-on" data-offer="off">بدون عرض</button>
              <button type="button" class="sz" data-offer="on" style="gap:7px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.1 1.9"/></svg>
                عرض محدود</button>
            </div>
            <div class="offer-fields hide" id="offerFields">
              <div class="admin-note" style="background:#fff">
                هيظهر للعميل: <b>كان بـ <span id="offerPreviewOld">—</span> والآن <span id="offerPreviewNew">—</span></b>
                + عدّاد تنازلي بالوقت المتبقي.
              </div>
              <div class="form-grid">
                <div class="field">
                  <label>ينتهي العرض في <span class="req">*</span></label>
                  <input class="input" id="fOfferEnds" type="datetime-local">
                </div>
                <div class="field">
                  <label>عنوان العرض (اختياري)</label>
                  <input class="input" id="fOfferLabel" placeholder="عرض العيد · آخر ٤٨ ساعة">
                </div>
              </div>
              <p class="tiny muted" style="margin:0">يجب أن يكون «السعر قبل الخصم» أكبر من السعر الحالي. بعد انتهاء الوقت يرجع العميل يشوف السعر الحالي بدون عدّاد.</p>
            </div>
          </div>

          <div class="field"><label>الوصف</label><textarea class="textarea" id="fDesc" placeholder="وصف هادئ ومختصر للفستان..."></textarea></div>

          <div class="field">
            <label>المقاسات المتاحة</label>
            <div class="sizes-check" id="sizesBox">
              ${(CFG.DEFAULT_SIZES || []).map(s => `<button type="button" class="sz" data-size="${util.esc(s)}">${util.esc(s)}</button>`).join('')}
            </div>
            <input class="input mt-2" id="fCustomSize" placeholder="أضيفي مقاس مخصص (Enter)">
          </div>

          <div class="field">
            <label>الألوان</label>
            <div class="sizes-check" id="colorsBox">
              ${(CFG.DEFAULT_COLORS || []).map(c => `
                <button type="button" class="sz" data-color="${util.esc(c.name)}" data-hex="${util.esc(c.hex)}" style="gap:8px">
                  <i style="width:12px;height:12px;border-radius:50%;background:${util.esc(c.hex)};display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></i>${util.esc(c.name)}
                </button>`).join('')}
            </div>
            <div class="form-grid mt-2">
              <input class="input" id="fColorName" placeholder="اسم لون مخصص">
              <div style="display:flex;gap:8px">
                <input class="input" id="fColorHex" type="color" value="#EFECE6" style="padding:4px;height:48px;width:64px">
                <button class="btn btn--ghost btn--sm" id="addColor" style="height:48px">إضافة</button>
              </div>
            </div>
          </div>

          <div class="field">
            <label>دليل القياسات (صورة اختيارية خاصة بالمنتج)</label>
            <div class="dropzone" id="dropGuide" style="padding:16px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
              <small>صورة جدول القياسات</small>
            </div>
            <input type="file" id="fileGuide" accept="image/*" hidden>
            <div class="preview-strip" id="previewGuide"></div>
          </div>

          <div class="form-grid">
            <div class="field"><label>شارة (اختياري)</label><input class="input" id="fBadge" placeholder="جديد / آخر قطعتين"></div>
            <div class="field"><label>ترتيب الظهور</label><input class="input" id="fSort" type="number" value="0"></div>
          </div>

          <div class="progress hide" id="upProgress"><i></i></div>
          <button class="btn btn--block" id="saveProduct">نشر المنتج</button>
          <p class="tiny muted" id="adminMsg"></p>
        </div>

        <!-- ==================== المنتجات ==================== -->
        <div data-panel="list" class="hide">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="tiny muted">اضغطي «تعديل» على أي منتج لتغيير صوره/سعره/عرضه</span>
            <button class="btn btn--ghost btn--sm" id="refreshList">تحديث</button>
          </div>
          <div class="admin-list" id="adminList"><div class="skeleton" style="height:56px"></div></div>
        </div>

        <!-- ==================== الكوبونات ==================== -->
        <div data-panel="coupons" class="hide">
          <div class="admin-note">
            الكوبون بيظهر للعميل كخانة <b class="en">COUPON / DISCOUNT</b> في السلة وصفحة الدفع.
            اكتبي النسبة، واختاري المنتجات اللي ينطبق عليها (أو سيبيها فاضية = كل المنتجات).
          </div>

          <div class="form-grid">
            <div class="field">
              <label>كود الخصم <span class="req">*</span></label>
              <input class="input en" id="cpCode" placeholder="EID2026" dir="ltr" style="text-transform:uppercase">
            </div>
            <div class="field">
              <label>نسبة الخصم % <span class="req">*</span></label>
              <input class="input" id="cpPercent" type="number" min="1" max="100" step="1" placeholder="15">
            </div>
            <div class="field">
              <label>ينتهي في (اختياري)</label>
              <input class="input" id="cpEnds" type="datetime-local">
            </div>
            <div class="field">
              <label>الحالة</label>
              <select class="select-full" id="cpActive">
                <option value="1">مُفعّل</option>
                <option value="0">موقوف</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label style="display:flex;justify-content:space-between;align-items:center">
              <span>المنتجات اللي ينطبق عليها</span>
              <button class="btn-mini" id="cpSelectAll" type="button">تحديد/إلغاء الكل</button>
            </label>
            <div class="coupon-products" id="cpProducts"><p class="tiny muted">جاري تحميل المنتجات...</p></div>
            <p class="tiny muted" id="cpScopeHint">محدش متحدد = الكوبون ينطبق على كل المنتجات.</p>
          </div>

          <button class="btn btn--block" id="cpSave">حفظ الكوبون</button>
          <button class="btn btn--ghost btn--block hide" id="cpCancelEdit">إلغاء التعديل</button>
          <p class="tiny muted" id="cpMsg"></p>

          <hr class="rule" style="margin-block:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="tiny muted">الكوبونات الحالية</span>
            <button class="btn btn--ghost btn--sm" id="cpRefresh">تحديث</button>
          </div>
          <div class="coupon-list" id="cpList"><div class="skeleton" style="height:64px"></div></div>
        </div>

        <!-- ==================== الطلبات ==================== -->
        <div data-panel="orders" class="hide">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="tiny muted">آخر الطلبات المحفوظة في القاعدة</span>
            <button class="btn btn--ghost btn--sm" id="refreshOrders">تحديث</button>
          </div>
          <div class="admin-list" id="ordersList"></div>
        </div>

        <!-- ==================== الإعدادات ==================== -->
        <div data-panel="settings" class="hide" style="display:grid;gap:14px">
          <div class="admin-note">
            <b>حالة الوضع:</b> آدمن مفعّل على هذا المتصفح.<br>
            الحالة محفوظة في <span class="en">localStorage</span> — ما تحتاج تدخل الرمز مرة ثانية على نفس الجهاز.
          </div>
          <div class="field">
            <label>الرابط السري (لا تشاركيه)</label>
            <div style="display:flex;gap:8px">
              <input class="input en" id="secretLink" readonly dir="ltr">
              <button class="btn btn--ghost btn--sm" id="copySecret" style="height:48px">نسخ</button>
            </div>
          </div>
          <button class="btn btn--ghost btn--block" id="logoutAdmin">إلغاء وضع الآدمن من هذا المتصفح</button>
          <div class="admin-note">
            <b>تنبيه تقني:</b> الحماية بثلاث طبقات — الرمز في الرابط، دالة الإدارة في قاعدة البيانات،
            وسياسات RLS على الجداول والـ Storage. أي محاولة كتابة من زائر عادي بترجع مرفوضة من Supabase.
          </div>
        </div>
      </div>`;
    document.body.appendChild(sheet);

    /* ---------- أحداث ---------- */
    ON($('#adminFab'), 'click', openSheet);
    ON($('#adminClose'), 'click', closeSheet);
    $$('.admin-tab', sheet).forEach(t => ON(t, 'click', () => switchTab(t.dataset.tab)));

    ON($('#fileProducts'), 'change', e => addFiles(e.target.files));
    ON($('#fileGuide'), 'change', e => addGuide(e.target.files[0]));
    setupDrop($('#dropProducts'), files => addFiles(files), () => $('#fileProducts').click());
    setupDrop($('#dropGuide'), files => addGuide(files[0]), () => $('#fileGuide').click());

    /* مقاسات */
    $$('#sizesBox .sz').forEach(b => ON(b, 'click', () => toggleSize(b)));
    ON($('#fCustomSize'), 'keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.target.value.trim(); if (!v) return;
      if (![...state.sizes].includes(v)) {
        state.sizes.add(v);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sz is-on'; b.textContent = v;
        ON(b, 'click', () => toggleSize(b));
        $('#sizesBox').appendChild(b);
      }
      e.target.value = '';
    });

    /* ألوان */
    $$('#colorsBox .sz').forEach(b => ON(b, 'click', () => toggleColor(b)));
    ON($('#addColor'), 'click', () => {
      const name = $('#fColorName').value.trim();
      const hex = $('#fColorHex').value;
      if (!name) return toast('اكتبي اسم اللون');
      if (state.colors.some(c => c.name === name)) return toast('اللون موجود بالفعل');
      state.colors.push({ name, hex });
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sz is-on';
      b.style.gap = '8px';
      b.dataset.color = name; b.dataset.hex = hex;
      b.innerHTML = `<i style="width:12px;height:12px;border-radius:50%;background:${util.esc(hex)};display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></i>${util.esc(name)}`;
      ON(b, 'click', () => toggleColor(b));
      $('#colorsBox').appendChild(b);
      $('#fColorName').value = '';
    });

    /* عرض محدود */
    $$('[data-offer]').forEach(b => ON(b, 'click', () => setOfferMode(b.dataset.offer === 'on')));
    ON($('#fOldPrice'), 'input', updateOfferPreview);
    ON($('#fPrice'), 'input', updateOfferPreview);

    /* حفظ / تعديل */
    ON($('#saveProduct'), 'click', saveProduct);
    ON($('#cancelEdit'), 'click', () => resetForm(true));
    ON($('#refreshList'), 'click', loadList);
    ON($('#refreshOrders'), 'click', loadOrders);

    /* الكوبونات */
    ON($('#cpSave'), 'click', saveCoupon);
    ON($('#cpRefresh'), 'click', loadCoupons);
    ON($('#cpSelectAll'), 'click', toggleAllCouponProducts);
    ON($('#cpProducts'), 'change', updateScopeHint);
    ON($('#cpCancelEdit'), 'click', resetCouponForm);

    ON($('#copySecret'), 'click', () => {
      const inp = $('#secretLink');
      inp.select();
      navigator.clipboard?.writeText(inp.value).then(() => toast('تم نسخ الرابط', 'ok')).catch(() => {});
    });
    ON($('#logoutAdmin'), 'click', () => {
      admin.disable();
      toast('تم إلغاء وضع الآدمن');
      setTimeout(() => location.reload(), 700);
    });

    $('#secretLink').value = `${location.origin}${location.pathname}?admin=${CFG.ADMIN_TOKEN}`;
  }

  function setupDrop(zone, onFiles, onClick) {
    if (!zone) return;
    ON(zone, 'click', onClick);
    ['dragenter', 'dragover'].forEach(ev => ON(zone, ev, e => { e.preventDefault(); zone.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach(ev => ON(zone, ev, e => { e.preventDefault(); zone.classList.remove('is-drag'); }));
    ON(zone, 'drop', e => onFiles([...(e.dataTransfer?.files || [])]));
  }

  function openSheet() {
    $('#adminSheet')?.classList.add('is-open');
    document.body.classList.add('is-locked');
    if (state.tab === 'list') loadList();
    if (state.tab === 'coupons') loadCoupons();
    if (state.tab === 'orders') loadOrders();
  }
  function closeSheet() {
    $('#adminSheet')?.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }
  function switchTab(tab) {
    state.tab = tab;
    $$('.admin-tab').forEach(t => t.classList.toggle('is-on', t.dataset.tab === tab));
    $$('#adminBody [data-panel]').forEach(p => p.classList.toggle('hide', p.dataset.panel !== tab));
    if (tab === 'list') loadList();
    if (tab === 'coupons') { loadProductsIntoPicker(); loadCoupons(); }
    if (tab === 'orders') loadOrders();
  }

  /* ============================ الصور ============================ */
  function addFiles(files) {
    [...files].filter(f => f.type.startsWith('image/')).slice(0, 6 - state.images.length).forEach(f => {
      state.images.push({ file: f, url: URL.createObjectURL(f) });
    });
    renderPreviews();
  }
  function addGuide(f) {
    if (!f || !f.type.startsWith('image/')) return;
    state.guide = { file: f, url: URL.createObjectURL(f) };
    renderPreviews();
  }
  function renderPreviews() {
    $('#previewProducts').innerHTML = state.images.map((im, i) =>
      `<img src="${im.url}" alt="صورة ${i + 1}" title="اضغطي للحذف" data-rm="${i}">`).join('');
    $$('#previewProducts img').forEach(img => ON(img, 'click', () => {
      state.images.splice(+img.dataset.rm, 1); renderPreviews();
    }));
    $('#previewGuide').innerHTML = state.guide ? `<img src="${state.guide.url}" alt="دليل القياسات">` : '';
    ON($('#previewGuide img'), 'click', () => { state.guide = null; renderPreviews(); });
  }

  /* ============================ مقاسات/ألوان ============================ */
  function toggleSize(btn) {
    const s = btn.dataset.size || btn.textContent.trim();
    btn.dataset.size = s;
    if (state.sizes.has(s)) { state.sizes.delete(s); btn.classList.remove('is-on'); }
    else { state.sizes.add(s); btn.classList.add('is-on'); }
  }
  function toggleColor(btn) {
    const name = btn.dataset.color;
    const i = state.colors.findIndex(c => c.name === name);
    if (i >= 0) { state.colors.splice(i, 1); btn.classList.remove('is-on'); }
    else { state.colors.push({ name, hex: btn.dataset.hex }); btn.classList.add('is-on'); }
  }

  /* ============================ عرض محدود ============================ */
  function setOfferMode(onMode) {
    $$('[data-offer]').forEach(b => b.classList.toggle('is-on', b.dataset.offer === (onMode ? 'on' : 'off')));
    $('#offerFields').classList.toggle('hide', !onMode);
    updateOfferPreview();
  }
  function isOfferOn() { return $('[data-offer="on"]').classList.contains('is-on'); }
  function updateOfferPreview() {
    const cur = Number($('#fPrice').value) || 0;
    const old = Number($('#fOldPrice').value) || 0;
    $('#offerPreviewOld').textContent = old ? util.money(old) : '—';
    $('#offerPreviewNew').textContent = cur ? util.money(cur) : '—';
  }

  /* ============================ حفظ منتج ============================ */
  async function saveProduct() {
    const msg = $('#adminMsg');
    const btn = $('#saveProduct');
    const title = $('#fTitle').value.trim();
    const price = Number($('#fPrice').value);
    const oldPrice = Number($('#fOldPrice').value) || null;
    const offerOn = isOfferOn();

    if (!title) { msg.textContent = 'لازم اسم المنتج'; return toast('اكتبي اسم المنتج', 'warn'); }
    if (!price) { msg.textContent = 'لازم السعر'; return toast('اكتبي السعر', 'warn'); }
    if (!state.images.length) { msg.textContent = 'لازم صورة واحدة على الأقل'; return toast('ارفعي صورة للمنتج', 'warn'); }
    if (offerOn) {
      if (!oldPrice || oldPrice <= price) { msg.textContent = '«السعر قبل الخصم» يجب أن يكون أكبر من السعر الحالي'; return toast('راجع أسعار العرض', 'warn'); }
      if (!$('#fOfferEnds').value) { msg.textContent = 'حددي وقت انتهاء العرض'; return toast('حددي وقت انتهاء العرض', 'warn'); }
    }

    btn.disabled = true;
    msg.textContent = 'جاري رفع الصور...';
    $('#upProgress').classList.remove('hide');

    try {
      /* ارفع الجديد فقط، وخُد الموجود زي ما هو */
      const urls = [];
      const toUpload = state.images.filter(im => !im.existing);
      let done = 0;
      for (const im of state.images) {
        if (im.existing) { urls.push(im.url); continue; }
        const u = await sb.upload(CFG.BUCKET_PRODUCTS, im.file);
        urls.push(u);
        done++;
        $('#upProgress i').style.width = `${Math.round((done / Math.max(1, toUpload.length)) * 80)}%`;
      }

      let guideUrl = state.guide ? (state.guide.existing ? state.guide.url : null) : null;
      if (state.guide && !state.guide.existing) {
        msg.textContent = 'جاري رفع دليل القياسات...';
        guideUrl = await sb.upload(CFG.BUCKET_SIZES, state.guide.file);
      }

      $('#upProgress i').style.width = '92%';
      msg.textContent = state.editingId ? 'جاري حفظ التعديلات...' : 'جاري حفظ بيانات المنتج...';

      const row = {
        title,
        title_en: $('#fTitleEn').value.trim() || null,
        description: $('#fDesc').value.trim() || null,
        price,
        old_price: oldPrice,
        image_url: urls[0],
        images: urls,
        category: $('#fCategory').value || null,
        fabric: $('#fFabric').value.trim() || null,
        sizes: [...state.sizes],
        colors: state.colors,
        size_guide_url: guideUrl,
        badge: $('#fBadge').value.trim() || null,
        sort: Number($('#fSort').value) || 0,
        offer_ends_at: offerOn ? new Date($('#fOfferEnds').value).toISOString() : null,
        offer_label: offerOn ? ($('#fOfferLabel').value.trim() || null) : null
      };

      /* لو أعمدة العرض المحدود غير مضافة في القاعدة بعد → احفظ باقي البيانات */
      const save = async (payload) => state.editingId
        ? sb.update(CFG.TABLE_ITEMS, state.editingId, payload)
        : sb.insert(CFG.TABLE_ITEMS, payload);

      let saved;
      try {
        saved = await save(row);
      } catch (e1) {
        if (/offer_ends_at|offer_label/i.test(e1.message)) {
          const fallback = { ...row };
          delete fallback.offer_ends_at; delete fallback.offer_label;
          saved = await save(fallback);
          toast('تم الحفظ — شغّل supabase-update-2.sql لتفعيل العروض المحدودة', 'warn');
        } else throw e1;
      }

      toast(state.editingId ? 'تم حفظ تعديلات المنتج' : 'تم نشر المنتج', 'ok');

      $('#upProgress i').style.width = '100%';
      msg.textContent = '✓ تم الحفظ بنجاح';
      products.invalidate();

      resetForm(false);
      loadList();
      setTimeout(() => { $('#upProgress').classList.add('hide'); $('#upProgress i').style.width = '0'; }, 1000);
    } catch (err) {
      console.error(err);
      msg.textContent = '✕ ' + err.message;
      toast('فشل الحفظ: ' + err.message, 'warn');
      $('#upProgress').classList.add('hide');
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================ تعديل منتج ============================ */
  async function editProduct(id) {
    try {
      let row = state.productsCache.find(p => String(p.id) === String(id));
      if (!row) row = (await sb.select(CFG.TABLE_ITEMS, `select=*&id=eq.${encodeURIComponent(id)}`))[0];
      if (!row) return toast('المنتج غير موجود', 'warn');

      state.editingId = row.id;
      state.images = (row.images && row.images.length ? row.images : [row.image_url])
        .filter(Boolean).map(u => ({ url: u, existing: true }));
      state.guide = row.size_guide_url ? { url: row.size_guide_url, existing: true } : null;
      state.colors = Array.isArray(row.colors) ? row.colors.slice() : [];

      /* الحقول */
      $('#fTitle').value = row.title || '';
      $('#fTitleEn').value = row.title_en || '';
      $('#fPrice').value = row.price || '';
      $('#fOldPrice').value = row.old_price || '';
      $('#fCategory').value = row.category || '';
      $('#fFabric').value = row.fabric || '';
      $('#fDesc').value = row.description || '';
      $('#fBadge').value = row.badge || '';
      $('#fSort').value = row.sort || 0;

      /* المقاسات */
      state.sizes = new Set(row.sizes || []);
      $$('#sizesBox .sz').forEach(b => {
        b.classList.toggle('is-on', state.sizes.has(b.dataset.size));
      });
      [...state.sizes].forEach(s => {
        if (!$(`#sizesBox .sz[data-size="${s}"]`)) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'sz is-on'; b.dataset.size = s; b.textContent = s;
          ON(b, 'click', () => toggleSize(b));
          $('#sizesBox').appendChild(b);
        }
      });

      /* الألوان */
      $$('#colorsBox .sz').forEach(b => {
        b.classList.toggle('is-on', state.colors.some(c => c.name === b.dataset.color));
      });
      state.colors.forEach(c => {
        if (!$(`#colorsBox .sz[data-color="${c.name}"]`)) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'sz is-on'; b.style.gap = '8px';
          b.dataset.color = c.name; b.dataset.hex = c.hex;
          b.innerHTML = `<i style="width:12px;height:12px;border-radius:50%;background:${util.esc(c.hex || '#EFECE6')};display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></i>${util.esc(c.name)}`;
          ON(b, 'click', () => toggleColor(b));
          $('#colorsBox').appendChild(b);
        }
      });

      /* العرض المحدود */
      const hasOffer = !!row.offer_ends_at;
      setOfferMode(hasOffer);
      if (hasOffer) {
        const d = new Date(row.offer_ends_at);
        const pad = n => String(n).padStart(2, '0');
        $('#fOfferEnds').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        $('#fOfferLabel').value = row.offer_label || '';
      } else {
        $('#fOfferEnds').value = '';
        $('#fOfferLabel').value = '';
      }

      /* الواجهة */
      $('#editBanner').classList.remove('hide');
      $('#editName').textContent = row.title || '—';
      $('#saveProduct').textContent = 'حفظ التعديلات';
      $('.admin-tab[data-tab="new"]').textContent = 'تعديل منتج';
      renderPreviews();
      updateOfferPreview();
      switchTab('new');
      $('#adminBody').scrollTop = 0;
      toast('المنتج محمّل للتعديل', 'ok');
    } catch (e) {
      toast('تعذّر تحميل المنتج: ' + e.message, 'warn');
    }
  }

  function resetForm(notify) {
    state.editingId = null;
    state.images = []; state.guide = null; state.colors = []; state.sizes.clear();

    $$('#sizesBox .sz, #colorsBox .sz').forEach(b => b.classList.remove('is-on'));
    ['#fTitle', '#fTitleEn', '#fPrice', '#fOldPrice', '#fFabric', '#fDesc', '#fBadge', '#fOfferEnds', '#fOfferLabel']
      .forEach(s => { const el = $(s); if (el) el.value = ''; });
    $('#fSort').value = 0;
    $('#fCategory').value = '';
    setOfferMode(false);
    renderPreviews();
    updateOfferPreview();

    $('#editBanner').classList.add('hide');
    $('#saveProduct').textContent = 'نشر المنتج';
    $('.admin-tab[data-tab="new"]').textContent = 'منتج جديد';
    $('#adminMsg').textContent = '';
    if (notify) toast('تم إلغاء التعديل');
  }

  /* ============================ قائمة المنتجات ============================ */
  async function loadList() {
    const box = $('#adminList');
    box.innerHTML = '<div class="skeleton" style="height:56px"></div>';
    try {
      const rows = await sb.select(CFG.TABLE_ITEMS, 'select=*&order=created_at.desc');
      state.productsCache = rows || [];
      if (!rows?.length) { box.innerHTML = '<p class="tiny muted">لا يوجد منتجات في القاعدة بعد.</p>'; return; }
      box.innerHTML = rows.map(r => {
        const offerLive = r.old_price && r.offer_ends_at && new Date(r.offer_ends_at) > new Date();
        return `
        <div class="admin-row admin-row--edit" data-row="${util.esc(r.id)}">
          <img src="${util.img(r.image_url, true)}" alt="">
          <div>
            <b>${util.esc(r.title)}</b>
            <small>${util.money(r.price)}${r.old_price ? ' · كان ' + util.money(r.old_price) : ''} · ${util.esc(r.category || 'بدون قسم')}
              ${offerLive ? ' · <span style="color:#3F6B4F">عرض محدود</span>' : ''}</small>
          </div>
          <div class="row-actions">
            <button class="btn-mini" data-edit="${util.esc(r.id)}">تعديل</button>
            <button class="btn-mini btn-mini--danger" data-del="${util.esc(r.id)}">✕</button>
          </div>
        </div>`;
      }).join('');

      $$('[data-edit]', box).forEach(b => ON(b, 'click', e => { e.stopPropagation(); editProduct(b.dataset.edit); }));
      $$('[data-del]', box).forEach(b => ON(b, 'click', async e => {
        e.stopPropagation();
        if (!confirm('حذف المنتج نهائياً؟')) return;
        try {
          await sb.remove(CFG.TABLE_ITEMS, b.dataset.del);
          products.invalidate();
          toast('تم الحذف', 'ok');
          loadList();
        } catch (er) { toast('فشل الحذف: ' + er.message, 'warn'); }
      }));
      $$('[data-row]', box).forEach(r => ON(r, 'click', () => {}));
    } catch (e) {
      box.innerHTML = `<p class="tiny muted">تعذّر جلب القائمة: ${util.esc(e.message)}</p>`;
    }
  }

  /* ============================ الكوبونات ============================ */
  let editingCouponId = null;

  async function loadProductsIntoPicker() {
    const box = $('#cpProducts');
    if (!box) return;
    box.innerHTML = '<p class="tiny muted">جاري تحميل المنتجات...</p>';
    try {
      const rows = await sb.select(CFG.TABLE_ITEMS, 'select=*&order=created_at.desc');
      state.productsCache = rows || [];
      if (!rows?.length) { box.innerHTML = '<p class="tiny muted">لا يوجد منتجات — ضيفي منتجات الأول.</p>'; return; }
      box.innerHTML = rows.map(r => `
        <label class="cp-row">
          <input type="checkbox" value="${util.esc(r.id)}">
          <img src="${util.img(r.image_url, true)}" alt="">
          <span>${util.esc(r.title)}<small>${util.money(r.price)}</small></span>
        </label>`).join('');
      updateScopeHint();
    } catch (e) {
      box.innerHTML = `<p class="tiny muted">تعذّر تحميل المنتجات: ${util.esc(e.message)}</p>`;
    }
  }

  function selectedCouponProducts() {
    return $$('#cpProducts input:checked').map(i => i.value);
  }
  function updateScopeHint() {
    const n = selectedCouponProducts().length;
    $('#cpScopeHint').textContent = n
      ? `الكوبون ينطبق على ${n} منتج مختار.`
      : 'محدش متحدد = الكوبون ينطبق على كل المنتجات.';
  }
  function toggleAllCouponProducts() {
    const boxes = $$('#cpProducts input');
    const allOn = boxes.every(b => b.checked);
    boxes.forEach(b => b.checked = !allOn);
    updateScopeHint();
  }
  function resetCouponForm() {
    editingCouponId = null;
    ['#cpCode', '#cpPercent', '#cpEnds'].forEach(s => $(s).value = '');
    $('#cpActive').value = '1';
    $$('#cpProducts input').forEach(b => b.checked = false);
    $('#cpSave').textContent = 'حفظ الكوبون';
    $('#cpCancelEdit').classList.add('hide');
    $('#cpMsg').textContent = '';
    updateScopeHint();
  }

  async function saveCoupon() {
    const msg = $('#cpMsg');
    const code = $('#cpCode').value.trim().toUpperCase();
    const percent = Number($('#cpPercent').value);
    const active = $('#cpActive').value === '1';
    const ends = $('#cpEnds').value ? new Date($('#cpEnds').value).toISOString() : null;
    const productIds = selectedCouponProducts();

    if (!code) { msg.textContent = 'اكتبي كود الكوبون'; return toast('اكتبي الكود', 'warn'); }
    if (!percent || percent <= 0 || percent > 100) { msg.textContent = 'النسبة لازم بين 1 و 100'; return toast('نسبة غير صحيحة', 'warn'); }

    const btn = $('#cpSave');
    btn.disabled = true;
    msg.textContent = 'جاري الحفظ...';
    try {
      const row = { code, percent, product_ids: productIds, active, ends_at: ends };
      if (editingCouponId) {
        await sb.update(CFG.TABLE_COUPONS, editingCouponId, row);
        toast('تم تعديل الكوبون', 'ok');
      } else {
        await sb.insert(CFG.TABLE_COUPONS, row);
        toast('تم إضافة الكوبون', 'ok');
      }
      msg.textContent = '✓ تم الحفظ';
      resetCouponForm();
      loadCoupons();
    } catch (e) {
      const m = /duplicate|unique/i.test(e.message)
        ? 'الكود ده مستخدم بالفعل — اختاري كود تاني'
        : /coupons/i.test(e.message)
          ? 'شغّل supabase-update-2.sql الأول لتفعيل الكوبونات'
          : e.message;
      msg.textContent = '✕ ' + m;
      toast('فشل: ' + m, 'warn');
    } finally {
      btn.disabled = false;
    }
  }

  async function loadCoupons() {
    const box = $('#cpList');
    if (!box) return;
    box.innerHTML = '<div class="skeleton" style="height:64px"></div>';
    try {
      const rows = await sb.select(CFG.TABLE_COUPONS, 'select=*&order=created_at.desc');
      state.couponsCache = rows || [];
      $('#couponsCnt').textContent = (rows || []).filter(r => r.active).length;

      if (!rows?.length) { box.innerHTML = '<p class="tiny muted">لا يوجد كوبونات بعد.</p>'; return; }

      box.innerHTML = rows.map(c => {
        const expired = c.ends_at && new Date(c.ends_at) < new Date();
        const scope = (c.product_ids && c.product_ids.length)
          ? `${c.product_ids.length} منتج`
          : 'كل المنتجات';
        return `
        <div class="coupon-card ${(!c.active || expired) ? 'is-off' : ''}">
          <div>
            <div class="cc-code">${util.esc(c.code)}
              ${!c.active ? '<span class="badge" style="font-size:10px">موقوف</span>' : ''}
              ${expired ? '<span class="badge" style="font-size:10px">منتهي</span>' : ''}
            </div>
            <div class="cc-meta">
              ${scope}${c.ends_at ? ' · ينتهي ' + new Date(c.ends_at).toLocaleDateString('ar-EG') : ' · بدون نهاية'}
            </div>
            <div class="row-actions" style="margin-top:8px">
              <button class="btn-mini" data-cp-edit="${util.esc(c.id)}">تعديل</button>
              <button class="btn-mini" data-cp-toggle="${util.esc(c.id)}">${c.active ? 'إيقاف' : 'تفعيل'}</button>
              <button class="btn-mini btn-mini--danger" data-cp-del="${util.esc(c.id)}">حذف</button>
            </div>
          </div>
          <div class="cc-pct">${Number(c.percent)}%</div>
        </div>`;
      }).join('');

      $$('[data-cp-edit]', box).forEach(b => ON(b, 'click', () => {
        const c = state.couponsCache.find(x => String(x.id) === String(b.dataset.cpEdit));
        if (!c) return;
        editingCouponId = c.id;
        $('#cpCode').value = c.code;
        $('#cpPercent').value = Number(c.percent);
        $('#cpActive').value = c.active ? '1' : '0';
        $('#cpEnds').value = c.ends_at ? c.ends_at.slice(0, 16) : '';
        $$('#cpProducts input').forEach(i => { i.checked = (c.product_ids || []).includes(i.value); });
        updateScopeHint();
        $('#cpSave').textContent = 'حفظ التعديلات';
        $('#cpCancelEdit').classList.remove('hide');
        toast('الكوبون محمّل للتعديل');
        $('#adminBody').scrollTop = 0;
      }));

      $$('[data-cp-toggle]', box).forEach(b => ON(b, 'click', async () => {
        const c = state.couponsCache.find(x => String(x.id) === String(b.dataset.cpToggle));
        if (!c) return;
        try {
          await sb.update(CFG.TABLE_COUPONS, c.id, { active: !c.active });
          loadCoupons();
          toast(!c.active ? 'تم تفعيل الكوبون' : 'تم إيقاف الكوبون');
        } catch (e) { toast('فشل: ' + e.message, 'warn'); }
      }));

      $$('[data-cp-del]', box).forEach(b => ON(b, 'click', async () => {
        if (!confirm('حذف الكوبون؟')) return;
        try {
          await sb.remove(CFG.TABLE_COUPONS, b.dataset.cpDel);
          loadCoupons();
          toast('تم حذف الكوبون', 'ok');
        } catch (e) { toast('فشل: ' + e.message, 'warn'); }
      }));
    } catch (e) {
      const missing = /coupons/i.test(e.message);
      box.innerHTML = `<p class="tiny muted">${missing
        ? 'نظام الكوبونات غير مفعّل بعد — شغّل ملف <b class="en">supabase-update-2.sql</b> في SQL Editor وتشتغل هذه الخانة فوراً.'
        : 'تعذّر جلب الكوبونات: ' + util.esc(e.message)}</p>`;
    }
  }

  /* ============================ الطلبات ============================ */
  async function loadOrders() {
    const box = $('#ordersList');
    box.innerHTML = '<div class="skeleton" style="height:56px"></div>';
    try {
      const rows = await sb.select(CFG.TABLE_ORDERS, 'select=*&order=created_at.desc&limit=30');
      if (!rows?.length) { box.innerHTML = '<p class="tiny muted">لا يوجد طلبات محفوظة.</p>'; return; }
      box.innerHTML = rows.map(o => `
        <div class="admin-row" style="grid-template-columns:1fr auto">
          <div>
            <b>${util.esc(o.customer_name)} · ${util.esc(o.phone)}</b>
            <small>${util.esc(o.code || '')} — ${util.money(o.total)}${o.coupon_code ? ' · كوبون ' + util.esc(o.coupon_code) : ''} — ${util.esc(o.payment_method || '')}</small>
          </div>
          <small class="muted">${new Date(o.created_at).toLocaleDateString('ar-EG')}</small>
        </div>`).join('');
    } catch (e) {
      box.innerHTML = `<p class="tiny muted">تعذّر جلب الطلبات: ${util.esc(e.message)}</p>`;
    }
  }
})();
