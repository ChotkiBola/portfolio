/* Anvar Zarifov — portfolio. Til, videolar va qor. */
(function () {
  'use strict';
  // ---- aloqa havolalari: shu yerni to'ldiring ----
  const CONTACT = {
    instagram: 'https://www.instagram.com/vaybbloger/',
    telegram: 'https://t.me/hisperspective',
    email: 'mailto:anvarzarifov200406@gmail.com',
  };
  document.querySelectorAll('[data-contact]').forEach(a => {
    const url = CONTACT[a.dataset.contact];
    if (url) a.href = url;
    else if (a.closest('.links')) a.setAttribute('aria-disabled', 'true');
  });

  // ---- til ----
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const langs = ['uz', 'ru', 'en'];
  let cur = 'uz';
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
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
    document.querySelectorAll('[data-i18n-alt]').forEach(el => { const v = d[el.dataset.i18nAlt]; if (v) el.alt = v; });
    if (touch) document.querySelectorAll('[data-i18n-touch]').forEach(el => { const v = d[el.dataset.i18nTouch]; if (v) el.textContent = v; });
    document.title = d['meta.title'];
    const md = document.querySelector('meta[name="description"]'); if (md && d['meta.desc']) md.content = d['meta.desc'];
    cur = l;
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    store.set('lang', l);
    if (window.__snowRelayout) window.__snowRelayout();
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(guess());

  // ---- sarlavha: aylantirilganda fon ----
  const top = document.querySelector('.top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---- telefonda: .exe o'rniga "kompyuterda oching" ----
  if (touch) {
    document.querySelectorAll('.dl-mobile').forEach(m => {
      m.hidden = false;
      const f = m.closest('.feature-text');
      f.querySelector('.dl').hidden = true; f.querySelector('.dl-note').hidden = true;
      const btn = m.querySelector('.dl-send');
      btn.addEventListener('click', async () => {
        const url = location.origin + '/#works';
        try {
          if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
          await navigator.clipboard.writeText(url);
          const t = btn.textContent; btn.textContent = window.I18N[cur]['dl.copied'];
          setTimeout(() => { btn.textContent = t; }, 2000);
        } catch (e) {}
      });
    });
  }

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
