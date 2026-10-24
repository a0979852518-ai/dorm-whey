// ===== 細緻模型（沙發、茶几、飲水機、蹲式馬桶、洗衣機、草地、曬衣場木樁與鐵鍊）=====
// 位置資料來自 dorm.js 的 DORM.props；碰撞仍然是 dorm.js 裡的方塊（那些方塊不畫，見 NO_DRAW）。
// 同材質的零件全部合併成一個網格，避免 draw call 變多。
function buildProps(DORM, scene) {
  const T = THREE;
  const bins = new Map();
  const bin = (key, mk) => { let b = bins.get(key); if (!b) bins.set(key, b = { geos: [], mk }); return b; };
  // 物件座標系：原點在物件地面中心、+z 朝前
  const frame = (x, y, z, ry = 0, sx = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sx, 1, 1));
  const local = (x, y, z, rx = 0, ry = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));
  const put = (key, geo, F, x, y, z, rx, ry, rz) => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(new T.Matrix4().multiplyMatrices(F, local(x, y, z, rx, ry, rz))); bin(key).geos.push(g); };

  // 圓角方塊（寬 w、高 h、深 d、圓角 r）
  const rboxCache = new Map();
  const rbox = (w, h, d, r = 0.03, seg = 2) => {
    const k = [w, h, d, r, seg].map((v) => v.toFixed(3)).join(); if (rboxCache.has(k)) return rboxCache.get(k);
    r = Math.max(0.002, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
    const W = w - 2 * r, H = h - 2 * r, rc = Math.max(0, Math.min(r, W / 2 - 0.001, H / 2 - 0.001)), s = new T.Shape(), x = -W / 2, y = -H / 2;
    if (rc > 0.004) { s.moveTo(x + rc, y); s.lineTo(x + W - rc, y); s.absarc(x + W - rc, y + rc, rc, -Math.PI / 2, 0); s.lineTo(x + W, y + H - rc); s.absarc(x + W - rc, y + H - rc, rc, 0, Math.PI / 2); s.lineTo(x + rc, y + H); s.absarc(x + rc, y + H - rc, rc, Math.PI / 2, Math.PI); s.lineTo(x, y + rc); s.absarc(x + rc, y + rc, rc, Math.PI, Math.PI * 1.5); }
    else { s.moveTo(x, y); s.lineTo(x + W, y); s.lineTo(x + W, y + H); s.lineTo(x, y + H); s.lineTo(x, y); }
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 3 });
    g.translate(0, 0, -Math.max(0.001, d - 2 * r) / 2); rboxCache.set(k, g); return g;
  };
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n = 10, open = false, t0 = 0, tl = Math.PI * 2) => new T.CylinderGeometry(r0, r1, h, n, 1, open, t0, tl);

  // ---------- 貼圖（程式畫的，不另外放檔案）----------
  const cv = (S, draw) => { const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
  let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const weaveTex = cv(256, (g, S) => { // 藤編：橫向粗藤條一上一下穿過直向細條
    g.fillStyle = '#3b2716'; g.fillRect(0, 0, S, S);
    const n = 16, h = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const over = (i + j) % 2 === 0, x = j * h, y = i * h;
      const grd = g.createLinearGradient(0, y, 0, y + h); const b = 150 + rnd() * 30;
      grd.addColorStop(0, `rgb(${b * 0.62},${b * 0.42},${b * 0.24})`); grd.addColorStop(0.5, `rgb(${b},${b * 0.72},${b * 0.44})`); grd.addColorStop(1, `rgb(${b * 0.55},${b * 0.37},${b * 0.2})`);
      g.fillStyle = grd; g.fillRect(x + (over ? 0 : h * 0.18), y + 1, over ? h : h * 0.64, h - 2);
      if (!over) { g.fillStyle = 'rgba(40,24,12,0.55)'; g.fillRect(x, y, h * 0.16, h); g.fillRect(x + h * 0.84, y, h * 0.16, h); }
    }
  });
  const grassTex = cv(512, (g, S) => {
    g.fillStyle = '#3f7a24'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26000; i++) { const x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 7, a = rnd() * Math.PI; const gg = 90 + rnd() * 90; g.strokeStyle = `rgba(${30 + rnd() * 40},${gg},${20 + rnd() * 25},0.75)`; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.3, y - l); g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '30,60,15' : '90,140,40'},0.12)`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 20 + rnd() * 60, 0, Math.PI * 2); g.fill(); }
  });
  const woodTex = cv(256, (g, S) => { // 風化的木樁（直紋、裂痕）
    g.fillStyle = '#4b4239'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) { const x = rnd() * S, w = 1 + rnd() * 3, c = 40 + rnd() * 50; g.fillStyle = `rgba(${c + 15},${c + 8},${c},0.5)`; g.fillRect(x, 0, w, S); }
    for (let i = 0; i < 14; i++) { const x = rnd() * S; g.fillStyle = 'rgba(18,14,10,0.8)'; g.fillRect(x, rnd() * S * 0.5, 1.5, 40 + rnd() * 120); }
  });

  // 材質
  const P = (o) => () => new T.MeshPhongMaterial(o);
  const MAT = {
    leather: P({ color: 0xf2a21e, shininess: 38, specular: 0x3a2a10 }),
    leatherD: P({ color: 0xde8f18, shininess: 30, specular: 0x2a1e0c }),
    chrome: P({ color: 0xd8dcdf, shininess: 110, specular: 0x9a9a9a }),
    rattan: P({ color: 0xffffff, map: weaveTex, shininess: 12, specular: 0x1a140c }),
    darkwood: P({ color: 0x2a1c14, shininess: 18, specular: 0x111111 }),
    redwood: P({ color: 0x6a2f1c, shininess: 40, specular: 0x2a1a12 }),
    cloth: P({ color: 0xe9e7df, shininess: 4 }),
    pot: P({ color: 0x1c1c1c, shininess: 30 }),
    leaf: P({ color: 0x3f6a2a, shininess: 8 }),
    steel: P({ color: 0xa2a8ad, shininess: 85, specular: 0x777777 }),
    steelD: P({ color: 0x7c8186, shininess: 70, specular: 0x555555 }),
    black: P({ color: 0x141618, shininess: 60, specular: 0x333333 }),
    red: P({ color: 0xc8302a, shininess: 40, emissive: 0x200404 }),
    blue: P({ color: 0x2a5ec8, shininess: 40, emissive: 0x040a20 }),
    lcd: P({ color: 0x2d6b78, shininess: 60, emissive: 0x06181c }),
    porcelain: P({ color: 0xf2f2ee, shininess: 95, specular: 0x8a8a8a }),
    drain: P({ color: 0x23272a, shininess: 30 }),
    white: P({ color: 0xe6e6e0, shininess: 40, specular: 0x333333 }),
    gray: P({ color: 0x9aa0a6, shininess: 50, specular: 0x444444 }),
    post: P({ color: 0xffffff, map: woodTex, shininess: 6 }),
    sheet: P({ color: 0xdedbd2, shininess: 30 }),
    porcelainIn: P({ color: 0xe4e2da, shininess: 70, specular: 0x555555 }),
    sensor: P({ color: 0xd9d2bd, shininess: 40 }),
    conduit: P({ color: 0xd6d3c8, shininess: 45, specular: 0x333333 }),
  };
  const glassMat = new T.MeshPhongMaterial({ color: 0x9fb8b4, shininess: 90, specular: 0x888888, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide });
  const glassGeos = [];
  const putGlass = (geo, F, x, y, z) => { const g = geo.clone(); g.applyMatrix4(new T.Matrix4().multiplyMatrices(F, local(x, y, z))); glassGeos.push(g); };

  // ---------- 沙發（皮沙發／藤編沙發）----------
  const sofa = (p, rattan) => {
    const { x0, x1, z0, z1, back, arm, bt, y } = p, alongX = back === 'N' || back === 'S';
    const W = alongX ? x1 - x0 : z1 - z0, D = alongX ? z1 - z0 : x1 - x0, TW = W + 2 * arm, TD = D + bt;
    let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; const o = bt / 2;
    if (back === 'N') cz -= o; if (back === 'S') cz += o; if (back === 'W') cx -= o; if (back === 'E') cx += o;
    const ry = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[back], F = frame(cx, y, cz, ry);
    const n = Math.max(1, Math.min(3, Math.round(W / 0.62))), cw = W / n, zs = -TD / 2 + bt + D / 2;
    if (!rattan) {
      const yb = 0.12, A = 'leather', B = 'leatherD';
      put(B, rbox(W, 0.2, D, 0.03), F, 0, yb + 0.1, zs);
      for (let i = 0; i < n; i++) put(A, rbox(cw - 0.014, 0.13, D - 0.02, 0.05, 3), F, -W / 2 + cw * (i + 0.5), yb + 0.265, zs + 0.01);
      put(B, rbox(W + 0.004, 0.88 - yb, bt, 0.045, 3), F, 0, yb + (0.88 - yb) / 2, -TD / 2 + bt / 2);
      for (let i = 0; i < n; i++) put(A, rbox(cw - 0.014, 0.34, 0.09, 0.045, 3), F, -W / 2 + cw * (i + 0.5), 0.63, -TD / 2 + bt + 0.035, -0.12);
      for (const s of [-1, 1]) {
        put(A, rbox(arm, 0.66 - yb, TD, 0.05, 3), F, s * (W / 2 + arm / 2), yb + (0.66 - yb) / 2, 0);
        put(B, rbox(0.012, 0.3, 0.012, 0.004, 1), F, s * (W / 2 + arm / 2), 0.4, TD / 2 + 0.001); // 扶手正面的車線
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('chrome', cyl(0.016, 0.02, yb, 8), F, sx * (TW / 2 - 0.07), yb / 2, sz * (TD / 2 - 0.07));
    } else {
      const yb = 0.06, R = 'rattan';
      put(R, rbox(W, 0.42 - yb, D, 0.02), F, 0, yb + (0.42 - yb) / 2, zs);
      put(R, rbox(W + 0.002, 0.88 - yb, bt, 0.03), F, 0, yb + (0.88 - yb) / 2, -TD / 2 + bt / 2);
      for (const s of [-1, 1]) put(R, rbox(arm, 0.62 - yb, TD, 0.03), F, s * (W / 2 + arm / 2), yb + (0.62 - yb) / 2, 0);
      put('darkwood', rbox(W + 2 * arm - 0.02, 0.025, TD - 0.02, 0.008), F, 0, yb + 0.012, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('darkwood', box(0.06, yb, 0.06), F, sx * (TW / 2 - 0.05), yb / 2, sz * (TD / 2 - 0.05));
    }
  };

  // ---------- 茶几 ----------
  const lobbyTable = (p) => { // 照片：木頭框＋玻璃桌面、白色桌巾、小盆栽
    const F = frame(p.x, p.y, p.z), W = 1.5, D = 0.8, H = 0.42;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('redwood', box(0.05, H - 0.02, 0.05), F, sx * (W / 2 - 0.05), (H - 0.02) / 2, sz * (D / 2 - 0.05));
    for (const sz of [-1, 1]) put('redwood', box(W - 0.04, 0.07, 0.035), F, 0, H - 0.055, sz * (D / 2 - 0.035));
    for (const sx of [-1, 1]) put('redwood', box(0.035, 0.07, D - 0.04), F, sx * (W / 2 - 0.035), H - 0.055, 0);
    put('redwood', box(W, 0.02, D), F, 0, H - 0.01 - 0.0, 0);
    putGlass(box(W + 0.02, 0.012, D + 0.02), F, 0, H + 0.007, 0);
    put('cloth', box(0.92, 0.004, 0.86), F, 0.08, H + 0.016, 0);
    put('pot', cyl(0.07, 0.055, 0.11, 12), F, 0.1, H + 0.073, 0);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = i ? 0.06 : 0; put('leaf', new T.IcosahedronGeometry(0.055, 0), F, 0.1 + Math.cos(a) * r, H + 0.17 + (i % 3) * 0.03, Math.sin(a) * r); }
  };
  const rattanTable = (p) => {
    const F = frame(p.x, p.y, p.z), W = 1.4, D = 0.8, H = 0.4;
    put('rattan', rbox(W - 0.04, H - 0.04, D - 0.04, 0.02), F, 0, (H - 0.04) / 2 + 0.01, 0);
    put('darkwood', box(W, 0.03, D), F, 0, H - 0.015, 0);
    put('sheet', box(W - 0.1, 0.004, D - 0.1), F, 0, H + 0.002, 0);
    putGlass(box(W + 0.02, 0.012, D + 0.02), F, 0, H + 0.03, 0);
  };

  // ---------- 飲水機（照片：銀色直立式，上方黑色按鍵面板）----------
  const dispenser = (p) => {
    const ns = p.face === 'N' || p.face === 'S', w = ns ? p.x1 - p.x0 : p.z1 - p.z0, d = ns ? p.z1 - p.z0 : p.x1 - p.x0, H = 1.3, fz = d / 2;
    const F = frame((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2, { W: -Math.PI / 2, E: Math.PI / 2, N: Math.PI, S: 0 }[p.face]);
    put('steel', rbox(w, H - 0.04, d, 0.025), F, 0, (H - 0.04) / 2, 0);
    put('steelD', rbox(w + 0.006, 0.05, d + 0.006, 0.015), F, 0, H - 0.025, 0);
    put('black', rbox(w - 0.05, 0.27, 0.03, 0.01), F, 0, 1.08, fz);
    put('lcd', box(0.12, 0.05, 0.005), F, 0, 1.15, fz + 0.016);
    [['red', -0.11], ['blue', -0.04], ['white', 0.04], ['red', 0.11]].forEach(([m, x]) => put(m, cyl(0.014, 0.014, 0.006, 10), F, x, 1.03, fz + 0.016, Math.PI / 2));
    put('black', box(w - 0.08, 0.24, 0.01), F, 0, 0.8, fz - 0.002); // 出水口凹槽
    for (const x of [-0.06, 0.06]) { put('steelD', cyl(0.012, 0.012, 0.05, 8), F, x, 0.88, fz - 0.03); put('black', cyl(0.018, 0.018, 0.012, 8), F, x, 0.905, fz - 0.03); }
    put('steelD', rbox(w - 0.1, 0.025, 0.09, 0.008), F, 0, 0.69, fz + 0.03); // 接水盤
    for (let i = 0; i < 7; i++) put('black', box(0.004, 0.006, 0.07), F, -0.12 + i * 0.04, 0.704, fz + 0.03);
    put('steelD', box(w - 0.04, 0.006, 0.004), F, 0, 0.6, fz + 0.001); // 下方櫃門縫
    put('steelD', box(0.12, 0.018, 0.012), F, 0, 0.54, fz + 0.006);
  };

  // ---------- 蹲式馬桶 ----------
  const squat = (p) => {
    const F = frame(p.x, p.y, p.z, (p.dir || 1) > 0 ? 0 : Math.PI); // +x 朝隔間後牆
    const s = new T.Shape(); const L = 0.29, Wd = 0.19, r = 0.08;
    s.moveTo(-L + r, -Wd); s.lineTo(L - r, -Wd); s.absarc(L - r, -Wd + r, r, -Math.PI / 2, 0); s.lineTo(L, Wd - r); s.absarc(L - r, Wd - r, r, 0, Math.PI / 2); s.lineTo(-L + r, Wd); s.absarc(-L + r, Wd - r, r, Math.PI / 2, Math.PI); s.lineTo(-L, -Wd + r); s.absarc(-L + r, -Wd + r, r, Math.PI, Math.PI * 1.5);
    const hole = new T.Path(); hole.absellipse(0.01, 0, 0.21, 0.115, 0, Math.PI * 2, false, 0); s.holes.push(hole);
    const rim = new T.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
    rim.rotateX(-Math.PI / 2); put('porcelain', rim, F, 0, 0.004, 0);
    const bowl = new T.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bowl.scale(0.21, 0.034, 0.115); put('porcelain', bowl, F, 0.01, 0.042, 0);
    put('drain', new T.CircleGeometry(0.035, 14), F, 0.12, 0.0105, 0, -Math.PI / 2);
    const hood = new T.SphereGeometry(1, 14, 6, Math.PI / 2, Math.PI, 0, Math.PI / 2); hood.scale(0.11, 0.1, 0.115); put('porcelain', hood, F, 0.12, 0.035, 0); // 後端的半圓罩
  };

  // ---------- 上掀式洗衣機 ----------
  const washer = (p) => {
    const w = p.z1 - p.z0, d = p.x1 - p.x0, H = 0.88, F = frame((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2, p.face === 'W' ? -Math.PI / 2 : Math.PI / 2);
    put('white', rbox(w, H - 0.03, d, 0.035), F, 0, (H - 0.03) / 2 + 0.03, 0);
    put('black', box(w - 0.06, 0.03, d - 0.06), F, 0, 0.015, 0);
    put('white', rbox(w, 0.13, 0.13, 0.03), F, 0, H + 0.05, -d / 2 + 0.065);
    put('lcd', box(0.14, 0.04, 0.005), F, 0, H + 0.07, -d / 2 + 0.133);
    put('gray', rbox(w - 0.07, 0.025, d - 0.2, 0.012), F, 0, H + 0.005, 0.06);
    put('black', box(w - 0.22, 0.004, d - 0.36), F, 0, H + 0.019, 0.07);
  };

  // ---------- 天花板垂下來的電線（每個吊點之間微微下垂）----------
  const cable = (p) => {
    const pts = []; for (let x = p.x0; x < p.x1 - 0.01; x += p.step) { const b = Math.min(p.x1, x + p.step); for (let k = 0; k < 6; k++) { const t = k / 6; pts.push(new T.Vector3(x + (b - x) * t, p.y - p.sag * 4 * t * (1 - t) * (0.7 + 0.3 * Math.sin(x * 3.1)), p.z + Math.sin(x * 1.7 + t * 2) * 0.03)); } }
    pts.push(new T.Vector3(p.x1, p.y, p.z));
    put('c:' + p.c, new T.TubeGeometry(new T.CatmullRomCurve3(pts), pts.length * 3, p.r, 5, false), new T.Matrix4(), 0, 0, 0);
  };
  // ---------- 小便斗（照片：壁掛式、上方有感應器）----------
  const urinal = (p) => {
    const F = frame(p.x, p.y, p.z, p.face === 'W' ? -Math.PI / 2 : p.face === 'E' ? Math.PI / 2 : p.face === 'N' ? Math.PI : 0), U = 'porcelain', I = 'porcelainIn';
    put(U, rbox(0.36, 0.64, 0.05, 0.02), F, 0, 0.32, 0.025);
    for (const s of [-1, 1]) put(U, rbox(0.06, 0.6, 0.3, 0.025, 3), F, s * 0.15, 0.33, 0.15);
    put(U, rbox(0.36, 0.13, 0.32, 0.05, 3), F, 0, 0.065, 0.16);
    put(U, rbox(0.36, 0.09, 0.24, 0.03, 3), F, 0, 0.6, 0.12);
    put(I, box(0.24, 0.46, 0.01), F, 0, 0.36, 0.055);
    put(I, box(0.24, 0.01, 0.22), F, 0, 0.13, 0.16);
    put('drain', new T.CircleGeometry(0.03, 10), F, 0, 0.136, 0.15, -Math.PI / 2);
    put('chrome', cyl(0.018, 0.018, 0.3, 8), F, 0, -0.14, 0.06);
    put('sensor', rbox(0.22, 0.11, 0.07, 0.015), F, 0, 0.95, 0.035);
    put('black', box(0.08, 0.035, 0.005), F, 0.03, 0.96, 0.071);
    put('c:' + 0x222222, cyl(0.003, 0.003, 0.22, 4), F, -0.07, 0.78, 0.012);
  };
  // ---------- 晒衣場：草地（貼圖＋一叢一叢的草）、木樁與下垂的鐵鍊 ----------
  const grassGeo = [], tufts = [];
  const grass = (p) => {
    const g = new T.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0).toNonIndexed(); g.rotateX(-Math.PI / 2); g.translate((p.x0 + p.x1) / 2, 0.012, (p.z0 + p.z1) / 2);
    const uv = g.attributes.uv, ps = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 2.2, ps.getZ(i) / 2.2);
    grassGeo.push(g);
    const n = Math.round((p.x1 - p.x0) * (p.z1 - p.z0) * 40);
    for (let i = 0; i < n; i++) tufts.push([p.x0 + 0.05 + rnd() * (p.x1 - p.x0 - 0.1), p.z0 + 0.05 + rnd() * (p.z1 - p.z0 - 0.1), rnd()]);
  };
  const links = [];
  const clothesline = (p) => {
    const top = 1.55;
    p.xs.forEach((x, i) => { const tilt = (rnd() - 0.5) * 0.06; const F = frame(x, 0, p.z, rnd() * 6); put('post', cyl(0.05, 0.062, top + 0.05, 9), F, 0, (top + 0.05) / 2, 0, tilt, 0, (rnd() - 0.5) * 0.06); put('post', cyl(0.0, 0.05, 0.05, 9), F, 0, top + 0.075, 0); });
    for (let i = 0; i + 1 < p.xs.length; i++) {
      const a = p.xs[i] + 0.05, b = p.xs[i + 1] - 0.05, L = b - a, sag = 0.08 + L * 0.06, step = 0.034, n = Math.floor(L / step);
      for (let k = 0; k <= n; k++) { const t = k / n, x = a + t * L, y = top - 0.06 - sag * 4 * t * (1 - t), dy = -sag * 4 * (1 - 2 * t) / L; links.push([x, y, p.z, Math.atan(dy), k % 2]); }
    }
  };

  for (const p of DORM.props || []) {
    if (p.k === 'leather') sofa(p, false); else if (p.k === 'rattan') sofa(p, true);
    else if (p.k === 'lobbyTable') lobbyTable(p); else if (p.k === 'rattanTable') rattanTable(p);
    else if (p.k === 'disp') dispenser(p); else if (p.k === 'squat') squat(p); else if (p.k === 'washer') washer(p);
    else if (p.k === 'pipe') { const g = cyl(p.r, p.r, p.z1 - p.z0, 10); g.rotateX(Math.PI / 2); put('conduit', g, frame(p.x, p.y, (p.z0 + p.z1) / 2), 0, 0, 0); }
    else if (p.k === 'tube') { const len = p.ax === 'x' ? p.x1 - p.x0 : p.ax === 'y' ? p.y1 - p.y0 : p.z1 - p.z0, g = cyl(p.r, p.r, len, 8); if (p.ax === 'x') g.rotateZ(Math.PI / 2); if (p.ax === 'z') g.rotateX(Math.PI / 2); put('c:' + p.c, g, frame((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2), 0, 0, 0); }
    else if (p.k === 'cable') cable(p); else if (p.k === 'urinal') urinal(p);
    else if (p.k === 'grass') grass(p); else if (p.k === 'clothesline') clothesline(p);
  }

  // 合併同材質的零件
  const merge = (geos) => {
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const g of geos) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += c; }
    const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); return m;
  };
  const triplanar = (g, s) => { // 依世界座標重算 UV（藤編、木紋才不會被拉長）
    const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ay >= ax && ay >= az) uv.setXY(i, x / s, z / s); else if (ax >= az) uv.setXY(i, z / s, y / s); else uv.setXY(i, x / s, y / s); }
  };
  for (const [key, b] of bins) {
    if (!b.geos.length) continue; const g = merge(b.geos);
    if (key === 'rattan') triplanar(g, 0.32); if (key === 'post') triplanar(g, 0.5);
    const m = new T.Mesh(g, key.startsWith('c:') ? new T.MeshPhongMaterial({ color: +key.slice(2), shininess: 35, specular: 0x2a2a2a }) : MAT[key]()); m.castShadow = key !== 'chrome'; m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
  }
  if (glassGeos.length) { const m = new T.Mesh(merge(glassGeos), glassMat); m.renderOrder = 2; scene.add(m); }
  if (grassGeo.length) { const m = new T.Mesh(merge(grassGeo), new T.MeshPhongMaterial({ map: grassTex, color: 0xb8d0a0, shininess: 3 })); m.receiveShadow = true; scene.add(m); }
  if (tufts.length) { // 一叢草：三片交叉的細長三角形
    const g = new T.BufferGeometry(), v = [];
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + 0.3, c = Math.cos(a) * 0.035, s = Math.sin(a) * 0.035, lean = 0.025 * (k - 1); v.push(-c * 0.6, 0, -s * 0.6, c * 0.6, 0, s * 0.6, lean, 0.065 + k * 0.012, lean * 0.5); }
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const im = new T.InstancedMesh(g, new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide }), tufts.length), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), c = new T.Color();
    tufts.forEach(([x, z, r], i) => { const s = 0.7 + r * 0.9; m4.compose(new T.Vector3(x, 0, z), q.setFromEuler(e.set(0, r * 40, 0)), new T.Vector3(s, s * (0.8 + rnd() * 0.6), s)); im.setMatrixAt(i, m4); c.setRGB(0.12 + rnd() * 0.1, 0.3 + rnd() * 0.16, 0.06 + rnd() * 0.05); im.setColorAt(i, c); });
    im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  }
  if (links.length) { // 鐵鍊：一節一節的環，相鄰兩節轉 90 度
    const g = new T.TorusGeometry(0.019, 0.0055, 4, 8); g.scale(1.45, 1, 1);
    const im = new T.InstancedMesh(g, new T.MeshPhongMaterial({ color: 0x8c8f8e, shininess: 70, specular: 0x666666 }), links.length), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    links.forEach(([x, y, z, a, odd], i) => { m4.compose(new T.Vector3(x, y, z), q.setFromEuler(e.set(odd ? Math.PI / 2 : 0, 0, a, 'XYZ')), new T.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.frustumCulled = false; scene.add(im);
  }
}
