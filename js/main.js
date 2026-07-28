/* main.js — page orchestration + lazy viz lifecycle */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- year ---- */
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ---- nav scroll state + burger ---- */
  const nav = $('#nav'), links = $('.nav__links'), burger = $('#navBurger');
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
    const sp = $('#scrollProgress');
    const h = document.documentElement;
    const p = h.scrollTop / (h.scrollHeight - h.clientHeight);
    if (sp) sp.style.width = (p * 100) + '%';
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if (burger) burger.addEventListener('click', () => {
    links.classList.toggle('is-open'); burger.classList.toggle('is-open');
  });
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('is-open'); burger.classList.remove('is-open');
  }));

  /* ---- cursor glow ---- */
  const glow = $('#cursorGlow');
  if (glow && window.matchMedia('(hover: hover)').matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function follow() { cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      glow.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(follow); })();
  }

  /* ---- reveal on scroll ---- */
  const revObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); revObs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => reduce ? el.classList.add('is-in') : revObs.observe(el));

  /* ---- animated stat counters ---- */
  const statObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = parseFloat(el.dataset.count);
      const suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
      const dur = 1400, t0 = performance.now();
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur);
        const val = Math.floor((1 - Math.pow(1 - k, 3)) * target);
        el.textContent = pre + val.toLocaleString() + suf;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick); statObs.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('.stat__num').forEach(el => statObs.observe(el));

  /* ---- gallery ---- */
  if (window.DRS && DRS.gallery) DRS.gallery($('#galleryGrid'));

  /* ---- viz lifecycle: build lazily, pause when off-screen ---- */
  const registry = [
    { id: 'heroCanvas',    make: () => DRS.hero($('#heroCanvas')) },
    { id: 'waveCanvas',    make: () => DRS.wave($('#waveCanvas')) },
    { id: 'acCanvas',      make: () => DRS.allenCahn($('#acCanvas')) },
    { id: 'turbCanvas',    make: () => DRS.turbulence($('#turbCanvas'), $('#viz-turb .viz__stage')) },
    { id: 'ctrlCanvas',    make: () => DRS.control($('#ctrlCanvas')) },
    { id: 'contactCanvas', make: () => contactField($('#contactCanvas')) },
  ];
  const instances = {};
  const vizObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const id = e.target.id;
      const inst = instances[id];
      if (!inst) return;
      if (e.isIntersecting) inst.resume(); else inst.pause();
    });
  }, { threshold: 0.05 });

  registry.forEach(r => {
    const el = document.getElementById(r.id);
    if (!el) return;
    try {
      instances[r.id] = r.make();
      // hero + contact autoplay; others resume when scrolled into view
      if (r.id === 'heroCanvas') instances[r.id].resume && instances[r.id].resume();
      vizObs.observe(el);
    } catch (err) { console.warn('viz init failed', r.id, err); }
  });

  /* ---- contact constellation ---- */
  function contactField(canvas) {
    if (!canvas) return { pause() {}, resume() {} };
    const ctx = canvas.getContext('2d');
    let W, H, DPR, pts = [], running = false, raf = 0;
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.min(56, Math.floor(W / 26));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      }));
    }
    function step() {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 130 * 130) {
            ctx.strokeStyle = `rgba(37,99,235,${0.16 * (1 - d2 / (130 * 130))})`;
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(13,148,136,.85)';
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, 6.283); ctx.fill(); }
    }
    let cframe = 0;
    function loop() { raf = requestAnimationFrame(loop); if (!running) return; if (cframe++ % 2) return; step(); }
    resize(); window.addEventListener('resize', resize); loop();
    return { pause() { running = false; }, resume() { running = true; } };
  }
})();
