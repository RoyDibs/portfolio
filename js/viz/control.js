/* Boundary/distributed control of the heat equation  uₜ = α uₓₓ + f(x,t)
   A feedback policy injects heat to track a (moving) target profile. */
(function () {
  window.DRS = window.DRS || {};

  DRS.control = function (canvas) {
    const ctx = canvas.getContext('2d');
    const N = 220;
    let u = new Float32Array(N);
    let W, H, DPR, running = false, raf = 0, t = 0;
    let gain = 1.0, targMode = 0, ctrlOn = true;
    const alpha = 0.22;

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function target(i) {
      const x = i / (N - 1);
      const drift = 0.14 * Math.sin(t * 0.5);
      if (targMode === 0) return 0.6 * Math.sin((x * 2 + drift) * Math.PI);
      if (targMode === 1) { const c = 0.5 + 0.25 * Math.sin(t * 0.6); return 0.85 * Math.exp(-Math.pow((x - c) / 0.14, 2)); }
      const c1 = 0.3, c2 = 0.72 + 0.05 * Math.sin(t);
      return 0.8 * (Math.exp(-Math.pow((x - c1) / 0.09, 2)) - Math.exp(-Math.pow((x - c2) / 0.09, 2)));
    }

    function physics() {
      t += 0.016;
      const next = new Float32Array(N);
      for (let i = 1; i < N - 1; i++) {
        const lap = u[i - 1] + u[i + 1] - 2 * u[i];
        let f = 0;
        if (ctrlOn) f = gain * (target(i) - u[i]) * 0.9;      // proportional feedback
        // small persistent disturbance so the controller has work to do
        const dist = 0.015 * Math.sin(i * 0.20 + t * 2.2);
        next[i] = u[i] + alpha * lap + f * 0.06 + dist * 0.05;
      }
      u = next;
    }

    function xmap(i) { return (i / (N - 1)) * (W - 40) + 20; }
    function ymap(val) { return H / 2 - val * (H * 0.34); }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // baseline grid
      ctx.strokeStyle = 'rgba(20,30,60,.14)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20, H / 2); ctx.lineTo(W - 20, H / 2); ctx.stroke();

      // target (dashed)
      ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(224,122,58,.95)'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < N; i++) { const x = xmap(i), y = ymap(target(i)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);

      // state (filled area)
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(37,99,235,.26)');
      grad.addColorStop(1, 'rgba(37,99,235,.02)');
      ctx.beginPath(); ctx.moveTo(xmap(0), H / 2);
      for (let i = 0; i < N; i++) ctx.lineTo(xmap(i), ymap(u[i]));
      ctx.lineTo(xmap(N - 1), H / 2); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < N; i++) { const x = xmap(i), y = ymap(u[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2.2; ctx.shadowColor = 'rgba(37,99,235,.35)'; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;

      // tracking error read-out
      let err = 0; for (let i = 0; i < N; i++) err += Math.abs(u[i] - target(i));
      err /= N;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillStyle = 'rgba(74,85,108,.95)';
      ctx.fillText('tracking error ‖u − u*‖ = ' + err.toFixed(4), 22, 26);
      ctx.fillStyle = ctrlOn ? '#0d9488' : '#e07a3a';
      ctx.fillText(ctrlOn ? '● control active' : '○ open loop (drifting)', 22, 44);
    }

    function loop() { if (running) { physics(); draw(); } raf = requestAnimationFrame(loop); }

    resize();
    window.addEventListener('resize', resize);

    const $ = id => document.getElementById(id);
    const bg = $('ctrlGain'), bgo = $('ctrlGainOut');
    if (bg) bg.addEventListener('input', () => { gain = parseFloat(bg.value); if (bgo) bgo.textContent = gain.toFixed(2); });
    const bt = $('ctrlTarg'), bto = $('ctrlTargOut'), names = ['Sine', 'Gaussian', 'Twin'];
    if (bt) bt.addEventListener('input', () => { targMode = parseInt(bt.value); if (bto) bto.textContent = names[targMode]; });
    const tog = $('ctrlToggle'), st = $('ctrlState');
    if (tog) tog.addEventListener('click', () => { ctrlOn = !ctrlOn; if (st) st.textContent = ctrlOn ? 'ON' : 'OFF'; });

    loop();
    return { pause() { running = false; }, resume() { running = true; } };
  };
})();
