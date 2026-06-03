/**
 * Maison Dorée — Champagne d'Exception
 * Main JavaScript Module
 */

'use strict';

/* ==========================================================================
   0. Utility helpers
   ========================================================================== */

/**
 * Debounce a function call
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Safely query a single element; returns null without throwing
 * @param {string} selector
 * @param {Element|Document} [ctx=document]
 * @returns {Element|null}
 */
function $(selector, ctx = document) {
  return ctx.querySelector(selector);
}

/**
 * Safely query all elements; returns an Array
 * @param {string} selector
 * @param {Element|Document} [ctx=document]
 * @returns {Element[]}
 */
function $$(selector, ctx = document) {
  return Array.from(ctx.querySelectorAll(selector));
}

/* ==========================================================================
   1. Age Gate
   ========================================================================== */

(function initAgeGate() {
  const gate    = $('#ageGate');
  const yesBtn  = $('#ageGateYes');
  const body    = document.body;

  if (!gate) return;

  // Check session storage — don't nag on every page reload
  const verified = sessionStorage.getItem('md_age_verified');

  if (verified) {
    gate.classList.add('hidden');
    return;
  }

  body.classList.add('age-gate-open');

  yesBtn && yesBtn.addEventListener('click', () => {
    sessionStorage.setItem('md_age_verified', '1');
    gate.style.transition = 'opacity 0.55s ease';
    gate.style.opacity    = '0';
    setTimeout(() => {
      gate.classList.add('hidden');
      body.classList.remove('age-gate-open');
    }, 560);
  });
})();

/* ==========================================================================
   2. Sticky Header
   ========================================================================== */

(function initStickyHeader() {
  const header = $('#header');
  if (!header) return;

  const SCROLL_THRESHOLD = 60;

  function onScroll() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Run once on load in case page is already scrolled
})();

/* ==========================================================================
   3. Mobile Hamburger Menu
   ========================================================================== */

(function initHamburger() {
  const hamburger = $('#hamburger');
  const navMenu   = $('#navMenu');

  if (!hamburger || !navMenu) return;

  function toggleMenu(open) {
    hamburger.classList.toggle('is-open', open);
    navMenu.classList.toggle('is-open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.contains('is-open');
    toggleMenu(!isOpen);
  });

  // Close when a nav link is clicked
  $$('.nav__link', navMenu).forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && hamburger.classList.contains('is-open')) {
      toggleMenu(false);
    }
  });

  // Close when clicking outside the menu
  document.addEventListener('click', e => {
    if (
      hamburger.classList.contains('is-open') &&
      !navMenu.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      toggleMenu(false);
    }
  });
})();

/* ==========================================================================
   4. Smooth Scrolling Navigation
   ========================================================================== */

(function initSmoothScroll() {
  const NAV_OFFSET = 80; // pixels offset from top for sticky header

  document.addEventListener('click', e => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href   = anchor.getAttribute('href');
    if (href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();

    const targetTop = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;

    window.scrollTo({
      top:      targetTop,
      behavior: 'smooth'
    });
  });
})();

/* ==========================================================================
   5. Active Nav Link Highlight on Scroll
   ========================================================================== */

