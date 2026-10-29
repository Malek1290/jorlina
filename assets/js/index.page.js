/* ============================================================
   CLOTHINA — HOME PAGE
   ============================================================ */
const { $, $$, ON, util, products, cart, toast, cardHTML, offer } = window.JL;
const initSilk = (window.JLSilk && window.JLSilk.initSilk) || (() => ({ destroy() {} }));

/* ---------- تشغيل ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  /* Silk في التحميل والهيرو */
  const loaderCv = document.getElementById('jl-loader-canvas');
  const heroCv = document.getElementById('hero-canvas');
  initSilk(loaderCv, { opacity: .92, amp: 1, colorA: '#7C532B', colorB: '#D4AF37', colorC: '#F8F5F0' });
  initSilk(heroCv, { opacity: 1, amp: 1.25, tilt: .1, colorA: '#7C532B', colorB: '#D4AF37', colorC: '#F8F5F0' });

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

  /* hero parallax ناعم */
  if (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to('.hero-media img', {
      yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }
});
