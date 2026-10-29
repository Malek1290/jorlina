/* Malek portfolio — native dialogs, project index, case studies, and small interactions. */
(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GITHUB_URL = 'https://github.com/Malek1290';

  const projects = {
    clothina: {
      eyebrow: '01 / Featured project',
      title: 'CLOTHINA',
      subtitle: 'Streetwear, made digital.',
      live: 'https://malek1290.github.io/CLOTHINA/index.html',
      type: 'E-commerce / Streetwear',
      role: 'Design & front-end development',
      stack: 'HTML, CSS, JavaScript, Supabase',
      hero: 'assets/portfolio/img/clothina-desktop.webp',
      heroAlt: 'CLOTHINA storefront homepage on desktop',
      heroClass: 'case-hero--browser',
      overview: 'CLOTHINA is a streetwear storefront built to feel like the brand: direct, bold, and easy to move through. The project connects an editorial shopping interface with the practical pieces of a small commerce operation — product options, a cart, checkout, and an order handoff to WhatsApp.',
      features: [
        'Responsive homepage, collection, and product pages',
        'Product variants for size and color',
        'Shopping bag and checkout flow',
        'WhatsApp order handoff with the order details',
        'Supabase-backed catalog and admin tools',
        'Coupon and limited-offer support'
      ],
      gallery: [
        { src: 'assets/portfolio/img/clothina-collection.webp', alt: 'CLOTHINA product grid with streetwear photography' },
        { src: 'assets/portfolio/img/clothina-mobile.webp', alt: 'CLOTHINA storefront on a mobile screen' }
      ],
      galleryClass: ''
    },
    jorlina: {
      eyebrow: '02 / Quiet luxury',
      title: 'JORLINA',
      subtitle: 'A quieter kind of fashion experience.',
      live: 'https://jorlina-quiet-luxury.vercel.app/',
      type: 'E-commerce / Fashion atelier',
      role: 'Design & front-end development',
      stack: 'HTML, CSS, JavaScript, Supabase',
      hero: 'assets/portfolio/img/jorlina-editorial.webp',
      heroAlt: 'Editorial fashion imagery from the Jorlina project',
      heroClass: '',
      overview: 'Jorlina explores quiet luxury through a soft editorial identity and a right-to-left Arabic interface. The experience is designed around browsing a fashion collection calmly: clear product imagery, considered detail pages, and a shopping flow that stays out of the way.',
      features: [
        'Editorial, RTL Arabic storefront',
        'Collection and product browsing',
        'Product detail pages with size and color selection',
        'Shopping bag and checkout flow',
        'WhatsApp order confirmation',
        'Soft, responsive layouts for desktop and mobile'
      ],
      gallery: [
        { src: 'assets/portfolio/img/jorlina-products.webp', alt: 'Jorlina collection grid with evening and occasion dresses' },
        { src: 'assets/portfolio/img/jorlina-thumb.webp', alt: 'Jorlina editorial fashion detail' }
      ],
      galleryClass: 'case-gallery--jorlina'
    }
  };

  /* ---------- Native dialog helpers ---------- */
  const dialogs = $$('dialog');
  const menuToggle = $('[data-open-menu]');

  function openDialog(dialog, trigger, focusTarget) {
    if (!dialog) return;
    dialogs.forEach(other => {
      if (other !== dialog && other.open) {
        other._skipFocusRestore = true;
        other.close();
      }
    });
    dialog._returnFocus = focusTarget || trigger || document.activeElement;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('dialog-open');
    if (trigger === menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
  }

  dialogs.forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!dialogs.some(item => item.open)) document.body.classList.remove('dialog-open');
      if (dialog._returnFocus === menuToggle || dialog.id === 'menu-dialog') menuToggle.setAttribute('aria-expanded', 'false');
      if (!dialog._skipFocusRestore && dialog._returnFocus?.isConnected) dialog._returnFocus.focus({ preventScroll: true });
      dialog._skipFocusRestore = false;
    });
  });

  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('[data-open-menu]').forEach(button => button.addEventListener('click', () => openDialog($('#menu-dialog'), button)));
  $$('[data-open-index]').forEach(button => button.addEventListener('click', () => {
    const focusTarget = button.closest('#menu-dialog') ? menuToggle : button;
    openDialog($('#index-dialog'), button, focusTarget);
    window.setTimeout(() => $('#project-search').focus(), 30);
  }));
  $$('.menu-links a').forEach(link => link.addEventListener('click', () => $('#menu-dialog').close()));

  /* ---------- Case studies ---------- */
  function openCase(id, trigger) {
    const project = projects[id];
    if (!project) return;
    $('#case-eyebrow').textContent = project.eyebrow;
    $('#case-content').innerHTML = `
      <div class="case-heading">
        <div><h2 id="case-title">${project.title}</h2><p>${project.subtitle}</p></div>
        <a class="btn" href="${project.live}" target="_blank" rel="noopener noreferrer">View live site <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
      </div>
      <img class="case-hero ${project.heroClass}" src="${project.hero}" alt="${project.heroAlt}">
      <dl class="case-meta">
        <div><dt>Project type</dt><dd>${project.type}</dd></div>
        <div><dt>Role</dt><dd>${project.role}</dd></div>
        <div><dt>Stack</dt><dd>${project.stack}</dd></div>
      </dl>
      <p class="case-overview">${project.overview}</p>
      <h3 class="case-subhead">What’s inside</h3>
      <ul class="case-features">${project.features.map(feature => `<li>${feature}</li>`).join('')}</ul>
      <h3 class="case-subhead">Project views</h3>
      <div class="case-gallery ${project.galleryClass}">${project.gallery.map(image => `<img src="${image.src}" alt="${image.alt}" loading="lazy">`).join('')}</div>
      <div class="case-foot"><p>The live project opens in a new tab.</p><a class="text-link" href="${project.live}" target="_blank" rel="noopener noreferrer">Explore ${project.title} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div>`;
    const fromIndex = trigger?.closest('#index-dialog');
    const focusTarget = fromIndex ? $('[data-open-index]') : trigger;
    openDialog($('#case-dialog'), trigger, focusTarget);
    $('#case-dialog').scrollTop = 0;
  }

  $$('[data-project]').forEach(button => button.addEventListener('click', () => openCase(button.dataset.project, button)));

  /* ---------- Project search ---------- */
  const search = $('#project-search');
  const rows = $$('.index-row');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach(row => {
      const match = row.dataset.search.includes(query);
      row.hidden = !match;
      if (match) visible += 1;
    });
    $('.index-empty').hidden = visible !== 0;
  });

  /* ---------- Copy GitHub profile ---------- */
  const toast = $('.toast');
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('Copy failed');
  }

  $('[data-copy-github]').addEventListener('click', async () => {
    try {
      await copyText(GITHUB_URL);
      showToast('GitHub profile link copied.');
    } catch {
      showToast('Copy this link: ' + GITHUB_URL);
    }
  });

  /* ---------- Scroll reveal and active navigation ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
    $$('.reveal').forEach(el => revealObserver.observe(el));
  }

  const navLinks = $$('.nav-left a');
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          const active = link.getAttribute('href') === '#' + entry.target.id;
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    ['work', 'about', 'approach'].forEach(id => {
      const section = document.getElementById(id);
      if (section) sectionObserver.observe(section);
    });
  }
})();