(function initActiveNav() {
  const navLinks = $$('.nav__link[href^="#"]');
  const sections = navLinks
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (!sections.length) return;

  const NAV_OFFSET = 100;

  function updateActive() {
    const scrollY = window.scrollY;

    let activeSection = sections[0];

    sections.forEach(section => {
      if (scrollY >= section.offsetTop - NAV_OFFSET) {
        activeSection = section;
      }
    });

    navLinks.forEach(link => {
      const isActive = link.getAttribute('href') === `#${activeSection.id}`;
      link.classList.toggle('active', isActive);
    });
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
})();

/* ==========================================================================
   6. Scroll-Triggered Reveal Animations
   ========================================================================== */

(function initScrollReveal() {
  const revealEls = $$('.reveal-up, .reveal-left, .reveal-right');
  if (!revealEls.length) return;

  // Use IntersectionObserver for performance
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Honour data-delay attribute
          const delay = parseInt(entry.target.dataset.delay || '0', 10);
          setTimeout(() => {
            entry.target.classList.add('is-visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold:  0.12,
      rootMargin: '0px 0px -60px 0px'
    }
  );

  revealEls.forEach(el => observer.observe(el));
})();

/* ==========================================================================
   7. Hero Parallax-esque Background
   ========================================================================== */

(function initHeroParallax() {
  const heroBg = $('.hero__bg');
  if (!heroBg) return;

  // Only run on devices that likely support it (not mobile)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrolled = window.scrollY;
        const heroHeight = document.querySelector('.hero')?.offsetHeight || window.innerHeight;
        // Move bg slightly slower than scroll for parallax feel
        const parallaxOffset = scrolled * 0.4;
        if (scrolled < heroHeight) {
          heroBg.style.transform = `translateY(${parallaxOffset}px) scale(1.04)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ==========================================================================
   8. Cuvée Cards — keyboard accessibility (Enter/Space to flip)
   ========================================================================== */

(function initCuveeCards() {
  const cards = $$('.cuvee-card');

  cards.forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Retourner la carte pour voir les détails');

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('flipped');
        const inner = card.querySelector('.cuvee-card__inner');
        if (inner) {
          inner.style.transform = card.classList.contains('flipped')
            ? 'rotateY(180deg)'
            : '';
        }
      }
    });
  });
})();

/* ==========================================================================
   9. Boutique — Quantity Selectors
   ========================================================================== */

(function initQuantitySelectors() {
  const qtyWrappers = $$('.produit-card__qty');

  qtyWrappers.forEach(wrapper => {
    const minusBtn = wrapper.querySelector('.qty-btn--minus');
    const plusBtn  = wrapper.querySelector('.qty-btn--plus');
    const input    = wrapper.querySelector('.qty-input');

    if (!minusBtn || !plusBtn || !input) return;

    const MIN = parseInt(input.min || '1',  10);
    const MAX = parseInt(input.max || '99', 10);

    function getValue() { return parseInt(input.value, 10) || MIN; }

    function setValue(val) {
      const clamped = Math.max(MIN, Math.min(MAX, val));
      input.value = clamped;

      // Visual feedback
      minusBtn.disabled = clamped <= MIN;
      plusBtn.disabled  = clamped >= MAX;

      minusBtn.style.opacity = clamped <= MIN ? '0.4' : '1';
      plusBtn.style.opacity  = clamped >= MAX ? '0.4' : '1';
    }

    minusBtn.addEventListener('click', () => setValue(getValue() - 1));
    plusBtn.addEventListener('click',  () => setValue(getValue() + 1));

    // Allow direct keyboard entry
    input.removeAttribute('readonly');
    input.addEventListener('change', () => setValue(getValue()));
    input.addEventListener('input', debounce(() => setValue(getValue()), 400));

    // Initialise state
    setValue(getValue());
  });
})();

/* ==========================================================================
   10. Boutique — Add to Cart
   ========================================================================== */

(function initAddToCart() {
  const addBtns  = $$('.btn--add-cart');
  const toast    = $('#cartToast');
  const toastTxt = toast ? toast.querySelector('.cart-toast__text') : null;
  let toastTimer;

  function showToast(message) {
    if (!toast || !toastTxt) return;
    toastTxt.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  addBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const card  = btn.closest('.produit-card');
      const name  = btn.dataset.name || 'Article';
      const price = parseFloat(btn.dataset.price || '0');
      const qtyEl = card ? card.querySelector('.qty-input') : null;
      const qty   = qtyEl ? parseInt(qtyEl.value, 10) : 1;
      const total = (price * qty).toFixed(2);

      // Button feedback
      const originalText = btn.textContent;
      btn.textContent = '✓ Ajouté !';
      btn.classList.add('added');

      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('added');
      }, 2000);

      // Toast message
      const qtyStr = qty > 1 ? ` × ${qty}` : '';
      showToast(`${name}${qtyStr} — ${total} € ajouté au panier`);

      // Simple cart count badge (if it exists or we create one)
      updateCartBadge(qty);
    });
  });

  /* Optional: floating cart badge in nav */
  function updateCartBadge(addedQty) {
    let badge = $('.nav__cart-badge');
    if (!badge) {
      // Inject a lightweight cart icon badge into the nav
      const nav = $('.nav');
      if (!nav) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'nav__cart';
      wrapper.setAttribute('aria-label', 'Panier');
      wrapper.innerHTML = `
        <span class="nav__cart-icon">🛒</span>
        <span class="nav__cart-badge">0</span>
      `;
      nav.appendChild(wrapper);

      // Inject inline style for the badge
      const style = document.createElement('style');
      style.textContent = `
        .nav__cart { position: relative; cursor: pointer; padding: 0.4rem; }
        .nav__cart-icon { font-size: 1.25rem; line-height: 1; }
        .nav__cart-badge {
          position: absolute; top: -4px; right: -4px;
          min-width: 18px; height: 18px;
          background: var(--color-gold);
          color: var(--color-white);
          font-size: 0.65rem; font-weight: 700;
          border-radius: 9999px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav__cart-badge.bump { transform: scale(1.4); }
      `;
      document.head.appendChild(style);
      badge = $('.nav__cart-badge');
    }

    if (!badge) return;
    const current = parseInt(badge.textContent, 10) || 0;
    badge.textContent = current + addedQty;

    // Bounce animation
    badge.classList.remove('bump');
    void badge.offsetWidth; // reflow
    badge.classList.add('bump');
    setTimeout(() => badge.classList.remove('bump'), 400);
  }
})();

/* ==========================================================================
   11. Newsletter Form Validation
   ========================================================================== */

(function initNewsletterForm() {
  const form       = $('#newsletterForm');
  const successMsg = $('#formSuccess');
  if (!form) return;

  const fields = {
    firstName: {
      el:       $('#firstName'),
      errorEl:  $('#firstNameError'),
      validate: v => v.trim().length >= 2
                     ? null
                     : 'Prénom requis (min. 2 caractères).'
    },
    lastName: {
      el:       $('#lastName'),
      errorEl:  $('#lastNameError'),
      validate: v => v.trim().length >= 2
                     ? null
                     : 'Nom requis (min. 2 caractères).'
    },
    email: {
      el:       $('#email'),
      errorEl:  $('#emailError'),
      validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
                     ? null
                     : 'Adresse e-mail invalide.'
    },
    ageVerify: {
      el:       $('#ageVerify'),
      errorEl:  $('#ageError'),
      validate: (_, el) => el.checked
                            ? null
                            : 'Vous devez certifier votre âge pour continuer.'
    }
  };

  /* Live validation on blur */
  Object.values(fields).forEach(({ el, errorEl, validate }) => {
    if (!el) return;
    el.addEventListener('blur', () => {
      const msg = validate(el.value, el);
      showError(el, errorEl, msg);
    });
    el.addEventListener('input', () => {
      // Clear error as soon as user starts correcting
      const msg = validate(el.value, el);
      if (!msg) showError(el, errorEl, null);
    });
  });

  function showError(inputEl, errorEl, message) {
    if (!errorEl || !inputEl) return;
    errorEl.textContent = message || '';
    if (message) {
      inputEl.classList.add('error');
    } else {
      inputEl.classList.remove('error');
    }
  }

  function validateAll() {
    let valid = true;
    Object.values(fields).forEach(({ el, errorEl, validate }) => {
      if (!el) return;
      const msg = validate(el.value, el);
      showError(el, errorEl, msg);
      if (msg) valid = false;
    });
    return valid;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

    if (!validateAll()) {
      // Focus first errored field
      const firstErr = Object.values(fields).find(({ el, validate }) =>
        el && validate(el.value, el)
      );
      firstErr?.el?.focus();
      return;
    }

    // Simulate async submission
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.querySelector('.btn__text').textContent = 'Inscription en cours…';
    }

    setTimeout(() => {
      form.querySelectorAll('input').forEach(i => { i.value = ''; i.checked = false; });
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn__text').textContent = 'M\'inscrire au Cercle Dorée';
      }
      if (successMsg) successMsg.classList.add('show');
      setTimeout(() => successMsg && successMsg.classList.remove('show'), 7000);
    }, 1200);
  });
})();

/* ==========================================================================
   12. Animated Counter (for stats in histoire section)
   ========================================================================== */

(function initCounters() {
  const counters = $$('.histoire__stat-number');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el     = entry.target;
        const target = parseInt(el.textContent, 10);
        if (isNaN(target)) return;

        const DURATION = 1600;
        const FPS      = 60;
        const steps    = Math.round((DURATION / 1000) * FPS);
        const increment = target / steps;
        let current = 0;
        let step    = 0;

        // Easing function (ease-out quad)
        function easeOut(t) { return t * (2 - t); }

        const timer = setInterval(() => {
          step++;
          const progress = easeOut(step / steps);
          current = Math.round(target * progress);
          el.textContent = current;

          if (step >= steps) {
            el.textContent = target;
            clearInterval(timer);
          }
        }, 1000 / FPS);

        observer.unobserve(el);
      });
    },
    { threshold: 0.8 }
  );

  counters.forEach(c => observer.observe(c));
})();

/* ==========================================================================
   13. Glassmorphism glow-follow on cuvée cards (desktop only)
   ========================================================================== */

(function initCardGlow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const cards = $$('.terroir__feature, .accord-card, .produit-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x    = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
      const y    = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
      card.style.setProperty('--glow-x', `${x}%`);
      card.style.setProperty('--glow-y', `${y}%`);
      card.style.backgroundImage = `radial-gradient(circle at ${x}% ${y}%, rgba(201,168,76,0.06) 0%, transparent 65%), ${getComputedStyle(card).backgroundImage.replace(/^(radial-gradient[^,]+,\s*)/, '')}`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.backgroundImage = '';
    });
  });
})();

/* ==========================================================================
   14. Section progress indicator (thin gold bar at top)
   ========================================================================== */

(function initScrollProgress() {
  const bar = document.createElement('div');
  bar.setAttribute('aria-hidden', 'true');
  bar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 2px;
    background: linear-gradient(to right, #C9A84C, #E2C478);
    z-index: 9998;
    width: 0%;
    transition: width 0.1s linear;
    pointer-events: none;
  `;
  document.body.appendChild(bar);

  window.addEventListener('scroll', () => {
    const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled     = (window.scrollY / docHeight) * 100;
    bar.style.width    = `${Math.min(scrolled, 100)}%`;
  }, { passive: true });
})();

/* ==========================================================================
   15. Lazy-load images placeholder pulse
   ========================================================================== */

(function initLazyImagePulse() {
  const placeholders = $$('.histoire__image-placeholder, .produit-card__image, .terroir__map-graphic');

  const style = document.createElement('style');
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
  `;
  document.head.appendChild(style);

  // Nothing more needed — images are decorative emoji for this demo.
  // In production, swap out emoji divs for <img> tags with loading="lazy".
})();

/* ==========================================================================
   16. Init complete log
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log(
    '%c✦ Maison Dorée — Champagne d\'Exception ✦',
    'font-family: Georgia, serif; font-size: 14px; color: #C9A84C; font-style: italic;'
  );
  console.log(
    '%cSite chargé avec succès.',
    'font-size: 11px; color: #888;'
  );
});
