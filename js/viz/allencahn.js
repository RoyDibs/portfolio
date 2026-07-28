/* Allen–Cahn phase field:  uₜ = ε²∇²u + (u − u³)
   Spinodal decomposition + coarsening, rendered as a colour field. */
(function () {
  window.DRS = window.DRS || {};

  DRS.allenCahn = function (canvas) {
    const ctx = canvas.getContext('2d');
    const NX = 200, NY = 150;
    let u = new Float32Array(NX * NY);
    let v = new Float32Array(NX * NY);
    let img, W, H, running = false, raf = 0;
    let D = 0.40;          // diffusion (interface width); CFL: dt*D*4 < 1
    let rate = 1.0;        // reaction strength
    const dt = 0.30;

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = NX; canvas.height = NY;
      img = ctx.createImageData(NX, NY);
    }
    function seed() { for (let k = 0; k < u.length; k++) u[k] = (Math.random() * 2 - 1) * 0.9; }
    const idx = (i, j) => j * NX + i;

    function stepOnce() {
      for (let j = 0; j < NY; j++) {
        const jm = (j - 1 + NY) % NY, jp = (j + 1) % NY;
        for (let i = 0; i < NX; i++) {
          const im = (i - 1 + NX) % NX, ip = (i + 1) % NX;
          const k = idx(i, j);
          const c = u[k];
          const lap = u[idx(im, j)] + u[idx(ip, j)] + u[idx(i, jm)] + u[idx(i, jp)] - 4 * c;
          v[k] = c + dt * (D * lap + rate * (c - c * c * c));
        }
      }
      const t = u; u = v; v = t;
    }

    // ParaView "coolwarm" diverging colormap (scientific standard) on phase ±1
    const CW = [
      [0.00, 59, 76, 192], [0.25, 123, 157, 240], [0.50, 221, 221, 221],
      [0.75, 233, 150, 122], [1.00, 180, 4, 38]
    ];
    function color(t) {
      const s = (Math.max(-1, Math.min(1, t)) + 1) * 0.5;   // [-1,1] -> [0,1]
      for (let i = 1; i < CW.length; i++) {
        if (s <= CW[i][0]) {
          const a = CW[i - 1], b = CW[i];
          const f = (s - a[0]) / (b[0] - a[0]);
          return [ (a[1] + f * (b[1] - a[1])) | 0, (a[2] + f * (b[2] - a[2])) | 0, (a[3] + f * (b[3] - a[3])) | 0 ];
        }
      }
      return [180, 4, 38];
    }

    function render() {
      const d = img.data;
      for (let k = 0; k < u.length; k++) {
        const c = color(u[k]); const p = k << 2;
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    function loop() {
      if (running) { for (let s = 0; s < 3; s++) stepOnce(); render(); }
      raf = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    seed(); render();

    const $ = id => document.getElementById(id);
    const be = $('acEps'), bo = $('acEpsOut');
    if (be) be.addEventListener('input', () => { const val = parseFloat(be.value); D = 0.18 + (val - 0.6) * 0.20; if (bo) bo.textContent = val.toFixed(1); });
    const br = $('acRate'), br0 = $('acRateOut');
    if (br) br.addEventListener('input', () => { rate = parseFloat(br.value); if (br0) br0.textContent = rate.toFixed(1); });
    const rs = $('acReset'); if (rs) rs.addEventListener('click', () => { seed(); render(); });

    loop();
    return { pause() { running = false; }, resume() { running = true; } };
  };
})();
