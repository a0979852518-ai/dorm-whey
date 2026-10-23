() => {
  const A = window.__ASSETS;
  const b64ToAB = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  const f32 = (arr) => { const u = new Uint8Array(new Float32Array(arr).buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const out = { objects: [], textures: {} };
  const hex = (c) => '#' + c.getHexString();
  // one object = { group, name, pos(b64), nrm(b64), uv(b64|null), mat:{color, opacity, tex, unlit} }
  function pushGeo(group, name, geo, mat) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.computeVertexNormals();
    const p = geo.getAttribute('position').array, n = geo.getAttribute('normal').array, uv = geo.getAttribute('uv');
    out.objects.push({ group, name, pos: f32(p), nrm: f32(n), uv: uv ? f32(uv.array) : null, count: p.length / 3, mat });
  }
  function pushMesh(group, name, mesh, mat, uvScale) {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld);
    if (uvScale) { const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]); }
    pushGeo(group, name, g, mat);
  }
  const texKey = (canvas) => { const k = 't' + Object.keys(out.textures).length; out.textures[k] = canvas.toDataURL('image/png'); return k; };

  // ---- 1) 依平面圖生成的地圖方塊（逐一保留名稱）
  const DORM = buildDorm(); const raw = DORM.solid;
  const groupOf = (n) => /^二樓_\d{3}房_/.test(n) ? '二樓寢室_' + n.slice(3, 6) : n.startsWith('浴廁') ? '二樓浴廁區' : n.startsWith('交誼廳') || n === '日光燈' ? '二樓交誼廳' : n.startsWith('走廊') ? '二樓走廊' : n.startsWith('樓梯') || n.startsWith('三樓') || n.startsWith('二樓樓板_樓梯') ? '西南角樓梯間' : n.startsWith('二樓_小樓梯') ? '二樓小樓梯間' : n.startsWith('二樓_儲藏室') ? '二樓儲藏室' : n.startsWith('二樓') ? '二樓結構' : n.startsWith('滅火器') ? '滅火器' : n.startsWith('中庭') ? '一樓中庭' : '一樓大廳';
  const pushBox = (arr, b) => { const { x0, x1, y0, y1, z0, z1 } = b; const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]; for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]) { for (const i of [f[0], f[1], f[2], f[0], f[2], f[3]]) arr.push(...v[i]); } };
  DORM.solid.concat(DORM.deco).forEach((b, i) => {
    if (b.n.startsWith('空氣牆') || b.n === '斜牆碰撞' || b.n.startsWith('樓梯碰撞') || b.n === '欄杆碰撞') return;
    const g = 0.0005 + (((b.c * 2654435761) >>> 0) % 13) * 0.00035; const a = [];
    pushBox(a, { x0: b.x0 - g, x1: b.x1 + g, y0: b.y0 - g, y1: b.y1 + g, z0: b.z0 - g, z1: b.z1 + g });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    const glass = b.n.includes('窗戶');
    pushGeo(groupOf(b.n), b.n, geo, glass ? (b.c === 0xc9ccc4 ? { color: '#c9ccc4', opacity: 0.86, name: '霧面玻璃' } : { color: '#1d3140', opacity: 0.32, name: '玻璃' }) : { color: hex(new THREE.Color(b.c)), opacity: 1, name: '色_' + hex(new THREE.Color(b.c)).slice(1) });
  });
  const cm = (c) => ({ color: hex(new THREE.Color(c)), opacity: 1, name: '色_' + hex(new THREE.Color(c)).slice(1) });
  for (const r of DORM.rots) { const m = new THREE.Mesh(new THREE.BoxGeometry(r.wb, r.y1 - r.y0, r.wa)); m.position.set(r.x, (r.y0 + r.y1) / 2, r.z); m.rotation.y = r.ry; pushMesh('西南角樓梯間', r.n, m, cm(r.c)); }
  for (const pr of DORM.prisms) { const sh = new THREE.Shape(pr.pts.map((p) => new THREE.Vector2(p.x, p.z))); const g = new THREE.ExtrudeGeometry(sh, { depth: pr.y1 - pr.y0, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, pr.y1, 0); pushGeo('西南角樓梯間', pr.n, g, cm(pr.c)); }
  for (const bm of DORM.beams) { const a = new THREE.Vector3(bm.x0, bm.y0, bm.z0), b = new THREE.Vector3(bm.x1, bm.y1, bm.z1); const m = new THREE.Mesh(new THREE.BoxGeometry(bm.w, bm.h || bm.w, a.distanceTo(b))); m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); pushMesh(bm.x0 < -10.3 ? '一樓中庭' : '二樓寢室_床架', bm.x0 < -10.3 ? '中庭_欄杆扶手' : '寢室_鐵梯', m, cm(bm.c)); }
  for (const d of DORM.doors) { const ax = d.axis === 'x'; const m = new THREE.Mesh(ax ? new THREE.BoxGeometry(d.len, d.y1 - d.y0, 0.045) : new THREE.BoxGeometry(0.045, d.y1 - d.y0, d.len)); m.position.set(ax ? d.hx - d.len / 2 : d.hx, (d.y0 + d.y1) / 2, ax ? d.hz : d.hz - d.len / 2); pushMesh(d.no ? '二樓寢室_' + d.no : (d.room.startsWith('一樓') ? '一樓中庭' : '二樓浴廁區'), d.room + '_門', m, cm(0xb7a388)); }
  for (const sp of DORM.sprisms) pushGeo('西南角樓梯間', sp.n, sprismGeo(sp), cm(sp.c));
  for (const w of DORM.diag) { const L2 = Math.hypot(w.x1 - w.x0, w.z1 - w.z0); const m = new THREE.Mesh(new THREE.BoxGeometry(w.t, w.y1 - w.y0, L2)); m.position.set((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2); m.rotation.y = Math.atan2(w.x1 - w.x0, w.z1 - w.z0); pushMesh('西南角樓梯間', '樓梯間斜牆', m, { color: hex(new THREE.Color(w.c)), opacity: 1, name: '色_' + hex(new THREE.Color(w.c)).slice(1) }); }

  { const TK = {};
    DORM.tplanes.forEach((p, i) => {
      if (!TK[p.kind]) { const { canvas, m } = tileCanvas(p.kind); TK[p.kind] = { k: texKey(canvas), m }; }
      const { k, m: M } = TK[p.kind]; let W, Hh; const msh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
      if (!p.wall) { W = p.x1 - p.x0; Hh = p.z1 - p.z0; msh.rotation.x = p.down ? Math.PI / 2 : -Math.PI / 2; msh.position.set((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2); }
      else if (p.wall === 'z') { W = p.x1 - p.x0; Hh = p.y1 - p.y0; msh.rotation.y = p.nz > 0 ? 0 : Math.PI; msh.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.z); }
      else { W = p.z1 - p.z0; Hh = p.y1 - p.y0; msh.rotation.y = p.nx > 0 ? Math.PI / 2 : -Math.PI / 2; msh.position.set(p.x, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2); }
      msh.scale.set(W, Hh, 1); const name = { roomTile: '寢室地磚', bathFloor: '浴廁地磚', wallTile: '浴廁壁磚', ceilPanel: '浴廁天花板' }[p.kind];
      pushMesh(p.kind === 'roomTile' ? '二樓寢室_地磚' : '二樓浴廁區', name + '_' + (i + 1), msh, { color: '#ffffff', opacity: 1, tex: k, name }, [W / M, Hh / M]);
    }); }
  // ---- 3) 門牌、標示牌、出口標示
  const roomNo = (r) => { const m = r.match(/二樓_(\d{3})房/); return m ? Number(m[1]) : 0; };
  for (const b of raw) {
    if (!b.n.includes('門框上緣')) continue; const no = roomNo(b.n); if (!no) continue;
    const c = document.createElement('canvas'); c.width = 256; c.height = 112; const g = c.getContext('2d');
    g.fillStyle = '#d9d3c3'; g.fillRect(0, 0, 256, 112); g.fillStyle = '#26303a'; g.fillRect(8, 8, 240, 96);
    g.fillStyle = '#e8e2cf'; g.font = '700 64px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(no), 128, 60);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22)); const right = b.x0 > 0;
    m.position.set(right ? b.x0 - 0.015 : b.x1 + 0.015, b.y1 + 0.17, (b.z0 + b.z1) / 2); m.rotation.y = right ? -Math.PI / 2 : Math.PI / 2;
    pushMesh('標示與門牌', '門牌_' + no, m, { color: '#ffffff', opacity: 1, tex: texKey(c), name: '門牌_' + no });
  }
  for (const sg of DORM.signs) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 112; const g = c.getContext('2d'); g.fillStyle = '#1b2224'; g.fillRect(0, 0, 256, 112); g.strokeStyle = sg.c; g.lineWidth = 6; g.strokeRect(6, 6, 244, 100); g.fillStyle = sg.c; g.font = '900 58px "Noto Sans CJK TC", "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sg.t, 128, 58);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.48)); m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.ry;
    pushMesh('標示與門牌', '標示_' + sg.t, m, { color: '#ffffff', opacity: 1, tex: texKey(c), name: '標示_' + sg.t });
  }
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#0c1a10'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#48ff7a'; g.font = '900 54px "Noto Sans CJK TC", "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('出口 EXIT', 128, 50);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34)); m.position.set(DORM.exitSign.x, DORM.exitSign.y, DORM.exitSign.z); m.rotation.y = Math.PI;
    pushMesh('標示與門牌', '出口標示_EXIT', m, { color: '#ffffff', opacity: 1, tex: texKey(c), unlit: true, name: '出口標示' });
  }
  DORM.lights.forEach((e, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1)); m.position.set(e.x + e.nx * 0.05, e.y, e.z + e.nz * 0.05); m.rotation.y = Math.atan2(e.nx, e.nz);
    pushMesh('緊急照明燈', '緊急照明燈_' + (i + 1), m, { color: '#fff0d0', opacity: 1, unlit: true, name: '緊急照明燈' });
  });
  // ---- 4) 磨石子地坪與電視
  out.textures.terrazzo = A.terrazzo;
  DORM.terrazzo.forEach((r, i) => {
    const W = r.x1 - r.x0, Lz = r.z1 - r.z0; const m = new THREE.Mesh(new THREE.PlaneGeometry(W, Lz)); m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2);
    pushMesh('磨石子地坪', '磨石子地坪_' + (i + 1), m, { color: '#a69a8a', opacity: 1, tex: 'terrazzo', name: '磨石子' }, [W / 1.15, Lz / 1.5]);
  });
  { const o = DORM.outside; const og = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d)); og.rotation.x = -Math.PI / 2; og.position.set(o.x, -0.01, o.z); pushMesh('一樓大廳', '大門外地面', og, { color: '#15171a', opacity: 1, name: '門外地面' }); }
  { const t = DORM.tv; const scr = new THREE.Mesh(new THREE.PlaneGeometry(t.w, t.h)); scr.position.set(t.x, t.y, t.z); scr.rotation.y = t.ry; pushMesh('二樓交誼廳', '交誼廳_電視螢幕', scr, { color: '#050607', opacity: 1, name: '電視螢幕' }); }
  return JSON.stringify(out);
}
