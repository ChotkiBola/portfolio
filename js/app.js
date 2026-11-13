/* Anvar Zarifov — portfolio. Til, videolar va qor. */
(function () {
  'use strict';
  // ---- aloqa havolalari: shu yerni to'ldiring ----
  const CONTACT = {
    instagram: '',   // masalan: 'https://instagram.com/username'
    telegram: '',    // masalan: 'https://t.me/username'
    email: '',       // masalan: 'mailto:siz@gmail.com'
  };
  document.querySelectorAll('[data-contact]').forEach(a => {
    const url = CONTACT[a.dataset.contact];
    if (url) a.href = url;
    else if (a.closest('.links')) a.setAttribute('aria-disabled', 'true');
  });

  // ---- til ----
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const langs = ['uz', 'ru', 'en'];
  function guess() {
    const saved = store.get('lang'); if (langs.includes(saved)) return saved;
    const n = (navigator.language || 'uz').slice(0, 2).toLowerCase();
    return n === 'ru' ? 'ru' : n === 'en' ? 'en' : 'uz';
  }
  function setLang(l) {
    const d = window.I18N[l]; if (!d) return;
    document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(el => { const v = d[el.dataset.i18n]; if (v) el.textContent = v; });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { const v = d[el.dataset.i18nHtml]; if (v) el.innerHTML = v; });
    document.title = d['meta.title'];
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    store.set('lang', l);
    if (window.__snowRelayout) window.__snowRelayout();
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(guess());

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- videolar: ko'ringanda yuklanadi va o'ynaydi ----
  const vids = document.querySelectorAll('video[data-src]');
  const vio = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src) { v.src = v.dataset.src; v.addEventListener('playing', () => v.classList.add('on'), { once: true }); }
      if (!reduce) v.play().catch(() => {});
    } else if (!v.paused) v.pause();
  }), { rootMargin: '200px' });
  vids.forEach(v => vio.observe(v));

  // ---- hero ustida qor (Osmon dvigateli) ----
  const hero = document.getElementById('hero'), cv = hero.querySelector('.snow'), toggle = hero.querySelector('.snow-toggle');
  if (!window.Osmon || reduce) { toggle.hidden = true; return; }
  const os = new window.Osmon(cv);
  os.setKind('snow'); os.setLevel(window.innerWidth < 760 ? 0 : 1); os.setMelt(true);
  function layout() {
    const r = hero.getBoundingClientRect();
    os.resize(r.width, r.height); os.setGround(r.height - 2);
    const ledges = [...hero.querySelectorAll('.ledge')].map((el, i) => {
      const b = el.getBoundingClientRect();
      return { id: 'l' + i, l: b.left - r.left, t: b.top - r.top, r: b.right - r.left, b: b.bottom - r.top, max: false };
    });
    os.setWindows(ledges);
  }
  window.__snowRelayout = layout;
  layout();
  window.addEventListener('resize', () => { clearTimeout(layout._t); layout._t = setTimeout(layout, 150); });
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); os.setCursorLocal(e.clientX - r.left, e.clientY - r.top); });
  let userOff = store.get('snow') === 'off', visible = true;
  const apply = () => { os.setPaused(userOff || !visible); toggle.setAttribute('aria-pressed', String(!userOff)); };
  toggle.addEventListener('click', () => { userOff = !userOff; store.set('snow', userOff ? 'off' : 'on'); if (userOff) os.clearAll(); apply(); });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; apply(); }).observe(hero);
  os.start(); apply();
})();
