// Prep Kitchen animated backgrounds.
// Each scene has init(w, h, dark, tokens) -> state and draw(ctx, state, t, dt, w, h).
// t is seconds since start (drives waves and pulses); dt is the frame step (drives movement).
// Sizes scale with the canvas, so the same code draws the full background and the small
// previews in Settings.
(function(){
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const scaleOf = (w, h) => clamp(Math.min(w, h) / 820, 0.16, 1.25);
  const count = (w, h, per, min, max) => clamp(Math.round(w * h / per), min, max);
  const wrap = (v, max) => ((v % max) + max) % max;
  function rgba(hex, a){
    const s = hex.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  function mix(h1, h2, f){
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const c = i => Math.round(((a >> i) & 255) * (1 - f) + ((b >> i) & 255) * f);
    return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
  }
  function glow(ctx, x, y, r, color, a){
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function vgrad(ctx, h, stops){
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  }
  function heartPath(ctx, s){
    ctx.beginPath();
    ctx.moveTo(0, s * 0.36);
    ctx.bezierCurveTo(-s * 0.62, -s * 0.04, -s * 0.36, -s * 0.62, 0, -s * 0.26);
    ctx.bezierCurveTo(s * 0.36, -s * 0.62, s * 0.62, -s * 0.04, 0, s * 0.36);
    ctx.closePath();
  }

  /* ---------------- Soft color clouds (plain palettes) ---------------- */
  const mesh = {
    init(w, h, dark, T){
      const cols = [T.accent, T.butter, T.accent, T.accentSoft, T.butter];
      return {T, dark, blobs: cols.map((c, i) => ({c, x: rand(0.1, 0.9), y: rand(0.1, 0.9), r: rand(0.35, 0.62), sx: rand(0.025, 0.06), sy: rand(0.025, 0.06), ph: rand(0, TAU), a: i % 2 ? 0.16 : 0.22}))};
    },
    draw(ctx, s, t, dt, w, h){
      ctx.fillStyle = s.T.bg; ctx.fillRect(0, 0, w, h);
      const R = Math.max(w, h);
      for(const b of s.blobs){
        const x = (b.x + Math.sin(t * b.sx + b.ph) * 0.22) * w;
        const y = (b.y + Math.cos(t * b.sy + b.ph * 1.3) * 0.2) * h;
        glow(ctx, x, y, b.r * R, b.c, s.dark ? b.a * 0.8 : b.a);
      }
      // A slow diagonal sheen.
      const p = wrap(t * 0.03, 1.6) - 0.3;
      const g = ctx.createLinearGradient(w * (p - 0.3), 0, w * (p + 0.3), h);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${s.dark ? 0.025 : 0.12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  };

  /* ---------------- Space ---------------- */
  // A small solar system at the edges of the screen: a ringed gas giant with a moon, a red
  // planet, an ice planet with a thin ring, a far-off planet, a turning spiral galaxy, a comet,
  // tumbling asteroids, a satellite, a flaring star and shooting stars.
  function galaxyImage(G, dark){
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(G * 2);
    const c = cv.getContext('2d');
    c.translate(G, G);
    const core = c.createRadialGradient(0, 0, 0, 0, 0, G * 0.35);
    core.addColorStop(0, dark ? 'rgba(255,236,200,.9)' : 'rgba(255,226,180,.9)'); core.addColorStop(0.4, dark ? 'rgba(255,190,160,.35)' : 'rgba(240,170,200,.35)'); core.addColorStop(1, 'rgba(255,200,200,0)');
    c.fillStyle = core; c.fillRect(-G, -G, G * 2, G * 2);
    for(let arm = 0; arm < 3; arm++){
      for(let i = 0; i < 520; i++){
        const f = Math.pow(Math.random(), 0.7), r = f * G * 0.95;
        const a = arm * TAU / 3 + f * 5.2 + rand(-0.32, 0.32) * (1 - f * 0.5);
        const x = Math.cos(a) * r + rand(-3, 3), y = Math.sin(a) * r + rand(-3, 3);
        const col = f < 0.25 ? [255, 225, 190] : (Math.random() < 0.5 ? [170, 190, 255] : [230, 160, 255]);
        const al = (1 - f) * (dark ? 0.8 : 0.6) * rand(0.3, 1);
        c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${al})`;
        c.beginPath(); c.arc(x, y, rand(0.4, 1.6) * (G / 160), 0, TAU); c.fill();
      }
    }
    return cv;
  }
  function sphereImage(R, cols, craters, dark){
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(R * 2 + 4);
    const c = cv.getContext('2d'), o = R + 2;
    c.save(); c.beginPath(); c.arc(o, o, R, 0, TAU); c.clip();
    const g = c.createRadialGradient(o - R * 0.4, o - R * 0.45, R * 0.05, o, o, R * 1.05);
    g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    c.fillStyle = g; c.fillRect(0, 0, o * 2, o * 2);
    for(let i = 0; i < craters; i++){
      const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * R * 0.8, cr = rand(0.06, 0.2) * R;
      const x = o + Math.cos(a) * rr, y = o + Math.sin(a) * rr;
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(x, y, cr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(x - cr * 0.25, y - cr * 0.25, cr * 0.7, 0, TAU); c.fill();
    }
    const sh = c.createRadialGradient(o - R * 0.55, o - R * 0.55, R * 0.4, o, o, R * 1.3);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, dark ? 'rgba(3,2,18,.85)' : 'rgba(40,20,90,.4)');
    c.fillStyle = sh; c.fillRect(0, 0, o * 2, o * 2);
    c.restore();
    return cv;
  }
  function rockShape(){ const n = 7 + Math.floor(Math.random() * 4); return Array.from({length: n}, (_, i) => [i / n * TAU, rand(0.65, 1.1)]); }
  const space = {
    init(w, h, dark){
      const k = scaleOf(w, h), M = Math.min(w, h);
      const layers = [{per: 4200, min: 18, max: 500, sp: 2, r: [0.3, 0.8]}, {per: 13000, min: 8, max: 180, sp: 6, r: [0.6, 1.3]}, {per: 45000, min: 4, max: 60, sp: 13, r: [1.1, 2.1]}];
      const stars = [];
      layers.forEach((L, li) => { for(let i = 0; i < count(w, h, L.per, L.min, L.max); i++) stars.push({x: rand(0, w), y: rand(0, h), r: rand(...L.r) * Math.max(0.55, k), sp: L.sp * k, li, ph: rand(0, TAU), f: rand(0.6, 2.2)}); });
      const neb = (dark ? ['#7b2ff7', '#e0118f', '#0db8de', '#4b3bd6', '#ff6a3d'] : ['#b9a7ff', '#ffb3e1', '#9fdcff', '#c6bfff', '#ffd0b0'])
        .map(c => ({c, x: rand(0.05, 0.95), y: rand(0.05, 0.85), r: rand(0.22, 0.42), ph: rand(0, TAU), sp: rand(0.02, 0.05)}));
      const G = M * 0.3;
      const giantR = M * 0.2;
      return {
        dark, k, M, stars, neb,
        galaxy: {img: galaxyImage(G, dark), x: w * 0.36, y: h * 0.3, G},
        giant: {x: w * 0.84, y: h * 0.8, R: giantR},
        red: {img: sphereImage(M * 0.055, dark ? ['#ffb08a', '#d2553a', '#5a1a14'] : ['#ffd0b8', '#e8795a', '#9a3a2a'], 9, dark), x: w * 0.9, y: h * 0.16, R: M * 0.055, ph: rand(0, TAU)},
        ice: {img: sphereImage(M * 0.075, dark ? ['#e8fbff', '#7fcfe8', '#1b4a66'] : ['#ffffff', '#a9e4f5', '#4c8fb0'], 0, dark), x: w * 0.1, y: h * 0.84, R: M * 0.075, ph: rand(0, TAU)},
        tiny: {img: sphereImage(M * 0.018, dark ? ['#fff4d6', '#e0b96a', '#6b4a1a'] : ['#fff8e6', '#f0cf8a', '#b08a40'], 2, dark), x: w * 0.6, y: h * 0.1, R: M * 0.018},
        asteroids: Array.from({length: count(w, h, 70000, 6, 22)}, () => ({x: rand(0, w), off: rand(-1, 1), s: rand(3, 11) * Math.max(k, 0.35), rot: rand(0, TAU), vr: rand(-0.8, 0.8), sp: rand(10, 24) * k, shape: rockShape(), shade: rand(0.35, 0.7)})),
        comet: {active: false, next: rand(3, 8)},
        sat: {x: -80, next: rand(2, 6)},
        shots: [], nextShot: rand(1.5, 4)
      };
    },
    draw(ctx, s, t, dt, w, h){
      const d = s.dark, k = s.k, M = s.M;
      ctx.fillStyle = vgrad(ctx, h, d ? [[0, '#0d0a33'], [0.55, '#070620'], [1, '#03020c']] : [[0, '#f6f4ff'], [1, '#d9d2f6']]);
      ctx.fillRect(0, 0, w, h);
      // Nebula clouds.
      ctx.globalCompositeOperation = d ? 'lighter' : 'source-over';
      const Rn = Math.max(w, h);
      for(const n of s.neb) glow(ctx, (n.x + Math.sin(t * n.sp + n.ph) * 0.08) * w, (n.y + Math.cos(t * n.sp * 0.8 + n.ph) * 0.06) * h, n.r * Rn, n.c, d ? 0.15 : 0.28);
      // Spiral galaxy, tilted and slowly turning.
      const Gx = s.galaxy;
      ctx.save(); ctx.translate(Gx.x, Gx.y); ctx.rotate(-0.5); ctx.scale(1, 0.42); ctx.rotate(t * 0.025);
      ctx.globalAlpha = d ? 0.75 : 0.55; ctx.drawImage(Gx.img, -Gx.G, -Gx.G); ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // Stars drift left in three parallax layers and twinkle.
      for(const st of s.stars){
        st.x -= st.sp * dt; if(st.x < -3){ st.x = w + 3; st.y = rand(0, h); }
        const a = (d ? 0.9 : 0.55) * (0.55 + 0.45 * Math.sin(t * st.f + st.ph));
        ctx.fillStyle = d ? `rgba(255,255,255,${a})` : `rgba(70,55,170,${a * 0.8})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill();
        if(st.li === 2 && d){
          ctx.strokeStyle = `rgba(200,210,255,${a * 0.5})`; ctx.lineWidth = 0.6;
          const L = st.r * 4.5;
          ctx.beginPath(); ctx.moveTo(st.x - L, st.y); ctx.lineTo(st.x + L, st.y); ctx.moveTo(st.x, st.y - L); ctx.lineTo(st.x, st.y + L); ctx.stroke();
        }
      }
      // A bright star with a lens flare in the top-left corner.
      const fx = w * 0.06, fy = h * 0.09, fp = 0.85 + 0.15 * Math.sin(t * 1.3);
      ctx.globalCompositeOperation = d ? 'lighter' : 'source-over';
      glow(ctx, fx, fy, M * 0.22 * fp, d ? '#9fc4ff' : '#c9b8ff', d ? 0.35 : 0.4);
      glow(ctx, fx, fy, M * 0.05, '#ffffff', d ? 0.9 : 0.8);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(t * 0.05);
      for(let i = 0; i < 4; i++){
        ctx.rotate(Math.PI / 4);
        const L = M * (i % 2 ? 0.09 : 0.17) * fp;
        const g = ctx.createLinearGradient(-L, 0, L, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${d ? 0.7 : 0.6})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-L, -0.8 * Math.max(k, 0.5), L * 2, 1.6 * Math.max(k, 0.5));
      }
      ctx.restore();
      // Flare ghosts along the line from the star toward the middle of the screen.
      [[0.35, 0.02, '#8fd3ff'], [0.55, 0.012, '#ff9ee6'], [0.8, 0.03, '#b9a7ff']].forEach(([f, r, c]) => glow(ctx, fx + (w * 0.5 - fx) * f, fy + (h * 0.5 - fy) * f, M * r * 2, c, d ? 0.18 : 0.2));
      ctx.globalCompositeOperation = 'source-over';
      // Far-off and small planets float gently.
      const tn = s.tiny; ctx.drawImage(tn.img, tn.x - tn.R - 2, tn.y - tn.R - 2 + Math.sin(t * 0.3) * 2 * k);
      const rp = s.red, ry = rp.y + Math.sin(t * 0.25 + rp.ph) * 6 * k;
      glow(ctx, rp.x, ry, rp.R * 1.8, d ? '#ff6a3d' : '#ffb08a', d ? 0.25 : 0.3);
      ctx.drawImage(rp.img, rp.x - rp.R - 2, ry - rp.R - 2);
      // Ice planet with a thin tilted ring.
      const ip = s.ice, iy = ip.y + Math.sin(t * 0.2 + ip.ph) * 7 * k;
      const iceRing = front => {
        ctx.save(); ctx.translate(ip.x, iy); ctx.rotate(0.45);
        ctx.strokeStyle = d ? 'rgba(190,240,255,.55)' : 'rgba(90,160,200,.55)'; ctx.lineWidth = ip.R * 0.07;
        ctx.beginPath(); ctx.ellipse(0, 0, ip.R * 1.8, ip.R * 0.35, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        ctx.strokeStyle = d ? 'rgba(190,240,255,.25)' : 'rgba(90,160,200,.3)'; ctx.lineWidth = ip.R * 0.03;
        ctx.beginPath(); ctx.ellipse(0, 0, ip.R * 2.05, ip.R * 0.41, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        ctx.restore();
      };
      glow(ctx, ip.x, iy, ip.R * 2, d ? '#6fe0ff' : '#a9e4f5', d ? 0.22 : 0.3);
      iceRing(false); ctx.drawImage(ip.img, ip.x - ip.R - 2, iy - ip.R - 2); iceRing(true);
      // Asteroid belt drifting diagonally across the lower middle.
      for(const a of s.asteroids){
        a.x += a.sp * dt; a.rot += a.vr * dt;
        if(a.x > w + 20) a.x = -20;
        const y = h * 0.62 + (a.x - w * 0.5) * -0.18 + a.off * h * 0.06;
        ctx.save(); ctx.translate(a.x, y); ctx.rotate(a.rot);
        const g = ctx.createLinearGradient(-a.s, -a.s, a.s, a.s);
        g.addColorStop(0, d ? `rgba(180,170,210,${a.shade + 0.2})` : `rgba(150,140,190,${a.shade + 0.2})`); g.addColorStop(1, d ? `rgba(40,35,70,${a.shade + 0.2})` : `rgba(80,70,120,${a.shade})`);
        ctx.fillStyle = g; ctx.beginPath();
        a.shape.forEach(([ang, rr], i) => { const x = Math.cos(ang) * a.s * rr, yy = Math.sin(ang) * a.s * rr; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // Satellite crossing the top with solar panels and a blinking light.
      const S2 = s.sat;
      if(S2.x < -60 && dt > 0 && (S2.next -= dt) <= 0){ S2.x = w + 60; S2.y = rand(0.2, 0.4) * h; S2.next = rand(14, 24); }
      if(S2.x >= -60){
        S2.x -= 28 * k * dt;
        const sy = S2.y + Math.sin(t * 0.4) * 5 * k, u = Math.max(k, 0.4) * 1.3;
        ctx.save(); ctx.translate(S2.x, sy); ctx.rotate(-0.15 + Math.sin(t * 0.3) * 0.05);
        ctx.fillStyle = d ? '#2b3f7a' : '#4a63b0'; ctx.strokeStyle = d ? 'rgba(160,190,255,.7)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.6;
        [-1, 1].forEach(side => { ctx.fillRect(side * 7 * u - (side < 0 ? 16 * u : 0), -4 * u, 16 * u, 8 * u); ctx.strokeRect(side * 7 * u - (side < 0 ? 16 * u : 0), -4 * u, 16 * u, 8 * u); for(let i = 1; i < 4; i++){ const x = side * 7 * u - (side < 0 ? 16 * u : 0) + i * 4 * u; ctx.beginPath(); ctx.moveTo(x, -4 * u); ctx.lineTo(x, 4 * u); ctx.stroke(); } });
        ctx.fillStyle = d ? '#d8d4e8' : '#f4f2fa'; ctx.fillRect(-7 * u, -5 * u, 14 * u, 10 * u);
        ctx.fillStyle = d ? '#a9a3c4' : '#c9c4dc'; ctx.fillRect(-3 * u, -8 * u, 6 * u, 3 * u);
        ctx.strokeStyle = d ? '#d8d4e8' : '#8a84a8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -8 * u); ctx.lineTo(3 * u, -14 * u); ctx.stroke();
        if(Math.sin(t * 5) > 0.6){ glow(ctx, 3 * u, -14 * u, 6 * u, '#ff4d4d', 0.9); }
        ctx.restore();
      }
      // Ringed gas giant with a moon, in the bottom-right corner.
      const {x: px, y: py, R} = s.giant;
      const ma = t * 0.2, mx = px + Math.cos(ma) * R * 2.2, my = py + Math.sin(ma) * R * 0.5 - R * 0.15, mr = R * 0.18;
      const moon = () => {
        const g = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
        g.addColorStop(0, d ? '#f4f1ff' : '#ffffff'); g.addColorStop(1, d ? '#6d6891' : '#a9a3cf');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(60,50,110,.25)';
        [[-0.3, -0.1, 0.22], [0.25, 0.25, 0.16], [0.1, -0.4, 0.12]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(mx + a * mr, my + b * mr, r * mr, 0, TAU); ctx.fill(); });
      };
      const ring = front => {
        ctx.save(); ctx.translate(px, py); ctx.rotate(-0.38);
        const cols = d ? ['rgba(255,214,150,.6)', 'rgba(230,180,255,.4)', 'rgba(255,255,255,.2)', 'rgba(255,200,140,.3)'] : ['rgba(255,190,120,.75)', 'rgba(170,130,240,.5)', 'rgba(255,255,255,.55)', 'rgba(255,170,110,.4)'];
        [[1.6, 0.11], [1.78, 0.07], [1.92, 0.03], [2.05, 0.05]].forEach(([rr, lw], i) => {
          ctx.strokeStyle = cols[i]; ctx.lineWidth = R * lw;
          ctx.beginPath(); ctx.ellipse(0, 0, R * rr, R * rr * 0.26, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        });
        ctx.restore();
      };
      glow(ctx, px, py, R * 2.6, d ? '#8f6bff' : '#b9a7ff', d ? 0.25 : 0.32);
      if(Math.sin(ma) < 0) moon();
      ring(false);
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.clip();
      const pg = ctx.createRadialGradient(px - R * 0.45, py - R * 0.5, R * 0.1, px, py, R * 1.05);
      pg.addColorStop(0, d ? '#ffe2c4' : '#fff0e0'); pg.addColorStop(0.4, d ? '#e0895a' : '#f2a878'); pg.addColorStop(0.75, d ? '#8a4ac8' : '#b48cff'); pg.addColorStop(1, d ? '#241563' : '#5b44c8');
      ctx.fillStyle = pg; ctx.fillRect(px - R, py - R, R * 2, R * 2);
      for(let i = 0; i < 9; i++){
        const by = py - R + (i + 0.5) * (2 * R / 9);
        ctx.strokeStyle = i % 2 ? `rgba(255,240,220,${d ? 0.14 : 0.25})` : `rgba(70,20,90,${d ? 0.2 : 0.14})`;
        ctx.lineWidth = R * 0.09;
        ctx.beginPath();
        for(let x = -R; x <= R; x += R / 14){
          const y = by + Math.sin((x + t * 16 * k + i * 37) / R * 3.4) * R * 0.03;
          x === -R ? ctx.moveTo(px + x, y) : ctx.lineTo(px + x, y);
        }
        ctx.stroke();
      }
      // A storm spot rolls across with the bands.
      const spx = px + (wrap(t * 16 * k * 0.6, R * 3) - R * 1.5), spy = py + R * 0.28;
      ctx.fillStyle = d ? 'rgba(255,150,110,.45)' : 'rgba(230,110,80,.4)'; ctx.beginPath(); ctx.ellipse(spx, spy, R * 0.16, R * 0.08, 0, 0, TAU); ctx.fill();
      const sh = ctx.createRadialGradient(px - R * 0.6, py - R * 0.6, R * 0.4, px, py, R * 1.25);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, d ? 'rgba(5,3,25,.78)' : 'rgba(40,20,110,.35)');
      ctx.fillStyle = sh; ctx.fillRect(px - R, py - R, R * 2, R * 2);
      ctx.restore();
      // Thin bright atmosphere edge.
      ctx.strokeStyle = d ? 'rgba(255,200,170,.35)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(1, R * 0.02);
      ctx.beginPath(); ctx.arc(px, py, R, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
      ring(true);
      if(Math.sin(ma) >= 0) moon();
      // A comet glides across now and then, trailing dust.
      const C = s.comet;
      if(!C.active && dt > 0 && (C.next -= dt) <= 0){
        const fromLeft = Math.random() < 0.5;
        C.active = true; C.x = fromLeft ? -60 : w + 60; C.y = rand(0.08, 0.45) * h;
        C.vx = (fromLeft ? 1 : -1) * rand(70, 110) * k; C.vy = rand(12, 30) * k; C.dust = []; C.next = rand(16, 28);
      }
      if(C.active){
        C.x += C.vx * dt; C.y += C.vy * dt;
        if(dt > 0 && Math.random() < 0.6) C.dust.push({x: C.x, y: C.y, vx: -C.vx * 0.05 + rand(-6, 6) * k, vy: rand(-6, 6) * k, life: 1});
        const m = Math.hypot(C.vx, C.vy), ux = -C.vx / m, uy = -C.vy / m, L = 190 * Math.max(k, 0.35), Wd = 9 * Math.max(k, 0.35);
        ctx.globalCompositeOperation = d ? 'lighter' : 'source-over';
        for(const p of C.dust){ p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.5; if(p.life > 0) glow(ctx, p.x, p.y, 4 * Math.max(k, 0.4), d ? '#bfe3ff' : '#8a7ae0', 0.35 * p.life); }
        C.dust = C.dust.filter(p => p.life > 0);
        const g = ctx.createLinearGradient(C.x, C.y, C.x + ux * L, C.y + uy * L);
        g.addColorStop(0, d ? 'rgba(210,235,255,.85)' : 'rgba(120,100,230,.7)'); g.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(C.x - uy * Wd * 0.3, C.y + ux * Wd * 0.3);
        ctx.quadraticCurveTo(C.x + ux * L * 0.5 - uy * Wd, C.y + uy * L * 0.5 + ux * Wd, C.x + ux * L - uy * Wd * 1.6, C.y + uy * L + ux * Wd * 1.6);
        ctx.lineTo(C.x + ux * L + uy * Wd * 1.6, C.y + uy * L - ux * Wd * 1.6);
        ctx.quadraticCurveTo(C.x + ux * L * 0.5 + uy * Wd, C.y + uy * L * 0.5 - ux * Wd, C.x + uy * Wd * 0.3, C.y - ux * Wd * 0.3);
        ctx.closePath(); ctx.fill();
        glow(ctx, C.x, C.y, 16 * Math.max(k, 0.4), d ? '#e6f4ff' : '#7a6ae0', 0.9);
        ctx.globalCompositeOperation = 'source-over';
        if(C.x < -300 || C.x > w + 300 || C.y > h + 200) C.active = false;
      }
      // Shooting stars.
      if(dt > 0 && (s.nextShot -= dt) <= 0){ s.nextShot = rand(3, 8); s.shots.push({x: rand(w * 0.2, w * 1.1), y: rand(-h * 0.05, h * 0.35), vx: -rand(420, 640) * k, vy: rand(160, 260) * k, life: 1}); }
      for(const sh2 of s.shots){
        sh2.x += sh2.vx * dt; sh2.y += sh2.vy * dt; sh2.life -= dt * 0.9;
        const L = 150 * k, m = Math.hypot(sh2.vx, sh2.vy);
        const tx = sh2.x - sh2.vx / m * L, ty = sh2.y - sh2.vy / m * L;
        const g = ctx.createLinearGradient(sh2.x, sh2.y, tx, ty);
        g.addColorStop(0, d ? `rgba(255,255,255,${sh2.life})` : `rgba(90,70,200,${sh2.life})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2 * Math.max(0.6, k); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sh2.x, sh2.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
      s.shots = s.shots.filter(x => x.life > 0);
    }
  };

  /* ---------------- Love ---------------- */
  const love = {
    init(w, h, dark){
      const k = scaleOf(w, h);
      const hc = dark ? ['#ff7e98', '#ff4d6d', '#ff9eb5', '#ffb3c4', '#e8375a'] : ['#ff5c7f', '#e8375a', '#ff8fa8', '#c8304f', '#ffa3b8'];
      const hearts = Array.from({length: count(w, h, 36000, 10, 42)}, () => {
        const z = rand(0.35, 1);
        return {x: rand(0, w), y: rand(0, h), z, s: rand(12, 40) * k * z, vy: rand(14, 34) * k * (0.5 + z), sway: rand(12, 34) * k, f: rand(0.35, 0.9), ph: rand(0, TAU), c: pick(hc)};
      }).sort((a, b) => a.z - b.z);
      const petals = Array.from({length: count(w, h, 65000, 6, 24)}, () => ({x: rand(0, w), y: rand(0, h), s: rand(7, 15) * k, vx: rand(8, 28) * k, vy: rand(18, 40) * k, rot: rand(0, TAU), vr: rand(-1.2, 1.2), ph: rand(0, TAU), c: pick(['#d7263d', '#f25f7a', '#e84a6b', '#b5173a', '#ff8fa3'])}));
      const bokeh = Array.from({length: 12}, () => ({x: rand(0, 1), y: rand(0, 1), r: rand(0.04, 0.12), ph: rand(0, TAU), sp: rand(0.03, 0.08), c: pick(dark ? ['#ff4d6d', '#ff9eb5', '#c9184a'] : ['#ffb3c4', '#ff8fa3', '#ffc8d6'])}));
      return {dark, k, hearts, petals, bokeh};
    },
    draw(ctx, s, t, dt, w, h){
      const d = s.dark, k = s.k;
      if(d){ const g = ctx.createRadialGradient(w * 0.5, h * 0.25, 0, w * 0.5, h * 0.4, Math.max(w, h)); g.addColorStop(0, '#4d1328'); g.addColorStop(1, '#170a0f'); ctx.fillStyle = g; }
      else ctx.fillStyle = vgrad(ctx, h, [[0, '#fff8fa'], [0.6, '#fde7ec'], [1, '#f9d0da']]);
      ctx.fillRect(0, 0, w, h);
      const M = Math.min(w, h);
      for(const b of s.bokeh) glow(ctx, (b.x + Math.sin(t * b.sp + b.ph) * 0.05) * w, (b.y + Math.cos(t * b.sp + b.ph) * 0.05) * h, b.r * M * 2, b.c, d ? 0.16 : 0.35);
      // Big heart that beats twice, then rests.
      const bt = t % 1.4, beat = 1 + 0.06 * Math.exp(-((bt - 0.1) ** 2) / 0.003) + 0.04 * Math.exp(-((bt - 0.36) ** 2) / 0.003);
      const hx = w * 0.84, hy = h * 0.78, hs = M * 0.5;
      ctx.save(); ctx.translate(hx, hy);
      const ring = bt / 1.4;
      ctx.save(); ctx.scale(1 + ring * 0.35, 1 + ring * 0.35); heartPath(ctx, hs);
      ctx.strokeStyle = d ? `rgba(255,126,152,${0.35 * (1 - ring)})` : `rgba(200,48,79,${0.25 * (1 - ring)})`; ctx.lineWidth = 3 * Math.max(0.5, k); ctx.stroke(); ctx.restore();
      ctx.scale(beat, beat); heartPath(ctx, hs);
      const hg = ctx.createLinearGradient(-hs / 2, -hs / 2, hs / 2, hs / 2);
      hg.addColorStop(0, d ? 'rgba(255,126,152,.28)' : 'rgba(255,143,168,.35)'); hg.addColorStop(1, d ? 'rgba(201,24,74,.12)' : 'rgba(200,48,79,.12)');
      ctx.fillStyle = hg; ctx.fill(); ctx.restore();
      // Floating hearts.
      for(const p of s.hearts){
        p.y -= p.vy * dt; if(p.y < -p.s){ p.y = h + p.s; p.x = rand(0, w); }
        const x = p.x + Math.sin(t * p.f + p.ph) * p.sway;
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(Math.sin(t * p.f * 1.4 + p.ph) * 0.3);
        ctx.globalAlpha = 0.35 + p.z * 0.55;
        if(d){ ctx.shadowColor = p.c; ctx.shadowBlur = 14 * k * p.z; }
        heartPath(ctx, p.s);
        const g = ctx.createLinearGradient(-p.s / 2, -p.s / 2, p.s / 2, p.s / 2);
        g.addColorStop(0, '#ffe3ea'); g.addColorStop(0.35, p.c); g.addColorStop(1, mix(p.c, '#5a0a1e', 0.35));
        ctx.fillStyle = g; ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // Rose petals tumble down.
      for(const p of s.petals){
        p.y += p.vy * dt; p.x += (p.vx + Math.sin(t + p.ph) * 18 * k) * dt; p.rot += p.vr * dt;
        if(p.y > h + p.s * 2){ p.y = -p.s * 2; p.x = rand(-w * 0.2, w); }
        if(p.x > w + p.s * 2) p.x = -p.s * 2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(t * 2.2 + p.ph), 1);
        const g = ctx.createLinearGradient(0, -p.s, 0, p.s);
        g.addColorStop(0, mix(p.c, '#ffffff', 0.35)); g.addColorStop(1, p.c);
        ctx.fillStyle = g; ctx.globalAlpha = d ? 0.85 : 0.75;
        ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.bezierCurveTo(p.s * 0.95, -p.s * 0.55, p.s * 0.7, p.s * 0.65, 0, p.s); ctx.bezierCurveTo(-p.s * 0.7, p.s * 0.65, -p.s * 0.95, -p.s * 0.55, 0, -p.s); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  };

  /* ---------------- Forest ---------------- */
  function pineLayer(w, h, d, dark, k){
    const tileW = Math.ceil(w * 1.4);
    const base = h * (0.42 + d * 0.4);
    const far = dark ? '#1c3a4c' : '#b9ccc0', near = dark ? '#040806' : '#223d1f';
    const col = mix(far, near, Math.pow(d, 0.8));
    const cv = document.createElement('canvas');
    cv.width = tileW; cv.height = Math.ceil(h);
    const c = cv.getContext('2d');
    c.fillStyle = col;
    // Rolling hill under the trees.
    c.beginPath(); c.moveTo(0, h);
    for(let x = 0; x <= tileW; x += 20){
      const y = base + Math.sin((x / tileW) * TAU * 2 + d * 5) * 10 * k * (1 + d) + Math.sin((x / tileW) * TAU * 5 + d) * 4 * k;
      c.lineTo(x, y);
    }
    c.lineTo(tileW, h); c.closePath(); c.fill();
    const gap = (14 + (1 - d) * 10) * Math.max(k, 0.25) * (0.6 + d);
    for(let x = -20; x < tileW + 20; x += rand(gap * 0.6, gap * 1.4)){
      const th = rand(45, 115) * Math.max(k, 0.2) * (0.35 + d * 1.15);
      const tw = th * rand(0.32, 0.42);
      const hillY = base + Math.sin((x / tileW) * TAU * 2 + d * 5) * 10 * k * (1 + d) + Math.sin((x / tileW) * TAU * 5 + d) * 4 * k;
      const y0 = hillY + th * 0.05;
      c.beginPath();
      for(let tier = 0; tier < 3; tier++){
        const ty = y0 - th * (0.12 + tier * 0.27), tw2 = tw * (1 - tier * 0.26);
        c.moveTo(x, ty - th * 0.42); c.lineTo(x + tw2 / 2, ty + th * 0.08); c.lineTo(x - tw2 / 2, ty + th * 0.08); c.closePath();
      }
      c.fill();
      c.fillRect(x - tw * 0.06, y0 - th * 0.2, tw * 0.12, th * 0.22);
    }
    return {cv, tileW, sp: (1.5 + d * 9) * Math.max(k, 0.3)};
  }
  const forest = {
    init(w, h, dark){
      const k = scaleOf(w, h);
      const layers = [0, 0.25, 0.5, 0.75, 1].map(d => pineLayer(w, h, d, dark, k));
      const flies = dark ? Array.from({length: count(w, h, 26000, 8, 60)}, () => ({x: rand(0, w), y: rand(h * 0.45, h), ph: rand(0, TAU), f: rand(0.3, 0.8), r: rand(1.2, 2.6) * Math.max(k, 0.4), ax: rand(20, 60) * k, ay: rand(10, 30) * k})) : [];
      const leaves = dark ? [] : Array.from({length: count(w, h, 60000, 6, 20)}, () => ({x: rand(0, w), y: rand(0, h), s: rand(6, 12) * k, vx: rand(10, 30) * k, vy: rand(20, 40) * k, rot: rand(0, TAU), vr: rand(-2, 2), ph: rand(0, TAU), c: pick(['#c9893b', '#d9a441', '#8a9a3b', '#b8612e', '#e0b04a'])}));
      const skyStars = dark ? Array.from({length: count(w, h, 9000, 10, 140)}, () => ({x: rand(0, w), y: rand(0, h * 0.45), r: rand(0.4, 1.3) * Math.max(k, 0.5), ph: rand(0, TAU)})) : [];
      return {dark, k, layers, flies, leaves, skyStars, offs: layers.map(() => rand(0, 500)), birds: {x: -200, y: 0, next: rand(2, 6)}, mist: [rand(0, 1), rand(0, 1)]};
    },
    draw(ctx, s, t, dt, w, h){
      const d = s.dark, k = s.k;
      ctx.fillStyle = vgrad(ctx, h, d ? [[0, '#07111f'], [0.5, '#0e2233'], [1, '#132a1f']] : [[0, '#fbf6e6'], [0.45, '#f1efd9'], [1, '#d8e6cf']]);
      ctx.fillRect(0, 0, w, h);
      const M = Math.min(w, h);
      for(const st of s.skyStars){ ctx.fillStyle = `rgba(255,255,240,${0.4 + 0.4 * Math.sin(t * 1.5 + st.ph)})`; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill(); }
      // Sun by day, moon by night.
      const sx = w * 0.72, sy = h * 0.26, sr = M * 0.075;
      glow(ctx, sx, sy, sr * 5, d ? '#cfe3ff' : '#ffd36b', d ? 0.18 : 0.45);
      ctx.fillStyle = d ? '#eef3ff' : '#ffe08a'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
      if(d){ ctx.fillStyle = 'rgba(120,140,170,.35)'; [[-0.3, -0.2, 0.2], [0.25, 0.1, 0.14], [0, 0.4, 0.1]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(sx + a * sr, sy + b * sr, r * sr, 0, TAU); ctx.fill(); }); }
      // Birds cross the sky now and then (day only).
      if(!d){
        const B = s.birds;
        if(B.x < -150){ if((B.next -= dt) <= 0){ B.x = w + 60; B.y = rand(h * 0.1, h * 0.3); B.next = rand(10, 20); } }
        else {
          B.x -= 55 * k * dt;
          ctx.strokeStyle = 'rgba(60,60,50,.55)'; ctx.lineWidth = 1.6 * Math.max(k, 0.5); ctx.lineCap = 'round';
          [[0, 0], [22, 10], [40, -6], [58, 14]].forEach(([ox, oy], i) => {
            const bx = B.x + ox * k * 1.5, by = B.y + oy * k * 1.5, fl = Math.sin(t * 9 + i) * 5 * k, ws = 9 * k;
            ctx.beginPath(); ctx.moveTo(bx - ws, by - fl); ctx.quadraticCurveTo(bx - ws * 0.4, by - ws * 0.3, bx, by); ctx.quadraticCurveTo(bx + ws * 0.4, by - ws * 0.3, bx + ws, by - fl); ctx.stroke();
          });
        }
      }
      // Pine ridges drift at different speeds, with mist between them.
      s.layers.forEach((L, i) => {
        s.offs[i] = wrap(s.offs[i] + L.sp * dt, L.tileW);
        const x0 = -s.offs[i];
        ctx.drawImage(L.cv, x0, 0); ctx.drawImage(L.cv, x0 + L.tileW, 0);
        if(i === 1 || i === 3){
          const my = h * (i === 1 ? 0.6 : 0.78), mh = h * 0.12;
          const mxo = wrap(t * (i === 1 ? 8 : 14) * k, w * 2) - w * 0.5;
          const g = ctx.createLinearGradient(0, my - mh, 0, my + mh);
          const mc = d ? '150,175,200' : '255,255,255';
          g.addColorStop(0, `rgba(${mc},0)`); g.addColorStop(0.5, `rgba(${mc},${d ? 0.12 : 0.45})`); g.addColorStop(1, `rgba(${mc},0)`);
          ctx.fillStyle = g; ctx.fillRect(0, my - mh, w, mh * 2);
          glow(ctx, mxo, my, w * 0.35, d ? '#96afc8' : '#ffffff', d ? 0.1 : 0.35);
        }
      });
      // Fireflies (night).
      ctx.globalCompositeOperation = 'lighter';
      for(const f of s.flies){
        const x = f.x + Math.sin(t * f.f + f.ph) * f.ax, y = f.y + Math.cos(t * f.f * 1.3 + f.ph) * f.ay;
        const a = Math.max(0, Math.sin(t * 1.7 + f.ph * 3));
        glow(ctx, x, y, f.r * 7, '#d9ff6b', 0.35 * a);
        ctx.fillStyle = `rgba(245,255,190,${0.9 * a})`; ctx.beginPath(); ctx.arc(x, y, f.r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // Falling leaves (day).
      for(const l of s.leaves){
        l.y += l.vy * dt; l.x += (l.vx + Math.sin(t * 1.3 + l.ph) * 25 * k) * dt; l.rot += l.vr * dt;
        if(l.y > h + 20){ l.y = -20; l.x = rand(-w * 0.2, w); }
        if(l.x > w + 20) l.x = -20;
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.scale(Math.cos(t * 2 + l.ph), 1);
        ctx.fillStyle = l.c;
        ctx.beginPath(); ctx.moveTo(0, -l.s); ctx.quadraticCurveTo(l.s * 0.8, 0, 0, l.s); ctx.quadraticCurveTo(-l.s * 0.8, 0, 0, -l.s); ctx.fill();
        ctx.strokeStyle = 'rgba(80,50,20,.4)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -l.s); ctx.lineTo(0, l.s * 1.2); ctx.stroke();
        ctx.restore();
      }
    }
  };

  /* ---------------- Deep Sea ---------------- */
  function seabed(w, h, dark, k){
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w); cv.height = Math.ceil(h);
    const c = cv.getContext('2d');
    const top = h * 0.84;
    const g = c.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, dark ? '#06202b' : '#e6d49f'); g.addColorStop(1, dark ? '#010a0f' : '#c9ae6c');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, h);
    for(let x = 0; x <= w; x += 16) c.lineTo(x, top + Math.sin(x / w * TAU * 1.5) * 14 * k + Math.sin(x / w * TAU * 4.3) * 6 * k);
    c.lineTo(w, h); c.closePath(); c.fill();
    for(let i = 0; i < 9; i++){
      const rx = rand(0, w), rr = rand(10, 34) * Math.max(k, 0.3);
      c.fillStyle = dark ? '#041822' : '#a9936a';
      c.beginPath(); c.ellipse(rx, top + rr * 0.5 + rand(4, 20) * k, rr * 1.4, rr, 0, Math.PI, TAU); c.fill();
    }
    return cv;
  }
  const deepsea = {
    init(w, h, dark){
      const k = scaleOf(w, h);
      const rays = Array.from({length: 6}, (_, i) => ({x: (i + rand(0.2, 0.8)) / 6, wd: rand(0.05, 0.12), ph: rand(0, TAU)}));
      const bubbles = Array.from({length: count(w, h, 30000, 8, 50)}, () => ({x: rand(0, w), y: rand(0, h), r: rand(1.5, 6) * Math.max(k, 0.35), vy: rand(20, 50) * k, ph: rand(0, TAU)}));
      const kelp = Array.from({length: clamp(Math.round(w / 110), 4, 16)}, () => ({x: rand(0, w), hgt: rand(0.25, 0.55) * h, ph: rand(0, TAU), wdt: rand(4, 9) * Math.max(k, 0.3), c: pick(dark ? ['#0f3b2d', '#12402f', '#0b3326'] : ['#2e7d4f', '#3b8f55', '#23693f'])}));
      const fishCols = dark ? ['#1c6f8a', '#23839f', '#155b72'] : ['#1f7f99', '#e0894a', '#2a6f8a', '#f2b14e'];
      const fish = [];
      for(let sch = 0; sch < 3; sch++){
        const dir = Math.random() < 0.5 ? -1 : 1, y = rand(0.15, 0.7) * h, sp = rand(25, 55) * k, c = pick(fishCols), n = Math.round(rand(3, 7));
        const x0 = rand(0, w);
        for(let i = 0; i < n; i++) fish.push({x: x0 + rand(-60, 60) * k, y: y + rand(-30, 30) * k, dir, sp, s: rand(8, 14) * Math.max(k, 0.3), ph: rand(0, TAU), c});
      }
      const jelly = Array.from({length: dark ? 3 : 2}, () => ({x: rand(0.1, 0.9) * w, y: rand(0.2, 0.9) * h, s: rand(18, 34) * Math.max(k, 0.3), ph: rand(0, TAU), c: pick(dark ? ['#ff9ee6', '#9ee7ff', '#c7a6ff'] : ['#ff9ec8', '#8fd3ff'])}));
      return {dark, k, rays, bubbles, kelp, fish, jelly, bed: seabed(w, h, dark, k)};
    },
    draw(ctx, s, t, dt, w, h){
      const d = s.dark, k = s.k;
      ctx.fillStyle = vgrad(ctx, h, d ? [[0, '#0c3a4f'], [0.45, '#06202e'], [1, '#020a10']] : [[0, '#e9f8fb'], [0.5, '#a9dcea'], [1, '#62b3cc']]);
      ctx.fillRect(0, 0, w, h);
      // Sunlight rays from the surface.
      ctx.globalCompositeOperation = d ? 'lighter' : 'source-over';
      for(const r of s.rays){
        const cx = (r.x + Math.sin(t * 0.15 + r.ph) * 0.03) * w, rw = r.wd * w, skew = Math.sin(t * 0.2 + r.ph) * w * 0.05 + w * 0.12;
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.9);
        g.addColorStop(0, `rgba(255,255,255,${d ? 0.09 : 0.35 * (0.7 + 0.3 * Math.sin(t * 0.7 + r.ph))})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - rw / 2, 0); ctx.lineTo(cx + rw / 2, 0); ctx.lineTo(cx + rw * 1.4 + skew, h * 0.9); ctx.lineTo(cx - rw * 0.3 + skew, h * 0.9); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // Fish swim in small schools.
      for(const f of s.fish){
        f.x += f.dir * f.sp * dt; if(f.dir > 0 && f.x > w + 40) f.x = -40; if(f.dir < 0 && f.x < -40) f.x = w + 40;
        const y = f.y + Math.sin(t * 0.8 + f.ph) * 6 * k, wag = Math.sin(t * 9 + f.ph) * 0.45;
        ctx.save(); ctx.translate(f.x, y); ctx.scale(f.dir, 1); ctx.globalAlpha = d ? 0.75 : 0.8;
        ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.42, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(-f.s * 0.9, 0); ctx.rotate(wag); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-f.s * 0.6, -f.s * 0.4); ctx.lineTo(-f.s * 0.6, f.s * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = d ? 'rgba(200,240,255,.8)' : 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(f.s * 0.55, -f.s * 0.08, f.s * 0.09, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // Jellyfish pulse upward.
      for(const j of s.jelly){
        const pulse = Math.sin(t * 2 + j.ph);
        j.y -= (8 + Math.max(0, pulse) * 14) * k * dt; if(j.y < -j.s * 3){ j.y = h + j.s * 2; j.x = rand(0.1, 0.9) * w; }
        const bw = j.s * (1 + 0.1 * pulse), bh = j.s * (0.75 - 0.08 * pulse);
        if(d) glow(ctx, j.x, j.y, j.s * 3, j.c, 0.25);
        ctx.save(); ctx.globalAlpha = d ? 0.85 : 0.7;
        ctx.strokeStyle = j.c; ctx.lineWidth = 1.4 * Math.max(k, 0.4);
        for(let i = 0; i < 5; i++){
          const tx = j.x - bw * 0.6 + i * bw * 0.3;
          ctx.beginPath(); ctx.moveTo(tx, j.y);
          for(let yy = 0; yy < j.s * 2.4; yy += j.s * 0.2) ctx.lineTo(tx + Math.sin(t * 3 + i + yy / j.s * 2) * j.s * 0.12, j.y + yy);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(j.x, j.y - bh * 0.4, bh * 0.1, j.x, j.y, bw);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, j.c); g.addColorStop(1, rgba(j.c.length === 7 ? j.c : '#ffffff', 0.3));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(j.x, j.y, bw, bh, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // Kelp sways from the seabed.
      for(const kp of s.kelp){
        const baseY = h * 0.9, segs = 14;
        ctx.strokeStyle = kp.c; ctx.lineCap = 'round';
        let px = kp.x, py = baseY;
        for(let i = 1; i <= segs; i++){
          const f = i / segs;
          const x = kp.x + Math.sin(t * 0.9 + kp.ph + f * 2.4) * 26 * k * Math.pow(f, 1.3);
          const y = baseY - kp.hgt * f;
          ctx.lineWidth = kp.wdt * (1.1 - f * 0.7);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
          if(i % 3 === 0){
            ctx.fillStyle = kp.c; const side = i % 2 ? 1 : -1, ls = kp.wdt * 3.2;
            ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.9 + Math.sin(t + i) * 0.2);
            ctx.beginPath(); ctx.ellipse(ls * 0.6, 0, ls * 0.7, ls * 0.25, 0, 0, TAU); ctx.fill(); ctx.restore();
          }
          px = x; py = y;
        }
      }
      ctx.drawImage(s.bed, 0, 0);
      // Bubbles rise and wobble.
      for(const b of s.bubbles){
        b.y -= b.vy * dt; if(b.y < -10){ b.y = h + 10; b.x = rand(0, w); }
        const x = b.x + Math.sin(t * 2 + b.ph) * 4 * k;
        ctx.strokeStyle = d ? 'rgba(170,230,255,.45)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = d ? 'rgba(170,230,255,.12)' : 'rgba(255,255,255,.25)'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, TAU); ctx.fill();
      }
    }
  };

  window.PKScenes = {mesh, space, love, forest, deepsea};
})();
