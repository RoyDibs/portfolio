/* Wave equation ∂²u/∂t² = c²∇²u − damping·∂u/∂t
   Finite-difference on a grid, rendered as a live 3D wireframe. */
(function () {
  window.DRS = window.DRS || {};

  DRS.wave = function (canvas, opts) {
    const ctx = canvas.getContext('2d');
    const NX = 64, NY = 48;
    let u = new Float32Array(NX * NY);
    let uPrev = new Float32Array(NX * NY);
    let uNext = new Float32Array(NX * NY);
    let W, H, DPR, running = false, raf = 0, phase = 0;
    const idx = (i, j) => j * NX + i;

    let freq = 5.3, amp = 0.6, damp = 0.0;
    const C2 = 0.18;               // wave speed² (CFL-safe)

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function reset() { u.fill(0); uPrev.fill(0); uNext.fill(0); phase = 0; }

    function physics() {
      // drive a source at centre
      phase += freq * 0.016;
      const cx = NX >> 1, cy = NY >> 1;
      u[idx(cx, cy)] = Math.sin(phase) * amp;

      for (let j = 1; j < NY - 1; j++) {
        for (let i = 1; i < NX - 1; i++) {
          const k = idx(i, j);
          const lap = u[k - 1] + u[k + 1] + u[k - NX] + u[k + NX] - 4 * u[k];
          uNext[k] = (2 - damp) * u[k] - (1 - damp) * uPrev[k] + C2 * lap;
        }
      }
      // absorbing-ish edges
      const tmp = uPrev; uPrev = u; u = uNext; uNext = tmp;
    }

    // --- 3D projection (low tilt, matches reference) ---
    function project(i, j) {
      const h = u[idx(i, j)];
      // centre & scale grid to world
      let x = (i - NX / 2) / NX;         // -.5..~.5
      let z = (j - NY / 2) / NY;
      let y = h * 0.9;
      // rotate about X (tilt the plane toward viewer)
      const tilt = 1.02;                 // radians
      const ry = y * Math.cos(tilt) - z * Math.sin(tilt);
      const rz = y * Math.sin(tilt) + z * Math.cos(tilt);
      // perspective
      const camZ = 1.55;
      const p = 1.4 / (camZ + rz);
      const sx = W / 2 + x * p * W * 1.15;
      const sy = H * 0.52 - ry * p * H * 1.25;
      return [sx, sy, h];
    }

    function draw() {
      ctx.fillStyle = '#eef1f7'; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 0.7;
      // draw rows then columns
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX - 1; i++) {
          const a = project(i, j), b = project(i + 1, j);
          strokeSeg(a, b);
        }
      }
      for (let i = 0; i < NX; i++) {
        for (let j = 0; j < NY - 1; j++) {
          const a = project(i, j), b = project(i, j + 1);
          strokeSeg(a, b);
        }
      }
    }
    function strokeSeg(a, b) {
      const hgt = (a[2] + b[2]) * 0.5;
      const c = Math.max(-1, Math.min(1, hgt * 2));
      // peaks → deep indigo-blue, troughs → lighter blue; dark ink on light paper
      const hue = 220 - c * 22;
      const lum = 50 - c * 14;              // darker where it rises
      const alpha = 0.34 + Math.min(0.5, Math.abs(hgt) * 1.5);
      ctx.strokeStyle = `hsla(${hue}, 72%, ${lum}%, ${alpha})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }

    function loop() { if (running) { physics(); draw(); } raf = requestAnimationFrame(loop); }

    resize();
    window.addEventListener('resize', resize);

    // wire up controls
    const $ = id => document.getElementById(id);
    const bind = (id, out, cb, fmt) => {
      const el = $(id), o = $(out);
      if (!el) return;
      el.addEventListener('input', () => { cb(parseFloat(el.value)); if (o) o.textContent = fmt(el.value); });
    };
    bind('waveFreq', 'waveFreqOut', v => freq = v, v => (+v).toFixed(1));
    bind('waveAmp', 'waveAmpOut', v => amp = v, v => (+v).toFixed(2));
    bind('waveDamp', 'waveDampOut', v => damp = v, v => (+v).toFixed(3));
    const rst = $('waveReset'); if (rst) rst.addEventListener('click', reset);

    loop();
    return { pause() { running = false; }, resume() { running = true; } };
  };
})();
