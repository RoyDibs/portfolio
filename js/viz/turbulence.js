/* Incompressible smoke — Jos Stam's stable-fluids method.
   advect · diffuse · pressure-project (divergence-free) · dye transport.
   Interactive: mouse injects velocity + dye; auto-drives when idle. */
(function () {
  window.DRS = window.DRS || {};

  DRS.turbulence = function (canvas, stage) {
    const ctx = canvas.getContext('2d');
    const N = 96, SZ = (N + 2) * (N + 2);
    const IX = (i, j) => i + (N + 2) * j;

    let u = new Float32Array(SZ), v = new Float32Array(SZ);
    let u0 = new Float32Array(SZ), v0 = new Float32Array(SZ);
    let dens = new Float32Array(SZ), dens0 = new Float32Array(SZ);
    let img, W, H, running = false, raf = 0;
    let vorticity = 18, fade = 0.996;
    const dt = 0.12, visc = 0.0000, diff = 0.00001;

    // interaction / auto-drive
    let mx = 0, my = 0, pmx = 0, pmy = 0, down = false, active = false, idle = 0, ang = 0;

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = N; canvas.height = N;
      img = ctx.createImageData(N, N);
    }

    function set_bnd(b, x) {
      for (let i = 1; i <= N; i++) {
        x[IX(0, i)]     = b === 1 ? -x[IX(1, i)] : x[IX(1, i)];
        x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)];
        x[IX(i, 0)]     = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)];
      }
      x[IX(0, 0)]         = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
      x[IX(0, N + 1)]     = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)]);
      x[IX(N + 1, 0)]     = 0.5 * (x[IX(N, 0)] + x[IX(N + 1, 1)]);
      x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)]);
    }
    function lin_solve(b, x, x0, a, c, iter) {
      const invc = 1 / c;
      for (let k = 0; k < iter; k++) {
        for (let j = 1; j <= N; j++)
          for (let i = 1; i <= N; i++)
            x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) * invc;
        set_bnd(b, x);
      }
    }
    function diffuse(b, x, x0, d, iter) { const a = dt * d * N * N; lin_solve(b, x, x0, a, 1 + 4 * a, iter); }
    function advect(b, d, d0, uu, vv) {
      const dt0 = dt * N;
      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          let x = i - dt0 * uu[IX(i, j)], y = j - dt0 * vv[IX(i, j)];
          if (x < 0.5) x = 0.5; if (x > N + 0.5) x = N + 0.5;
          if (y < 0.5) y = 0.5; if (y > N + 0.5) y = N + 0.5;
          const i0 = x | 0, i1 = i0 + 1, j0 = y | 0, j1 = j0 + 1;
          const s1 = x - i0, s0 = 1 - s1, t1 = y - j0, t0 = 1 - t1;
          d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)])
                      + s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
        }
      }
      set_bnd(b, d);
    }
    function project(uu, vv, p, div) {
      const h = 1.0 / N;
      for (let j = 1; j <= N; j++)
        for (let i = 1; i <= N; i++) {
          div[IX(i, j)] = -0.5 * h * (uu[IX(i + 1, j)] - uu[IX(i - 1, j)] + vv[IX(i, j + 1)] - vv[IX(i, j - 1)]);
          p[IX(i, j)] = 0;
        }
      set_bnd(0, div); set_bnd(0, p);
      lin_solve(0, p, div, 1, 4, 10);
      for (let j = 1; j <= N; j++)
        for (let i = 1; i <= N; i++) {
          uu[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) / h;
          vv[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) / h;
        }
      set_bnd(1, uu); set_bnd(2, vv);
    }

    // confinement adds small-scale swirl back in
    function vortConfine(strength) {
      if (strength <= 0) return;
      const curl = u0; // reuse scratch
      for (let j = 1; j <= N; j++)
        for (let i = 1; i <= N; i++)
          curl[IX(i, j)] = Math.abs(
            (v[IX(i + 1, j)] - v[IX(i - 1, j)]) - (u[IX(i, j + 1)] - u[IX(i, j - 1)])) * 0.5;
      for (let j = 2; j <= N - 1; j++)
        for (let i = 2; i <= N - 1; i++) {
          let nx = (curl[IX(i + 1, j)] - curl[IX(i - 1, j)]) * 0.5;
          let ny = (curl[IX(i, j + 1)] - curl[IX(i, j - 1)]) * 0.5;
          const len = Math.hypot(nx, ny) + 1e-5;
          nx /= len; ny /= len;
          const c = (v[IX(i + 1, j)] - v[IX(i - 1, j)] - (u[IX(i, j + 1)] - u[IX(i, j - 1)])) * 0.5;
          u[IX(i, j)] += strength * 0.001 * ny * c;
          v[IX(i, j)] -= strength * 0.001 * nx * c;
        }
    }

    function velStep() {
      diffuse(1, u0, u, visc, 4); diffuse(2, v0, v, visc, 4);
      project(u0, v0, u, v);
      advect(1, u, u0, u0, v0); advect(2, v, v0, u0, v0);
      vortConfine(vorticity);
      project(u, v, u0, v0);
    }
    function densStep() {
      diffuse(0, dens0, dens, diff, 4);
      advect(0, dens, dens0, u, v);
      for (let k = 0; k < SZ; k++) dens[k] *= fade;
    }

    function inject() {
      // pointer drive
      if (down || active) {
        const gi = Math.max(1, Math.min(N, (mx / W * N) | 0));
        const gj = Math.max(1, Math.min(N, (my / H * N) | 0));
        const fx = (mx - pmx), fy = (my - pmy);
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const i = gi + di, j = gj + dj;
            if (i < 1 || i > N || j < 1 || j > N) continue;
            dens[IX(i, j)] += 60;
            u[IX(i, j)] += fx * 4.0;
            v[IX(i, j)] += fy * 4.0;
          }
      }
      pmx = mx; pmy = my;
    }
    function autoDrive() {
      // gentle wandering source when the user isn't touching it
      ang += 0.03;
      const cx = W * (0.5 + 0.34 * Math.cos(ang * 0.7));
      const cy = H * (0.5 + 0.32 * Math.sin(ang));
      pmx = mx; pmy = my; mx = cx; my = cy;
      const gi = Math.max(1, Math.min(N, (cx / W * N) | 0));
      const gj = Math.max(1, Math.min(N, (cy / H * N) | 0));
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const i = gi + di, j = gj + dj; if (i < 1 || i > N || j < 1 || j > N) continue;
          dens[IX(i, j)] += 40;
          u[IX(i, j)] += Math.cos(ang * 1.7) * 26;
          v[IX(i, j)] += Math.sin(ang * 1.3) * 26;
        }
    }

    // "ink in water" sequential ramp on light paper:
    //   0 dye = paper white → teal → deep navy at high density
    const P0 = [238, 241, 247], P1 = [26, 140, 160], P2 = [11, 26, 70];
    function render() {
      const d = img.data;
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          let t = Math.min(1, dens[IX(i + 1, j + 1)] * 0.024);
          t = Math.pow(t, 0.85);
          let r, g, b;
          if (t < 0.5) { const f = t / 0.5; r = P0[0] + f * (P1[0] - P0[0]); g = P0[1] + f * (P1[1] - P0[1]); b = P0[2] + f * (P1[2] - P0[2]); }
          else { const f = (t - 0.5) / 0.5; r = P1[0] + f * (P2[0] - P1[0]); g = P1[1] + f * (P2[1] - P1[1]); b = P1[2] + f * (P2[2] - P1[2]); }
          const p = (i + j * N) << 2;
          d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    }

    let frame = 0;
    function loop() {
      raf = requestAnimationFrame(loop);
      if (!running) return;
      if (frame++ % 2) return;            // ~30fps: halves solver cost
      if (active) { idle++; if (idle > 40) active = false; }
      else autoDrive();
      inject();
      velStep(); densStep(); render();
    }

    resize();
    window.addEventListener('resize', resize);

    // pointer handlers on the stage element
    const rectXY = e => {
      const r = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return [cx, cy];
    };
    function onMove(e) {
      const [cx, cy] = rectXY(e); pmx = mx; pmy = my; mx = cx; my = cy; active = true; idle = 0;
    }
    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mousedown', e => { down = true; onMove(e); });
    window.addEventListener('mouseup', () => { down = false; });
    stage.addEventListener('touchstart', e => { down = true; onMove(e); }, { passive: true });
    stage.addEventListener('touchmove', e => { onMove(e); }, { passive: true });
    window.addEventListener('touchend', () => { down = false; });

    const $ = id => document.getElementById(id);
    const bv = $('turbVort'), bvo = $('turbVortOut');
    if (bv) bv.addEventListener('input', () => { vorticity = parseFloat(bv.value); if (bvo) bvo.textContent = bv.value; });
    const bf = $('turbFade'), bfo = $('turbFadeOut');
    if (bf) bf.addEventListener('input', () => { fade = parseFloat(bf.value); if (bfo) bfo.textContent = (+bf.value).toFixed(3); });
    const rs = $('turbReset');
    if (rs) rs.addEventListener('click', () => { u.fill(0); v.fill(0); dens.fill(0); active = false; idle = 0; });

    loop();
    return { pause() { running = false; }, resume() { running = true; } };
  };
})();
