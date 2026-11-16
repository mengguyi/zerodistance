/* Zero Distance Internet — restored behaviors
 * Reimplements the original framer-motion animations in vanilla JS:
 *  - header slide-in on load (y:-100 -> 0, 0.5s)
 *  - hero intro reveal (title y:30, subtitle/buttons y:20, staggered)
 *  - scroll-reveal via IntersectionObserver (opacity/translate, 0.8s headings, 0.5s + 0.1s*i items)
 *  - hero typewriter (words cycle, type 100ms, delete 50ms, pause 2s)
 *  - mobile menu toggle
 */
(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header slide-in ---------- */
  var header = document.getElementById('site-header');
  if (header) {
    if (prefersReduced) {
      header.style.transform = 'translateY(0)';
    } else {
      header.style.transform = 'translateY(-100px)';
      header.style.transition = 'transform 0.5s ease-out';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          header.style.transform = 'translateY(0)';
        });
      });
    }
  }

  /* ---------- Reveal engine ---------- */
  var TRANS = {
    up:    'translateY(20px)',
    up30:  'translateY(30px)',
    left:  'translateX(-20px)',
    right: 'translateX(20px)',
    fade:  'none'
  };

  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  // hero elements reveal on load; the rest on scroll
  var hero = document.querySelector('section [data-reveal]');

  function prepare(el, delay, duration) {
    var dir = el.getAttribute('data-reveal');
    el.style.opacity = '0';
    el.style.transform = TRANS[dir] || 'none';
    el.style.transition = 'opacity ' + duration + 's ease-out ' + delay + 's, transform ' + duration + 's ease-out ' + delay + 's';
  }

  function show(el) {
    el.style.opacity = '1';
    el.style.transform = 'translate(0, 0)';
  }

  // staggered groups: consecutive siblings inside the same container share index-based delays (0.1s * i)
  var groups = new Map(); // parent -> [children with data-reveal]
  revealEls.forEach(function (el) {
    var p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });

  var conf = new Map();
  groups.forEach(function (els) {
    // a "group" of similar items: >1 sibling with the same reveal direction
    var byDir = {};
    els.forEach(function (el) { (byDir[el.getAttribute('data-reveal')] = byDir[el.getAttribute('data-reveal')] || []).push(el); });
    Object.keys(byDir).forEach(function (dir) {
      var list = byDir[dir];
      var group = list.length > 1;
      list.forEach(function (el, i) {
        var delay = group ? 0.1 * i : 0;
        var duration = group ? 0.5 : 0.8; // items 0.5s, standalone headings/blocks 0.8s
        conf.set(el, { delay: delay, duration: duration });
      });
    });
  });

  revealEls.forEach(function (el) {
    var c = conf.get(el);
    if (prefersReduced) return; // leave visible
    prepare(el, c.delay, c.duration);
  });

  if (!prefersReduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) {
      io.observe(el);
    });

    // hero reveal fires on load (top of page already in view -> observer fires immediately anyway;
    // ensure immediate next-frame show for elements above the fold on first paint)
    window.addEventListener('load', function () {
      revealEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) show(el);
      });
    });
  }

  /* ---------- Scheme-aware hero background (matches original per-page HeroBackground) ----------
   * dark : data-dark image + via-black/40 -> black/60
   * light: data-light image + via-black/10 -> black/30
   * SSR ships the dark variant; swap on load and on scheme change. */
  var mqColor = window.matchMedia('(prefers-color-scheme: dark)');
  var heroBg = document.getElementById('hero-bg');
  var heroOv = document.getElementById('hero-overlay');
  var DARK_IMG = heroBg && heroBg.getAttribute('data-dark');
  var LIGHT_IMG = heroBg && heroBg.getAttribute('data-light');
  function applyHeroScheme() {
    var dark = mqColor.matches;
    if (heroOv) {
      heroOv.className = 'fixed inset-0 -z-10 bg-gradient-to-b from-transparent ' +
        (dark ? 'via-black/40 to-black/60' : 'via-black/10 to-black/30');
    }
    if (heroBg && (dark ? DARK_IMG : LIGHT_IMG)) {
      heroBg.style.backgroundImage = 'url("' + (dark ? DARK_IMG : LIGHT_IMG) + '")';
    }
  }
  if (heroBg || heroOv) {
    applyHeroScheme();
    if (mqColor.addEventListener) mqColor.addEventListener('change', applyHeroScheme);
  }

  /* ---------- Contact form (matches original contact page.js) ---------- */
  var form = document.querySelector('main form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var btnLabel = null;
      if (btn) {
        btnLabel = btn.querySelector('span');
        btn.disabled = true;
        if (btnLabel) btnLabel.textContent = 'Sending...';
      }
      setTimeout(function () {
        form.reset();
        if (btn) {
          btn.disabled = false;
          if (btnLabel) btnLabel.textContent = 'Send Message';
        }
        alert('Thank you for your message! We will get back to you within 24 hours.');
      }, 2000);
    });
  }

  /* ---------- Typewriter ---------- */
  var WORDS = ['VPS Solutions', 'Dedicated Servers', 'Cloud Hosting', 'Enterprise Solutions', 'Scalable Infrastructure'];
  var TYPE_SPEED = 100, DELETE_SPEED = 50, DELAY_BETWEEN = 2000;
  var typed = document.getElementById('typed-text');
  if (typed) {
    if (prefersReduced) {
      typed.textContent = WORDS[0];
    } else {
      var wi = 0, text = '', deleting = false;
      (function tick() {
        var word = WORDS[wi];
        var timeout;
        if (deleting) {
          if (text.length > 0) { text = word.slice(0, text.length - 1); timeout = DELETE_SPEED; }
          else { deleting = false; wi = (wi + 1) % WORDS.length; timeout = TYPE_SPEED; }
        } else {
          if (text.length < word.length) { text = word.slice(0, text.length + 1); timeout = TYPE_SPEED; }
          else { deleting = true; timeout = DELAY_BETWEEN; }
        }
        typed.textContent = text;
        setTimeout(tick, timeout);
      })();
    }
  }

  /* ---------- Mobile menu ---------- */
  var btn = document.getElementById('mobile-menu-btn');
  var menu = document.getElementById('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', function () {
      var open = menu.classList.toggle('hidden') === false;
      menu.classList.toggle('flex', open);
    });
  }
})();
