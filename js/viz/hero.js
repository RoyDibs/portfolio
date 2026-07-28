/* Hero — neural flow field.
   Particles advected through a curl-noise field: a soft, living "latent field"
   that evokes a neural operator's internal representation of a flow. */
(function () {
  window.DRS = window.DRS || {};

  // ---- tiny value-noise (deterministic, no deps) ----
  function makeNoise() {
    const p = new Uint8Array(512);
    let seed = 1337;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y) => { const u = h & 1 ? x : -x, v = h & 2 ? y : -y; return u + v; };
    return (x, y) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = p[X] + Y, b = p[X + 1] + Y;
      return lerp(
        lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u),
        lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u),
        v);
    };
  }

  DRS.hero = function (canvas) {
    const ctx = canvas.getContext('2d');
    const noise = makeNoise();
    let W, H, DPR, particles = [], t = 0, running = true, raf = 0;
    const COUNT = () => Math.min(1100, Math.floor((W * H) / 1600));

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }
    function seed() {
      particles = [];
      const n = COUNT();
      for (let i = 0; i < n; i++) particles.push({ x: Math.random() * W, y: Math.random() * H, life: Math.random() * 100 });
      ctx.fillStyle = '#f7f8fb'; ctx.fillRect(0, 0, W, H);
    }

    const SCALE = 0.0016;
    function step() {
      // gentle fade => trails (fade toward paper white)
      ctx.fillStyle = 'rgba(247,248,251,0.038)';
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1.15;
      for (const pt of particles) {
        const a = noise(pt.x * SCALE, pt.y * SCALE + t) * Math.PI * 2.5
                + noise(pt.x * SCALE * 2.3 + 40, pt.y * SCALE * 2.3 - t) * Math.PI;
        const spd = 0.9 + 0.6 * Math.sin(a * 1.3);
        const nx = pt.x + Math.cos(a) * spd;
        const ny = pt.y + Math.sin(a) * spd;
        // professional blue→indigo ink on light, colour by direction
        const hue = 218 + 34 * Math.sin(a);
        ctx.strokeStyle = `hsla(${hue}, 72%, ${46 + 8 * Math.sin(a)}%, 0.42)`;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(nx, ny); ctx.stroke();
        pt.x = nx; pt.y = ny; pt.life -= 1;
        if (pt.x < 0 || pt.x > W || pt.y < 0 || pt.y > H || pt.life < 0) {
          pt.x = Math.random() * W; pt.y = Math.random() * H; pt.life = 60 + Math.random() * 120;
        }
      }
      t += 0.0012;
    }
    function loop() { if (running) step(); raf = requestAnimationFrame(loop); }

    resize();
    window.addEventListener('resize', resize);
    loop();
    return {
      pause() { running = false; },
      resume() { running = true; },
    };
  };
})();
