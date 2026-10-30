/* Hero — a neural operator, live.
   An input field a(x) drifts (random Fourier modes + cursor bumps); its solution
   u(x) of the screened Poisson problem (I − α∇²)u = a is solved every frame by
   warm-started SOR sweeps. Between them, a network glyph with signals flowing
   through it stands for the learned operator G_θ : a ↦ u. */
(function () {
  window.DRS = window.DRS || {};

  // diverging map, matched to the site's blue → magenta accent
  const STOPS = [
    [-1.0, 30, 64, 175], [-0.5, 96, 140, 240], [0.0, 247, 248, 251],
    [0.5, 205, 120, 190], [1.0, 150, 30, 120]
  ];
  function cmap(v) {
    v = Math.max(-1, Math.min(1, v));
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i][0]) {
        const a = STOPS[i - 1], b = STOPS[i], f = (v - a[0]) / (b[0] - a[0]);
        return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])];
      }
    }
    return [150, 30, 120];
  }

  DRS.hero = function (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = 1, running = true, frame = 0, t = 0;
    let L = null;                      // layout
    let NX = 0, NY = 0, a, u, imgA, imgU, offA, offU;
    let scaleA = 1, scaleU = 1;
    const ALPHA = 40;                  // screening length² in grid units
    const OMEGA = 1.85;                // SOR over-relaxation
    const bumps = [];
    const pulses = [];

    // random Fourier modes for the drifting input field
    let seedN = 7;
    const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
    const MODES = [];
    // isotropic: random wave-vector directions, power-law amplitude decay
    for (let n = 0; n < 48; n++) {
      const km = 1 + rnd() * 9, th = rnd() * Math.PI;
      const kx = km * Math.cos(th), ky = km * Math.sin(th), k2 = km * km;
      MODES.push({ kx, ky, amp: (rnd() * 0.7 + 0.3) / Math.pow(1 + k2, 0.55),
                   ph: rnd() * 6.283, w: (rnd() - 0.5) * 0.9 });
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      layout();
      // pre-solve so u is converged on first paint
      synthA(); for (let k = 0; k < 300; k++) sor();
      draw();
    }

    function layout() {
      const pad = Math.round(Math.min(W, H) * 0.06), lab = 22;
      const vertical = W / H < 1.25;
      let fa, fu, net;
      if (vertical) {
        const netH = H * 0.26;
        const fh = (H - 2 * pad - netH - 2 * lab - 16) / 2;
        fa = { x: pad, y: pad + lab, w: W - 2 * pad, h: fh };
        net = { x: pad, y: fa.y + fh + 8, w: W - 2 * pad, h: netH };
        fu = { x: pad, y: net.y + netH + 8 + lab, w: W - 2 * pad, h: fh };
      } else {
        const netW = W * 0.2;
        const fw = (W - 2 * pad - netW - 16) / 2;
        fa = { x: pad, y: pad + lab, w: fw, h: H - 2 * pad - lab };
        net = { x: fa.x + fw + 8, y: fa.y, w: netW, h: fa.h };
        fu = { x: net.x + netW + 8, y: fa.y, w: fw, h: fa.h };
      }
      L = { vertical, fa, fu, net, lab };

      // field grid matched to region aspect (~4k cells)
      const asp = fa.w / fa.h;
      NX = Math.max(16, Math.round(Math.sqrt(4200 * asp)));
      NY = Math.max(10, Math.round(4200 / NX));
      a = new Float32Array(NX * NY); u = new Float32Array(NX * NY);
      offA = document.createElement('canvas'); offA.width = NX; offA.height = NY;
      offU = document.createElement('canvas'); offU.width = NX; offU.height = NY;
      imgA = offA.getContext('2d').createImageData(NX, NY);
      imgU = offU.getContext('2d').createImageData(NX, NY);

      // network glyph: layers along the flow axis
      const sizes = [4, 6, 6, 4];
      L.layers = sizes.map((n, li) => {
        const along = (li + 0.5) / sizes.length;
        return Array.from({ length: n }, (_, ni) => {
          const across = (ni + 0.5) / n;
          return vertical
            ? { x: net.x + net.w * (0.18 + 0.64 * across), y: net.y + net.h * along }
            : { x: net.x + net.w * along, y: net.y + net.h * (0.2 + 0.6 * across) };
        });
      });
      pulses.length = 0;
    }

    function synthA() {
      for (let j = 0; j < NY; j++) {
        const y = j / NX * Math.PI * 2;
        for (let i = 0; i < NX; i++) {
          const x = i / NX * Math.PI * 2;
          let s = 0;
          for (const m of MODES) s += m.amp * Math.cos(m.kx * x + m.ky * y + m.ph + m.w * t);
          for (const b of bumps) {
            const dx = i - b.i, dy = j - b.j;
            s += b.amp * Math.exp(-(dx * dx + dy * dy) / (2 * b.r * b.r));
          }
          a[j * NX + i] = s;
        }
      }
    }

    // SOR sweep for (I − α∇²)u = a, periodic in x, Neumann in y
    function sor() {
      const c = 1 / (1 + 4 * ALPHA);
      for (let j = 0; j < NY; j++) {
        const jm = j > 0 ? j - 1 : 0, jp = j < NY - 1 ? j + 1 : NY - 1;
        for (let i = 0; i < NX; i++) {
          const im = (i - 1 + NX) % NX, ip = (i + 1) % NX, k = j * NX + i;
          const nb = u[j * NX + im] + u[j * NX + ip] + u[jm * NX + i] + u[jp * NX + i];
          u[k] += OMEGA * ((a[k] + ALPHA * nb) * c - u[k]);
        }
      }
    }

    function paintField(field, img, off, scale) {
      const d = img.data;
      for (let k = 0; k < field.length; k++) {
        const c = cmap(field[k] / scale), p = k << 2;
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
      off.getContext('2d').putImageData(img, 0, 0);
    }
    function maxAbs(f) { let m = 1e-6; for (let k = 0; k < f.length; k++) { const v = Math.abs(f[k]); if (v > m) m = v; } return m; }

    function rrect(r, rad) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, rad); else ctx.rect(r.x, r.y, r.w, r.h);
    }
    function blit(off, r) {
      ctx.save(); rrect(r, 12); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, r.x, r.y, r.w, r.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1; rrect(r, 12); ctx.stroke();
    }
    function label(text, sub, x, y) {
      ctx.font = "600 11px Inter, -apple-system, system-ui, sans-serif";
      ctx.fillStyle = '#6e6e73'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
      if (sub) {
        const w = ctx.measureText(text).width;
        ctx.font = "italic 13px Georgia, 'Times New Roman', serif"; ctx.fillStyle = '#1d1d1f';
        ctx.fillText(sub, x + w + 8, y);
      }
    }

    let touched = false;
    function hint(r) {
      const txt = window.matchMedia('(hover: none)').matches ? 'Touch to add a source' : 'Hover to add a source';
      ctx.font = "600 11.5px Inter, -apple-system, system-ui, sans-serif";
      const w = ctx.measureText(txt).width + 22, h = 24, x = r.x + r.w - w - 10, y = r.y + 10;
      const pulse = 0.82 + 0.18 * Math.sin(t * 3);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * pulse})`;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.rect(x, y, w, h); ctx.fill();
      ctx.fillStyle = '#1d1d1f'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x + 11, y + h / 2 + 0.5);
      ctx.textBaseline = 'alphabetic';
    }

    function drawNet() {
      const Ls = L.layers;
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(29,29,31,.07)';
      ctx.beginPath();
      for (let l = 0; l < Ls.length - 1; l++)
        for (const p of Ls[l]) for (const q of Ls[l + 1]) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
      ctx.stroke();

      // spawn + advance pulses
      if (pulses.length < 26 && Math.random() < 0.5) {
        pulses.push({ l: 0, i: (Math.random() * Ls[0].length) | 0, j: (Math.random() * Ls[1].length) | 0, p: 0 });
      }
      for (let n = pulses.length - 1; n >= 0; n--) {
        const s = pulses[n];
        s.p += 0.06;
        if (s.p >= 1) {
          if (s.l + 2 < Ls.length) { s.l++; s.i = s.j; s.j = (Math.random() * Ls[s.l + 1].length) | 0; s.p = 0; }
          else { pulses.splice(n, 1); continue; }
        }
        const P = Ls[s.l][s.i], Q = Ls[s.l + 1][s.j];
        const x = P.x + (Q.x - P.x) * s.p, y = P.y + (Q.y - P.y) * s.p;
        const c = cmap(-1 + 2 * (s.l + s.p) / (Ls.length - 1));
        ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},.9)`;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill();
      }
      for (const layer of Ls) for (const p of layer) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(29,29,31,.22)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 6.283); ctx.fill(); ctx.stroke();
      }
      // operator label beside the glyph
      ctx.font = "italic 600 20px Georgia, 'Times New Roman', serif"; ctx.fillStyle = '#1d1d1f';
      if (L.vertical) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('𝒢', L.net.x, L.net.y + L.net.h / 2);
        ctx.font = "italic 12px Georgia, serif"; ctx.fillText('θ', L.net.x + 15, L.net.y + L.net.h / 2 + 7);
        ctx.textAlign = 'right'; ctx.font = "600 11px Inter, -apple-system, system-ui, sans-serif"; ctx.fillStyle = '#6e6e73';
        ctx.fillText('NEURAL', L.net.x + L.net.w, L.net.y + L.net.h / 2 - 7);
        ctx.fillText('OPERATOR', L.net.x + L.net.w, L.net.y + L.net.h / 2 + 8);
      } else {
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('𝒢θ', L.net.x + L.net.w / 2, L.net.y + 18);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    function draw() {
      if (!L) return;
      ctx.fillStyle = '#f7f8fb'; ctx.fillRect(0, 0, W, H);
      scaleA = 0.9 * scaleA + 0.1 * maxAbs(a);
      scaleU = 0.9 * scaleU + 0.1 * maxAbs(u);
      paintField(a, imgA, offA, scaleA);
      paintField(u, imgU, offU, scaleU);
      label('INPUT', 'a(x)', L.fa.x, L.fa.y - 8);
      blit(offA, L.fa);
      if (!touched) hint(L.fa);
      drawNet();
      label('SOLUTION', 'u = 𝒢θ[a]', L.fu.x, L.fu.y - 8);
      blit(offU, L.fu);
    }

    function step() {
      t += 0.04;
      for (let n = bumps.length - 1; n >= 0; n--) { bumps[n].amp *= 0.96; if (Math.abs(bumps[n].amp) < 0.02) bumps.splice(n, 1); }
      synthA();
      for (let k = 0; k < 8; k++) sor();
      draw();
    }

    // hover the input field to inject sources
    let lastBump = 0;
    function onPointer(e) {
      if (!L) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top, f = L.fa;
      const inside = x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h;
      canvas.style.cursor = inside ? 'crosshair' : '';
      if (!inside) return;
      touched = true;
      const now = performance.now(); if (now - lastBump < 90) return; lastBump = now;
      if (bumps.length > 12) bumps.shift();
      bumps.push({ i: (x - f.x) / f.w * NX, j: (y - f.y) / f.h * NY, amp: 1.0, r: NX / 28 });
    }
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerdown', onPointer);

    function loop() { requestAnimationFrame(loop); if (!running || !L) return; if (frame++ % 2) return; step(); }

    resize();
    window.addEventListener('resize', resize);
    loop();
    return {
      pause() { running = false; },
      resume() { running = true; },
    };
  };
})();
