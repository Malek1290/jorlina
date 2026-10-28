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
      return v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + (CFG.CURRENCY || 'ج.م');
    },
    /** سعر بأرقام عربية (للعربون الثابت) */
    moneyAr(n) {
      const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
      return this.money(n).replace(/[0-9]/g, d => map[+d]).replace('ج.م', CFG.CURRENCY || 'ج.م');
    },
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
      if (!url) return 'assets/img/p1.jpg';
      if (!small) return url;
      // صور محلية: نستخدم نسخة مصغرة تلقائياً
      if (/^assets\/img\/[^/]+\.jpg$/.test(url)) return url.replace('assets/img/', 'assets/img/thumbs/');
      return url;
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
      if (!this.url || !this.key) throw new Error('Supabase config مفقود');
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: this.headers(headers),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        let msg = res.status + ' ' + res.statusText;
        try { const j = await res.json(); msg = j.message || j.error || msg; } catch (_) {}
        throw new Error(msg);
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
        let msg = 'فشل رفع الصورة';
        try { const j = await res.json(); msg = j.message || msg; } catch (_) {}
        throw new Error(msg);
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
        util.toast('تم تفعيل وضع الآدمن على هذا المتصفح', 'ok');
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
      try { return JSON.parse(localStorage.getItem(this.key)) || []; }
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
      if (d > 1) return `${d} أيام و${h} ساعة`;
      if (d === 1) return `${h} ساعة و${m} دقيقة`;
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
      if (!c) throw new Error('اكتبي كود الخصم');

      // وضع العرض التجريبي (بدون قاعدة بيانات)
      if (coupons.demoMode()) {
        const demo = { CLOTHINA10: 10, WELCOME15: 15, SALE20: 20 };
        if (!demo[c]) throw new Error('الكود غير صحيح أو منتهي الصلاحية');
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
          if (!demo[c]) throw new Error('الكود غير صحيح — (وضع تجريبي: جرّبي CLOTHINA10)');
          const res = { ok: true, code: c, percent: demo[c], product_ids: [], ends_at: null, demo: true };
          this.save(res);
          document.dispatchEvent(new CustomEvent('jl:coupon', { detail: res }));
          console.warn('[CLOTHINA] وضع كوبونات تجريبي — شغّل supabase-update-2.sql');
          return res;
        }
        throw new Error('تعذّر التحقق من الكود — حاولي تاني');
      }
      if (!data || !data.ok) throw new Error(data?.message || 'الكود غير صحيح أو منتهي الصلاحية');

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

    /** تفصيل الخصم على السلة: { eligible, discount, percent } */
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
      id: 'demo-1', title: 'سيلين', title_en: 'CELINE', price: 4200, old_price: 4800,
      description: 'فستان ساتان بقصّة انسيابية ورقبة كاول ناعمة، مبطّن بالكامل ويناسب السهرات والمناسبات الخاصة.',
      image_url: 'assets/img/p1.jpg', images: ['assets/img/p1.jpg', 'assets/img/hero.jpg'],
      category: 'فساتين سهرة', fabric: 'ساتان حريري', badge: 'الأكثر طلباً',
      sizes: ['S', 'M', 'L', 'XL'], colors: [{ name: 'أوف وايت', hex: '#EFECE6' }]
    },
    {
      id: 'demo-2', title: 'ليا', title_en: 'LEA', price: 3600, old_price: null,
      description: 'فستان طويل من الكريب المطفي بلون زيتوني هادي، بأكمام طويلة وتفاصيل كسرة دقيقة.',
      image_url: 'assets/img/p2.jpg', images: ['assets/img/p2.jpg'],
      category: 'فساتين سهرة', fabric: 'كريب مطفي', badge: 'جديد',
      sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: [{ name: 'زيتوني', hex: '#8A8C7F' }]
    },
    {
      id: 'demo-3', title: 'نور', title_en: 'NOOR', price: 2850, old_price: null,
      description: 'فستان شيفون بلون البيج الرملي مع حزام ناعم يبرز الوسط. خفيف ومريح للمناسبات النهارية.',
      image_url: 'assets/img/p3.jpg', images: ['assets/img/p3.jpg'],
      category: 'فساتين كاجوال', fabric: 'شيفون', badge: '',
      sizes: ['S', 'M', 'L'], colors: [{ name: 'بيج رملي', hex: '#D9CDBB' }]
    },
    {
      id: 'demo-4', title: 'فيرونيك', title_en: 'VERONIQUE', price: 3900, old_price: 4400,
      description: 'فستان مخمل أسود بقصّة كلاسيكية ولمعة راقية، تصميم هادي وواثق.',
      image_url: 'assets/img/p4.jpg', images: ['assets/img/p4.jpg'],
      category: 'فساتين سهرة', fabric: 'مخمل', badge: 'آخر قطعتين',
      sizes: ['S', 'M', 'L', 'XL'], colors: [{ name: 'أسود', hex: '#1A1A1A' }]
    },
    {
      id: 'demo-5', title: 'أريا', title_en: 'ARIA', price: 8600, old_price: null,
      description: 'فستان زفاف بلون الأوف وايت بأسدال طويلة وأكمام بتفاصيل ناعمة، خفيف على الجسم ويضيف إشراقة لليوم.',
      image_url: 'assets/img/p5.jpg', images: ['assets/img/p5.jpg'],
      category: 'فساتين زفاف', fabric: 'ساتان لؤلؤي', badge: 'أتيليه',
      sizes: ['XS', 'S', 'M', 'L', 'مقاس خاص'], colors: [{ name: 'أوف وايت', hex: '#F4F1EA' }]
    }
  ];

  function normalize(row) {
    const images = (row.images && row.images.length ? row.images : [row.image_url]).filter(Boolean);
    return {
      ...row,
      id: row.id,
      title: row.title || 'بدون اسم',
      title_en: row.title_en || '',
      price: Number(row.price) || 0,
      old_price: row.old_price ? Number(row.old_price) : null,
      image_url: row.image_url || images[0],
      images,
      sizes: (row.sizes && row.sizes.length ? row.sizes : CFG.DEFAULT_SIZES),
      colors: (row.colors && row.colors.length ? row.colors : []),
      category: row.category || '',
      fabric: row.fabric || '',
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
        console.warn('[CLOTHINA] Supabase غير متاح — يتم استخدام منتجات العرض.', err.message);
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
      const minDuration = 1300;
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

    const heroImg = document.querySelector('.hero-media img');
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

  /* ---------- Scroll reveal ---------- */
  let revealed = false;
  function revealInit() {
    if (revealed) return; revealed = true;
    const els = $$('.reveal, .reveal-lines');
    if (!els.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.gsap && window.ScrollTrigger && !reduced) {
      gsap.registerPlugin(ScrollTrigger);
      els.forEach(el => {
        if (el.classList.contains('reveal')) {
          gsap.fromTo(el, { y: 26, opacity: 0 }, {
            y: 0, opacity: 1, duration: 1.05, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
            delay: parseFloat(el.dataset.delay || 0)
          });
        } else {
          const lines = el.querySelectorAll('span > i');
          gsap.fromTo(lines, { yPercent: 112 }, {
            yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .09,
            scrollTrigger: { trigger: el, start: 'top 90%' }
          });
        }
      });
    } else {
      els.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    }
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

  function chrome() {
    const page = document.body.dataset.page || 'home';
    const header = `
      <div class="announce">
        <span>${util.esc(CFG.FREE_SHIPPING_NOTE)} · تفصيل على مقاسك · توصيل لجميع محافظات مصر</span>
        <span class="en" style="margin-inline-start:14px">CLOTHINA ATELIER</span>
      </div>
      <header class="site-header" id="siteHeader">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="CLOTHINA">
            <img class="brand-logo" src="${LOGO_WORD}" alt="CLOTHINA" width="590" height="70">
          </a>
          <nav class="nav" aria-label="القائمة الرئيسية">
            <a href="index.html" class="${page === 'home' ? 'is-active' : ''}">الرئيسية</a>
            <a href="shop.html" class="${page === 'shop' ? 'is-active' : ''}">المتجر</a>
            <a href="index.html#collections">الأقسام</a>
            <a href="index.html#story">عن الأتيليه</a>
            <a href="index.html#contact">تواصل معنا</a>
          </nav>
          <div class="header-actions">
            <button class="icon-btn burger" id="burgerBtn" aria-label="القائمة">${icons.menu}</button>
                     <a class="icon-btn" href="cart.html" aria-label="سلة التسوق">
              ${icons.cart}<span class="cart-count">0</span>
            </a>
          </div>
        </div>
      </header>
      <div class="mobile-nav" id="mobileNav">
        <button class="icon-btn close-m" id="closeMobile" aria-label="إغلاق">${icons.close}</button>
        <a href="index.html">الرئيسية</a>
        <a href="shop.html">المتجر</a>
        <a href="index.html#collections">الأقسام</a>
        <a href="index.html#story">عن الأتيليه</a>
        <a href="cart.html">سلة التسوق</a>
        <a href="index.html#contact">تواصل معنا</a>
      </div>`;

    const footer = `
      <footer class="site-footer" id="contact">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="brand">
                <img class="brand-logo" src="${LOGO_WORD_LIGHT}" alt="CLOTHINA" width="590" height="70">
              </div>
              <p>براند أزياء في القاهرة — نهتم بالتفاصيل الهادية: أقمشة مختارة، قصّات مريحة، وإطلالة تبقى معك سنين.</p>
            </div>
            <div>
              <h4>تسوّق</h4>
              <ul>
                <li><a href="shop.html">كل الفساتين</a></li>
                <li><a href="shop.html?cat=${encodeURIComponent('فساتين سهرة')}">سهرة</a></li>
                <li><a href="shop.html?cat=${encodeURIComponent('فساتين زفاف')}">زفاف</a></li>
                <li><a href="shop.html?cat=${encodeURIComponent('فساتين كاجوال')}">كاجوال</a></li>
              </ul>
            </div>
            <div>
              <h4>المساعدة</h4>
              <ul>
                <li><a href="cart.html">سلة التسوّق</a></li>
                <li><a href="#" data-open-guide>دليل المقاسات</a></li>
                <li><a href="#" data-open-shipping>الشحن والاستبدال</a></li>
              </ul>
            </div>
            <div>
              <h4>تواصل معنا</h4>
              <ul>
                <li><a href="https://wa.me/${CFG.WHATSAPP_NUMBER}" target="_blank" rel="noopener">واتساب · 01040124131</a></li>
                <li><a href="${CFG.TIKTOK}" target="_blank" rel="noopener">تيك توك · ${CFG.TIKTOK_HANDLE}</a></li>
                <li><span>${CFG.CITY}</span></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span class="en">© ${new Date().getFullYear()} CLOTHINA ATELIER — QUIET LUXURY</span>
            <span>صُنع بعناية <i class="admin-dot" id="adminDot" title="·"></i></span>
          </div>
        </div>
      </footer>`;

    const hHost = document.getElementById('site-header');
    if (hHost) hHost.innerHTML = header;
    const fHost = document.getElementById('site-footer');
    if (fHost) fHost.innerHTML = footer;

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
      a.setAttribute('aria-label', 'تواصلي معنا على واتساب');
      a.href = waLink('السلام عليكم CLOTHINA ✦ عندي استفسار');
      a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.7A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.6 9.4c.4 2.2 2 3.8 4.2 4.2l1-1.2 1.8.7c-.3 1.2-1.4 1.9-2.6 1.8-2.9-.3-5.2-2.6-5.5-5.5-.1-1.2.6-2.3 1.8-2.6l.7 1.8-1.4.8Z"/></svg>`;
      document.body.appendChild(a);
    }
  }

  /* ==========================================================
     7) واتساب — رسالة الطلب الكاملة
     ========================================================== */
  function buildOrderMessage(order) {
    const L = [];
    L.push('✦ طلب جديد — CLOTHINA ✦');
    L.push('رقم الطلب: ' + order.code);
    L.push('');
    L.push('— بيانات العميل —');
    L.push('الاسم: ' + order.name);
    L.push('الجوال: ' + order.phone);
    if (order.city) L.push('المدينة: ' + order.city);
    if (order.address) L.push('العنوان: ' + order.address);
    L.push('');
    L.push('— المنتجات —');
    order.items.forEach((i, n) => {
      L.push(`${n + 1}) ${i.title}${i.title_en ? ' / ' + i.title_en : ''}`);
      if (i.size) L.push('   المقاس: ' + i.size);
      if (i.color) L.push('   اللون: ' + i.color);
      L.push('   الكمية: ' + (i.qty || 1) + ' — السعر: ' + util.money((i.price || 0) * (i.qty || 1)));
      if (i.note) L.push('   ملاحظة: ' + i.note);
    });
    L.push('');

    /* قسم المقاسات (اختياري) — يروح مع الرسالة */
    const mes = order.measurements || {};
    const mKeys = [
      ['height', 'الطول'], ['bust', 'الصدر'], ['waist', 'الوسط'],
      ['hips', 'الأرداف'], ['shoulder', 'الكتف'], ['sleeve', 'طول الكم'], ['notes', 'ملاحظات المقاس']
    ];
    const mFilled = mKeys.filter(([k]) => mes[k]);
    const mImages = mes.images || [];
    if (mFilled.length || mImages.length) {
      L.push('— المقاسات (اختياري) —');
      mFilled.forEach(([k, label]) => L.push(`${label}: ${mes[k]}${['height', 'bust', 'waist', 'hips', 'shoulder', 'sleeve'].includes(k) ? ' سم' : ''}`));
      if (mImages.length) {
        L.push('صور المقاسات:');
        mImages.forEach((u, n) => L.push(`${n + 1}) ${u}`));
      }
      L.push('');
    }

    if (order.subtotal != null) L.push('المجموع: ' + util.money(order.subtotal));
    if (order.couponCode || order.discount) {
      L.push(`الخصم${order.couponCode ? ' (كوبون ' + order.couponCode + ')' : ''}: −` + util.money(order.discount || 0));
    }
    if (order.shipping) L.push('التوصيل: ' + util.money(order.shipping));
    L.push('الإجمالي: ' + util.money(order.total));
    L.push('');
    L.push('— طريقة الدفع —');
    L.push(order.payment);
    if (order.paymentId === 'vodafone_cash') {
      L.push(`دفعة فودافون كاش المقدمة (${Number(CFG.DEPOSIT_PERCENT) || 50}٪): ${util.moneyAr(order.deposit || 0)}`);
      L.push(`رقم التحويل: ${CFG.VODAFONE_CASH_NUMBER || '01040124131'}`);
      L.push('المتبقي عند الاستلام: ' + util.moneyAr(Math.max(0, (order.total || 0) - (order.deposit || 0))));
      L.push('يرجى إرسال صورة التحويل لتأكيد الأوردر.');
    }
    if (order.notes) { L.push(''); L.push('ملاحظات: ' + order.notes); }
    L.push('');
    L.push('أُرسل من متجر CLOTHINA');
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
      <h3>دليل المقاسات</h3>
      <button class="modal-close" data-close-modal aria-label="إغلاق">${icons.close}</button>
    </div>
    <p class="tiny muted">قيسي بمرونة، وإذا كنت بين مقاسين اختاري الأكبر. المقاسات بالسنتيمتر.</p>
    <div style="overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:center">
        <thead>
          <tr style="background:var(--bg-secondary)">
            <th style="padding:10px;border-bottom:1px solid var(--line)">المقاس</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">الصدر</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">الوسط</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">الأرداف</th>
            <th style="padding:10px;border-bottom:1px solid var(--line)">الطول</th>
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
    <p class="tiny muted">إذا تحتاجين مقاس خاص، اكتبيه في ملاحظات الطلب أو ارفعي صورة مقاساتك في صفحة إتمام الطلب.</p>`;

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
          <h3>الشحن والاستبدال</h3>
          <button class="modal-close" data-close-modal aria-label="إغلاق">${icons.close}</button>
        </div>
        <ul style="display:grid;gap:10px;font-size:14px;color:var(--ink-soft);line-height:1.9">
          <li>— التوصيل داخل مصر خلال ٢–٥ أيام عمل.</li>
          <li>— ${util.esc(CFG.FREE_SHIPPING_NOTE)}.</li>
          <li>— الاستبدال أو الإرجاع خلال ١٤ يوم بشرط عدم الاستخدام وبقاء البطاقة.</li>
          <li>— المقاسات الخاصة تُفصَّل حسب الطلب ولا تُستبدل إلا في حال وجود عيب.</li>
          <li>— يتم دفع ٥٠٪ من قيمة الطلب مقدماً عبر فودافون كاش والباقي عند الاستلام.</li>
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

    const offerBadge = st === 'live'
      ? `<span class="badge badge--sale">-${off}%</span>`
      : '';

    const timedBadge = (st === 'live' && endsAt)
      ? `<span class="card-old-badge"><span class="dot-live" style="width:5px;height:5px;border-radius:50%;background:#7BC08A;display:inline-block"></span>عرض محدود <span class="cd" data-offer-end="${endsAt.toISOString()}"></span></span>`
      : '';

    const priceHTML = st === 'live'
      ? `<span class="card-price">${util.money(p.price)}</span>
         <span class="card-price-old">${util.money(p.old_price)}</span>`
      : `<span class="card-price">${util.money(p.price)}</span>`;

    const quickBtn = opts.quick
      ? `<button class="card-quick" data-quick="${util.esc(p.id)}">نظرة سريعة <span class="en">+</span></button>`
      : '';

    return `
    <article class="card reveal" data-delay="${(i % 4) * 0.06}" data-id="${util.esc(p.id)}">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-media" aria-label="${util.esc(p.title)}">
        <img src="${util.img(p.image_url, true)}" alt="${util.esc(p.title)}" loading="lazy">
        <span class="card-badges">
          ${p.badge ? `<span class="badge">${util.esc(p.badge)}</span>` : ''}
          ${offerBadge}
        </span>
        ${timedBadge ? `<span style="position:absolute;bottom:12px;inset-inline-start:12px;z-index:2">${timedBadge}</span>` : ''}
      </a>
      ${quickBtn}
      <div class="card-body">
        <a class="card-title" href="product.html?id=${encodeURIComponent(p.id)}">${util.esc(p.title)}${
          p.title_en ? ` <span class="en muted" style="font-size:12px;letter-spacing:.16em">${util.esc(p.title_en)}</span>` : ''}</a>
        <div class="card-meta">${priceHTML}</div>
        ${st === 'live' ? `<span class="price-was">كان بـ <s>${util.money(p.old_price)}</s> والآن ${util.money(p.price)}</span>` : ''}
        ${p.category ? `<span class="card-fabric">${util.esc(p.category)}${p.fabric ? ' · ' + util.esc(p.fabric) : ''}</span>` : ''}
      </div>
    </article>`;
  }

  /* عدّاد تنازلي لكل العناصر اللي عندها data-offer-end */
  function initCountdowns() {
    const els = $$('[data-offer-end]');
    if (!els.length) return;
    const tick = () => {
      els.forEach(el => {
        const end = new Date(el.dataset.offerEnd);
        if (isNaN(end)) return;
        const left = end.getTime() - Date.now();
        if (left <= 0) { el.textContent = 'انتهى'; el.closest('.offer-strip')?.remove(); return; }
        el.textContent = offer.countdown(end);
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ==========================================================
     8.b) صندوق الكوبون (يستخدمه السلة + صفحة الدفع)
     ========================================================== */
  function couponBoxHTML() {
    const c = coupons.get();
    if (c) {
      return `<div class="coupon-applied">
          <span class="coupon-tag en">${util.esc(c.code)}</span>
          <span class="coupon-txt">خصم <b>${Number(c.percent)}%</b> مطبّق على المؤهل من طلبك</span>
          <button class="coupon-x" data-coupon-remove aria-label="إزالة الكوبون">✕</button>
        </div>`;
    }
    return `<div class="coupon-form">
        <input class="input en" id="couponInput" placeholder="COUPON CODE" dir="ltr" autocomplete="off">
        <button class="btn btn--ghost btn--sm" id="couponApply">تطبيق</button>
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
      toast('تم إزالة الكوبون');
      onChange && onChange();
    });

    async function apply() {
      const code = (input?.value || '').trim();
      if (!code) return;
      if (msg) { msg.textContent = 'جاري التحقق...'; msg.className = 'coupon-msg'; }
      if (btn) btn.disabled = true;
      try {
        const res = await coupons.validate(code);
        toast(`تم تطبيق الكوبون ${res.code} — خصم ${Number(res.percent)}%`, 'ok');
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
  // التحقق من رمز الآدمن فوراً (قبل تحميل بقية الملفات)
  admin.handleUrl();

  document.addEventListener('DOMContentLoaded', () => {
    loader();
    chrome();
    guidesModal();
    initAccordions();
    document.documentElement.classList.add('is-ready');

    // زر الآدمن السريع (لو مفعّل)
    ON($('#quickAdmin'), 'click', () => document.dispatchEvent(new CustomEvent('jl:open-admin')));
    ON($('#adminDot'), 'click', () => {
      if (admin.isAdmin()) document.dispatchEvent(new CustomEvent('jl:open-admin'));
      else toast('وضع الآدمن غير مفعّل على هذا المتصفح');
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
  window.JL = { CFG, $, $$, ON, util, sb, admin, cart, products, coupons, offer, cardHTML, initCountdowns,
    couponBoxHTML, bindCouponBox, modal, toast, loader, waLink, buildOrderMessage, initAccordions, icons, logoSVG };
})();
