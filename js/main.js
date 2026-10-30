/* main.js — view routing, switchers, lazy media + viz lifecycle */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* ---- year ---- */
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ---- lazy media: load gifs/videos only when their panel is shown ---- */
  function loadMedia(root) {
    root.querySelectorAll('[data-src]').forEach(el => {
      el.src = el.dataset.src; el.removeAttribute('data-src');
      if (el.tagName === 'VIDEO') { el.load(); el.play().catch(() => {}); }
    });
  }
  // sims size themselves from clientWidth; nudge them after a panel becomes visible
  const relayout = () => window.dispatchEvent(new Event('resize'));

  /* ---- views (hash router) ---- */
  const VIEWS = ['overview', 'research', 'lab', 'publications', 'about'];
  // old single-page anchors still land somewhere sensible
  const ALIAS = { top: 'overview', journey: 'about', awards: 'about', gallery: 'about', contact: 'about',
                  motion: 'research', work: 'research', papers: 'publications' };

  function show(name) {
    if (!VIEWS.includes(name)) name = ALIAS[name] || 'overview';
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== name; });
    $$('.nav__tabs a').forEach(a => a.classList.toggle('is-active', a.dataset.view === name));
    const active = $('#view-' + name);
    const panel = active.querySelector('.project.is-active');
    if (panel) loadMedia(panel);
    window.scrollTo(0, 0);
    relayout();
  }
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  /* ---- switchers: research projects + lab sims ---- */
  $$('[data-switcher]').forEach(group => {
    const buttons = Array.from(group.querySelectorAll('[data-target]'));
    buttons.forEach(btn => btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.toggle('is-active', b === btn);
        document.getElementById(b.dataset.target).classList.toggle('is-active', b === btn);
      });
      const panel = document.getElementById(btn.dataset.target);
      loadMedia(panel);
      relayout();
    }));
  });

  /* ---- publication filter ---- */
  const filter = $('#pubFilter');
  if (filter) filter.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]'); if (!btn) return;
    filter.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    $$('.pub').forEach(p => { p.hidden = f !== 'all' && p.dataset.kind !== f; });
  });

  /* ---- gallery strip ---- */
  const strip = $('#galleryGrid');
  if (window.DRS && DRS.gallery) DRS.gallery(strip);
  $$('[data-scroll]').forEach(b => b.addEventListener('click', () => {
    strip.scrollBy({ left: +b.dataset.scroll * strip.clientWidth * 0.8, behavior: 'smooth' });
  }));

  /* ---- viz lifecycle: run only while visible on screen ---- */
  const registry = [
    { id: 'heroCanvas', make: () => DRS.hero($('#heroCanvas')) },
    { id: 'waveCanvas', make: () => DRS.wave($('#waveCanvas')) },
    { id: 'acCanvas',   make: () => DRS.allenCahn($('#acCanvas')) },
    { id: 'turbCanvas', make: () => DRS.turbulence($('#turbCanvas'), $('#viz-turb .viz__stage')) },
    { id: 'ctrlCanvas', make: () => DRS.control($('#ctrlCanvas')) },
  ];
  const instances = {};
  registry.forEach(r => {
    const el = document.getElementById(r.id);
    if (!el) return;
    try {
      instances[r.id] = r.make();
      instances[r.id].pause();
    } catch (err) { console.warn('viz init failed', r.id, err); }
  });

  // run a sim only while its canvas is displayed and overlaps the viewport
  // (checked explicitly: IntersectionObserver misses display:none -> visible flips)
  const syncViz = () => {
    Object.keys(instances).forEach(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      const visible = r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
      if (visible) instances[id].resume(); else instances[id].pause();
    });
  };
  let pending = false;
  const queueSync = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; syncViz(); }); };
  window.addEventListener('scroll', queueSync, { passive: true });
  window.addEventListener('resize', queueSync);

  show(location.hash.slice(1));
})();
