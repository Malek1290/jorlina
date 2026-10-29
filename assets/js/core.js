/* ============================================================
   CLOTHINA — CORE (ES6+)
   Supabase · Admin · Cart · Products · UI helpers
   لا حاجة لتعديل أي شيء هنا — كل الإعدادات في config.js
   ============================================================ */
(() => {
  'use strict';

  const CFG = window.JL_CONFIG || {};
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ON = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* ==========================================================
     0) أدوات عامة
     ========================================================== */
  const util = {
    esc(str = '') {
      return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    money(n) {
      const v = Number(n) || 0;
      return v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + (CFG.CURRENCY || 'EGP');
    },
    /** Format deposit amount */
    moneyAr(n) { return this.money(n); },
    uid() {
      return 'ORD-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    },
    slugify(s = '') {
      return s.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '');
    },
    debounce(fn, t = 180) {
      let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), t); };
    },
    params() { return new URLSearchParams(location.search); },
    img(url, small) {
      if (!url) url = 'assets/img/p1.jpg';
      if (!/^assets\/img\/[^/]+\.jpg$/i.test(url)) return url;
      // Serve responsive WebP derivatives for local catalog images; remote uploads are untouched.
      const local = small ? url.replace('assets/img/', 'assets/img/thumbs/') : url;
      return local.replace(/\.jpg$/i, '.webp');
    }
  };

  /* ==========================================================
     1) Supabase — عميل خفيف مبني على fetch (بدون مكتبات)
     ========================================================== */
  const sb = {
    url: (CFG.SUPABASE_URL || '').replace(/\/$/, ''),
    key: CFG.SUPABASE_KEY || '',

    headers(extra = {}) {
      const h = {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        ...extra
      };
      // رمز الآدمن يتبعت فقط لو الوضع أدمن مفعّل في المتصفح
      if (admin.isAdmin()) h['x-jl-admin'] = CFG.ADMIN_TOKEN;
      return h;
    },

    async req(path, { method = 'GET', body, headers, raw = false } = {}) {
      if (!this.url || !this.key) throw new Error('Supabase configuration is missing');
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: this.headers(headers),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        let msg = res.status + ' ' + res.statusText;
        try { const j = await res.json(); msg = j.message || j.error || msg; } catch (_) {}
        throw new Error(englishField(msg, `${res.status} ${res.statusText}`));
      }
      if (raw) return res;
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    },

    select(table, query = 'select=*') {
      return this.req(`/rest/v1/${table}?${query}`);
    },
    insert(table, rows) {
      return this.req(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'return=representation' } });
    },
    update(table, id, patch) {
      return this.req(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' }
      });
    },
    remove(table, id) {
      return this.req(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async upload(bucket, file, onProgress) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await fetch(`${this.url}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'false',
          ...(admin.isAdmin() ? { 'x-jl-admin': CFG.ADMIN_TOKEN } : {})
        },
        body: file
      });
      if (!res.ok) {
        let msg = 'Image upload failed';
        try { const j = await res.json(); msg = j.message || msg; } catch (_) {}
        throw new Error(englishField(msg, 'Image upload failed'));
      }
      if (onProgress) onProgress(100);
      return this.publicUrl(bucket, path);
    },
    publicUrl(bucket, path) {
      return `${this.url}/storage/v1/object/public/${bucket}/${path}`;
    }
  };

  /* ==========================================================
     2) نظام حماية الآدمن (Token + localStorage)
     ========================================================== */
  const admin = {
    isAdmin() {
      try { return localStorage.getItem(CFG.ADMIN_STORAGE_KEY) === 'granted'; }
      catch (_) { return false; }
    },
    enable(token) {
      if (token && token === CFG.ADMIN_TOKEN) {
        try { localStorage.setItem(CFG.ADMIN_STORAGE_KEY, 'granted'); } catch (_) {}
        return true;
      }
      return false;
    },
    disable() {
      try { localStorage.removeItem(CFG.ADMIN_STORAGE_KEY); } catch (_) {}
    },
    /** يتعامل مع ?admin=TOKEN في الرابط ثم يمسحه من شريط العنوان */
    handleUrl() {
      const p = util.params();
      const tok = p.get('admin');
      if (!tok) return;
      if (tok === 'off' || tok === 'logout') {
        this.disable();
      } else if (this.enable(tok)) {
        util.toast('Admin mode enabled in this browser.', 'ok');
      }
      p.delete('admin');
      const q = p.toString();
      history.replaceState({}, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
  };

  /* ==========================================================
     3) السلة (localStorage)
     ========================================================== */
  const cart = {
    key: 'jl_cart_v1',
    get() {
      try { return (JSON.parse(localStorage.getItem(this.key)) || []).map(i => ({
        ...i,
        title: englishField(i.title_en || i.title, 'CLOTHINA piece'),
        size: englishField(i.size, 'Custom'),
        color: englishField(i.color, 'Color')
      })); }
      catch (_) { return []; }
    },
    save(items) {
      try { localStorage.setItem(this.key, JSON.stringify(items)); } catch (_) {}
      document.dispatchEvent(new CustomEvent('jl:cart', { detail: items }));
      this.badge();
    },
    keyOf(i) { return `${i.id}__${i.size || ''}__${i.color || ''}`; },
    add(item) {
      const items = this.get();
      const k = this.keyOf(item);
      const found = items.find(x => this.keyOf(x) === k);
      if (found) found.qty = Math.min(99, (found.qty || 1) + (item.qty || 1));
      else items.push({ ...item, qty: item.qty || 1 });
      this.save(items);
      return items;
    },
    remove(key) { this.save(this.get().filter(i => this.keyOf(i) !== key)); },
    setQty(key, qty) {
      const items = this.get();
      const it = items.find(i => this.keyOf(i) === key);
      if (!it) return;
      it.qty = Math.max(1, Math.min(99, qty));
      this.save(items);
    },
    clear() { this.save([]); },
    count() { return this.get().reduce((s, i) => s + (i.qty || 1), 0); },
    subtotal() { return this.get().reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0); },
    shipping() { return Number(CFG.SHIPPING) || 0; },
    discount() { return coupons.breakdown(this.get()).discount; },
    total() { return Math.max(0, this.subtotal() - this.discount() + this.shipping()); },
    badge() {
      const n = this.count();
      $$('.cart-count').forEach(el => {
        el.textContent = n > 99 ? '99+' : n;
        el.classList.toggle('on', n > 0);
      });
    }
  };

  /* ==========================================================
     3.b) محرّك الأسعار: عرض الفترة المحدودة
     ========================================================== */
  const offer = {
    isPriceOffer(p)  { return !!(p.old_price && Number(p.old_price) > Number(p.price)); },
    isTimed(p)       { return !!(offer.isPriceOffer(p) && p.offer_ends_at); },
    endsAt(p)        { return p.offer_ends_at ? new Date(p.offer_ends_at) : null; },
    isLive(p) {
      if (!offer.isTimed(p)) return offer.isPriceOffer(p);
      const end = offer.endsAt(p);
      return end && end.getTime() > Date.now();
    },
    pct(p) {
      if (!offer.isPriceOffer(p)) return 0;
      return Math.round((1 - Number(p.price) / Number(p.old_price)) * 100);
    },
    /** يرجع الحالة الحالية: عرض فعّال / منتهي / بدون عرض */
    state(p) {
      if (!offer.isPriceOffer(p)) return 'none';
      if (!offer.isTimed(p)) return 'live';
      const end = offer.endsAt(p);
      if (end && end.getTime() <= Date.now()) return 'expired';
      return 'live';
    },
    /** سعر البيع الفعلي للعميل */
    price(p) {
      if (offer.state(p) === 'live') return Number(p.price);
      if (offer.state(p) === 'expired' && p.old_price) return Number(p.price); // السعر يفضل زي ما هو
      return Number(p.price);
    },
    /** عدّاد تنازلي نصي */
    countdown(endDate) {
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      let diff = Math.max(0, end.getTime() - Date.now());
      if (!diff) return '';
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 1) return `${d} days ${h} hours`;
      if (d === 1) return `${h} hours ${m} minutes`;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  };

  /* ==========================================================
     3.c) الكوبونات (Coupon / Discount)
     ========================================================== */
  const COUPON_KEY = 'jl_coupon_v1';

  const coupons = {
    /** الكوبون المحفوظ في المتصفح (بعد التحقق) */
    get() {
      try {
        const c = JSON.parse(localStorage.getItem(COUPON_KEY));
        if (!c || !c.code) return null;
        if (c.ends_at && new Date(c.ends_at).getTime() <= Date.now()) { this.clear(); return null; }
        return c;
      } catch (_) { return null; }
    },
    save(c) { try { localStorage.setItem(COUPON_KEY, JSON.stringify(c)); } catch (_) {} },
    clear() {
      try { localStorage.removeItem(COUPON_KEY); } catch (_) {}
      document.dispatchEvent(new CustomEvent('jl:coupon', { detail: null }));
    },

    /** التحقق من الكود عبر Supabase (dالة validate_coupon) */
    async validate(code) {
      const c = String(code || '').trim().toUpperCase();
      if (!c) throw new Error('Enter a discount code.');

      // وضع العرض التجريبي (بدون قاعدة بيانات)
      if (coupons.demoMode()) {
        const demo = { CLOTHINA10: 10, WELCOME15: 15, SALE20: 20 };
        if (!demo[c]) throw new Error('Invalid or expired code.');
        const res = { ok: true, code: c, percent: demo[c], product_ids: [], ends_at: null, demo: true };
        this.save(res);
        document.dispatchEvent(new CustomEvent('jl:coupon', { detail: res }));
        return res;
      }

      let data;
      try {
        data = await sb.req('/rest/v1/rpc/validate_coupon', { method: 'POST', body: { p_code: c } });
      } catch (e) {
        const missing = /schema cache|does not exist|not find the function/i.test(e.message);
        if (missing) {
          // نظام الكوبونات غير مفعّل بعد على القاعدة → أكواد تجريبية للعرض
          const demo = { CLOTHINA10: 10, WELCOME15: 15, SALE20: 20 };
          if (!demo[c]) throw new Error('Invalid code. Demo code: CLOTHINA10');
          const res = { ok: true, code: c, percent: demo[c], product_ids: [], ends_at: null, demo: true };
          this.save(res);
          document.dispatchEvent(new CustomEvent('jl:coupon', { detail: res }));
          console.warn('[CLOTHINA] وضع كوبونات تجريبي — شغّل supabase-update-2.sql');
          return res;
        }
        throw new Error('Could not verify the code. Please try again.');
      }
      if (!data || !data.ok) throw new Error(englishField(data?.message, 'Invalid or expired code.'));

      const res = { ...data, product_ids: data.product_ids || [] };
      this.save(res);
      document.dispatchEvent(new CustomEvent('jl:coupon', { detail: res }));
      return res;
    },

    demoMode() { return !!(window.__JL_DEMO__); },

    /** هل الكوبون ينطبق على هذا المنتج؟ */
    applies(c, item) {
      if (!c) return false;
      if (!c.product_ids || !c.product_ids.length) return true;
      return c.product_ids.includes(String(item.id));
    },

    /** تفصيل الSave على السلة: { eligible, discount, percent } */
    breakdown(items = cart.get()) {
      const c = this.get();
      if (!c) return { coupon: null, eligible: 0, discount: 0, percent: 0 };
      const eligible = items.reduce((sum, i) => {
        if (!this.applies(c, i)) return sum;
        return sum + (Number(i.price) || 0) * (Number(i.qty) || 1);
      }, 0);
      const percent = Number(c.percent) || 0;
      const discount = Math.round(eligible * percent) / 100;
      return { coupon: c, eligible, discount, percent };
    }
  };

  /* ==========================================================
     4) المنتجات (Supabase + Demo fallback)
     ========================================================== */
  const DEMO = [
    {
      id: 'demo-1', title: 'Celine', title_en: 'CELINE', price: 4200, old_price: 4800,
      description: 'A polished everyday look in a soft oversized hoodie and easy, well-cut trousers.',
      image_url: 'assets/img/p1.jpg', images: ['assets/img/p1.jpg'],
      category: 'Hoodies', fabric: 'Soft knit', badge: 'Bestseller',
      sizes: ['S', 'M', 'L', 'XL'], colors: [{ name: 'Ivory', hex: '#EFECE6' }]
    },
    {
      id: 'demo-2', title: 'Lea', title_en: 'LEA', price: 3600, old_price: null,
      description: 'A relaxed oversized hoodie paired with comfortable, neatly tailored trousers.',
      image_url: 'assets/img/p2.jpg', images: ['assets/img/p2.jpg'],
      category: 'Trousers', fabric: 'Soft knit', badge: 'New',
      sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: [{ name: 'Cocoa', hex: '#8A8C7F' }]
    },
    {
      id: 'demo-3', title: 'Noor', title_en: 'NOOR', price: 2850, old_price: null,
      description: 'An easy casual outfit in warm neutral tones, designed for comfort throughout the day.',
      image_url: 'assets/img/p3.jpg', images: ['assets/img/p3.jpg'],
      category: 'Casualwear', fabric: 'Cotton blend', badge: '',
      sizes: ['S', 'M', 'L'], colors: [{ name: 'Sand', hex: '#D9CDBB' }]
    },
    {
      id: 'demo-4', title: 'Veronique', title_en: 'VERONIQUE', price: 3900, old_price: 4400,
      description: 'A timeless dark-toned casual set with a roomy top and a clean, flattering silhouette.',
      image_url: 'assets/img/p4.jpg', images: ['assets/img/p4.jpg'],
      category: 'Casualwear', fabric: 'Cotton blend', badge: 'Limited pieces',
      sizes: ['S', 'M', 'L', 'XL'], colors: [{ name: 'Espresso', hex: '#1A1A1A' }]
    },
    {
      id: 'demo-5', title: 'Aria', title_en: 'ARIA', price: 8600, old_price: null,
      description: 'A soft ivory hoodie and well-fitting trousers create an effortless, polished everyday look.',
      image_url: 'assets/img/p5.jpg', images: ['assets/img/p5.jpg'],
      category: 'Trousers', fabric: 'Cotton blend', badge: 'Atelier pick',
      sizes: ['XS', 'S', 'M', 'L', 'Custom'], colors: [{ name: 'Ivory', hex: '#F4F1EA' }]
    }
  ];

  const FIELD_TRANSLATIONS = {
    'فساتين سهرة': 'Eveningwear', 'فساتين زفاف': 'Bridal', 'فساتين كاجوال': 'Casualwear',
    'عبايات': 'Abayas', 'إطلالات': 'Looks', 'ساتان حريري': 'Silk satin', 'كريب مطفي': 'Matte crepe',
    'شيفون': 'Chiffon', 'مخمل': 'Velvet', 'ساتان لؤلؤي': 'Pearl satin',
    'الكود غير صحيح أو منتهي الصلاحية': 'Invalid or expired code.',
    'الأكثر طلباً': 'Bestseller', 'جديد': 'New', 'آخر قطعتين': 'Last two', 'أتيليه': 'Atelier pick',
    'أوف وايت': 'Ivory', 'بيج رملي': 'Sand', 'زيتوني': 'Olive', 'أسود': 'Black', 'مقاس خاص': 'Custom'
  };
  const englishField = (value, fallback = '') => {
    if (!value) return fallback;
    const text = String(value);
    if (FIELD_TRANSLATIONS[text]) return FIELD_TRANSLATIONS[text];
    return /[\u0600-\u06ff]/.test(text) ? fallback : text;
  };

  function normalize(row) {
    const images = (row.images && row.images.length ? row.images : [row.image_url]).filter(Boolean);
    return {
      ...row,
      id: row.id,
      title: englishField(row.title, '') || englishField(row.title_en, 'CLOTHINA piece'),
      title_en: row.title_en || '',
      price: Number(row.price) || 0,
      old_price: row.old_price ? Number(row.old_price) : null,
      image_url: row.image_url || images[0],
      images,
      sizes: (row.sizes && row.sizes.length ? row.sizes : CFG.DEFAULT_SIZES).map(s => englishField(s, 'Custom')),
      colors: (row.colors && row.colors.length ? row.colors.map(c => ({ ...c, name: englishField(c.name, 'Color') })) : []),
      category: englishField(row.category, 'Clothing'),
      fabric: englishField(row.fabric, 'Selected fabric'),
      description: englishField(row.description, 'A thoughtfully designed CLOTHINA piece with a comfortable fit and considered details.'),
      badge: englishField(row.badge, ''),
      size_guide_url: row.size_guide_url || ''
    };
  }

  let _productsCache = null;
  const products = {
    async all({ force = false } = {}) {
      if (_productsCache && !force) return _productsCache;
      let rows = [];
      try {
        rows = await sb.select(CFG.TABLE_ITEMS, 'select=*&order=sort.asc,created_at.desc');
        rows = (rows || []).filter(r => r.is_active !== false);
      } catch (err) {
        console.warn('[CLOTHINA] Supabase unavailable — using demo products.', err.message);
        rows = [];
      }
      window.__JL_DEMO__ = rows.length === 0;
      _productsCache = rows.length ? rows.map(normalize) : DEMO;
      return _productsCache;
    },
    async one(id) {
      const list = await this.all();
      return list.find(p => String(p.id) === String(id)) || null;
    },
    invalidate() { _productsCache = null; }
  };

  /* ==========================================================
     5) واجهة: Toast / Modal / Loader / Reveal
     ========================================================== */
  function toast(msg, kind = '') {
    let wrap = $('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast ' + (kind ? 'toast--' + kind : '');
    el.innerHTML = `<span>${util.esc(msg)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 450); }, 3200);
  }
  util.toast = toast;

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('is-open');
    document.body.classList.add('is-locked');
  }
  function closeModal(el) {
    const m = typeof el === 'string' ? document.getElementById(el) : el;
    if (!m) return;
    m.classList.remove('is-open');
    if (!$$('.modal.is-open').length) document.body.classList.remove('is-locked');
  }
  const modal = { open: openModal, close: closeModal };

  /* ---------- Loader ---------- */
  function loader() {
    const el = $('#jl-loader');
    if (!el) return Promise.resolve();

    const pctEl = $('.jl-loader-pct', el);
    const mark = $('.jl-loader-logo', el) || $('.jl-loader-mark', el);
    const bar = $('.jl-loader-bar', el);
    const started = Date.now();
    let p = 0;
    let done = false;
    let assetsReady = false;
    let finishScheduled = false;
    let resolveLoader;
    const finished = new Promise(resolve => { resolveLoader = resolve; });

    // The loader must never block the shop, even if an animation or asset fails.
    const watchdog = setTimeout(() => finish(), 5000);
    const tick = setInterval(() => {
      p = Math.min(92, p + Math.random() * 11);
      if (pctEl) pctEl.textContent = String(Math.round(p)).padStart(2, '0') + '%';
    }, 110);

    if (mark) {
      mark.style.opacity = '1';
      mark.style.visibility = 'visible';
    }

    const revealPage = () => {
      if (el.isConnected) el.remove();
      document.documentElement.classList.add('is-ready');
      revealInit();
      resolveLoader();
    };

    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(tick);
      clearTimeout(watchdog);
      if (pctEl) pctEl.textContent = '100%';

      const out = () => {
        if (!el.isConnected) return revealPage();
        // Keep the loader independent of GSAP; a failed optional animation must never block entry.
        el.classList.add('is-leaving');
        setTimeout(revealPage, 800);
      };
      setTimeout(out, 180);
    };

    const tryFinish = () => {
      if (!assetsReady || finishScheduled || done) return;
      finishScheduled = true;
      const minDuration = 1050;
      setTimeout(finish, Math.max(0, minDuration - (Date.now() - started)));
    };
    const markReady = () => {
      assetsReady = true;
      tryFinish();
    };

    // The logo and progress bar use CSS; do not pass optional/missing nodes into GSAP.
    [mark, bar, pctEl].filter(Boolean).forEach(node => {
      node.style.opacity = '1';
      node.style.visibility = 'visible';
    });

    const heroImg = document.querySelector('.hero-background img');
    if (heroImg && !heroImg.complete) {
      ON(heroImg, 'load', markReady, { once: true });
      ON(heroImg, 'error', markReady, { once: true });
    }
    if (document.readyState === 'complete') markReady();
    else ON(window, 'load', markReady, { once: true });

    // If the page's load event never arrives, stop waiting for assets after 2 seconds.
    setTimeout(() => {
      if (!assetsReady) markReady();
    }, 2000);

    return finished;
  }

  /* ---------- Native, low-cost scroll reveal ---------- */
  let revealed = false;
  let revealObserver = null;
  function revealWithin(scope = document) {
    const selector = '.reveal, .reveal-lines';
    const els = scope.matches?.(selector) ? [scope, ...$$(selector, scope)] : $$(selector, scope);
    if (!els.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const delay = Math.max(0, Math.min(parseFloat(el.dataset.delay || 0), .5));
          el.style.setProperty('--reveal-delay', `${delay}s`);
          el.classList.add('is-visible');
          revealObserver.unobserve(el);
        });
      }, { threshold: .08, rootMargin: '0px 0px -32px 0px' });
    }
    els.forEach(el => {
      if (!el.classList.contains('is-visible')) revealObserver.observe(el);
    });
  }
  function revealInit() {
    if (revealed) return;
    revealed = true;
    revealWithin(document);
  }

  /* ==========================================================
     6) الهيدر / الفوتر (يتم حقنهم في كل الصفحات)
     ========================================================== */
  const logoSVG = `
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="47" stroke="currentColor" stroke-width="1.2" opacity=".4"/>
      <circle cx="50" cy="50" r="41" stroke="currentColor" stroke-width=".7" opacity=".25"/>
      <path d="M63.5 27.5v30.2c0 9.6-6.6 16.3-16.2 16.3-8 0-13.6-4.4-15-11.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M57 27.5h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;

  const LOGO_WORD = 'assets/img/brand/clothina-wordmark-white.png';
  const LOGO_WORD_LIGHT = 'assets/img/brand/clothina-wordmark-white.png';

  const icons = {
    cash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="19" height="11" rx="2.2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/></svg>`,
    cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1.2 12.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7Z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 8h16M4 15h16"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/></svg>`,
    /* أيقونة Administrator (شخص بتاج/شيلد إداري) */
    admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8.4" r="3.4"/>
      <path d="M5.2 20.2c.7-3.5 3.3-5.6 6.8-5.6 3.5 0 6.1 2.1 6.8 5.6"/>
      <path d="M8.7 3.1l1.3 1.3 2-2 2 2 1.3-1.3.7 3.1H8l.7-3.1Z"/>
    </svg>`,
    /* بديل مبسّط: شيلد + شخص */
    adminBadge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3.2 5.4 6v5.1c0 4 2.7 7.5 6.6 9.7 3.9-2.2 6.6-5.7 6.6-9.7V6L12 3.2Z"/>
      <circle cx="12" cy="10.4" r="2.1"/>
      <path d="M8.9 16.1c.5-1.7 1.7-2.6 3.1-2.6s2.6.9 3.1 2.6"/>
    </svg>`
  };

  const COOKIE_CONSENT_KEY = 'clothina_cookie_consent';
  function initCookieConsent() {
    if (document.getElementById('cookieConsent')) return;
    const savedChoice = () => {
      try {
        const entry = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_CONSENT_KEY}=`));
        if (entry) return decodeURIComponent(entry.slice(COOKIE_CONSENT_KEY.length + 1));
      } catch (_) {}
      try { return localStorage.getItem(COOKIE_CONSENT_KEY) || ''; } catch (_) { return ''; }
    };
    const hasChoice = ['all', 'essential'].includes(savedChoice());
    const banner = document.createElement('section');
    banner.id = 'cookieConsent';
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie preferences');
    banner.hidden = hasChoice;
    banner.innerHTML = `
      <div class="cookie-consent-copy">
        <strong>Cookie preferences</strong>
        <p>Essential browser storage keeps your shopping bag and checkout working. We do not currently use analytics or advertising cookies. Third-party security cookies are controlled by their service and your browser.</p>
      </div>
      <div class="cookie-consent-actions">
        <button type="button" class="cookie-accept" data-cookie-choice="all">Accept all</button>
        <button type="button" class="cookie-essential" data-cookie-choice="essential">Essential only</button>
      </div>`;
    document.body.appendChild(banner);

    const saveChoice = choice => {
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      try { document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(choice)}; Expires=${expiry}; Path=/; SameSite=Lax${secure}`; } catch (_) {}
      try { localStorage.setItem(COOKIE_CONSENT_KEY, choice); } catch (_) {}
      banner.hidden = true;
    };
    banner.querySelectorAll('[data-cookie-choice]').forEach(button => {
      ON(button, 'click', () => saveChoice(button.dataset.cookieChoice));
    });
    $$('[data-cookie-settings]').forEach(button => ON(button, 'click', () => {
      banner.hidden = false;
      banner.querySelector('[data-cookie-choice="all"]')?.focus();
    }));
  }

  function chrome() {
    const page = document.body.dataset.page || 'home';
    const header = `
      <div class="announce">
        <span>Fresh drops · ${util.esc(CFG.FREE_SHIPPING_NOTE)}</span>
        <span class="en" style="margin-inline-start:14px">CLOTHINA STREETWEAR</span>
      </div>
      <header class="site-header" id="siteHeader">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="CLOTHINA">
            <img class="brand-logo" src="${LOGO_WORD}" alt="CLOTHINA" width="590" height="70">
          </a>
          <nav class="nav" aria-label="Main menu">
            <a href="index.html" class="${page === 'home' ? 'is-active' : ''}">Home</a>
            <a href="shop.html" class="${page === 'shop' ? 'is-active' : ''}">Shop</a>
            <a href="index.html#collections">Collections</a>
            <a href="index.html#story">About CLOTHINA</a>
            <a href="index.html#contact">Contact</a>
          </nav>
          <div class="header-actions">
            <button class="icon-btn burger" id="burgerBtn" aria-label="Menu">${icons.menu}</button>
                     <button class="icon-btn" type="button" id="cartDrawerOpen" aria-label="Open shopping bag" aria-controls="cartDrawer" aria-expanded="false">
              ${icons.cart}<span class="cart-count">0</span>
            </button>
          </div>
        </div>
      </header>
      <div class="mobile-nav" id="mobileNav">
        <button class="icon-btn close-m" id="closeMobile" aria-label="Close">${icons.close}</button>
        <a href="index.html">Home</a>
        <a href="shop.html">Shop</a>
        <a href="index.html#collections">Collections</a>
        <a href="index.html#story">About CLOTHINA</a>
        <a href="cart.html">Shopping bag</a>
        <a href="index.html#contact">Contact</a>
      </div>`;

    const footer = `
      <footer class="site-footer" id="contact">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="brand">
                <img class="brand-logo" src="${LOGO_WORD_LIGHT}" alt="CLOTHINA" width="590" height="70">
              </div>
              <p>Everyday streetwear, easy layers, oversized fits, and comfortable essentials made for life in Cairo.</p>
            </div>
            <div>
              <h4>Shop</h4>
              <ul>
                <li><a href="shop.html">Shop all</a></li>
                <li><a href="shop.html?cat=${encodeURIComponent('Hoodies')}">Hoodies</a></li>
                <li><a href="shop.html?cat=${encodeURIComponent('Trousers')}">Trousers</a></li>
                <li><a href="shop.html?cat=${encodeURIComponent('Casualwear')}">Casualwear</a></li>
              </ul>
            </div>
            <div>
              <h4>Help</h4>
              <ul>
                <li><a href="cart.html">Shopping bag</a></li>
                <li><a href="#" data-open-guide>Size guide</a></li>
                <li><a href="#" data-open-shipping>Delivery & returns</a></li>
                <li><button class="cookie-settings" type="button" data-cookie-settings>Cookie settings</button></li>
              </ul>
            </div>
            <div>
              <h4>Contact us</h4>
              <ul>
                <li><a href="https://wa.me/${CFG.WHATSAPP_NUMBER}" target="_blank" rel="noopener">WhatsApp · 01040124131</a></li>
                <li><a href="${CFG.TIKTOK}" target="_blank" rel="noopener">TikTok · ${CFG.TIKTOK_HANDLE}</a></li>
                <li><span>${CFG.CITY}</span></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span class="en">© ${new Date().getFullYear()} CLOTHINA — STREETWEAR FOR EVERY DAY</span>
            <span>Made with care <i class="admin-dot" id="adminDot" title="·"></i></span>
          </div>
        </div>
      </footer>`;

    const hHost = document.getElementById('site-header');
    if (hHost) hHost.innerHTML = header;
    const fHost = document.getElementById('site-footer');
    if (fHost) fHost.innerHTML = footer;
    initCookieConsent();
    initCartDrawer();

    // burger
    ON($('#burgerBtn'), 'click', () => $('#mobileNav')?.classList.add('is-open'));
    ON($('#closeMobile'), 'click', () => $('#mobileNav')?.classList.remove('is-open'));
    $$('#mobileNav a').forEach(a => ON(a, 'click', () => $('#mobileNav').classList.remove('is-open')));

    // sticky header
    const hd = $('#siteHeader');
    const onScroll = () => hd?.classList.toggle('is-stuck', window.scrollY > 8);
    ON(window, 'scroll', onScroll, { passive: true }); onScroll();

    cart.badge();
    ON(document, 'jl:cart', () => cart.badge());
    initCountdowns();

    // زر واتساب عائم
    if (!document.getElementById('waFab')) {
      const a = document.createElement('a');
      a.id = 'waFab'; a.className = 'wa-fab';
      a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', 'Contact us on WhatsApp');
      a.href = waLink('Hello CLOTHINA ✦ I have a question');
      a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.7A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.6 9.4c.4 2.2 2 3.8 4.2 4.2l1-1.2 1.8.7c-.3 1.2-1.4 1.9-2.6 1.8-2.9-.3-5.2-2.6-5.5-5.5-.1-1.2.6-2.3 1.8-2.6l.7 1.8-1.4.8Z"/></svg>`;
      document.body.appendChild(a);
    }
  }

  /* ==========================================================
     7) واتساب — رسالة الطلب الكاملة
     ========================================================== */
  function buildOrderMessage(order) {
    const L = [];
    L.push('✦ NEW CLOTHINA ORDER ✦');
    L.push('Order number: ' + order.code);
    L.push('');
    L.push('— CUSTOMER DETAILS —');
    L.push('Name: ' + order.name);
    L.push('Phone: ' + order.phone);
    if (order.city) L.push('City: ' + order.city);
    if (order.address) L.push('Address: ' + order.address);
    L.push('');
    L.push('— ITEMS —');
    order.items.forEach((i, n) => {
      L.push(`${n + 1}) ${i.title}${i.title_en ? ' / ' + i.title_en : ''}`);
      if (i.size) L.push('   Size: ' + i.size);
      if (i.color) L.push('   Color: ' + i.color);
      L.push('   Qty: ' + (i.qty || 1) + ' — Price: ' + util.money((i.price || 0) * (i.qty || 1)));
      if (i.note) L.push('   Note: ' + i.note);
    });
    L.push('');

    /* قسم المقاسات (اختياري) — يروح مع الرسالة */
    const mes = order.measurements || {};
    const mKeys = [
      ['height', 'Height'], ['bust', 'Bust'], ['waist', 'Waist'],
      ['hips', 'Hips'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['notes', 'Fit notes']
    ];
    const mFilled = mKeys.filter(([k]) => mes[k]);
    const mImages = mes.images || [];
    if (mFilled.length || mImages.length) {
      L.push('— MEASUREMENTS (OPTIONAL) —');
      mFilled.forEach(([k, label]) => L.push(`${label}: ${mes[k]}${['height', 'bust', 'waist', 'hips', 'shoulder', 'sleeve'].includes(k) ? ' cm' : ''}`));
      if (mImages.length) {
        L.push('Measurement photos:');
        mImages.forEach((u, n) => L.push(`${n + 1}) ${u}`));
      }
      L.push('');
    }

    if (order.subtotal != null) L.push('Subtotal: ' + util.money(order.subtotal));
    if (order.couponCode || order.discount) {
      L.push(`Discount${order.couponCode ? ' (coupon ' + order.couponCode + ')' : ''}: −` + util.money(order.discount || 0));
    }
    if (order.shipping) L.push('Delivery: ' + util.money(order.shipping));
    L.push('Total: ' + util.money(order.total));
    L.push('');
    L.push('— PAYMENT —');
    L.push(order.payment);
    if (order.paymentId === 'vodafone_cash') {
      L.push(`Vodafone Cash deposit (${Number(CFG.DEPOSIT_PERCENT) || 50}%): ${util.moneyAr(order.deposit || 0)}`);
      L.push(`Transfer to: ${CFG.VODAFONE_CASH_NUMBER || '01040124131'}`);
      L.push('Balance due on delivery: ' + util.moneyAr(Math.max(0, (order.total || 0) - (order.deposit || 0))));
      L.push('Please send a transfer screenshot to confirm your order.');
    }
    if (order.notes) { L.push(''); L.push('Notes: ' + order.notes); }
    L.push('');
    L.push('Sent from the CLOTHINA store');
    return L.join('\n');
  }

  function waLink(text) {
    return `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  }

  /* ==========================================================
     8) عناصر مشتركة: أكورديون + أدلة
     ========================================================== */
  function initAccordions(scope = document) {
    $$('.acc-item', scope).forEach(item => {
      const head = $('.acc-head', item);
      const body = $('.acc-body', item);
      if (!head || !body) return;
      ON(head, 'click', () => {
        const open = item.classList.toggle('is-open');
        body.style.height = open ? body.scrollHeight + 'px' : '0px';
        if (open) $$('.acc-item', scope).forEach(o => {
          if (o !== item && o.classList.contains('is-open')) {
            o.classList.remove('is-open');
            $('.acc-body', o).style.height = '0px';
          }
        });
      });
    });
  }

  const GUIDE_HTML = `
    <div class="modal-head">
      <h3>Size guide</h3>
      <button class="modal-close" data-close-modal aria-label="Close">${icons.close}</button>
    </div>
    <p class="tiny muted">Measure comfortably. If you are between sizes, choose the larger size. Measurements are in centimetres.</p>
    <div style="overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:center">
        <thead>
          <tr style="background:var(--bg-secondary)">
            <th style="padding:10px;border-bottom:1px solid var(--line)">Size</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">Bust</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">Waist</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">Hips</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">Length</th>
          </tr>
        </thead>
        <tbody>
          ${[
            ['XS', '80–84', '62–66', '88–92', '140'],
            ['S', '84–88', '66–70', '92–96', '142'],
            ['M', '88–92', '70–74', '96–100', '144'],
            ['L', '92–96', '74–78', '100–104', '146'],
            ['XL', '96–102', '78–84', '104–110', '148'],
            ['XXL', '102–108', '84–90', '110–116', '150']
          ].map(r => `<tr>${r.map((c, i) => `<td style="padding:10px;border-bottom:1px solid var(--line);${i === 0 ? 'font-weight:500' : 'color:var(--ink-soft)'}">${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="tiny muted">For a custom fit, add a note or upload your measurements at checkout.</p>`;

  function guidesModal() {
    if (document.getElementById('guideModal')) return;
    const d = document.createElement('div');
    d.className = 'modal'; d.id = 'guideModal';
    d.innerHTML = `<div class="modal-card">${GUIDE_HTML}</div>`;
    document.body.appendChild(d);

    const ship = document.createElement('div');
    ship.className = 'modal'; ship.id = 'shipModal';
    ship.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <h3>Delivery & returns</h3>
          <button class="modal-close" data-close-modal aria-label="Close">${icons.close}</button>
        </div>
        <ul style="display:grid;gap:10px;font-size:14px;color:var(--ink-soft);line-height:1.9">
          <li>— Delivery across Egypt in 2–5 business days.</li>
          <li>— ${util.esc(CFG.FREE_SHIPPING_NOTE)}.</li>
          <li>— Returns or exchanges within 14 days, provided the item is unused and tags are attached.</li>
          <li>— Custom-fit pieces are made to order and can only be exchanged if faulty.</li>
          <li>— A 50% deposit is paid via Vodafone Cash; the balance is due on delivery.</li>
        </ul>
      </div>`;
    document.body.appendChild(ship);

    $$('[data-open-guide]').forEach(b => ON(b, 'click', e => { e.preventDefault(); openModal('guideModal'); }));
    $$('[data-open-shipping]').forEach(b => ON(b, 'click', e => { e.preventDefault(); openModal('shipModal'); }));
    $$('[data-close-modal]').forEach(b => ON(b, 'click', () => closeModal(b.closest('.modal'))));
    $$('.modal').forEach(m => ON(m, 'click', e => { if (e.target === m) closeModal(m); }));
    ON(document, 'keydown', e => { if (e.key === 'Escape') $$('.modal.is-open').forEach(m => closeModal(m)); });
  }

  /* ==========================================================
     8.a) كارت المنتج الموحّد (يدعم عرض الفترة المحدودة)
     ========================================================== */
  function cardHTML(p, i = 0, opts = {}) {
    const st = offer.state(p);
    const off = offer.pct(p);
    const endsAt = offer.endsAt(p);
    const badgeText = String(p.badge || '').trim().toLowerCase();
    const saleBadge = st === 'live'
      ? `<span class="badge badge--sale">SALE -${off}%</span>`
      : '';
    const labelBadge = /^(new|new arrival|just dropped)$/.test(badgeText)
      ? '<span class="badge badge--new">NEW</span>'
      : /best\s*seller|bestseller|top seller/.test(badgeText)
        ? '<span class="badge badge--best">BEST SELLER</span>'
        : '';
    const timedBadge = (st === 'live' && endsAt)
      ? `<span class="card-old-badge"><span class="dot-live" style="width:5px;height:5px;border-radius:50%;background:var(--color-success);display:inline-block"></span>Limited-time offer <span class="cd" data-offer-end="${endsAt.toISOString()}"></span></span>`
      : '';
    const priceHTML = st === 'live'
      ? `<span class="card-price">${util.money(p.price)}</span><span class="card-price-old">${util.money(p.old_price)}</span>`
      : `<span class="card-price">${util.money(p.price)}</span>`;
    const images = (p.images || []).filter(Boolean);
    const alternate = images.find(src => src !== p.image_url) || '';
    const quickBtns = opts.quick === false ? '' : `
      <div class="card-actions">
        <button class="card-quick" type="button" data-quick="${util.esc(p.id)}">Quick add <span aria-hidden="true">+</span></button>
        <button class="card-view" type="button" data-quick-view="${util.esc(p.id)}" aria-label="Quick view ${util.esc(p.title)}">View</button>
      </div>`;

    return `
    <article class="card reveal" data-delay="${(i % 4) * 0.06}" data-id="${util.esc(p.id)}">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-media" aria-label="${util.esc(p.title)}">
        <img class="card-image-primary" src="${util.img(p.image_url, true)}" alt="${util.esc(p.title)}" width="480" height="600" loading="lazy" decoding="async">
        ${alternate ? `<img class="card-image-alt" src="${util.img(alternate, true)}" alt="" width="480" height="600" loading="lazy" decoding="async" aria-hidden="true">` : ''}
        <span class="card-badges">${labelBadge}${saleBadge}</span>
        ${timedBadge ? `<span class="card-timed-badge">${timedBadge}</span>` : ''}
      </a>
      ${quickBtns}
      <div class="card-body">
        <a class="card-title" href="product.html?id=${encodeURIComponent(p.id)}">${util.esc(p.title)}${p.title_en ? ` <span class="en muted card-title-en">${util.esc(p.title_en)}</span>` : ''}</a>
        <div class="card-meta">${priceHTML}</div>
        ${p.category ? `<span class="card-fabric">${util.esc(p.category)}${p.fabric ? ' · ' + util.esc(p.fabric) : ''}</span>` : ''}
      </div>
    </article>`;
  }

  function openQuickView(p) {
    const id = 'quickModal';
    let m = document.getElementById(id);
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal'; m.id = id;
      document.body.appendChild(m);
      ON(m, 'click', e => { if (e.target === m) modal.close(m); });
    }
    const sizes = (p.sizes || []).map((size, i) => `<button class="opt-btn ${i === 0 ? 'is-on' : ''}" type="button" data-q-size="${util.esc(size)}">${util.esc(size)}</button>`).join('');
    const colors = (p.colors || []).map((color, i) => `<button class="swatch ${i === 0 ? 'is-on' : ''}" type="button" data-q-color="${util.esc(color.name)}" title="${util.esc(color.name)}"><i style="background:${util.esc(color.hex || '#EFECE6')}"></i></button>`).join('');
    const sale = offer.state(p) === 'live';
    m.innerHTML = `
      <div class="modal-card quick-card">
        <div class="modal-head"><div><span class="eyebrow">QUICK VIEW</span><h3>${util.esc(p.title)}</h3></div><button class="modal-close" type="button" data-close aria-label="Close">✕</button></div>
        <div class="quick-grid">
          <div class="quick-image"><img src="${util.img(p.image_url)}" alt="${util.esc(p.title)}"></div>
          <div class="quick-info">
            <div class="card-meta"><span class="card-price">${util.money(p.price)}</span>${sale ? `<span class="card-price-old">${util.money(p.old_price)}</span><span class="badge badge--sale">SALE -${offer.pct(p)}%</span>` : ''}</div>
            <p class="tiny muted">${util.esc((p.description || '').slice(0, 150))}</p>
            ${sizes ? `<div class="opt"><span class="opt-label">Choose size</span><div class="opt-grid">${sizes}</div></div>` : ''}
            ${colors ? `<div class="opt"><span class="opt-label">Color</span><div class="opt-grid">${colors}</div></div>` : ''}
            <button class="btn btn--block" type="button" id="quickAdd">Add to bag</button>
            <a class="link-u" href="product.html?id=${encodeURIComponent(p.id)}">Full details <span class="en">→</span></a>
          </div>
        </div>
      </div>`;
    modal.open(id);
    ON(m.querySelector('[data-close]'), 'click', () => modal.close(m));
    m.querySelectorAll('[data-q-size]').forEach(b => ON(b, 'click', () => {
      m.querySelectorAll('[data-q-size]').forEach(x => x.classList.toggle('is-on', x === b));
    }));
    m.querySelectorAll('[data-q-color]').forEach(b => ON(b, 'click', () => {
      m.querySelectorAll('[data-q-color]').forEach(x => x.classList.toggle('is-on', x === b));
    }));
    ON(m.querySelector('#quickAdd'), 'click', () => {
      const size = m.querySelector('[data-q-size].is-on')?.dataset.qSize || '';
      const color = m.querySelector('[data-q-color].is-on')?.dataset.qColor || '';
      if (sizes && !size) return toast('Please choose a size first.', 'warn');
      cart.add({ id: p.id, title: p.title, title_en: p.title_en, price: p.price, qty: 1, size, color, image: p.image_url });
      toast('Added to your bag', 'ok');
      modal.close(m);
    });
  }

  function initCartDrawer() {
    if (document.getElementById('cartDrawer')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="cart-drawer-backdrop" data-cart-close></div>
      <aside class="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Shopping bag" aria-hidden="true" tabindex="-1">
        <div class="cart-drawer-head"><div><span class="eyebrow">YOUR BAG</span><h2>Shopping bag <span class="drawer-count" id="drawerCount">0</span></h2></div><button class="modal-close" type="button" data-cart-close aria-label="Close bag">✕</button></div>
        <div class="cart-drawer-items" id="drawerItems"></div>
        <div class="cart-drawer-empty" id="drawerEmpty"><p>Your bag is empty.</p><a class="btn btn--ghost btn--sm" href="shop.html">Explore the drop</a></div>
        <div class="cart-drawer-foot" id="drawerFoot"><div class="drawer-total"><span>Subtotal</span><b id="drawerSubtotal"></b></div><div class="drawer-total drawer-total-final"><span>Total</span><b id="drawerTotal"></b></div><a class="btn btn--block" id="drawerCheckout" href="checkout.html">Checkout</a><a class="drawer-view-bag" href="cart.html">View full bag</a></div>
      </aside>`);
    const drawer = $('#cartDrawer');
    let returnFocus = null;
    const render = () => {
      const items = cart.get();
      $('#drawerCount').textContent = items.reduce((sum, item) => sum + (item.qty || 1), 0);
      $('#drawerItems').innerHTML = items.map(item => {
        const key = `${item.id}__${item.size || ''}__${item.color || ''}`;
        return `<article class="drawer-item" data-key="${util.esc(key)}"><img src="${util.img(item.image || item.image_url, true)}" alt=""><div class="drawer-item-info"><b>${util.esc(item.title)}</b><span>${[item.size && `Size ${util.esc(item.size)}`, item.color && util.esc(item.color)].filter(Boolean).join(' · ')}</span><strong>${util.money(item.price)}</strong></div><button type="button" class="drawer-remove" data-drawer-remove aria-label="Remove ${util.esc(item.title)}">×</button></article>`;
      }).join('');
      $('#drawerEmpty').classList.toggle('hide', items.length > 0);
      $('#drawerFoot').classList.toggle('hide', !items.length);
      $('#drawerSubtotal').textContent = util.money(cart.subtotal());
      $('#drawerTotal').textContent = util.money(cart.total());
    };
    const close = () => {
      if (!drawer.classList.contains('is-open')) return;
      drawer.classList.remove('is-open');
      $('.cart-drawer-backdrop').classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      $('#cartDrawerOpen')?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
      returnFocus?.focus();
      returnFocus = null;
    };
    ON($('#cartDrawerOpen'), 'click', () => {
      returnFocus = document.activeElement;
      render(); drawer.classList.add('is-open'); $('.cart-drawer-backdrop').classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      $('#cartDrawerOpen')?.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked'); drawer.focus();
    });
    $$('[data-cart-close]').forEach(el => ON(el, 'click', close));
    ON(document, 'keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) close(); });
    ON(document, 'jl:cart', render);
    ON($('#drawerItems'), 'click', e => {
      const row = e.target.closest('.drawer-item');
      if (!row) return;
      if (e.target.closest('[data-drawer-remove]')) cart.remove(row.dataset.key);
    });
    ON($('#drawerCheckout'), 'click', e => { if (!cart.get().length) { e.preventDefault(); toast('Your bag is empty.', 'warn'); } });
    render();
  }

  ON(document, 'click', async e => {
    const trigger = e.target.closest('[data-quick], [data-quick-view]');
    if (!trigger) return;
    e.preventDefault();
    const id = trigger.dataset.quick || trigger.dataset.quickView;
    const p = (await products.all()).find(item => String(item.id) === String(id));
    if (p) openQuickView(p);
  });

  /* Keep one lightweight timer for all currently visible offer countdowns. */
  let countdownTimer = null;
  function initCountdowns() {
    if (!$$('[data-offer-end]').length || countdownTimer) return;
    const tick = () => {
      $$('[data-offer-end]').forEach(el => {
        const end = new Date(el.dataset.offerEnd);
        if (isNaN(end)) return;
        const left = end.getTime() - Date.now();
        if (left <= 0) {
          el.textContent = 'Ended';
          el.closest('.offer-strip, .card-old-badge')?.remove();
          return;
        }
        el.textContent = offer.countdown(end);
      });
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* ==========================================================
     8.b) صندوق الكوبون (يستخدمه السلة + صفحة الدفع)
     ========================================================== */
  function couponBoxHTML() {
    const c = coupons.get();
    if (c) {
      return `<div class="coupon-applied">
          <span class="coupon-tag en">${util.esc(c.code)}</span>
          <span class="coupon-txt">Save <b>${Number(c.percent)}%</b> applies to eligible items in your bag</span>
          <button class="coupon-x" data-coupon-remove aria-label="Remove coupon">✕</button>
        </div>`;
    }
    return `<div class="coupon-form">
        <input class="input en" id="couponInput" placeholder="COUPON CODE" dir="ltr" autocomplete="off">
        <button class="btn btn--ghost btn--sm" id="couponApply">Apply</button>
      </div>
      <p class="coupon-msg" id="couponMsg"></p>`;
  }

  function bindCouponBox(scope = document, onChange) {
    const input = $('#couponInput', scope);
    const btn = $('#couponApply', scope);
    const msg = $('#couponMsg', scope);

    if (input) ON(input, 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    if (btn) ON(btn, 'click', apply);
    const rm = $('[data-coupon-remove]', scope);
    if (rm) ON(rm, 'click', () => {
      coupons.clear();
      toast('Coupon removed.');
      onChange && onChange();
    });

    async function apply() {
      const code = (input?.value || '').trim();
      if (!code) return;
      if (msg) { msg.textContent = 'Verifying…'; msg.className = 'coupon-msg'; }
      if (btn) btn.disabled = true;
      try {
        const res = await coupons.validate(code);
        toast(`Coupon ${res.code} applied — ${Number(res.percent)}% off.`, 'ok');
        onChange && onChange();
      } catch (err) {
        if (msg) { msg.textContent = err.message; msg.className = 'coupon-msg is-err'; }
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  }

  /* ==========================================================
     9) التشغيل
     ========================================================== */
  let adminToolsPromise = null;
  function loadAdminTools() {
    if (window.__JL_ADMIN_READY) return Promise.resolve();
    if (adminToolsPromise) return adminToolsPromise;
    adminToolsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/admin.js';
      script.onload = () => resolve();
      script.onerror = () => { adminToolsPromise = null; reject(new Error('Admin tools failed to load.')); };
      document.head.appendChild(script);
    });
    return adminToolsPromise;
  }

  document.documentElement.classList.add('js-reveal');
  // Validate an admin link before DOM ready so the tools can boot on any page.
  admin.handleUrl();

  document.addEventListener('DOMContentLoaded', () => {
    loader();
    chrome();
    guidesModal();
    initAccordions();
    document.documentElement.classList.add('is-ready');
    if (!$('#jl-loader')) revealInit();

    // Load the admin bundle only in an authenticated browser, from any page.
    if (admin.isAdmin()) loadAdminTools().catch(err => toast(err.message, 'warn'));
    const openAdmin = () => {
      if (!admin.isAdmin()) {
        location.href = `index.html?admin=${encodeURIComponent(CFG.ADMIN_TOKEN)}`;
        return;
      }
      loadAdminTools()
        .then(() => document.dispatchEvent(new CustomEvent('jl:open-admin')))
        .catch(err => toast(err.message, 'warn'));
    };
    ON($('#quickAdmin'), 'click', openAdmin);
    ON($('#adminDot'), 'click', () => {
      if (admin.isAdmin()) openAdmin();
      else toast('Admin mode is not enabled in this browser.');
    });
  });

  /* تحديث تلقائي عند الرجوع بالـ back/forward (كاش bfcache) */
  ON(window, 'pageshow', e => {
    if (e.persisted) {
      products.invalidate();
      cart.badge();
    }
  });

  /* ==========================================================
     التصدير
     ========================================================== */
  window.JL = { CFG, $, $$, ON, util, sb, admin, cart, products, coupons, offer, cardHTML, initCountdowns, normalize, englishField,
    couponBoxHTML, bindCouponBox, modal, toast, loader, waLink, buildOrderMessage, initAccordions, revealWithin, icons, logoSVG };
})();
