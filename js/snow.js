/* Osmon — desktop ob-havo effektlari dvigateli.
 * Muallif: Anvar Zarifov © 2026. Barcha huquqlar himoyalangan.
 * Bitta canvas ustida ishlaydi: qor oynalar ustiga to'planadi, yomg'ir sachraydi,
 * o'rik gullari va barglar oynalarda yotadi, yaltiroq qo'ng'izlar kursorga yig'iladi,
 * meteorlar oynalarga urilib uchqun chiqaradi.
 * Koordinatalar: shu canvasning lokal DIP pikseli (ekran chap-yuqori burchagi = 0,0).
 */
(function (root) {
  'use strict';
  const BIN = 4;                                   // qor uyumi kengligi bo'yicha 1 katak = 4px
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const TARGET = {                                 // [kam, o'rta, ko'p]
    snow: [40, 85, 160], rain: [130, 280, 520], petals: [16, 34, 64],
    leaves: [10, 22, 40], fireflies: [14, 28, 48], stars: [0, 0, 0],
  };
  const METEOR_GAP = [2.8, 1.4, 0.65];             // soniya

  /* ---------- sprite'lar (bir marta chiziladi) ---------- */
  function sprite(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
  function petalSprite(col, edge) {
    return sprite(28, 28, (g) => {
      g.translate(14, 14);
      for (let i = 0; i < 5; i++) {                // o'rik guli: 5 ta yumaloq gulbarg
        g.save(); g.rotate(i * Math.PI * 2 / 5);
        const gr = g.createRadialGradient(0, -6, 0, 0, -6, 7);
        gr.addColorStop(0, col); gr.addColorStop(1, edge);
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, -6.2, 4.4, 6, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.fillStyle = '#f2b84b'; g.beginPath(); g.arc(0, 0, 2.2, 0, 7); g.fill();
      g.fillStyle = '#c0574f'; for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.arc(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0.7, 0, 7); g.fill(); }
    });
  }
  function singlePetal(col) {
    return sprite(14, 14, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 14); gr.addColorStop(0, '#fff7f8'); gr.addColorStop(1, col);
      g.fillStyle = gr; g.beginPath(); g.moveTo(7, 13); g.bezierCurveTo(-1, 8, 1, 1, 7, 1.5); g.bezierCurveTo(13, 1, 15, 8, 7, 13); g.fill();
    });
  }
  function leafSprite(col, dark, kind) {
    return sprite(34, 34, (g) => {
      g.translate(17, 17); g.rotate(-0.6);
      g.fillStyle = col; g.strokeStyle = dark; g.lineWidth = 1;
      g.beginPath();
      if (kind === 0) {                            // chinor (plane tree) bargi — 5 uchli
        const pts = [[0, -14], [4, -6], [12, -9], [8, -1], [14, 4], [5, 4], [3, 12], [0, 7], [-3, 12], [-5, 4], [-14, 4], [-8, -1], [-12, -9], [-4, -6]];
        g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.closePath();
      } else {                                     // tut / terak bargi — oval
        g.moveTo(0, -13); g.bezierCurveTo(10, -8, 10, 6, 0, 12); g.bezierCurveTo(-10, 6, -10, -8, 0, -13);
      }
      g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -11); g.lineTo(0, 15); g.stroke();
    });
  }
  function glowSprite(r, rgb) {
    return sprite(r * 2, r * 2, (g) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.18, `rgba(${rgb},0.85)`);
      gr.addColorStop(0.45, `rgba(${rgb},0.22)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    });
  }

  function subtract(segs, a, b) {
    const out = [];
    for (const [s, e] of segs) {
      if (b <= s || a >= e) { out.push([s, e]); continue; }
      if (a - s > 6) out.push([s, a]);
      if (e - b > 6) out.push([b, e]);
    }
    return out;
  }
  const inSegs = (segs, x) => { for (const s of segs) if (x >= s[0] && x <= s[1]) return s; return null; };

  class Osmon {
    constructor(canvas) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.kind = 'snow'; this.level = 1; this.lowPower = false; this.paused = false;
      this.ox = 0; this.oy = 0; this.W = 0; this.H = 0; this.ground = null;
      this.wins = []; this.winMap = new Map(); this.ledges = []; this.ledgeMap = new Map();
      this.piles = new Map(); this.parts = []; this.fx = []; this.rest = [];
      this.cur = { x: -9999, y: -9999, vx: 0, vy: 0, still: 0, seen: false };
      this.flash = 0; this.bolt = null; this.boltT = rnd(6, 14); this.meteorT = 1; this.frame = 0;
      this.spr = {
        blossom: [petalSprite('#fff6f7', '#f6c7d3'), petalSprite('#ffffff', '#f3d3dc'), petalSprite('#fde6ec', '#ec9fb4')],
        petal: [singlePetal('#f7c3d0'), singlePetal('#fbd9e1'), singlePetal('#f2aec0')],
        leaf: [leafSprite('#e0892e', '#9a5418', 0), leafSprite('#c8412c', '#7d2416', 0), leafSprite('#e9b93a', '#9c7615', 1), leafSprite('#b5642a', '#6e3a12', 1), leafSprite('#d9a23a', '#8a5c14', 0)],
        flake: sprite(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.62, 'rgba(240,246,255,0.45)'); gr.addColorStop(1, 'rgba(235,242,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }),
        fly: glowSprite(16, '255,226,120'), spark: glowSprite(8, '255,240,200'), sparkBlue: glowSprite(8, '170,220,255'),
      };
      this._loop = this._loop.bind(this); this._last = 0; this._raf = 0;
    }

    /* ---------------- tashqi API ---------------- */
    resize(w, h) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.W = w; this.H = h; if (this.ground == null) this.ground = h;
      this._ledges();
    }
    setOrigin(ox, oy) { this.ox = ox; this.oy = oy; }
    setGround(y) { if (Math.abs((this.ground || 0) - y) > 1) { this._dislodge('g'); this.ground = y; this._ledges(); } }
    setLevel(l) { this.level = clamp(l | 0, 0, 3); }
    setMelt(v) { this.melt = !!v; for (const p of this.piles.values()) p.dirty = true; }
    // hamma qorni tozalash: uyumlar chang bo'lib sochiladi
    clearAll() {
      for (const led of this.ledges) {
        const p = this.piles.get(led.id); if (p) for (let k = 0; k < p.n; k += 2) { const h = p.bins[k], x = p.l + k * BIN; if (h > 0.8 && inSegs(led.segs, x)) this._powder(x, led.y - h * 0.5, Math.min(3, h / 3)); }
        this.rest.forEach(r => { r.age = Math.max(r.age, 235); });
      }
      this.piles.clear(); this.runs = [];
      if (this.extra && this.extra.clear) this.extra.clear();
    }
    setLowPower(v) { this.lowPower = !!v; }
    setKind(k) {
      if (k === this.kind) return;
      this.kind = k; this.parts = []; this.fx = []; this.rest = []; this.piles.clear(); this.runs = [];
      this.flash = 0; this.bolt = null; this.meteorT = 0.6;
      if (this.extra) this.extra.reset();
    }
    setPaused(p) {
      this.paused = !!p;
      if (this.paused) { cancelAnimationFrame(this._raf); this._raf = 0; this.g.clearRect(0, 0, this.W, this.H); }
      else if (!this._raf) this.start();
    }
    /** list: [{id,l,t,r,b,max}] global DIP, z-tartibda (eng ustidagi birinchi) */
    setWindows(list) {
      const loc = list.map(w => ({ id: String(w.id), l: w.l - this.ox, t: w.t - this.oy, r: w.r - this.ox, b: w.b - this.oy, max: !!w.max }));
      const now = new Map(loc.map(w => [w.id, w]));
      for (const [id, o] of this.winMap) {
        const n = now.get(id);
        if (!n || Math.abs(n.l - o.l) > 1 || Math.abs(n.t - o.t) > 1 || Math.abs((n.r - n.l) - (o.r - o.l)) > 1) this._dislodge(id, n ? clamp((n.l - o.l) / 6, -3, 3) : 0, !n);
      }
      this.winMap = now; this.wins = loc; this._ledges();
    }
    setCursor(x, y) {                              // global DIP
      const lx = x - this.ox, ly = y - this.oy, c = this.cur;
      if (c.seen) { c.vx = c.vx * 0.5 + (lx - c.x) * 0.5; c.vy = c.vy * 0.5 + (ly - c.y) * 0.5; }
      if (Math.abs(lx - c.x) + Math.abs(ly - c.y) > 2) c.still = 0;
      c.x = lx; c.y = ly; c.seen = true;
    }
    setCursorLocal(x, y) { this.setCursor(x + this.ox, y + this.oy); }
    start() { this._last = performance.now(); this._dts = 1; this._raf = requestAnimationFrame(this._loop); }

    /* ---------------- sirtlar (oyna tepalari + taskbar) ---------------- */
    _ledges() {
      const L = [], ws = this.wins;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        if (w.max || w.t < 6 || w.t > this.ground - 12 || w.r < 0 || w.l > this.W) continue;
        let segs = [[Math.max(w.l, 0), Math.min(w.r, this.W)]];
        for (let j = 0; j < i && segs.length; j++) { const o = ws[j]; if (o.t <= w.t + 1 && o.b > w.t) segs = subtract(segs, o.l, o.r); }
        if (segs.length) L.push({ id: w.id, y: w.t, l: w.l, r: w.r, segs });
      }
      L.push({ id: 'g', y: this.ground, l: 0, r: this.W, segs: [[0, this.W]], ground: true });
      this.ledges = L; this.ledgeMap = new Map(L.map(x => [x.id, x]));
    }
    _pile(led) {
      let p = this.piles.get(led.id);
      if (!p) { const n = Math.ceil((led.r - led.l) / BIN) + 1; p = { l: led.l, n, bins: new Float32Array(n), dirty: true }; this.piles.set(led.id, p); }
      return p;
    }
    _surface(led, x) {
      if (this.kind === 'snow') { const p = this.piles.get(led.id); if (p) { const k = ((x - p.l) / BIN) | 0; if (k >= 0 && k < p.n) return led.y - p.bins[k]; } }
      if (this.kind === 'leaves' || this.kind === 'petals') return led.y - this._stack(led.id, x);
      return led.y;
    }
    _stack(id, x) { let h = 0; for (const r of this.rest) if (r.led === id && Math.abs(r.x - x) < r.s * 0.45) h = Math.max(h, r.h); return h; }
    _hit(x, y0, y1) {
      let best = null;
      for (const led of this.ledges) {
        if (!inSegs(led.segs, x)) continue;
        const s = this._surface(led, x);
        if (y0 <= s + 0.5 && y1 >= s && (!best || s < best.s)) best = { led, s };
      }
      return best;
    }
    // oyna surildi / yopildi: ustidagi narsalar to'kilib tushadi
    _dislodge(id, dir = 0, gone = false) {
      if (this.runs) this.runs = this.runs.filter(r => r.win !== id);
      const led = this.ledgeMap.get(id), p = this.piles.get(id);
      if (p && led) {
        let budget = 700 - this.parts.length;
        for (let k = 0; k < p.n && budget > 0; k++) {
          const h = p.bins[k]; if (h < 0.7) continue;
          const x = p.l + k * BIN; if (!inSegs(led.segs, x)) continue;
          if (gone) {                                                           // oyna yopildi: qor bo'lak-bo'lak bo'lib tushadi
            if (k % 3 || budget-- <= 0) continue;
            this.parts.push({ t: 'chunk', lump: true, x: x + rnd(-2, 2), y: led.y - h * 0.5, vx: rnd(-0.4, 0.4), vy: rnd(0, 0.6), r: clamp(h * 0.45, 2.2, 5.5), a: 1 });
            continue;
          }
          const n = Math.min(3, Math.ceil(h / 4));                              // oyna surildi: qor harakatga qarama-qarshi sirpanadi
          for (let i = 0; i < n && budget-- > 0; i++)
            this.parts.push({ t: 'chunk', x: x + rnd(-2, 2), y: led.y - rnd(0, h), vx: rnd(-0.6, 0.6) - dir * rnd(0.4, 1.1), vy: rnd(-0.8, 0.3), r: rnd(1.4, 2.8), a: 1 });
        }
      }
      this.piles.delete(id);
      this.rest = this.rest.filter(r => {
        if (r.led !== id) return true;
        this.parts.push({ t: r.t, x: r.x, y: r.y - 2, vx: rnd(-0.8, 0.8) - dir, vy: rnd(-1, 0), rot: r.rot, vr: rnd(-0.08, 0.08), ph: rnd(0, 6), s: r.s, sp: r.sp, flip: r.flip || 0 });
        return false;
      });
    }
    _addSnow(led, x, amt) {
      const p = this._pile(led), k0 = ((x - p.l) / BIN) | 0, seg = inSegs(led.segs, x);
      const W = [0.06, 0.22, 0.5, 0.62, 0.5, 0.22, 0.06], MAXH = led.ground ? 14 : 9;
      for (let d = -3; d <= 3; d++) {
        const k = k0 + d; if (k < 0 || k >= p.n) continue;
        const bx = p.l + k * BIN, edge = seg ? Math.min(bx - seg[0], seg[1] - bx) : 0;
        const cap = Math.min(MAXH, 0.6 + Math.max(0, edge) * 0.22);           // chetlarida qor sirpanib tushadi
        p.bins[k] = Math.min(cap, p.bins[k] + amt * W[d + 3]);
      }
      p.dirty = true;
    }
    // bo'lak yerga urilib changga aylanadi
    _powder(x, y, k) {
      const n = Math.round(6 + k * 6);
      for (let i = 0; i < n && this.fx.length < 900; i++) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95), v = rnd(0.6, 2.4) * (0.6 + k * 0.4); this.fx.push({ t: 'powder', x: x + rnd(-3, 3), y: y - 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, r: rnd(0.8, 2), life: rnd(25, 55), max: 55 }); }
    }
    // yomg'ir tomchisi oyna oynasi bo'ylab pastga oqadi
    _run(led, x) {
      if (!this.runs) this.runs = [];
      const w = this.winMap.get(led.id); if (!w || this.runs.length > 45) return;
      this.runs.push({ win: led.id, x, y: led.y + 2, r: rnd(1.6, 2.8), stop: Math.min(w.b - 6, led.y + rnd(60, 340)), hold: rnd(10, 50), trail: [[x, led.y + 2]], fade: 1, wob: rnd(0, 6) });
    }
    _coveredAt(winId, x, y) {
      for (const w of this.wins) { if (w.id === winId) return false; if (x >= w.l && x <= w.r && y >= w.t && y <= w.b) return true; }
      return false;
    }
    _stepRuns(dt) {
      const out = [];
      for (const r of this.runs) {
        if (r.y >= r.stop) { r.fade -= 0.008 * dt; if (r.fade <= 0) continue; out.push(r); continue; }
        if (r.hold > 0) { r.hold -= dt; if (r.hold <= 0 && Math.random() < 0.3) r.r = Math.min(3.6, r.r + 0.3); out.push(r); continue; }   // ilinib qoladi
        r.y += rnd(0.8, 2.6) * (r.r / 2.2) * dt; r.x += Math.sin(r.y * 0.05 + r.wob) * 0.25 * dt;
        const last = r.trail[r.trail.length - 1]; if (r.y - last[1] > 5) { r.trail.push([r.x, r.y]); if (r.trail.length > 70) r.trail.shift(); }
        if (Math.random() < 0.025 * dt) r.hold = rnd(8, 60);                       // dog'ga ilinadi
        out.push(r);
      }
      this.runs = out;
    }
    _drawRuns() {
      const g = this.g;
      for (const r of this.runs) {
        g.globalAlpha = r.fade;
        g.strokeStyle = 'rgba(110,140,180,0.16)'; g.lineWidth = r.r * 0.8; g.lineCap = 'round'; g.beginPath();
        let pen = false;
        for (const [x, y] of r.trail) { if (this._coveredAt(r.win, x, y)) { pen = false; continue; } if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true; }
        g.stroke();
        for (let i = 0; i < r.trail.length; i += 6) { const [x, y] = r.trail[i]; if (this._coveredAt(r.win, x, y)) continue; g.fillStyle = 'rgba(90,120,160,0.3)'; g.beginPath(); g.arc(x + 1.5, y, 0.9, 0, 6.28); g.fill(); }
        if (!this._coveredAt(r.win, r.x, r.y)) {
          const gr = g.createRadialGradient(r.x - r.r * 0.3, r.y - r.r * 0.4, 0, r.x, r.y, r.r * 1.2);
          gr.addColorStop(0, 'rgba(235,244,255,0.55)'); gr.addColorStop(0.6, 'rgba(140,170,210,0.35)'); gr.addColorStop(1, 'rgba(40,60,95,0.55)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(r.x, r.y, r.r * 0.9, r.r * 1.15, 0, 0, 6.28); g.fill();
          g.strokeStyle = 'rgba(45,65,100,0.45)'; g.lineWidth = 0.7; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(r.x - r.r * 0.32, r.y - r.r * 0.42, r.r * 0.3, 0, 6.28); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    _relax() {
      for (const [id, p] of this.piles) {
        if (!p.dirty) continue; let moved = false; const b = p.bins;
        for (let k = 0; k < p.n - 1; k++) { const d = b[k] - b[k + 1]; if (d > 1.4 || d < -1.4) { const m = d * 0.22; b[k] -= m; b[k + 1] += m; moved = true; } }
        const m = this.melt ? (id === 'g' ? 0.004 : 0.003) : (id === 'g' ? 0.0025 : 0);           // sekin eriydi
        if (m) for (let k = 0; k < p.n; k++) if (b[k] > 0) b[k] = Math.max(0, b[k] - m * (0.6 + b[k] * 0.08));
        p.dirty = moved || !!m;
      }
    }

    /* ---------------- tug'ilish ---------------- */
    _target() {
      const T = TARGET[this.kind] || [0, 0, 0];
      let t = T[Math.min(this.level, 2)];
      if (this.level === 3) {                                                  // o'zgaruvchan: goh sekin, goh qalin yog'adi
        const s = this.frame / 60, w = (0.5 + 0.5 * Math.sin(s / 75)) * (0.65 + 0.35 * Math.sin(s / 23 + 1.3));
        t = T[0] * 0.25 + (T[2] - T[0] * 0.25) * w;
      }
      return Math.round(t * (this.lowPower ? 0.5 : 1));
    }
    _spawn(initial) {
      const k = this.kind, W = this.W, H = this.H, y = initial ? rnd(-H, 0) : rnd(-40, -10);
      if (k === 'snow') { const z = Math.random(); this.parts.push({ t: 'flake', x: rnd(-40, W + 40), y, vx: 0, vy: 0.35 + z * 0.75, r: 0.8 + z * 1.6, z, ph: rnd(0, 6.28), ph2: rnd(0, 6.28), fs: rnd(0.008, 0.016), sw: rnd(0.25, 0.6), a: 0.5 + z * 0.5 }); }
      else if (k === 'rain') { const z = Math.random(); this.parts.push({ t: 'drop', x: rnd(-80, W + 40), y: initial ? rnd(-H, H) : rnd(-60, -10), vx: 1.6, vy: 13 + z * 9, len: 9 + z * 12, z }); }
      else if (k === 'petals') { const whole = Math.random() < 0.35; this.parts.push({ t: whole ? 'blossom' : 'petal', x: rnd(-60, W), y, vx: 0, vy: rnd(0.55, 1.05), rot: rnd(0, 6.28), vr: rnd(-0.04, 0.04), ph: rnd(0, 6.28), s: whole ? rnd(15, 22) : rnd(8, 12), sp: whole ? pick(this.spr.blossom) : pick(this.spr.petal), flip: rnd(0, 6) }); }
      else if (k === 'leaves') { this.parts.push({ t: 'leaf', x: rnd(-60, W), y, vx: 0, vy: rnd(0.8, 1.5), rot: rnd(0, 6.28), vr: rnd(-0.05, 0.05), ph: rnd(0, 6.28), s: rnd(16, 26), sp: pick(this.spr.leaf), flip: rnd(0, 6) }); }
      else if (k === 'fireflies') { this.parts.push({ t: 'fly', x: rnd(0, W), y: rnd(H * 0.25, this.ground - 20), vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3), ph: rnd(0, 6.28), sp: rnd(0.02, 0.05), orb: rnd(28, 80), oa: rnd(0, 6.28), ov: rnd(0.008, 0.02) * (Math.random() < 0.5 ? -1 : 1) }); }
    }
    _meteor() {
      const W = this.W, fromRight = Math.random() < 0.7, ang = rnd(0.42, 0.75), sp = rnd(11, 17);
      this.parts.push({ t: 'meteor', x: fromRight ? rnd(W * 0.35, W + 120) : rnd(-120, W * 0.6), y: rnd(-60, this.H * 0.2), vx: (fromRight ? -1 : 1) * Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: rnd(90, 170), life: 0, hue: Math.random() < 0.3 ? 'b' : 'w' });
    }
    _burst(x, y, n, blue) {
      for (let i = 0; i < n; i++) { const a = rnd(Math.PI, Math.PI * 2), v = rnd(1, 4.5); this.fx.push({ t: 'spark', x, y, vx: Math.cos(a) * v * rnd(0.5, 1.4), vy: Math.sin(a) * v - rnd(0, 1.5), life: rnd(35, 70), max: 70, blue: blue && Math.random() < 0.6 }); }
      this.fx.push({ t: 'ring', x, y, life: 16, max: 16 });
    }
    _splash(x, y) {
      for (let i = 0; i < 3; i++) this.fx.push({ t: 'drip', x, y: y - 1, vx: rnd(-1.6, 1.6), vy: rnd(-2.8, -1.2), life: rnd(14, 24) });
      if (Math.random() < 0.4) this.fx.push({ t: 'ripple', x, y, life: 14, max: 14 });
    }
    _makeBolt() {
      const pts = [[rnd(this.W * 0.1, this.W * 0.9), -10]], end = rnd(this.H * 0.35, this.H * 0.7);
      while (pts[pts.length - 1][1] < end) { const [x, y] = pts[pts.length - 1]; pts.push([x + rnd(-38, 38), y + rnd(22, 48)]); }
      const br = []; for (let i = 0; i < 2; i++) { const s = pts[(rnd(2, pts.length - 2)) | 0]; if (!s) continue; const b = [s.slice()]; for (let j = 0; j < 4; j++) { const [x, y] = b[b.length - 1]; b.push([x + rnd(-40, 40), y + rnd(15, 35)]); } br.push(b); }
      this.bolt = { pts, br, life: 12 }; this.flash = 1;
    }

    /* ---------------- asosiy sikl ---------------- */
    _loop(now) {
      this._raf = requestAnimationFrame(this._loop);
      let ms = now - this._last;
      if (this.lowPower && ms < 30) return;          // batareyada ~30 fps
      this._last = now; this._dts = this._dts * 0.75 + clamp(ms / 16.667, 0.2, 3) * 0.25; const dt = this._dts;
      this.frame++;
      if (this.kind !== 'off') this._step(dt); else { const c = this.cur; c.still += dt / 60; c.vx *= 0.85; c.vy *= 0.85; }
      this._draw();
      if (this.extra) this.extra.frame(dt);
    }
    _step(dt) {
      const k = this.kind, c = this.cur, sec = dt / 60;
      c.still += sec; c.vx *= 0.85; c.vy *= 0.85;
      const target = this._target(); let live = 0;
      for (const p of this.parts) if (p.t !== 'chunk' && p.t !== 'meteor') live++;
      if (this.parts.length === 0 && target) for (let i = 0; i < target * 0.6; i++) this._spawn(true);
      const need = target - live; if (need > 0) for (let i = 0, n = Math.max(1, Math.round(need * dt / 40)); i < n; i++) this._spawn(false);

      if (k === 'stars') { this.meteorT -= sec * (this.lowPower ? 0.5 : 1); if (this.meteorT <= 0) { this._meteor(); this.meteorT = METEOR_GAP[this.level] * rnd(0.5, 1.6); } }
      if (k === 'rain' && this.level > 0) { this.boltT -= sec; if (this.boltT <= 0) { this._makeBolt(); this.boltT = rnd(9, 26); } }
      if (this.bolt) { this.bolt.life -= dt; if (this.bolt.life <= 0) this.bolt = null; if (this.bolt && this.bolt.life > 7.5 && this.bolt.life < 8.5) this.flash = 0.8; }
      this.flash = Math.max(0, this.flash - 0.07 * dt);

      const W = this.W, H = this.H, t = this.frame * 0.016;
      const wind = Math.sin(t * 0.13) * 0.35 + Math.sin(t * 0.041) * 0.25;
      const out = [];
      for (const p of this.parts) {
        const y0 = p.y;
        if (p.t === 'flake') {
          p.ph += p.fs * dt; p.ph2 += p.fs * 0.43 * dt;
          p.x += (Math.sin(p.ph) * p.sw + Math.sin(p.ph2) * p.sw * 0.5 + wind * (0.35 + p.z * 0.8)) * dt;
          p.y += p.vy * (1 + Math.sin(p.ph * 0.8) * 0.12) * dt;
          const h = this._hit(p.x, y0, p.y);
          if (h) { this._addSnow(h.led, p.x, p.r * 0.75); continue; }
        } else if (p.t === 'chunk') {
          p.vy = Math.min(p.vy + 0.16 * dt, 7); p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y > this.ground + 3) continue;
          const h = this._hit(p.x, y0, p.y);
          if (h) { this._addSnow(h.led, p.x, p.r * (p.lump ? 1.1 : 0.7)); if (p.lump) this._powder(p.x, h.s, p.r / 2.2); continue; }
        } else if (p.t === 'drop') {
          p.x += (p.vx + wind) * dt; p.y += p.vy * dt;
          const h = this._hit(p.x, y0, p.y);
          if (h) { if (Math.random() < 0.7) this._splash(p.x, h.s); if (!h.led.ground && Math.random() < 0.05) this._run(h.led, p.x); continue; }
        } else if (p.t === 'petal' || p.t === 'blossom' || p.t === 'leaf') {
          const leaf = p.t === 'leaf';
          p.ph += (leaf ? 0.035 : 0.025) * dt; p.flip += (leaf ? 0.06 : 0.04) * dt;
          p.vy = p.vy * 0.98 + (leaf ? 1.25 : 0.85) * 0.02 + 0.0;
          p.x += (Math.sin(p.ph) * (leaf ? 1.3 : 0.9) + wind * 1.2 + p.vx) * dt; p.vx *= 0.97;
          p.y += (p.vy + Math.cos(p.ph * 2) * 0.25) * dt; p.rot += p.vr * dt;
          this._kick(p);
          const h = this._hit(p.x, y0, p.y);
          if (h && p.vy > 0) {
            this.rest.push({ t: p.t, x: p.x, y: h.s, led: h.led.id, rot: p.rot, s: p.s, sp: p.sp, flip: Math.random() < 0.5 ? 0.35 : 1, h: (h.s === h.led.y ? 0 : h.led.y - h.s) + (leaf ? 2.2 : 1.2), age: 0 });
            continue;
          }
        } else if (p.t === 'fly') {
          p.ph += p.sp * dt;
          if (c.seen && c.still > 1.2 && c.x > -50 && c.x < W + 50) {        // kursor to'xtadi — atrofiga yig'ilishadi
            p.oa += p.ov * dt; const tx = c.x + Math.cos(p.oa) * p.orb, ty = c.y + Math.sin(p.oa) * p.orb * 0.7;
            p.vx += (tx - p.x) * 0.0016 * dt; p.vy += (ty - p.y) * 0.0016 * dt;
          } else { p.vx += rnd(-0.04, 0.04) * dt; p.vy += rnd(-0.04, 0.04) * dt; }
          const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy, sp2 = c.vx * c.vx + c.vy * c.vy;
          if (d2 < 3600 && sp2 > 20) { p.vx += dx / 60 * 0.6; p.vy += dy / 60 * 0.6; }   // tez qimirlasa qochishadi
          p.vx *= 0.975; p.vy *= 0.975; const v = Math.hypot(p.vx, p.vy); if (v > 2.2) { p.vx *= 2.2 / v; p.vy *= 2.2 / v; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < 20) p.vy += 0.05; if (p.y > this.ground - 10) p.vy -= 0.08;
          out.push(p); continue;
        } else if (p.t === 'meteor') {
          p.life += dt; let hit = null;
          const steps = 3; for (let s = 0; s < steps && !hit; s++) { const ya = p.y; p.x += p.vx * dt / steps; p.y += p.vy * dt / steps; hit = this._hit(p.x, ya, p.y); }
          if (hit) { this._burst(p.x, hit.s, this.lowPower ? 10 : 20, p.hue === 'b'); continue; }
          if (p.y > H + 50 || p.x < -250 || p.x > W + 250) continue;
          out.push(p); continue;
        }
        if (p.y > H + 30 || p.x < -150 || p.x > W + 150) continue;
        out.push(p);
      }
      this.parts = out;

      // yotgan gulbarg / barglar: kursor tegsa uchib ketadi, eskilari so'nadi
      const cap = k === 'leaves' ? 220 : 280;
      if (this.rest.length > cap) this.rest.splice(0, this.rest.length - cap);
      const keep = [];
      for (const r of this.rest) {
        r.age += sec;
        const led = this.ledgeMap.get(r.led);
        if (!led) { this.parts.push({ t: r.t, x: r.x, y: r.y, vx: rnd(-0.5, 0.5), vy: 0.5, rot: r.rot, vr: rnd(-0.05, 0.05), ph: rnd(0, 6), s: r.s, sp: r.sp, flip: 0 }); continue; }
        const dx = r.x - c.x, dy = r.y - c.y, sp2 = c.vx * c.vx + c.vy * c.vy, rad = k === 'leaves' ? 70 : 50;
        if (sp2 > 4 && dx * dx + dy * dy < rad * rad) {
          const f = 1 - Math.hypot(dx, dy) / rad;
          this.parts.push({ t: r.t, x: r.x, y: r.y - 3, vx: c.vx * 0.35 * f + Math.sign(dx) * rnd(0.5, 2), vy: -rnd(2, 4.5) * f - 0.5, rot: r.rot, vr: rnd(-0.15, 0.15), ph: rnd(0, 6), s: r.s, sp: r.sp, flip: rnd(0, 6) });
          continue;
        }
        if (r.age > 240) continue;
        keep.push(r);
      }
      this.rest = keep;

      // effektlar (uchqun, tomchi, halqa)
      const fx = [];
      for (const f of this.fx) {
        f.life -= dt; if (f.life <= 0) continue;
        if (f.t === 'spark') { f.vy += 0.09 * dt; f.vx *= 0.985; f.x += f.vx * dt; f.y += f.vy * dt; }
        else if (f.t === 'drip') { f.vy += 0.32 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
        else if (f.t === 'powder') { f.vx *= 0.94; f.vy = f.vy * 0.94 + 0.03 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
        fx.push(f);
      }
      this.fx = fx;
      if (this.runs && this.runs.length) this._stepRuns(dt);
      if (this.frame % 3 === 0) this._relax();
    }
    _kick(p) {
      const c = this.cur, dx = p.x - c.x, dy = p.y - c.y, sp2 = c.vx * c.vx + c.vy * c.vy;
      if (sp2 > 6 && dx * dx + dy * dy < 3600) { p.vx += c.vx * 0.05; p.vy += c.vy * 0.04 - 0.2; }
    }

    _draw() {
      const g = this.g, W = this.W, H = this.H, k = this.kind;
      g.clearRect(0, 0, W, H);
      if (k === 'rain') { g.fillStyle = 'rgba(14,24,44,0.07)'; g.fillRect(0, 0, W, H); }

      if (k === 'snow') {
        this._drawPiles();
        const fl = this.spr.flake;
        for (const p of this.parts) { const d = p.r * 2.7; g.globalAlpha = p.a; g.drawImage(fl, p.x - d / 2, p.y - d / 2, d, d); }
        for (const f of this.fx) if (f.t === 'powder') { const d = f.r * 2.7; g.globalAlpha = clamp(f.life / f.max, 0, 1) * 0.85; g.drawImage(fl, f.x - d / 2, f.y - d / 2, d, d); }
        g.globalAlpha = 1;
      } else if (k === 'rain') {
        if (this.runs && this.runs.length) this._drawRuns();
        g.lineCap = 'round';
        for (let layer = 0; layer < 2; layer++) {
          g.strokeStyle = layer ? 'rgba(205,222,245,0.62)' : 'rgba(170,190,220,0.32)'; g.lineWidth = layer ? 1.3 : 0.9; g.beginPath();
          for (const p of this.parts) { if ((p.z > 0.5) !== !!layer) continue; const s = p.len / p.vy; g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx) * s, p.y - p.len); }
          g.stroke();
        }
        g.fillStyle = 'rgba(215,230,250,0.8)';
        for (const f of this.fx) { if (f.t === 'drip') { g.beginPath(); g.arc(f.x, f.y, 1.1, 0, 6.28); g.fill(); } }
        g.strokeStyle = 'rgba(215,230,250,0.5)'; g.lineWidth = 1;
        for (const f of this.fx) { if (f.t === 'ripple') { const q = 1 - f.life / f.max; g.globalAlpha = 1 - q; g.beginPath(); g.ellipse(f.x, f.y, 2 + q * 9, 1 + q * 2.2, 0, 0, 6.28); g.stroke(); } }
        g.globalAlpha = 1;
        if (this.bolt) {
          const b = this.bolt; g.save(); g.globalAlpha = clamp(b.life / 8, 0, 1); g.strokeStyle = '#f4f8ff'; g.shadowColor = '#9cc4ff'; g.shadowBlur = 22; g.lineWidth = 2.6; g.lineJoin = 'round';
          const line = (pts, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.stroke(); };
          line(b.pts, 2.8); b.br.forEach(br => line(br, 1.3)); g.restore();
        }
        if (this.flash > 0) { g.fillStyle = `rgba(225,235,255,${this.flash * 0.22})`; g.fillRect(0, 0, W, H); }
      } else if (k === 'petals' || k === 'leaves') {
        for (const r of this.rest) { const led = this.ledgeMap.get(r.led); if (led && !inSegs(led.segs, r.x)) continue; this._sprite(r, r.flip, Math.min(1, (240 - r.age) / 20)); }
        for (const p of this.parts) this._sprite(p, Math.cos(p.flip), 1);
      } else if (k === 'fireflies') {
        g.globalCompositeOperation = 'lighter';
        const s = this.spr.fly;
        for (const p of this.parts) { const a = 0.15 + 0.85 * Math.max(0, Math.sin(p.ph)) ** 2; g.globalAlpha = a; g.drawImage(s, p.x - 16, p.y - 16); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      } else if (k === 'stars') {
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (const p of this.parts) {
          const v = Math.hypot(p.vx, p.vy), tx = p.x - p.vx / v * p.len, ty = p.y - p.vy / v * p.len;
          const gr = g.createLinearGradient(p.x, p.y, tx, ty); const col = p.hue === 'b' ? '170,215,255' : '255,246,220';
          gr.addColorStop(0, `rgba(${col},0.95)`); gr.addColorStop(0.25, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
          g.strokeStyle = gr; g.lineWidth = 2.2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(tx, ty); g.stroke();
          g.drawImage(p.hue === 'b' ? this.spr.sparkBlue : this.spr.spark, p.x - 8, p.y - 8);
        }
        for (const f of this.fx) {
          if (f.t === 'spark') { g.globalAlpha = clamp(f.life / 40, 0, 1); g.drawImage(f.blue ? this.spr.sparkBlue : this.spr.spark, f.x - 4, f.y - 4, 8, 8); }
          else if (f.t === 'ring') { const q = 1 - f.life / f.max; g.globalAlpha = (1 - q) * 0.8; g.strokeStyle = '#fff3d6'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(f.x, f.y, 4 + q * 26, 2 + q * 7, 0, 0, 6.28); g.stroke(); }
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
    }
    _sprite(p, sx, a) {
      const g = this.g, s = p.s; g.save(); g.globalAlpha = a; g.translate(p.x, p.y - s * 0.12); g.rotate(p.rot);
      g.scale(Math.abs(sx) < 0.15 ? 0.15 * Math.sign(sx || 1) : sx, 1); g.drawImage(p.sp, -s / 2, -s / 2, s, s); g.restore();
    }
    _drawPiles() {
      const g = this.g;
      for (const led of this.ledges) {
        const p = this.piles.get(led.id); if (!p) continue;
        for (const [a, b] of led.segs) {
          const k0 = Math.max(0, Math.floor((a - p.l) / BIN)), k1 = Math.min(p.n - 1, Math.ceil((b - p.l) / BIN));
          let mx = 0; for (let k = k0; k <= k1; k++) if (p.bins[k] > mx) mx = p.bins[k];
          if (mx < 0.4) continue;
          if (!p.disp || p.disp.length !== p.n) p.disp = Float32Array.from(p.bins);
          const D = p.disp; for (let k = k0; k <= k1; k++) D[k] += (p.bins[k] - D[k]) * 0.12;
          const y = led.y, hAt = k => { let s = 0, w = 0; for (let d = -2; d <= 2; d++) { const q = clamp(k + d, k0, k1), ww = 3 - Math.abs(d); s += D[q] * ww; w += ww; } return s / w; };
          const gr = g.createLinearGradient(0, y - mx, 0, y + 1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#f1f6fc'); gr.addColorStop(1, '#b9cbe2');
          g.save(); g.shadowColor = 'rgba(30,50,85,0.45)'; g.shadowBlur = 5; g.shadowOffsetY = 1.5;
          g.fillStyle = gr; g.beginPath(); g.moveTo(a, y + 1);
          let px = a, py = y - hAt(k0); g.lineTo(px, py);
          for (let k = k0 + 1; k <= k1; k++) { const x = clamp(p.l + k * BIN, a, b), yy = y - hAt(k); g.quadraticCurveTo(px, py, (px + x) / 2, (py + yy) / 2); px = x; py = yy; }
          g.lineTo(px, py); g.lineTo(b, y + 1); g.closePath(); g.fill(); g.restore();
          g.strokeStyle = 'rgba(150,175,205,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a, y + 0.5); g.lineTo(b, y + 0.5); g.stroke();
        }
      }
    }
  }
  Osmon.util = { rnd, pick, clamp, inSegs, glowSprite, sprite, BIN };
  root.Osmon = Osmon;
})(typeof window !== 'undefined' ? window : globalThis);
