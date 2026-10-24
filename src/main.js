// ===== MAIN (THREE r128 global) =====
(function () {
  'use strict';
  const A = window.__ASSETS;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function b64ToAB(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }

  // ---------- 資料 ----------
  $('scareImg').src = A.dead;
  const DORM = buildDorm();
  const raw = DORM.solid;
  const world = new World(raw); world.extra = DORM.extra;
  const nav = new Nav(world, DORM.spawn);
  const L = buildLayout(world, nav, DORM.spots, DORM.patrol, DORM.XS);
  const LNG = { tv: DORM.tv, remote: DORM.remote };
  const roomNo = (r) => { const m = r.match(/二樓_(\d{3})房/); return m ? Number(m[1]) : 0; };
  const roomLabel = (r) => { const n = roomNo(r); return n ? `${n} 號房` : r; };

  // ---------- 渲染器 ----------
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const DPR_MAX = Math.min(window.devicePixelRatio || 1, 1.25); let dpr = DPR_MAX; renderer.setPixelRatio(dpr);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x020203, 0.095);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 90);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();

  // ---------- 環境模型（依平面圖生成的方塊，依顏色合併）----------
  const TERRAZZO_MATS = []; // 需要磨石子貼圖的多邊形地板（貼圖載入後再套上）
  (function buildEnv() {
    const pushBox = (arr, b) => { const { x0, x1, y0, y1, z0, z1 } = b; const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]; for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]) { for (const i of [f[0], f[1], f[2], f[0], f[2], f[3]]) arr.push(...v[i]); } };
    const bg = new Map(), glass = [], frost = [];
    // 1) 同顏色、截面完全相同、首尾相接的方塊先合併成一塊（接縫直接消失，也少很多三角形）
    const boxes = [];
    for (const b of DORM.solid.concat(DORM.deco)) { if (b.n.startsWith('空氣牆') || b.n === '斜牆碰撞' || b.n.startsWith('樓梯碰撞') || b.n === '欄杆碰撞' || b.noDraw || DORM.NO_DRAW.test(b.n)) continue; boxes.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1, c: b.c, win: b.n.includes('窗戶') }); }
    const mergeAxis = (list, ax) => {
      const o = ax === 'x' ? ['y', 'z'] : ax === 'y' ? ['x', 'z'] : ['x', 'y'], r = (v) => Math.round(v * 2000);
      const groups = new Map();
      for (const b of list) { if (b.win) continue; const k = b.c + '|' + r(b[o[0] + '0']) + ',' + r(b[o[0] + '1']) + ',' + r(b[o[1] + '0']) + ',' + r(b[o[1] + '1']); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(b); }
      const out = list.filter((b) => b.win);
      for (const a of groups.values()) { a.sort((p, q) => p[ax + '0'] - q[ax + '0']); let cur = null;
        for (const b of a) { if (cur && b[ax + '0'] <= cur[ax + '1'] + 0.0006) cur[ax + '1'] = Math.max(cur[ax + '1'], b[ax + '1']); else { if (cur) out.push(cur); cur = { ...b }; } }
        if (cur) out.push(cur); }
      return out;
    };
    let merged = boxes; for (let pass = 0; pass < 2; pass++) for (const ax of ['x', 'z', 'y']) merged = mergeAxis(merged, ax);
    // 2) 往外撐開的量依「顏色」決定：同顏色的相鄰方塊表面完全對齊（不會露出一條暗縫），不同顏色疊在一起時又錯開一點點（不會閃爍）
    const gOf = (c) => 0.0005 + (((c * 2654435761) >>> 0) % 13) * 0.00035;
    for (const b of merged) {
      const g = gOf(b.c); const bb = { x0: b.x0 - g, x1: b.x1 + g, y0: b.y0 - g, y1: b.y1 + g, z0: b.z0 - g, z1: b.z1 + g };
      if (b.win) { pushBox(b.c === 0xc9ccc4 ? frost : glass, bb); continue; }
      let a = bg.get(b.c); if (!a) bg.set(b.c, a = []); pushBox(a, bb);
    }
    window.__boxStats = { before: boxes.length, after: merged.length };
    // 斜向的方塊、斜牆、斜梁、多邊形平台：全部烘成世界座標後併入同色的大網格（大幅減少 draw call）
    const bake = (geo, obj, c) => { obj.updateMatrixWorld(true); const g = (geo.index ? geo.toNonIndexed() : geo); g.applyMatrix4(obj.matrixWorld); const pa = g.getAttribute('position').array; let a = bg.get(c); if (!a) bg.set(c, a = []); for (let i = 0; i < pa.length; i++) a.push(pa[i]); };
    DORM.rots.forEach((r, i) => { const g = 0.0006 + ((i * 5) % 13) * 0.0004; const o = new THREE.Object3D(); o.position.set(r.x, (r.y0 + r.y1) / 2, r.z); o.rotation.y = r.ry; bake(new THREE.BoxGeometry(r.wb + 2 * g, r.y1 - r.y0 + 2 * g, r.wa + 2 * g), o, r.c); }); // 每塊撐開不同量，避免重疊面閃爍
    for (const bm of DORM.beams) { const a = new THREE.Vector3(bm.x0, bm.y0, bm.z0), b = new THREE.Vector3(bm.x1, bm.y1, bm.z1); const o = new THREE.Object3D(); o.position.copy(a).add(b).multiplyScalar(0.5); o.lookAt(b); bake(new THREE.BoxGeometry(bm.w, bm.h || bm.w, a.distanceTo(b)), o, bm.c); }
    for (const sp of DORM.sprisms) { const g = sprismGeo(sp); bake(g, new THREE.Object3D(), sp.c); }
    for (const w of DORM.diag) { const o = new THREE.Object3D(); o.position.set((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2); o.rotation.y = Math.atan2(w.x1 - w.x0, w.z1 - w.z0); bake(new THREE.BoxGeometry(w.t, w.y1 - w.y0, Math.hypot(w.x1 - w.x0, w.z1 - w.z0)), o, w.c); }
    for (const pr of DORM.prisms) { const sh = new THREE.Shape(pr.pts.map((p) => new THREE.Vector2(p.x, p.z))); const g = new THREE.ExtrudeGeometry(sh, { depth: pr.y1 - pr.y0, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, pr.y1, 0);
      bake(g, new THREE.Object3D(), pr.tex ? 0xcbc0aa : pr.c); // 平台本體（側面、底面）是一般的牆面
      if (pr.tex) { // 只有上表面鋪磨石子（原本整塊都貼，從樓梯底下看側面和底面也是磨石子）
        const tg = new THREE.ShapeGeometry(sh); tg.rotateX(Math.PI / 2); tg.translate(0, pr.y1 + 0.004, 0); const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, -uv.getY(i));
        const mat = new THREE.MeshPhongMaterial({ shininess: 26, specular: 0x262420, color: pr.c, side: THREE.DoubleSide }); TERRAZZO_MATS.push(mat); const m = new THREE.Mesh(tg, mat); m.receiveShadow = true; scene.add(m); } }
    { // 所有不透明的方塊合成「一個」網格，用頂點顏色區分材質顏色（只要 1 次 draw call）
      let n = 0; for (const arr of bg.values()) n += arr.length;
      const pos = new Float32Array(n), col = new Float32Array(n), wear = new Float32Array(n / 3 * 2); let o = 0; const cc = new THREE.Color();
      // 每個顏色的「陳舊程度」：x＝水泥質感強度、y＝髒污強度（白牆、天花板、水泥最髒；家具、門窗框幾乎不加）
      const CONC = new Set([0x55564f, 0x777b7d, 0x6c6d68, 0xb9b6ad, 0x2a2825, 0x1c1b19, 0x3a3936, 0x9a9287]), WALLS = new Set([0xcbc0aa, 0xdcdad3, 0xbab4ad, 0xc4bcae, 0x2c2a26, 0xe3e3dd, 0xd8d8d2, 0xcbc0aa, 0x8d908f]);
      for (const [c, arr] of bg) { cc.setHex(c); pos.set(arr, o); const wx = CONC.has(c) ? 1 : WALLS.has(c) ? 0.35 : 0, wy = 0; // 只留水泥顆粒質感（x）；髒污（y）關掉
        for (let i = 0; i < arr.length; i += 3) { col[o + i] = cc.r; col[o + i + 1] = cc.g; col[o + i + 2] = cc.b; const v = (o + i) / 3 * 2; wear[v] = wx; wear[v + 1] = wy; } o += arr.length; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('wear', new THREE.BufferAttribute(wear, 2)); geo.computeVertexNormals();
      const envMat = new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a, vertexColors: true, side: THREE.DoubleSide });
      { // 舊舊髒髒的感覺：水泥面的顆粒與裂痕、牆角往上的污垢、雨痕一樣的垂直髒線、一塊一塊的污漬（全部用世界座標算，不需要 UV）
        const mk = (S, draw) => { const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
        let sd = 99; const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
        const concT = mk(512, (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
          for (let i = 0; i < 9000; i++) { const v = 90 + rn() * 80; g.fillStyle = `rgba(${v},${v},${v},0.35)`; const r = 1 + rn() * 3; g.fillRect(rn() * S, rn() * S, r, r); }
          for (let i = 0; i < 70; i++) { const v = rn() < 0.5 ? 60 : 170, x = rn() * S, y = rn() * S, r = 20 + rn() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.25)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
          g.strokeStyle = 'rgba(30,30,30,0.6)'; for (let i = 0; i < 9; i++) { let x = rn() * S, y = rn() * S; g.lineWidth = 0.8 + rn(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (rn() - 0.5) * 40; y += rn() * 30; g.lineTo(x, y); } g.stroke(); } });
        const dirtT = mk(256, (g, S) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
          for (let i = 0; i < 90; i++) { const x = rn() * S, y = rn() * S, r = 8 + rn() * 50, a = 0.12 + rn() * 0.3; for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); } }
          for (let i = 0; i < 160; i++) { const x = rn() * S, w = 1 + rn() * 3, h = 20 + rn() * 140, y = rn() * S; g.fillStyle = `rgba(255,255,255,${0.08 + rn() * 0.18})`; g.fillRect(x, y, w, h); g.fillRect(x, y - S, w, h); } });
        envMat.onBeforeCompile = (sh) => {
          sh.uniforms.concT = { value: concT }; sh.uniforms.dirtT = { value: dirtT };
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 wear; varying vec2 vWear; varying vec3 vWP; varying vec3 vWN;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWear = wear; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D concT; uniform sampler2D dirtT; varying vec2 vWear; varying vec3 vWP; varying vec3 vWN;')
            .replace('#include <color_fragment>', `#include <color_fragment>
              vec3 an = abs(vWN); vec2 uvp = an.y > max(an.x, an.z) ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy);
              float cn = texture2D(concT, uvp / 2.6).r;
              diffuseColor.rgb *= mix(1.0, 0.55 + 0.9 * cn, vWear.x);
              float blot = texture2D(dirtT, uvp / 5.3 + 0.37).r;
              float streak = an.y < 0.5 ? smoothstep(0.25, 0.6, texture2D(dirtT, vec2(uvp.x / 4.1, vWP.y / 9.0)).r) : 0.0;
              float yb = vWP.y < 3.3 ? vWP.y : vWP.y - 3.35; if (yb < 0.0) yb = vWP.y - 3.6;
              float foot = an.y < 0.5 ? (1.0 - smoothstep(0.0, 0.55, yb)) * (0.55 + 0.45 * texture2D(dirtT, vec2(uvp.x / 2.3, 0.5)).r) : 0.0;
              diffuseColor.rgb *= 1.0 - vWear.y * clamp(0.32 * blot + 0.2 * streak + 0.3 * foot, 0.0, 0.6);
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.0, 0.96, 0.86), vWear.y * 0.5 * blot);`);
        };
      }
      const m = new THREE.Mesh(geo, envMat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
    }
    { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(glass, 3)); geo.computeVertexNormals(); scene.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ shininess: 30, specular: 0x222222, color: 0x1d3140, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }))); }
    { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(frost, 3)); geo.computeVertexNormals();
      { // 霧面壓花玻璃（照片：一朵一朵的花紋）：依世界座標貼 UV
        const p = geo.attributes.position, nn = geo.attributes.normal, uv = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) { const u = Math.abs(nn.getX(i)) > Math.abs(nn.getZ(i)) ? p.getZ(i) : p.getX(i); uv[i * 2] = u / 0.36; uv[i * 2 + 1] = p.getY(i) / 0.36; }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
      const fc = document.createElement('canvas'); fc.width = fc.height = 256; { const g = fc.getContext('2d'); g.fillStyle = '#c9ccc4'; g.fillRect(0, 0, 256, 256);
        const flower = (cx, cy, r) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, px = cx + Math.cos(a) * r * 0.55, py = cy + Math.sin(a) * r * 0.55;
            g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(px - 1.5, py - 1.5, r * 0.32, r * 0.2, a, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(90,95,90,0.28)'; g.beginPath(); g.ellipse(px + 1.5, py + 1.5, r * 0.32, r * 0.2, a, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(cx - 1, cy - 1, r * 0.18, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(80,85,80,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * 0.92, 0, Math.PI * 2); g.stroke(); };
        for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256], [128, 128]]) flower(x, y, 62);
        for (const [x, y] of [[128, 0], [0, 128], [256, 128], [128, 256]]) { g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(90,95,90,0.25)'; g.beginPath(); g.arc(x + 3, y + 3, 16, 0, Math.PI * 2); g.fill(); } }
      const ft = new THREE.CanvasTexture(fc); ft.encoding = THREE.sRGBEncoding; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.anisotropy = 4;
      scene.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: ft, shininess: 20, specular: 0x222222, color: 0xffffff, emissive: 0x15160f, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }))); }
    // 房門門牌：201–215 在走廊右手邊（由北往南）、216–230 在左手邊
    for (const b of raw) {
      if (!b.n.includes('門框上緣')) continue; const no = roomNo(b.n); if (!no) continue;
      const c = document.createElement('canvas'); c.width = 256; c.height = 112; const g = c.getContext('2d');
      g.fillStyle = '#d9d3c3'; g.fillRect(0, 0, 256, 112); g.fillStyle = '#26303a'; g.fillRect(8, 8, 240, 96);
      g.fillStyle = '#e8e2cf'; g.font = '700 64px "IBM Plex Mono", "Noto Sans TC", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(no), 128, 60);
      const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.16), new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a, map: tx }));
      const right = (b.x0 + b.x1) / 2 > DORM.XS; m.position.set(right ? b.x0 - 0.015 : b.x1 + 0.015, b.y1 + 0.13, (b.z0 + b.z1) / 2); m.rotation.y = right ? -Math.PI / 2 : Math.PI / 2; scene.add(m);
    }
    // 隔間門／浴簾（躲藏時才關上）
    for (const sp of L.usableBeds) if (sp.door) { const a = []; pushBox(a, sp.door); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); geo.computeVertexNormals(); sp.doorMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a, color: sp.door.c, side: THREE.DoubleSide })); sp.doorMesh.visible = false; scene.add(sp.doorMesh); }
    // 標示牌
    for (const sg of DORM.signs) {
      const c = document.createElement('canvas'); c.width = 256; c.height = sg.board ? 400 : (sg.paper || sg.plate) ? 72 : 112; const g = c.getContext('2d');
      if (sg.board) { g.fillStyle = '#f4f3ee'; g.fillRect(0, 0, 256, 400); g.fillStyle = '#1d3f8a'; g.font = '900 30px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText(sg.t, 128, 44); g.textAlign = 'left'; g.font = '700 20px "Noto Sans TC", sans-serif'; sg.board.forEach((l, i) => { g.fillStyle = '#1d3f8a'; g.fillText(l, 14, 92 + i * 62); g.fillStyle = sg.c; g.fillText('××××-×××××', 40, 118 + i * 62); }); }
      else if (sg.plate) { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 72); g.strokeStyle = '#999'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 68); g.fillStyle = sg.c; g.font = '900 40px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sg.t, 128, 38); } else
      if (sg.paper) { g.fillStyle = '#e9c96b'; g.fillRect(0, 0, 256, 72); g.fillStyle = sg.c; g.font = '900 48px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sg.t, 128, 38); }
      else { g.fillStyle = '#1b2224'; g.fillRect(0, 0, 256, 112); g.strokeStyle = sg.c; g.lineWidth = 6; g.strokeRect(6, 6, 244, 100); g.fillStyle = sg.c; g.font = '900 58px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sg.t, 128, 58); }
      const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(sg.w || 1.1, sg.h || 0.48), new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a, map: tx })); m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.ry; scene.add(m);
    }
    // 手寫的紙（夾在告示框裡）：每個字大小、角度、位置都有點歪，筆畫粗細不一，像麥克筆寫的
    for (const nt of DORM.notes || []) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 390; const g = c.getContext('2d');
      g.fillStyle = '#f3f1e8'; g.fillRect(0, 0, 256, 390); g.fillStyle = 'rgba(120,110,80,0.08)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 390, 30 + Math.random() * 60, 1);
      g.strokeStyle = 'rgba(150,170,200,0.35)'; g.lineWidth = 1; for (let y = 40; y < 390; y += 34) { g.beginPath(); g.moveTo(10, y); g.lineTo(246, y); g.stroke(); }
      const chars = [...nt.t], step = 330 / chars.length;
      chars.forEach((ch, i) => { g.save(); g.translate(128 + (Math.random() - 0.5) * 18, 50 + step * (i + 0.5) + (Math.random() - 0.5) * 8); g.rotate((Math.random() - 0.5) * 0.22); g.scale(1 + (Math.random() - 0.5) * 0.15, 1 + (Math.random() - 0.5) * 0.12);
        g.font = '900 104px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round';
        g.strokeStyle = '#141414'; g.lineWidth = 7; g.strokeText(ch, 0, 0); g.fillStyle = '#141414'; g.fillText(ch, 0, 0);
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 18; k++) g.fillRect((Math.random() - 0.5) * 110, (Math.random() - 0.5) * 110, 2 + Math.random() * 5, 1 + Math.random() * 2); g.restore(); });
      const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(nt.w, nt.h), new THREE.MeshPhongMaterial({ shininess: 4, map: tx })); m.position.set(nt.x, nt.y, nt.z); m.rotation.set(0, nt.ry, 0.04); scene.add(m);
    }
    // 門外地面
    const o = DORM.outside; const og = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a, color: 0x15171a }));
    og.rotation.x = -Math.PI / 2; og.position.set(o.x, -0.01, o.z); og.receiveShadow = true; scene.add(og);
  })();
  buildProps(DORM, scene); // 細緻模型（props.js）

  // ---------- 燈光 ----------
  // 只有手電筒照到的地方有光（另有敵人身上的紅光）
  // 手電筒：中央亮芯（窄）＋外圈泛光（寬、邊緣完全柔化）＋打到牆面後的反射補光，讓亮暗之間慢慢過渡
  const FLASH_I = 1.5, FLOOD_I = 0.95, BOUNCE_I = 0.32;
  const flash = new THREE.SpotLight(0xfff0d8, FLASH_I, 28, 0.3, 0.9, 1.5); scene.add(flash); scene.add(flash.target);
  const flood = new THREE.SpotLight(0xf1e4cc, FLOOD_I, 17, 0.86, 1.0, 1.8); scene.add(flood); scene.add(flood.target);
  const flashSpill = new THREE.PointLight(0xd9ccb4, 0, 7.5, 2); scene.add(flashSpill);
  const ambientFill = new THREE.HemisphereLight(0x1a2233, 0x0a0806, 0.06); scene.add(ambientFill); // 極微弱的環境光，讓暗處仍有輪廓
  const flashDir = new THREE.Vector3(0, 0, -1);
  // Ⓔ 緊急照明燈（停電時靠電池亮著；只發光、不照明）
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,210,0.9)'); gr.addColorStop(0.4, 'rgba(255,220,170,0.25)'); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  for (const e of DORM.lights) {
    const grp = new THREE.Group(); grp.position.set(e.x, e.y, e.z); grp.rotation.y = Math.atan2(e.nx, e.nz);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), new THREE.MeshPhongMaterial({ color: 0xd8d6cc, shininess: 6 })); body.position.z = 0.05; grp.add(body);
    for (const sx of [-0.13, 0.13]) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); lamp.position.set(sx, -0.11, 0.1); lamp.rotation.x = 0.5; grp.add(lamp); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })); sp.scale.set(0.9, 0.9, 1); sp.position.set(0, -0.1, 0.2); grp.add(sp);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x40ff60 })); led.position.set(0.17, 0.04, 0.105); grp.add(led);
    scene.add(grp);
  }
  // 出口標示
  (function exitSign() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#0c1a10'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#48ff7a'; g.font = '900 54px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('出口 EXIT', 128, 50);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: t })); m.position.set(DORM.exitSign.x, DORM.exitSign.y, DORM.exitSign.z); m.rotation.y = Math.PI; scene.add(m);
  })();
  // 敵人紅光
  const eSpot = new THREE.SpotLight(0xff1410, 0, 19, 0.62, 0.45, 1.25);
  eSpot.castShadow = true; eSpot.shadow.mapSize.set(768, 768); eSpot.shadow.camera.near = 0.2; eSpot.shadow.camera.far = 19; eSpot.shadow.bias = -0.0015; eSpot.shadow.normalBias = 0.03;
  scene.add(eSpot); scene.add(eSpot.target);
  renderer.shadowMap.autoUpdate = false; // 只有敵人出現時才更新陰影
  // 他身上的紅色光暈：用發光貼圖（會被牆擋住），不再用會穿牆的點光源
  const eGlow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,60,40,0.85)'); gr.addColorStop(0.35, 'rgba(200,20,10,0.35)'); gr.addColorStop(1, 'rgba(120,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    sp.scale.set(2.6, 2.6, 1); scene.add(sp); return { sprite: sp, set intensity(v) { sp.material.opacity = Math.min(1, v / 1.6); sp.visible = v > 0.01; }, get intensity() { return sp.material.opacity * 1.6; }, position: sp.position };
  })();

  // ---------- 貼圖 / Billboard ----------
  const texLoader = new THREE.TextureLoader();
  const loadTex = (src) => new Promise((res) => texLoader.load(src, (t) => { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; res(t); }));
  // 走廊磨石子地板
  texLoader.load(A.terrazzo, (t0) => {
    { // 照片裡的磨石子地是一塊一塊約 1 m 見方的格子：每格顏色差一點點，格子之間有深色分隔線（貼圖 3.07 m 一循環，剛好 3×3 格）
      const im = t0.image, S = im.width, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const n = 3, w = S / n, tint = [0.05, -0.04, 0.01, -0.06, 0.03, -0.02, 0.06, -0.01, -0.05];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = tint[i * n + j]; g.fillStyle = v > 0 ? `rgba(255,250,240,${v})` : `rgba(20,18,15,${-v})`; g.fillRect(i * w, j * w, w, w); }
      g.fillStyle = 'rgba(28,26,24,0.85)'; for (let i = 0; i < n; i++) { g.fillRect(i * w - 1.5, 0, 3, S); g.fillRect(0, i * w - 1.5, S, 3); }
      g.fillRect(S - 1.5, 0, 1.5, S); g.fillRect(0, S - 1.5, S, 1.5);
      t0.image = c;
    }
    for (const mat of TERRAZZO_MATS) { const t = t0.clone(); t.needsUpdate = true; t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(1 / 3.07, 1 / 3.07); mat.map = t; mat.needsUpdate = true; }
    const pos = [], uv = [], t = t0.clone(); t.needsUpdate = true; t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    for (const r of DORM.terrazzo) { // 全部合成一個網格
      const { x0, x1, z0, z1, y } = r; for (const [x, z] of [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]]) { pos.push(x, y, z); uv.push(x / 3.07, -z / 3.07); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ shininess: 26, specular: 0x262420, map: t, color: 0xa69a8a })); m.receiveShadow = true; scene.add(m);
  });
  // 磁磚貼圖面（寢室地磚、浴廁地磚、白色壁磚、天花板）
  { const groups = {};
    for (const p of DORM.tplanes) {
      const G = groups[p.kind] || (groups[p.kind] = { pos: [], uv: [], M: tileCanvas(p.kind).m });
      let W, Hh; const o = new THREE.Object3D();
      if (!p.wall) { W = p.x1 - p.x0; Hh = p.z1 - p.z0; o.rotation.x = p.down ? Math.PI / 2 : -Math.PI / 2; o.position.set((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2); }
      else if (p.wall === 'z') { W = p.x1 - p.x0; Hh = p.y1 - p.y0; o.rotation.y = p.nz > 0 ? 0 : Math.PI; o.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.z); }
      else { W = p.z1 - p.z0; Hh = p.y1 - p.y0; o.rotation.y = p.nx > 0 ? Math.PI / 2 : -Math.PI / 2; o.position.set(p.x, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2); }
      o.updateMatrixWorld(true); const g = new THREE.PlaneGeometry(W, Hh).toNonIndexed(); g.applyMatrix4(o.matrixWorld);
      const pa = g.getAttribute('position').array, ua = g.getAttribute('uv').array; for (let i = 0; i < pa.length; i++) G.pos.push(pa[i]); for (let i = 0; i < ua.length; i += 2) G.uv.push(ua[i] * W / G.M, ua[i + 1] * Hh / G.M);
    }
    for (const kind in groups) { const G = groups[kind]; const t = new THREE.CanvasTexture(tileCanvas(kind).canvas); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: t, shininess: kind === 'roomTile' ? 18 : 40, specular: 0x222222 })); m.receiveShadow = true; scene.add(m); }
  }
  // 空氣牆外的霧（半透明黑幕，越遠越暗）
  { const mat = (o) => new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const f of DORM.fogs) { const m = new THREE.Mesh(new THREE.PlaneGeometry(f.z1 - f.z0, f.y1 - f.y0), mat(f.o)); m.rotation.y = Math.PI / 2; m.position.set(f.x, (f.y0 + f.y1) / 2, (f.z0 + f.z1) / 2); m.renderOrder = 2; scene.add(m); } }
  // 寢室門：預設關著，按 F 開關；他經過時會自己推開
  const DOORS = DORM.doors.map((d) => {
    d.base = d.axis === 'x' ? Math.PI / 2 : 0; const piv = new THREE.Group(); piv.position.set(d.hx, d.y0, d.hz); piv.rotation.y = d.base;
    const h = d.y1 - d.y0, mat = d.iron ? new THREE.MeshPhongMaterial({ shininess: 70, specular: 0x555555, color: 0xe9e9e4 }) : new THREE.MeshPhongMaterial({ shininess: 10, specular: 0x111111, color: 0xb7a388 }); // 224 是白色鐵門
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.045, h, d.len), mat); leaf.position.set(0, h / 2, -d.len / 2); leaf.castShadow = leaf.receiveShadow = true; piv.add(leaf);
    if (d.iron) { // 鐵門的壓紋：上下兩塊凸起的方框、門下緣的踢板
      const pm = new THREE.MeshPhongMaterial({ shininess: 70, specular: 0x555555, color: 0xdedfd9 });
      for (const [y0, y1] of [[0.18, 0.9], [1.15, h - 0.18]]) for (const sx of [-1, 1]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.012, y1 - y0, d.len - 0.24), pm); pnl.position.set(sx * 0.028, (y0 + y1) / 2, -d.len / 2); piv.add(pnl); }
      for (const sx of [-1, 1]) { const kp = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.12, d.len - 0.04), new THREE.MeshPhongMaterial({ color: 0x9a9c9a, shininess: 80, specular: 0x777777 })); kp.position.set(sx * 0.026, 0.07, -d.len / 2); piv.add(kp); }
    }
    for (const sx of [-1, 1]) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.12), new THREE.MeshPhongMaterial({ color: 0xb8b8b0, shininess: 60, specular: 0x666666 })); hd.position.set(sx * 0.045, 0.98, -d.len + 0.12); piv.add(hd); }
    scene.add(piv);
    const box = d.axis === 'x' ? { n: 'roomdoor', x0: d.hx - d.len, x1: d.hx, z0: d.hz - 0.05, z1: d.hz + 0.05, y0: d.y0, y1: d.y1, on: true, sight: true } : { n: 'roomdoor', x0: d.hx - 0.05, x1: d.hx + 0.05, z0: d.hz - d.len, z1: d.hz, y0: d.y0, y1: d.y1, on: true, sight: true };
    world.dyn.push(box);
    return Object.assign(d, { piv, box, open: false, ang: 0 });
  });
  // 大門：兩扇玻璃門，喝下乳清後才會打開（往外推開）
  const MAIN = { open: false, ang: 0, leaves: [] };
  { const D = DORM.DOOR, half = (D.x1 - D.x0) / 2, h = 2.45, zc = D.z + 0.075;
    for (const dir of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(dir > 0 ? D.x0 : D.x1, 0, zc);
      const frameM = new THREE.MeshPhongMaterial({ color: 0xa8aaa8, shininess: 50, specular: 0x555555 });
      const glassM = new THREE.MeshPhongMaterial({ color: 0x1d3140, transparent: true, opacity: 0.35, shininess: 60, specular: 0x444444, depthWrite: false });
      const g = new THREE.Mesh(new THREE.BoxGeometry(half - 0.12, h - 0.2, 0.02), glassM); g.position.set(dir * half / 2, h / 2, 0); piv.add(g);
      for (const [w, hh, x, y] of [[0.06, h, dir * 0.03, h / 2], [0.06, h, dir * (half - 0.03), h / 2], [half, 0.07, dir * half / 2, 0.035], [half, 0.07, dir * half / 2, h - 0.035], [half, 0.05, dir * half / 2, 1.0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.05), frameM); f.position.set(x, y, 0); piv.add(f); }
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.08), frameM); hd.position.set(dir * (half - 0.15), 1.05, 0); piv.add(hd);
      scene.add(piv); MAIN.leaves.push({ piv, dir });
    } }
  function setDoor(d, open, byPlayer) {
    if (d.open === open) return;
    if (!open && P.x > d.box.x0 - 0.35 && P.x < d.box.x1 + 0.35 && P.z > d.box.z0 - 0.1 && P.z < d.box.z1 + 0.1 && Math.abs(P.y - d.y0) < 1) return; // 人站在門口時關不上
    d.open = open; if (open) d.box.on = false;
    try { SFX.door(open, d.cx, d.y0 + 1, d.cz); } catch (e) { }
    if (byPlayer && G.phase === 'chase' && enemy.active && Math.hypot(enemy.x - d.cx, enemy.z - d.cz) < 11 && Math.abs(enemy.y - d.y0) < 1.5) enemy.hear(d.cx, d.y0, d.cz);
  }
  function updateDoors(dt) {
    { const t = MAIN.open ? 1 : 0, da = t - MAIN.ang; if (Math.abs(da) > 1e-4) { MAIN.ang += Math.sign(da) * Math.min(Math.abs(da), dt * 1.4); for (const l of MAIN.leaves) l.piv.rotation.y = -l.dir * Math.PI / 2 * 0.85 * MAIN.ang; } }
    for (const d of DOORS) {
      if (!d.open && enemy.active && enemy.stun <= 0 && Math.abs(enemy.y - d.y0) < 1 && Math.hypot(enemy.x - d.cx, enemy.z - d.cz) < 1.35) setDoor(d, true, false);
      const target = d.open ? d.openAng : 0; const da = target - d.ang;
      if (Math.abs(da) > 1e-4) { d.ang += Math.sign(da) * Math.min(Math.abs(da), dt * 3.2); d.piv.rotation.y = d.base + d.ang; }
      if (!d.open && Math.abs(d.ang) < 0.05) d.box.on = true;
    }
  }
  function billboard(tex, h, emissive) {
    const w = h * tex.image.width / tex.image.height; const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
    const m = new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a,  map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveMap = tex; }
    const mesh = new THREE.Mesh(g, m); mesh.userData.w = w; scene.add(mesh); return mesh;
  }
  let npcMesh, enemyMesh, wheyMesh, potMesh, stunMesh, houMesh, panMesh; const TEX = {}, BAGS = [];
  const HOU = DORM.hou;
  // 電視：螢幕（自發光）、雜訊畫面、照到交誼廳的螢幕光
  const TV = { on: 0, mesh: null, light: null, tex: [], noise: null, staticT: 0, remoteMesh: null, remoteInWorld: true };
  {
    const t = LNG.tv; const scr = new THREE.Mesh(new THREE.PlaneGeometry(t.w, t.h), new THREE.MeshBasicMaterial({ color: 0x050607 }));
    scr.position.set(t.x, t.y, t.z); scr.rotation.y = t.ry; scene.add(scr); TV.mesh = scr;
    const nc = document.createElement('canvas'); nc.width = 160; nc.height = 90; TV.noiseCanvas = nc; TV.noise = new THREE.CanvasTexture(nc);
    TV.light = new THREE.SpotLight(0x9fb4d8, 0, 10, 1.15, 1, 2); TV.light.position.set(t.x + t.nx * 0.15, t.y, t.z + t.nz * 0.15); TV.light.target.position.set(t.x + t.nx * 7, 3.6, t.z + t.nz * 7); scene.add(TV.light); scene.add(TV.light.target);
  }
  const ready = Promise.all([loadTex(A.p1), loadTex(A.p2), loadTex(A.whey), loadTex(A.pot), loadTex(A.tv1), loadTex(A.tv2), loadTex(A.tv3), loadTex(A.tv4), loadTex(A.remote), loadTex(A.hou), loadTex(A.bags2), loadTex(A.bag1), loadTex(A.card)]).then(([t1, t2, tw, tp, v1, v2, v3, v4, rm, th, tb2, tb1, tc]) => {
    TV.tex = [v1, v2, v3, v4]; TEX.whey = tw; TEX.pot = tp; TEX.remote = rm; TEX.card = tc;
    // 208 號房：受傷的侯宸宇（躺在靠窗左側地上）、乳清旁的垃圾袋
    houMesh = billboard(th, 0.56, 0x0d0d0d); houMesh.position.set(HOU.x, HOU.y, HOU.z);
    for (const [ti, x, z, h] of DORM.bags) { const tx = ti ? tb1 : tb2; const m = billboard(tx, h, 0x050505); m.position.set(x, DORM.F + 0.01, z); BAGS.push(m); world.dyn.push({ n: 'bag', x0: x - 0.22, x1: x + 0.22, z0: z - 0.22, z1: z + 0.22, y0: 3.35, y1: 3.35 + h * 0.85 }); }
    { const r = LNG.remote; const w = 0.06, h = w * rm.image.height / rm.image.width; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a,  map: rm, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0x111111, emissiveMap: rm }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = 0.5; m.position.set(r.x, r.y + 0.018, r.z); scene.add(m); TV.remoteMesh = m; }
    npcMesh = billboard(t1, 1.78, 0x0b0b0b);
    enemyMesh = billboard(t2, 1.9, 0x5a0d0b); enemyMesh.visible = false;
    wheyMesh = billboard(tw, 0.3, 0x15110a);
    potMesh = billboard(tp, 0.26, 0x0e0e0e);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = '900 40px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd25a'; g.fillText('✶ 暈 眩 ✶', 128, 46);
    const st = new THREE.CanvasTexture(c); stunMesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, depthTest: false, transparent: true })); stunMesh.scale.set(0.9, 0.22, 1); stunMesh.visible = false; scene.add(stunMesh);
  });

  // ---------- 音效（全部即時合成）----------
  const AU = { ctx: null };
  function noiseBuf(C, sec) { const b = C.createBuffer(1, C.sampleRate * sec, C.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function impulse(C, sec, decay) { const len = C.sampleRate * sec; const b = C.createBuffer(2, len, C.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  function distCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  function audioInit() {
    if (AU.ctx) { AU.ctx.resume(); return; }
    const C = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = C;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(C.destination);
    AU.master = C.createGain(); AU.master.gain.value = 0.9; AU.master.connect(comp);
    AU.rev = C.createConvolver(); AU.rev.buffer = impulse(C, 3.4, 2.6); AU.revOut = C.createGain(); AU.revOut.gain.value = 0.78; AU.rev.connect(AU.revOut); AU.revOut.connect(AU.master);
    for (const k of ['amb', 'horror', 'chase', 'hb', 'sfx']) { AU[k] = C.createGain(); AU[k].connect(AU.master); }
    AU.horror.gain.value = 0; AU.chase.gain.value = 0; AU.hb.gain.value = 0;
    AU.noise = noiseBuf(C, 2);
    AU.voice = {}; for (const k of ['roar1', 'roar2', 'c_huan', 'c_bie', 'c_zhan', 'c_ah', 'c_ruqing', 'bgm_chase', 'chase_loop', 'breath', 'step_soft', 'step_hard', 'step_heavy']) { try { C.decodeAudioData(b64ToAB(A[k]), (buf) => { AU.voice[k] = buf; }, () => { }); } catch (e) { } }
    // 環境低鳴
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; const ag = C.createGain(); ag.gain.value = 0.07; lp.connect(ag); ag.connect(AU.amb);
    for (const f of [41.2, 41.75, 61.9]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    const wn = C.createBufferSource(); wn.buffer = AU.noise; wn.loop = true; const wb = C.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 340; wb.Q.value = 0.6; const wg = C.createGain(); wg.gain.value = 0.022; wn.connect(wb); wb.connect(wg); wg.connect(AU.amb); wn.start();
    const lfo = C.createOscillator(); lfo.frequency.value = 0.07; const lg = C.createGain(); lg.gain.value = 0.014; lfo.connect(lg); lg.connect(wg.gain); lfo.start();
    // 恐怖音樂層
    const hl = C.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 520; hl.Q.value = 3; const hlfo = C.createOscillator(); hlfo.frequency.value = 0.09; const hlg = C.createGain(); hlg.gain.value = 260; hlfo.connect(hlg); hlg.connect(hl.frequency); hlfo.start();
    const trem = C.createGain(); trem.gain.value = 0.7; const tl = C.createOscillator(); tl.frequency.value = 5.3; const tlg = C.createGain(); tlg.gain.value = 0.3; tl.connect(tlg); tlg.connect(trem.gain); tl.start();
    hl.connect(trem); trem.connect(AU.horror);
    for (const f of [55, 58.27, 77.78, 103.83, 155.6]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rand(-9, 9); const g = C.createGain(); g.gain.value = 0.11; o.connect(g); g.connect(hl); o.start(); }
    const hi = C.createOscillator(); hi.frequency.value = 1244.5; const vib = C.createOscillator(); vib.frequency.value = 6.1; const vg = C.createGain(); vg.gain.value = 9; vib.connect(vg); vg.connect(hi.frequency); vib.start(); const hg = C.createGain(); hg.gain.value = 0.018; hi.connect(hg); hg.connect(AU.horror); hg.connect(AU.rev); hi.start();
    // 追逐弦樂刮音
    for (const f of [466.2, 493.9, 698.5]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 4; const g = C.createGain(); g.gain.value = 0.05; const m = C.createOscillator(); m.frequency.value = rand(7, 11); const mg = C.createGain(); mg.gain.value = 0.04; m.connect(mg); mg.connect(g.gain); m.start(); o.connect(bp); bp.connect(g); g.connect(AU.chase); o.start(); }
    AU.nextBeat = C.currentTime; AU.beatN = 0; AU.nextHB = C.currentTime; AU.nextAmbient = C.currentTime + rand(6, 12);
    setInterval(scheduler, 30);
  }
  function out(dest, x, y, z, revAmt) { // 回傳輸入節點（可選 3D 定位）
    const C = AU.ctx; const g = C.createGain();
    if (x !== undefined) {
      const p = C.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.6; p.rolloffFactor = 1.25; p.maxDistance = 60;
      if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
      g.connect(p); p.connect(dest || AU.sfx);
    } else g.connect(dest || AU.sfx);
    if (revAmt) { const r = C.createGain(); r.gain.value = revAmt; g.connect(r); r.connect(AU.rev); }
    return g;
  }
  // 腳步聲錄音：每個檔是 8 個腳步排在一起（每格 SLOT 秒、開頭 0.05 秒留白），隨機挑一格播
  const STEP_SLOT = { step_soft: 0.47, step_hard: 0.35, step_heavy: 0.65 };
  function playStep(key, dest, gain, rate, lowpass, pan = 0) {
    const C = AU.ctx, buf = AU.voice && AU.voice[key]; if (!C || !buf) return false;
    const L = STEP_SLOT[key], n = Math.max(1, Math.floor(buf.duration / L + 0.01)), k = (Math.random() * n) | 0;
    const s = C.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; const g = C.createGain(); g.gain.value = gain;
    let node = s; if (lowpass) { const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; s.connect(f); node = f; }
    node.connect(g); if (pan && C.createStereoPanner) { const sp = C.createStereoPanner(); sp.pan.value = pan; g.connect(sp); sp.connect(dest); } else g.connect(dest); s.start(C.currentTime, k * L + 0.03, L - 0.03); return true;
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noiseHit(dest, t, type, f, q, peak, a, d) { const C = AU.ctx; const s = C.createBufferSource(); s.buffer = AU.noise; const b = C.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = C.createGain(); env(g, t, a, peak, d); s.connect(b); b.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + a + d + 0.05); return b; }
  function tone(dest, t, type, f0, f1, peak, a, d) { const C = AU.ctx; const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d); const g = C.createGain(); env(g, t, a, peak, d); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + 0.05); return o; }
  const SFX = {
    step(run, stair, inRoom, land, foot = 0, amp = 1) {
      if (!AU.ctx) return; const C = AU.ctx, t = C.currentTime; const tile = P.z < DORM.bathZ && P.y > 3;
      { // 真實錄音的腳步聲（使用者提供）：浴廁磁磚 → 硬底清脆的；寢室 → 悶一點；晒衣場草地 → 很悶很小聲；其他（磨石子走廊、大廳、樓梯）→ 一般室內腳步；跳下落地 → 重的
        const yard = P.y < 1 && P.z < -0.8 && P.x > -24.5, set = land ? 'step_heavy' : tile ? 'step_hard' : 'step_soft';
        const d = out(AU.sfx, undefined, 0, 0, tile ? 0.5 : inRoom ? 0.25 : yard ? 0.05 : 0.2);
        const g = (land ? 0.7 : run ? 0.5 : 0.32) * rand(0.85, 1.1) * (yard ? 0.55 : 1);
        if (playStep(set, d, g * (0.55 + 0.45 * Math.min(1, amp)), (run ? 1.1 : 0.97) * rand(0.95, 1.05), yard ? 700 : inRoom ? 3200 : 0, foot * (run ? 0.1 : 0.16))) { // 左右腳輪流稍微偏左偏右（跟鏡頭左右晃同步）；起步、停下時比較輕
          if (run && !yard) noiseHit(d, t + 0.06, 'bandpass', rand(1800, 2600), 0.9, g * 0.06, 0.004, 0.05); // 跑步時腳尖蹬地的擦聲
          if (stair) tone(d, t, 'triangle', rand(160, 190), 120, g * 0.12, 0.003, 0.1); // 樓梯的空心感
          if (yard) noiseHit(d, t + 0.01, 'bandpass', rand(2500, 3500), 0.8, g * 0.08, 0.01, 0.08); // 踩草的沙沙聲
          return;
        }
      }
      const d = out(AU.sfx, undefined, 0, 0, tile ? 0.5 : inRoom ? 0.3 : 0.18);
      const g = (run ? 0.34 : 0.2) * rand(0.85, 1.12) * (land ? 1.4 : 1);
      tone(d, t, 'sine', rand(82, 98), 48, g, 0.004, run ? 0.08 : 0.1);                                // 鞋跟落地的悶響
      noiseHit(d, t, 'lowpass', rand(700, 1000), 0.7, g * 0.55, 0.002, 0.04);                           // 鞋底接觸
      noiseHit(d, t + (run ? 0.045 : rand(0.07, 0.1)), 'bandpass', rand(1300, 2000), 0.9, g * 0.22, 0.006, run ? 0.04 : 0.06); // 腳尖離地的摩擦
      if (stair) tone(d, t, 'triangle', rand(160, 190), 120, g * 0.35, 0.003, 0.12);                     // 樓梯的空心感
      if (tile) noiseHit(d, t, 'highpass', 3500, 0.7, g * 0.22, 0.001, 0.025);                           // 磁磚地的清脆聲
      if (!run && Math.random() < 0.06) tone(d, t + 0.05, 'sine', rand(2600, 3200), rand(3300, 3800), 0.012, 0.01, 0.05); // 偶爾的球鞋摩擦聲
    },
    zhuStep(x, y, z) { // 竹竿穿拖鞋跑步：啪噠啪噠
      if (!AU.ctx) return; const t = AU.ctx.currentTime, d = out(AU.sfx, x, y + 0.1, z, 0.35);
      noiseHit(d, t, 'bandpass', rand(1500, 2300), 1.1, 0.5, 0.001, 0.035); noiseHit(d, t + 0.05, 'highpass', 2600, 0.8, 0.22, 0.001, 0.03); tone(d, t, 'sine', rand(95, 120), 60, 0.25, 0.003, 0.06);
    },
    enemyStep(x, y, z, heavy) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, x, y + 0.2, z, 0.3); if (playStep('step_heavy', d, heavy ? 1.1 : 0.85, rand(0.86, 0.94), 0)) { tone(d, t, 'sine', heavy ? 70 : 62, 40, 0.35, 0.005, 0.18); return; } tone(d, t, 'sine', heavy ? 82 : 70, 40, 0.9, 0.005, 0.22); noiseHit(d, t, 'lowpass', 500, 1, 0.45, 0.003, 0.1); },
    gulp() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx); for (let i = 0; i < 3; i++) { const tt = t + i * 0.45; tone(d, tt, 'sine', 210, 95, 0.16, 0.02, 0.18); noiseHit(d, tt + 0.05, 'bandpass', 650, 5, 0.05, 0.02, 0.1); } tone(d, t + 1.5, 'sine', 300, 240, 0.05, 0.03, 0.3); },
    // 扭曲男聲怒吼：聲門脈衝（鋸齒波＋低八度次諧波）→ 共振峰濾波（逐字切換母音）→ 失真 → 樓下的悶響與回音
    // 喊話：真人錄音拼成的吼叫。直達聲＋早期反射都放在他的位置（不是廣播），
    // 不同樓層時透過樓板只剩低頻、帶樓梯間回音，聽起來像從樓下遠遠傳來
    shout(x, y, z, power, key) {
      const buf = AU.voice && AU.voice[key || (power ? 'roar2' : 'roar1')]; if (!AU.ctx || !buf) return false;
      const C = AU.ctx, t = C.currentTime + 0.05;
      const dist = Math.hypot(x - P.x, (y - P.y) * 1.4, z - P.z), otherFloor = Math.abs(y - P.y) > 1.5;
      const src = C.createBufferSource(); src.buffer = buf; src.playbackRate.value = power ? 1.0 : 0.98;
      const g = C.createGain(); g.gain.value = key ? 1.7 : power ? 2.2 : 2.0; src.connect(g); if (key) src.playbackRate.value = rand(0.95, 1.04);
      const muff = C.createBiquadFilter(); muff.type = 'lowpass'; muff.frequency.value = otherFloor ? 2100 : clamp(7000 - dist * 160, 2600, 7000); muff.Q.value = 0.5; g.connect(muff);
      const body = C.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = otherFloor ? 4 : 1; muff.connect(body);
      const pan = (gain) => { const p = C.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3.5; p.rolloffFactor = 0.9; p.maxDistance = 80; if (p.positionX) { p.positionX.value = x; p.positionY.value = y + 1.6; p.positionZ.value = z; } else p.setPosition(x, y + 1.6, z); const gg = C.createGain(); gg.gain.value = gain; gg.connect(p); p.connect(AU.sfx); return gg; };
      body.connect(pan(1));
      // 早期反射（牆面、樓梯間）：同樣從他的方向來
      for (const [dt, gv] of [[0.09, 0.42], [0.17, 0.3], [0.29, 0.22], [0.46, 0.15], [0.68, 0.09]]) { const d = C.createDelay(1); d.delayTime.value = dt + (otherFloor ? 0.04 : 0); const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; body.connect(d); d.connect(lp); lp.connect(pan(gv)); }
      // 空間殘響（距離越遠比例越高）
      const rv = C.createGain(); rv.gain.value = clamp(0.45 + dist / 40, 0.5, 0.95); body.connect(rv); rv.connect(AU.rev);
      src.start(t); AU.shoutEnd = t + buf.duration / src.playbackRate.value;
      return true;
    },
    roar(x, y, z, power) {
      if (!AU.ctx) return;
      if (SFX.shout(x, y, z, power)) return; const C = AU.ctx; let t = C.currentTime + 0.08;
      const LINES = [
        // [子音, 母音(可滑音), 長度, 音高倍率, 重音]
        [['j', 'iu', .2, 1.0, .9], ['g', 'e', .17, 1.05, .8], ['n', 'i', .16, 1.1, .8], ['sh', 'uo', .42, 1.28, 1], null,
         ['b', 'u', .16, 1.0, .9], ['zh', 'un', .19, 1.08, 1], ['t', 'ou', .2, 1.12, 1], ['h', 'e', .19, 1.1, .9], ['w', 'o', .18, 1.05, .85], ['d', 'e', .12, 1.0, .7], ['r', 'u', .2, 1.1, .9], ['q', 'ing', 1.15, 1.42, 1.2]],
        [['n', 'i', .17, 1.05, .9], ['h', 'ai', .22, 1.12, 1], ['g', 'a', .26, 1.2, 1], ['h', 'e', .2, 1.15, 1], ['d', 'i', .16, 1.1, .9], ['', 'er', .24, 1.18, 1], ['k', 'ou', 1.25, 1.5, 1.25]],
      ];
      const VW = { a: [760, 1150, 2500], o: [560, 880, 2450], e: [520, 1250, 2450], i: [300, 2150, 2950], u: [330, 760, 2300], er: [500, 1350, 1700], ai: ['a', 'i'], ou: ['o', 'u'], uo: ['u', 'o'], iu: ['i', 'u'], ing: ['i', 'i'], un: ['u', 'e'] };
      const line = LINES[power ? 1 : 0]; const f0 = power ? 128 : 116; // 男聲基頻
      let total = 0.15; for (const sy of line) total += sy ? sy[2] + 0.03 : 0.28;
      // 聲源
      const glot = C.createOscillator(); glot.type = 'sawtooth';
      const sub = C.createOscillator(); sub.type = 'sawtooth';
      const subG = C.createGain(); subG.gain.value = 0.75; sub.connect(subG);
      const src = C.createGain(); glot.connect(src); subG.connect(src);
      // 嗓音粗糙度：抖動＋顫動
      const jit = C.createBufferSource(); jit.buffer = AU.noise; jit.loop = true; const jl = C.createBiquadFilter(); jl.type = 'lowpass'; jl.frequency.value = 28; const jg = C.createGain(); jg.gain.value = f0 * 0.09; jit.connect(jl); jl.connect(jg); jg.connect(glot.frequency); const jg2 = C.createGain(); jg2.gain.value = f0 * 0.045; jl.connect(jg2); jg2.connect(sub.frequency);
      const rough = C.createOscillator(); rough.frequency.value = 41; const rg = C.createGain(); rg.gain.value = 0.38; rough.connect(rg); const am = C.createGain(); am.gain.value = 0.62; rg.connect(am.gain); src.connect(am);
      const breath = C.createBufferSource(); breath.buffer = AU.noise; breath.loop = true; const bg = C.createGain(); bg.gain.value = 0.22; breath.connect(bg);
      // 共振峰
      const formants = [0, 1, 2].map((k) => { const f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [6, 9, 11][k]; const g = C.createGain(); g.gain.value = [1.0, 0.55, 0.3][k]; am.connect(f); bg.connect(f); f.connect(g); return { f, g }; });
      const vox = C.createGain(); vox.gain.value = 0; for (const F of formants) F.g.connect(vox);
      // 子音噪音通道
      const cons = C.createGain(); cons.gain.value = 0; const cs = C.createBufferSource(); cs.buffer = AU.noise; cs.loop = true; const cf = C.createBiquadFilter(); cf.type = 'bandpass'; cf.Q.value = 1.4; cs.connect(cf); cf.connect(cons);
      // 失真與成形
      const pre = C.createGain(); pre.gain.value = 3.2; vox.connect(pre); cons.connect(pre);
      const ws = C.createWaveShaper(); ws.curve = distCurve(power ? 14 : 10); ws.oversample = '2x'; pre.connect(ws);
      const tilt = C.createBiquadFilter(); tilt.type = 'lowpass'; tilt.frequency.value = 3600; ws.connect(tilt);
      const low = C.createBiquadFilter(); low.type = 'peaking'; low.frequency.value = 160; low.gain.value = 6; tilt.connect(low);
      // 若他在樓下而你在樓上：聲音透過樓板變悶
      const below = P.y - y > 1.5; const muff = C.createBiquadFilter(); muff.type = 'lowpass'; muff.frequency.value = below ? 1500 : 6000; low.connect(muff);
      const outG = C.createGain(); outG.gain.value = power ? 0.62 : 0.55; muff.connect(outG);
      const dest = out(AU.sfx, x, y + 1.6, z, below ? 1.0 : 0.6); outG.connect(dest);
      // 樓梯間回音
      const dl = C.createDelay(1.5); dl.delayTime.value = 0.27; const fb = C.createGain(); fb.gain.value = 0.42; const dlp = C.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1300; outG.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); const eo = C.createGain(); eo.gain.value = 0.38; dlp.connect(eo); eo.connect(AU.sfx); eo.connect(AU.rev);
      // 逐字排程
      const setF = (v, tt, tc) => { const fq = VW[v]; formants.forEach((F, k) => F.f.frequency.setTargetAtTime(fq[k], tt, tc)); };
      const pitchAt = (v, tt, tc) => { glot.frequency.setTargetAtTime(v, tt, tc); sub.frequency.setTargetAtTime(v / 2, tt, tc); };
      glot.frequency.setValueAtTime(f0, t); sub.frequency.setValueAtTime(f0 / 2, t); setF('a', t, 0.01);
      for (const sy of line) {
        if (!sy) { vox.gain.setTargetAtTime(0.0001, t, 0.03); t += 0.28; continue; }
        const [c, v, dur, pm, st] = sy; const glide = typeof VW[v][0] === 'string'; const v1 = glide ? VW[v][0] : v, v2 = glide ? VW[v][1] : v;
        let ct = 0;
        if (/^(j|q|x|zh|sh|ch|h|s)$/.test(c)) { ct = c === 'h' ? 0.06 : 0.08; cf.frequency.setValueAtTime(c === 'h' ? 1300 : c === 'sh' || c === 'zh' ? 2900 : 4200, t); cons.gain.setValueAtTime(0, t); cons.gain.linearRampToValueAtTime(0.5 * st, t + ct * 0.6); cons.gain.linearRampToValueAtTime(0, t + ct + 0.02); vox.gain.setTargetAtTime(0.0001, t, 0.01); }
        else if (/^(b|d|g|t|k|p)$/.test(c)) { ct = 0.035; vox.gain.setTargetAtTime(0.0001, t, 0.006); cf.frequency.setValueAtTime(/[tk]/.test(c) ? 3000 : 1600, t + ct - 0.012); cons.gain.setValueAtTime(0.55 * st, t + ct - 0.012); cons.gain.linearRampToValueAtTime(0, t + ct + 0.02); }
        else if (c) { ct = 0.05; setF('u', t, 0.01); vox.gain.setTargetAtTime(0.35 * st, t, 0.015); }
        const vt = t + ct; const hp = f0 * pm;
        setF(v1, vt, 0.018); vox.gain.setTargetAtTime(0.9 * st, vt, 0.02);
        pitchAt(hp * 0.9, t, 0.01); pitchAt(hp * 1.08, vt + 0.02, dur * 0.18);
        if (v2 !== v1) setF(v2, vt + dur * 0.5, dur * 0.18);
        if (dur > 0.8) { pitchAt(hp * 1.22, vt + 0.1, 0.12); pitchAt(hp * 0.72, vt + dur * 0.55, dur * 0.3); vox.gain.setTargetAtTime(1.05 * st, vt + 0.1, 0.1); vox.gain.setTargetAtTime(0.0001, vt + dur * 0.8, dur * 0.12); }
        else pitchAt(hp * 0.88, vt + dur * 0.6, dur * 0.25);
        t = vt + dur + 0.03;
      }
      vox.gain.setTargetAtTime(0.0001, t, 0.06);
      const end = t + 0.6;
      for (const n of [glot, sub, jit, rough, breath, cs]) { n.start(C.currentTime + 0.05); n.stop(end); }
      // 底層低吼（讓聲音更像野獸化的男人）
      const gr = C.createOscillator(); gr.type = 'sawtooth'; gr.frequency.value = 52; const grf = C.createBiquadFilter(); grf.type = 'lowpass'; grf.frequency.value = 260; const grg = C.createGain(); grg.gain.setValueAtTime(0.0001, C.currentTime); grg.gain.linearRampToValueAtTime(0.18, C.currentTime + 0.3); grg.gain.setValueAtTime(0.18, t - 0.4); grg.gain.linearRampToValueAtTime(0.0001, t + 0.3); gr.connect(grf); grf.connect(grg); grg.connect(pre); gr.start(); gr.stop(end);
    },
    sting() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, undefined, 0, 0, 0.6); for (const f of [622, 659, 932, 988]) tone(d, t, 'sawtooth', f, f * 0.97, 0.09, 0.01, 1.1); tone(d, t, 'sine', 70, 35, 0.8, 0.01, 0.6); },
    transform() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, undefined, 0, 0, 0.6); for (const f of [49, 51.9, 73.4, 77.8]) tone(d, t, 'sawtooth', f, f * 0.8, 0.055, 0.25, 2.4); noiseHit(d, t, 'highpass', 2500, 0.5, 0.05, 0.3, 1.0); },
    // 呼吸：先吸氣（較尖細）再吐氣（較低沉）；open 越大越像張嘴喘氣，最後會帶出「哈」的聲帶音
    breath(open, vol, period) { // 真實一點的呼吸：只有氣聲（濾波後的噪音），沒有任何音高；吸氣偏高、短，吐氣偏低、長
      if (!AU.ctx) return; const C = AU.ctx, t = C.currentTime + 0.02; const d = out(AU.sfx, undefined, 0, 0, 0.06);
      const inD = Math.min(0.9, period * 0.38), exD = Math.min(1.4, period * 0.52), te = t + inD + 0.06 + rand(0, 0.05);
      const env = (g, st, dur, peak, peakAt) => { g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(peak * 0.35, st + dur * peakAt * 0.45); g.gain.linearRampToValueAtTime(peak, st + dur * peakAt); g.gain.linearRampToValueAtTime(peak * 0.4, st + dur * (peakAt + (1 - peakAt) * 0.55)); g.gain.linearRampToValueAtTime(0.0001, st + dur); };
      const air = (st, dur, bands, hp, lp, peak, peakAt) => {
        const src = C.createBufferSource(); src.buffer = AU.noise; src.playbackRate.value = rand(0.92, 1.08);
        const h = C.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; const l = C.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
        const g = C.createGain(); env(g, st, dur, peak, peakAt); src.connect(h); h.connect(l);
        for (const [f, q, w] of bands) { const b = C.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f * rand(0.95, 1.05); b.Q.value = q; const bw = C.createGain(); bw.gain.value = w; l.connect(b); b.connect(bw); bw.connect(g); }
        g.connect(d); src.start(st, rand(0, 1)); src.stop(st + dur + 0.05);
      };
      // 吸氣：細細的「嘶」，鼻吸時更細更小聲
      air(t, inD, [[2600 + open * 500, 0.9, 1], [1300, 1.2, 0.35]], 600, 6500, vol * (0.38 + open * 0.3), 0.7);
      // 吐氣：比較低沉的「哈」，張嘴喘的時候更明顯
      air(te, exD, [[650 + open * 250, 1.1, 1], [1500 + open * 300, 1.0, 0.6], [2600, 1.4, 0.2]], 180, 4200, vol, 0.22);
    },
    click(on) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx); noiseHit(d, t, 'bandpass', on ? 3200 : 2400, 4, 0.18, 0.001, 0.025); tone(d, t, 'square', on ? 1900 : 1500, null, 0.03, 0.001, 0.02); },
    clang(x, y, z) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, x, y, z, 0.5); for (const f of [523, 1187, 1873, 2639, 3511]) tone(d, t, 'sine', f, f * 0.995, 0.14, 0.002, rand(0.5, 1.0)); noiseHit(d, t, 'highpass', 2000, 0.7, 0.3, 0.002, 0.05); tone(d, t, 'triangle', 180, 120, 0.25, 0.003, 0.25); },
    stun(x, y, z) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, x, y + 1.7, z, 0.3); for (let i = 0; i < 4; i++) tone(d, t + i * 0.14, 'triangle', 1400 - i * 180, 600, 0.12, 0.005, 0.12); },
    whoosh() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const b = noiseHit(out(AU.sfx), t, 'bandpass', 400, 1.5, 0.35, 0.05, 0.3); b.frequency.exponentialRampToValueAtTime(2200, t + 0.3); },
    pickup() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx); tone(d, t, 'triangle', 660, 880, 0.15, 0.005, 0.12); noiseHit(d, t, 'bandpass', 2500, 3, 0.1, 0.002, 0.05); },
    blip(low) { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(out(AU.sfx), t, 'square', low ? rand(180, 210) : rand(430, 520), null, 0.02, 0.003, 0.035); },
    door(open, x, y, z) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, x, y, z, 0.35);
      if (open) { noiseHit(d, t, 'bandpass', 2200, 6, 0.12, 0.004, 0.05); tone(d, t + 0.03, 'sawtooth', rand(310, 360), rand(240, 280), 0.025, 0.05, 0.35); }
      else { tone(d, t, 'sine', 70, 45, 0.5, 0.004, 0.16); noiseHit(d, t, 'lowpass', 600, 0.8, 0.35, 0.002, 0.09); noiseHit(d, t + 0.02, 'bandpass', 2600, 5, 0.12, 0.002, 0.04); } },
    locked() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, DORM.DOOR.x, 1, DORM.DOOR.z, 0.3); for (let i = 0; i < 3; i++) noiseHit(d, t + i * 0.09, 'bandpass', 900, 4, 0.4, 0.002, 0.06); },
    // 被抓到：先吸一口氣般的上升音 → 瞬間死寂 → 重擊 → 尖銳不和諧弦樂＋扭曲尖叫 → 耳鳴與逐漸停止的心跳
    riser() {
      if (!AU.ctx) return; const C = AU.ctx, t = C.currentTime; const d = out(AU.master, undefined, 0, 0, 0.6);
      const s = C.createBufferSource(); s.buffer = AU.noise; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.32);
      const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + 0.34); s.connect(bp); bp.connect(g); g.connect(d); s.start(t); s.stop(t + 0.4);
      for (const f of [220, 233]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 4, t + 0.32); const og = C.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.12, t + 0.3); og.gain.linearRampToValueAtTime(0.0001, t + 0.34); o.connect(og); og.connect(d); o.start(t); o.stop(t + 0.4); }
    },
    peek() { // 潘柏翰出現：有點毛但不驚悚——輕悶響＋一陣吸氣般的風聲＋兩個不和諧的高音短暫浮起再消失（音量偏小、不壓掉其他聲音）
      if (!AU.ctx) return; const C = AU.ctx, t = C.currentTime + 0.02; const d = out(AU.sfx, undefined, 0, 0, 0.45);
      noiseHit(d, t, 'lowpass', 380, 0.7, 0.13, 0.004, 0.2); // 輕輕一聲悶響
      { const n = C.createBufferSource(); n.buffer = AU.noise; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1900, t + 0.35);
        const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); n.connect(bp); bp.connect(g); g.connect(d); n.start(t); n.stop(t + 0.65); } // 吸氣般的風聲
      for (const [f, det] of [[622, 0], [659, 7]]) { // 小二度的不和諧音，帶一點顫音
        const o = C.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t + 0.05); o.detune.value = det;
        const lfo = C.createOscillator(); lfo.frequency.value = 6.5; const lg = C.createGain(); lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
        const g = C.createGain(); g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.exponentialRampToValueAtTime(0.035, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
        o.connect(g); g.connect(d); o.start(t + 0.05); lfo.start(t + 0.05); o.stop(t + 1.35); lfo.stop(t + 1.35);
      }
    },
    scare() {
      if (!AU.ctx) return; const C = AU.ctx, t = C.currentTime + 0.06;
      // 瞬間把所有聲音壓掉，製造「心跳停一拍」的死寂
      for (const k of ['amb', 'sfx', 'horror', 'chase', 'hb']) if (AU[k]) { AU[k].gain.cancelScheduledValues(C.currentTime); AU[k].gain.setValueAtTime(0.0001, C.currentTime); }
      setTimeout(() => { if (AU.sfx) AU.sfx.gain.setTargetAtTime(1, C.currentTime, 0.05); }, 1600);
      const bus = C.createGain(); bus.gain.value = 0.85; bus.connect(AU.master); const rv = C.createGain(); rv.gain.value = 0.55; bus.connect(rv); rv.connect(AU.rev);
      const ws = C.createWaveShaper(); ws.curve = distCurve(60); ws.oversample = '2x'; const wg = C.createGain(); wg.gain.value = 0.5; ws.connect(wg); wg.connect(bus);
      // 1. 重擊：次低頻＋爆裂
      tone(bus, t, 'sine', 64, 26, 1.0, 0.004, 1.4);
      tone(bus, t, 'triangle', 120, 40, 0.5, 0.003, 0.5);
      noiseHit(bus, t, 'lowpass', 1800, 0.7, 0.9, 0.002, 0.35);
      noiseHit(ws, t, 'bandpass', 3200, 0.6, 0.7, 0.002, 0.6);
      // 2. 尖銳不和諧的弦樂刮音（半音簇＋快速顫音＋往上滑）
      for (const f of [1397, 1480, 1568, 1661, 2093, 2217]) {
        const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f * 1.12, t + 1.6);
        const v = C.createOscillator(); v.frequency.value = rand(11, 17); const vg = C.createGain(); vg.gain.value = f * 0.025; v.connect(vg); vg.connect(o.frequency);
        const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.4; bp.Q.value = 3;
        const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.03); g.gain.setValueAtTime(0.16, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(bp); bp.connect(g); g.connect(ws); g.connect(bus); o.start(t); o.stop(t + 2.3); v.start(t); v.stop(t + 2.3);
      }
      // 3. 扭曲的人聲尖叫（用他的嘶吼音檔拉高、加失真）
      const sc = AU.voice && (AU.voice.c_ah || AU.voice.chase_loop);
      if (sc) { const s = C.createBufferSource(); s.buffer = sc; s.playbackRate.setValueAtTime(1.45, t); s.playbackRate.linearRampToValueAtTime(1.15, t + 1.4); const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.3, t + 0.02); g.gain.setValueAtTime(1.3, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); s.connect(hp); hp.connect(g); g.connect(ws); g.connect(bus); s.start(t, sc === AU.voice.chase_loop ? 1.0 : 0); s.stop(t + 1.7); }
      // 4. 餘波：耳鳴＋低沉嗡鳴
      { const o = C.createOscillator(); o.frequency.value = 7200; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t + 0.4); g.gain.exponentialRampToValueAtTime(0.035, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5); o.connect(g); g.connect(AU.master); o.start(t + 0.4); o.stop(t + 6.6); }
      { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 41; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t + 0.8); g.gain.exponentialRampToValueAtTime(0.25, t + 2); g.gain.exponentialRampToValueAtTime(0.0001, t + 7); o.connect(lp); lp.connect(g); g.connect(AU.master); o.start(t + 0.8); o.stop(t + 7.1); }
      // 5. 越來越慢、最後停止的心跳
      { let tt = t + 1.9; for (const gap of [0.62, 0.78, 1.0, 1.35, 1.9]) { tone(AU.master, tt, 'sine', 58, 36, 0.55, 0.01, 0.16); tone(AU.master, tt + 0.22, 'sine', 50, 32, 0.38, 0.01, 0.2); tt += gap; } }
    },
    win() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.master, undefined, 0, 0, 0.8); [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => tone(d, t + i * 0.12, 'triangle', f, f, 0.12, 0.6, 3.2)); tone(d, t + 0.7, 'sine', 1046.5, 1046.5, 0.08, 0.01, 2.5); },
    ambientOne() {
      const C = AU.ctx, t = C.currentTime; const a = rand(0, Math.PI * 2), r = rand(6, 14); const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, y = P.y + rand(-1, 3);
      const d = out(AU.sfx, x, y, z, 0.9); const k = Math.random();
      if (k < 0.35) { for (let i = 0; i < (2 + (Math.random() * 2 | 0)); i++) { tone(d, t + i * 0.32, 'sine', 120, 70, 0.35, 0.003, 0.15); noiseHit(d, t + i * 0.32, 'lowpass', 700, 1, 0.25, 0.002, 0.06); } }
      else if (k < 0.7) { const o = tone(d, t, 'sawtooth', rand(90, 140), rand(70, 110), 0.07, 0.3, 1.2); const w = C.createOscillator(); w.frequency.value = 9; const wg = C.createGain(); wg.gain.value = 12; w.connect(wg); wg.connect(o.frequency); w.start(t); w.stop(t + 1.6); }
      else { tone(d, t, 'sine', 1600, 900, 0.12, 0.002, 0.25); }
    },
    cough() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, HOU.x, HOU.y + 0.3, HOU.z, 0.3); for (let i = 0; i < 3; i++) { const tt = t + i * 0.32 + rand(0, 0.05); noiseHit(d, tt, 'bandpass', rand(700, 950), 1.2, 0.35, 0.01, 0.16); tone(d, tt, 'sawtooth', rand(120, 140), 90, 0.08, 0.01, 0.12); } },
    thud(x, y, z, type) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx, x, y, z, 0.3); if (type === 'card') noiseHit(d, t, 'highpass', 3000, 0.8, 0.12, 0.001, 0.03); else if (type === 'remote') { noiseHit(d, t, 'bandpass', 1800, 2, 0.3, 0.001, 0.05); tone(d, t, 'square', 420, 300, 0.04, 0.001, 0.04); } else { tone(d, t, 'sine', 160, 90, 0.4, 0.003, 0.12); noiseHit(d, t, 'lowpass', 900, 0.8, 0.3, 0.002, 0.06); } },
    tvClick() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const d = out(AU.sfx); noiseHit(d, t, 'bandpass', 2600, 3, 0.25, 0.001, 0.02); tone(d, t + 0.01, 'square', 1200, null, 0.02, 0.001, 0.015); },
    tvStatic() { if (!AU.ctx) return; const t = AU.ctx.currentTime; const x = LNG.tv; const d = out(AU.sfx, x.x, x.y, x.z, 0.3); noiseHit(d, t, 'highpass', 1800, 0.5, 0.16, 0.01, 0.22); tone(d, t, 'sine', 15600, null, 0.01, 0.01, 0.3); },
  };
  function scheduler() {
    const C = AU.ctx; if (!C) return; const now = C.currentTime;
    // 追逐鼓點
    while (AU.nextBeat < now + 0.12) { const t = AU.nextBeat; const n = AU.beatN++; if (G.chaseMix > 0.02) { tone(AU.chase, t, 'sine', 95, 38, 0.9, 0.003, 0.24); if (n % 2 === 1) noiseHit(AU.chase, t, 'bandpass', 1800, 0.8, 0.25, 0.002, 0.09); if (n % 4 === 0) tone(AU.chase, t, 'sawtooth', 55, 52, 0.3, 0.01, 0.3); } AU.nextBeat += 0.36 / Math.min(1.25, G.enemySpeedMul); }
    // 心跳
    while (AU.nextHB < now + 0.12) { const t = AU.nextHB; const d = G.enemyDist; if (d < 17) { const v = clamp(1 - d / 17, 0, 1); tone(AU.hb, t, 'sine', 62, 40, 0.15 + v * 0.75, 0.01, 0.13); tone(AU.hb, t + 0.21, 'sine', 55, 36, 0.1 + v * 0.55, 0.01, 0.16); AU.nextHB += clamp(1.3 - v * 0.9, 0.42, 1.3); } else AU.nextHB += 0.5; }
    breathTick(now);
    if (now > AU.nextAmbient) { AU.nextAmbient = now + rand(9, 22); if (G.phase !== 'start' && G.phase !== 'dead' && G.phase !== 'won' && G.phase !== 'event') SFX.ambientOne(); }
  }
  // 呼吸聲：你提供的真人錄音（原速、只調大音量）循環播放，捲毛靠近或追你時才淡入；躲著時變小聲、他很近時屏住呼吸、走遠後鬆一口氣
  function breathTick(now) {
    const C = AU.ctx; if (!C || !AU.voice || !AU.voice.breath) return;
    if (!AU.br) { const s = C.createBufferSource(); s.buffer = AU.voice.breath; s.loop = true; const g = C.createGain(); g.gain.value = 0; const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120; s.connect(hp); hp.connect(g); g.connect(out(AU.sfx, undefined, 0, 0, 0.05)); s.start(); AU.br = { s, g, sigh: 0 }; }
    const play = (G.phase === 'intro' || G.phase === 'quest' || G.phase === 'chase') && !G.paused;
    const E = G.exert || 0; let target = 0;
    if (play) {
      // 只有捲毛在附近、或正在被他追時才會喘；他離開後還會喘一陣子，再慢慢變小、停止
      if (enemy.active && enemy.stun <= 0 && (enemy.state === 'chase' || enemy.state === 'hunt' || G.enemyDist < 11)) AU.br.until = now + 7;
      if (now < (AU.br.until || 0)) target = 0.2 + 0.25 * Math.min(1, E);
      if (P.hidden) { if (G.enemyDist < 7) { G.held = true; target = 0; } else { if (G.held) { G.held = false; AU.br.sigh = now + 2.2; } target *= 0.45; } }
      if (now < AU.br.sigh) target = Math.max(target, 0.3);
    }
    AU.br.g.gain.setTargetAtTime(target, now, target > AU.br.g.gain.value ? 0.5 : 2.6); // 淡出很慢
  }
  // 追逐聲：一條一直循環的聲音掛在他身上；追逐時淡入、跟丟或暈眩時淡出。距離越近越大聲（線性衰減，35 公尺外聽不到）
  function chaseVoiceStart() {
    if (!AU.ctx || !AU.voice.chase_loop || AU.cv) return; const C = AU.ctx;
    const src = C.createBufferSource(); src.buffer = AU.voice.chase_loop; src.loop = true;
    const g = C.createGain(); g.gain.value = 0; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    const p = C.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.refDistance = 1.2; p.maxDistance = 35; p.rolloffFactor = 1;
    src.connect(g); g.connect(lp); lp.connect(p); p.connect(AU.sfx); const rv = C.createGain(); rv.gain.value = 0.5; lp.connect(rv); rv.connect(AU.rev);
    { // 走廊回音：吼叫聲在走廊裡來回彈的「回聲」（延遲＋回授，越彈越悶）
      const dl = C.createDelay(1.2); dl.delayTime.value = 0.23; const fb = C.createGain(); fb.gain.value = 0.38; const dlp = C.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1700;
      const wet = C.createGain(); wet.gain.value = 0.34; p.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(AU.sfx); }
    src.start(); AU.cv = { src, g, lp, p };
  }
  function chaseVoiceUpdate(on) {
    const v = AU.cv; if (!v) return; const C = AU.ctx, t = C.currentTime; const p = v.p;
    if (p.positionX) { p.positionX.setTargetAtTime(enemy.x, t, 0.05); p.positionY.setTargetAtTime(enemy.y + 1.6, t, 0.05); p.positionZ.setTargetAtTime(enemy.z, t, 0.05); } else p.setPosition(enemy.x, enemy.y + 1.6, enemy.z);
    const near = clamp(1 - G.enemyDist / 35, 0, 1);
    v.g.gain.setTargetAtTime(on ? 1.5 * (0.55 + 0.45 * near) : 0.0001, t, on ? 0.25 : 0.9);
    v.lp.frequency.setTargetAtTime(Math.abs(enemy.y - P.y) > 1.5 ? 1700 : 9000, t, 0.3);
  }
  function chaseVoiceStop() { const v = AU.cv; if (!v) return; AU.cv = null; v.g.gain.setTargetAtTime(0.0001, AU.ctx.currentTime, 0.2); setTimeout(() => { try { v.src.stop(); } catch (e) { } }, 1500); }
  function bgmStart() {
    if (!AU.ctx || !AU.voice.bgm_chase || AU.bgmSrc) return;
    const C = AU.ctx; AU.bgmG = AU.bgmG || (() => { const g = C.createGain(); g.gain.value = 0; g.connect(AU.master); const r = C.createGain(); r.gain.value = 0.15; g.connect(r); r.connect(AU.rev); return g; })();
    const s = C.createBufferSource(); s.buffer = AU.voice.bgm_chase; s.loop = true; s.connect(AU.bgmG); s.start(); AU.bgmSrc = s;
  }
  function bgmStop(tc) { if (!AU.bgmSrc) return; const s = AU.bgmSrc; AU.bgmSrc = null; mixTo(AU.bgmG, 0.0001, tc || 0.4); setTimeout(() => { try { s.stop(); } catch (e) { } }, 2500); }
  function mixTo(node, v, tc) { if (!AU.ctx) return; node.gain.setTargetAtTime(v, AU.ctx.currentTime, tc); }

  // ---------- 遊戲狀態 ----------
  const SPAWN_Z = DORM.spawn.z, SPAWN_X = DORM.spawn.x, DOOR = DORM.DOOR;
  const P = { x: SPAWN_X, y: 0, z: SPAWN_Z, vy: 0, grounded: true, yaw: 0, pitch: 0, stamina: 100, hidden: false, running: false, light: true };
  const look = { yaw: 0, pitch: 0, dx: 0, dy: 0 };
  const G = { phase: 'start', paused: false, noLock: false, enemyDist: 99, chaseMix: 0, enemySpeedMul: 1, items: [], cur: -1, hold: 0, holding: false, wheyRoom: null, questT: 0, hintShown: false, sips: 0, hits: 0, startTime: 0, stepAcc: 0, bob: 0, walk: { phase: 0, amp: 0, run: 0, land: 0, fov: 72 }, exert: 0, held: false, bed: null, prevPos: null, target: null, shake: 0, lastY: 0 };
  const enemy = new Enemy(world, nav, L);
  const npcPos = { x: DORM.npc.x, y: 0, z: DORM.npc.z };
  const npcBox = { n: 'npc', x0: npcPos.x - 0.25, x1: npcPos.x + 0.25, z0: npcPos.z - 0.25, z1: npcPos.z + 0.25, y0: 0, y1: 1.8, on: true };
  const doorBox = { n: 'door', x0: DOOR.x0 - 0.1, x1: DOOR.x1 + 0.1, z0: DOOR.z - 0.05, z1: DOOR.z + 0.2, y0: 0, y1: 2.6, on: true };
  world.dyn.push(npcBox, doorBox);
  const whey = { x: 0, y: 0, z: 0, inWorld: false, desk: null };
  const pot = { x: 0, y: 0, z: 0, inWorld: false, fly: null };
  const keys = {};

  // ---------- UI ----------
  const ui = { objective: $('objective'), prompt: $('prompt'), stamina: $('staminaFill'), staminaWrap: $('stamina'), staminaLbl: $('staminaLbl'), dlg: $('dialog'), dlgName: $('dlgName'), dlgText: $('dlgText'), choice: $('choice'), btnYes: $('btnDrink'), btnNo: $('btnNo'), fade: $('fade'), roar: $('roar'), hand: $('hand'), handImg: $('handImg'), slots: $('slots'), ring: $('ringFill'), ringWrap: $('ring'), toast: $('toast'), danger: $('danger'), hideFx: $('hideFx'), pause: $('pause'), scare: $('scare'), dead: $('dead'), won: $('won'), start: $('start'), hud: $('hud'), wonStats: $('wonStats'), deadLine: $('deadLine') };
  function setObjective(t) { ui.objective.querySelector('.obj-text').textContent = t; ui.objective.classList.remove('flash'); void ui.objective.offsetWidth; ui.objective.classList.add('flash'); }
  let toastT = 0; function toast(t, ms = 2600) { ui.toast.textContent = t; ui.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => ui.toast.classList.remove('show'), ms); }
  function renderSlots() {
    ui.slots.innerHTML = '';
    const IMG = { whey: A.whey, pot: A.pot, remote: A.remote, card: A.card, cig: A.cig }, NAME = { whey: ITEM_NAME('whey'), pot: '快煮鍋', remote: '遙控器', card: '冷氣卡', cig: '香菸' };
    G.items.forEach((it, i) => { const d = document.createElement('div'); d.className = 'slot' + (i === G.cur ? ' cur' : ''); d.innerHTML = `<img alt="" src="${IMG[it]}"><span class="slot-key">${i + 1}</span><span class="slot-name">${NAME[it]}</span>`; ui.slots.appendChild(d); });
    const it = G.items[G.cur];
    ui.hand.hidden = !it; if (it) { ui.handImg.src = { whey: A.whey, pot: A.pot, remote: A.remote, card: A.card, cig: A.cig }[it]; ui.hand.dataset.item = it; }
    $('useHint').hidden = !it;
    $('useHint').textContent = it === 'pot' ? '長按 F 投擲快煮鍋 · Q 丟出' : it === 'remote' ? '對著電視按 F · Q 丟出' : it === 'card' ? 'Q 丟到地上引開他' : it === 'cig' ? '按住 F 抽一根（短暫加速） · Q 丟出' : '長按 F 再喝一口 · Q 丟出';
  }
  function addItem(it) { if (!G.items.includes(it)) G.items.push(it); G.cur = G.items.indexOf(it); renderSlots(); }
  function removeItem(it) { const i = G.items.indexOf(it); if (i >= 0) G.items.splice(i, 1); G.cur = G.items.length ? Math.min(G.cur, G.items.length - 1) : -1; if (G.cur < 0 && G.items.length) G.cur = 0; renderSlots(); }

  // ---------- 滑鼠鎖定 ----------
  const locked = () => document.pointerLockElement === canvas;
  function lockPointer() {
    if (G.noLock) return;
    try {
      let r; try { r = canvas.requestPointerLock({ unadjustedMovement: true }); } catch (e) { r = null; }
      if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => { G.noLock = true; }); } catch (e) { G.noLock = true; } });
      else if (!r) { /* 舊版瀏覽器：同步呼叫，不回傳 Promise */ }
    } catch (e) { G.noLock = true; }
  }
  function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
  document.addEventListener('pointerlockerror', () => { G.noLock = true; ui.pause.hidden = true; toast('瀏覽器不允許鎖定滑鼠：請按住滑鼠左鍵拖曳來轉動視角', 5000); });
  document.addEventListener('pointerlockchange', () => { if (!locked() && playable() && !G.noLock && !dlgState && !G.inTalk) { G.paused = true; ui.pause.hidden = false; } else if (locked()) { G.paused = false; ui.pause.hidden = true; } });
  const playable = () => (G.phase === 'intro' || G.phase === 'quest' || G.phase === 'chase');
  let dragging = false;
  canvas.addEventListener('mousedown', (e) => { if (G.noLock) dragging = true; else if (playable() && !locked()) lockPointer(); });
  window.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('mousemove', (e) => {
    if (!(locked() || (G.noLock && dragging))) return; if (!playable() || G.paused) return;
    const mx = e.movementX || 0, my = e.movementY || 0;
    if (Math.abs(mx) > 350 || Math.abs(my) > 350) return; // 濾除瀏覽器滑鼠鎖定時偶發的跳動
    const s = G.noLock ? 0.0036 : 0.0021;
    look.dx += mx * s; look.dy += my * s;
  });
  ui.pause.addEventListener('click', () => { lockPointer(); });

  // ---------- 電視 ----------
  const TV_AVG = [0x8a96b0, 0x9a8ca0, 0x9a8a7a, 0xa09a8c];
  function tvPress() {
    TV.on = TV.on % 4 + 1; TV.staticT = 0.22; SFX.tvClick(); SFX.tvStatic();
    TV.mesh.material.color.setHex(0xffffff); TV.mesh.material.map = TV.noise; TV.mesh.material.needsUpdate = true;
    TV.light.color.setHex(TV_AVG[TV.on - 1]);
  }
  function tvReset() { TV.on = 0; TV.staticT = 0; TV.mesh.material.map = null; TV.mesh.material.color.setHex(0x050607); TV.mesh.material.needsUpdate = true; TV.light.intensity = 0; TV.remoteInWorld = true; if (TV.remoteMesh) TV.remoteMesh.visible = true; }
  function tvUpdate(dt) {
    if (!TV.on) return;
    if (TV.staticT > 0) {
      TV.staticT -= dt; const c = TV.noiseCanvas, g = c.getContext('2d'), im = g.createImageData(c.width, c.height);
      for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0); TV.noise.needsUpdate = true; TV.light.intensity = 0.6 + Math.random() * 0.5;
      if (TV.staticT <= 0) { TV.mesh.material.map = TV.tex[TV.on - 1]; TV.mesh.material.needsUpdate = true; }
    } else TV.light.intensity = 1.25 + Math.sin(performance.now() / 90) * 0.04 + (Math.random() < 0.02 ? -0.4 : 0); // 映像管的微微閃動
  }

  // ---------- 手電筒 ----------
  // 222 號房：潘柏翰（一開門就貼臉出現）
  loadTex(A.cig).then((t) => { TEX.cig = t; });
  loadTex(A.pan).then((t) => { panMesh = billboard(t, 1.76, 0x0c0c0c); panMesh.visible = false; });
  // ---------- 竹竿：222 和 210 門前、走廊正中間站著不動；看得到他時玩家被迫用走的，靠近一點他就朝玩家跑過來、擦身而過跑掉（不會傷人）----------
  const ZHU = { meshes: null, st: 'idle', slow: false };
  Promise.all([A.zhu_stand, A.zhu_run1, A.zhu_run2].map((u) => loadTex(u))).then((ts) => { ZHU.meshes = ts.map((t) => { const m = billboard(t, 1.74, 0x0c0c0c); m.visible = false; return m; }); zhuReset(); });
  function zhuReset() {
    const da = DORM.doors.find((x) => x.no === 222), db = DORM.doors.find((x) => x.no === 210); // 站在 222 和 210 門口中間
    Object.assign(ZHU, { st: 'idle', slow: false, said: false, passed: false, t: 0, stepT: 0, wp: null, x: DORM.XS, z: da && db ? (da.cz + db.cz) / 2 : -18.8 });
    if (ZHU.meshes) ZHU.meshes.forEach((m) => { m.visible = false; });
  }
  let subT = 0;
  function zhuSay(lines, i = 0) { // 邊跑邊講：字幕自己往下播，不用按、也不會停住玩家
    const el = $('sub'); if (i >= lines.length) { el.classList.remove('show'); return; }
    $('subName').textContent = '竹竿'; $('subText').textContent = lines[i][0]; el.classList.add('show');
    clearTimeout(subT); subT = setTimeout(() => zhuSay(lines, i + 1), lines[i][1]);
  }
  function updateZhu(dt) {
    if (!ZHU.meshes) return; const M = ZHU.meshes;
    if ((G.phase !== 'quest' && G.phase !== 'intro') || ZHU.st === 'gone') { M.forEach((m) => { m.visible = false; }); ZHU.slow = false; if (G.phase === 'chase' && ZHU.st === 'idle') ZHU.st = 'gone'; return; }
    if (G.paused) return;
    const F = DORM.F, d = Math.hypot(ZHU.x - P.x, ZHU.z - P.z), inCorr = P.y > 3 && Math.abs(P.x - DORM.XS) < 2.7 && P.z < 4.9;
    const see = inCorr && world.los(P.x, P.y + 1.6, P.z, ZHU.x, F + 1.4, ZHU.z);
    let frame = 0;
    if (ZHU.st === 'idle') {
      // 21 m 遠遠開始看得到 → 被迫用走的；13 m 還看不太清楚時他就衝過來
      if (see && d < 21) ZHU.slow = true;
      if (see && d < 13) { ZHU.st = 'run'; ZHU.side = P.x >= DORM.XS ? -1 : 1; }
    } else {
      ZHU.t += dt; frame = 1 + (Math.floor(ZHU.t / 0.15) % 2);
      if (!ZHU.passed && ZHU.z >= P.z - 0.2) { ZHU.passed = true; ZHU.wp = [[clamp(ZHU.x, DORM.XS - 1.8, DORM.XS + 1.8), 9.6], [DORM.XS - 14, 10.2]]; }
      let tx, tz; if (!ZHU.passed) { tx = clamp(P.x + ZHU.side * 0.95, DORM.XS - 2.1, DORM.XS + 2.1); tz = P.z + 0.5; } else { while (ZHU.wp.length && Math.hypot(ZHU.wp[0][0] - ZHU.x, ZHU.wp[0][1] - ZHU.z) < 0.4) ZHU.wp.shift(); if (!ZHU.wp.length) { ZHU.st = 'gone'; return; } [tx, tz] = ZHU.wp[0]; }
      const vx = tx - ZHU.x, vz = tz - ZHU.z, L = Math.hypot(vx, vz) || 1, sp = 6.2 * dt; ZHU.x += vx / L * Math.min(sp, L + 0.6); ZHU.z += vz / L * Math.min(sp, L + 0.6);
      if ((ZHU.stepT += dt) > 0.29) { ZHU.stepT = 0; try { SFX.zhuStep(ZHU.x, F, ZHU.z); } catch (e) { } }
      if (!ZHU.said && d < 3.4) { ZHU.said = true; ZHU.slow = false; zhuSay([['乾，超黑的啦', 1900], ['發瘋', 1500]]); }
      if (ZHU.passed && d > 19) { ZHU.st = 'gone'; return; }
    }
    M.forEach((m, k) => { m.visible = k === frame; if (k === frame) m.position.set(ZHU.x, F + (frame ? Math.abs(Math.sin(ZHU.t * 21)) * 0.05 : 0), ZHU.z); });
  }
  function setFlash(on, silent) {
    P.light = on; flash.intensity = on ? FLASH_I : 0; flood.intensity = on ? FLOOD_I : 0; if (!on) flashSpill.intensity = 0;
    const el = $('flashState'); if (el) { el.textContent = on ? '開' : '關'; el.parentElement.classList.toggle('off', !on); }
    if (!silent) SFX.click(on);
  }

  // ---------- 麥克風：只量音量大小（不錄音），太大聲時他會聽到 ----------
  const MIC = { on: false, rms: 0, floor: 0.006, sens: 5, calibT: 0, cs: [], an: null, buf: null, over: 0, cd: 0 };
  async function micStart() {
    if (MIC.on || MIC.pending || !$('micToggle').checked) return; MIC.pending = true;
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      const src = AU.ctx.createMediaStreamSource(st); const an = AU.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an); // 不接到喇叭
      MIC.an = an; MIC.buf = new Float32Array(an.fftSize); MIC.on = true; MIC.calibT = 2.5; MIC.cs = [];
      { // 自己的回音：只有說話時打開閘門，送進空間殘響＋反射回聲（大小依所在位置）
        const C = AU.ctx, hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; const gate = C.createGain(); gate.gain.value = 0;
        const rev = C.createGain(); rev.gain.value = 0; const dl = C.createDelay(1.0); dl.delayTime.value = 0.15; const dlp = C.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
        const fb = C.createGain(); fb.gain.value = 0; const wet = C.createGain(); wet.gain.value = 0;
        const comp = C.createDynamicsCompressor(); comp.threshold.value = -26; comp.knee.value = 8; comp.ratio.value = 10; comp.attack.value = 0.004; comp.release.value = 0.2; // 自動增益後再壓一下，近距離大聲也不會爆
        src.connect(hp); hp.connect(gate); gate.connect(comp); comp.connect(rev); rev.connect(AU.rev); comp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(AU.master);
        MIC.echo = { gate, rev, dl, fb, wet, zone: '' };
      }
      $('micHud').hidden = false; toast('麥克風校正中，請先保持安靜 2 秒……', 2600);
    } catch (e) { toast('沒有開啟麥克風：這局他聽不到你的聲音', 3200); }
    MIC.pending = false;
  }
  // 依所在位置決定回音強度（接近真實：磁磚浴廁、水泥樓梯間、長走廊回音重；寢室有家具很乾；戶外幾乎沒有）
  function echoZone() {
    const x = P.x, y = P.y, z = P.z;
    if (x < -28.5 && z > 4.6) return ['樓梯間', 0.85, 0.085, 0.32, 0.22];
    if (y > 3) {
      if (z < DORM.bathZ) return ['浴廁', 0.8, 0.055, 0.28, 0.2];
      const xr = x - DORM.XS; // 宿舍走廊中心線
      if (Math.abs(xr) <= 2.6 && z < 4.6) return ['走廊', 0.55, 0.21, 0.3, 0.26];
      if (Math.abs(xr) > 2.6 && z < -0.8) return ['寢室', 0.12, 0.04, 0, 0];
      return ['交誼廳', 0.38, 0.12, 0.12, 0.1];
    }
    if (z < -0.8 && x > -24.5) return ['戶外', 0.04, 0.24, 0, 0.07];
    if (x < -30.4) return ['一樓走道', 0.55, 0.1, 0.2, 0.16];
    return ['大廳', 0.45, 0.13, 0.18, 0.14];
  }
  function micEcho() {
    const E = MIC.echo; if (!E) return; const C = AU.ctx, t = C.currentTime;
    const on = (G.phase === 'intro' || G.phase === 'quest' || G.phase === 'chase') && !G.paused && MIC.calibT <= 0;
    const open = on ? clamp((MIC.rms - MIC.floor * 1.4) / (MIC.floor * 0.9 + 0.001), 0, 1) : 0; // 回音的門檻比捲毛聽到的門檻（micThr）低：離麥克風遠一點、正常音量說話就有回音
    const makeup = clamp(0.09 / Math.max(MIC.rms, 1e-4), 1.5, 40); // 自動增益：聲音小（離麥克風遠）就放大，回音大小跟距離無關
    E.gate.gain.setTargetAtTime(open * makeup, t, open > E.gate.gain.value ? 0.015 : 0.08);
    const [name, rv, dt, fbk, wet] = echoZone();
    if (name !== E.zone) { E.zone = name; E.rev.gain.setTargetAtTime(rv, t, 0.4); E.dl.delayTime.setTargetAtTime(dt, t, 0.3); E.fb.gain.setTargetAtTime(fbk, t, 0.3); E.wet.gain.setTargetAtTime(wet, t, 0.3); }
  }
  const micThr = () => Math.max(MIC.floor * 2.4, 0.01) * (2.15 - MIC.sens * 0.17); // 靈敏度 1 → 約 2 倍門檻、10 → 約 0.45 倍
  function micUpdate(dt) {
    if (!MIC.on) return;
    MIC.an.getFloatTimeDomainData(MIC.buf); let sum = 0; for (let i = 0; i < MIC.buf.length; i++) sum += MIC.buf[i] * MIC.buf[i];
    const r = Math.sqrt(sum / MIC.buf.length); MIC.rms = r > MIC.rms ? r : MIC.rms + (r - MIC.rms) * Math.min(1, dt * 6);
    micEcho();
    if (MIC.calibT > 0) { MIC.calibT -= dt; MIC.cs.push(r); if (MIC.calibT <= 0) { const a = MIC.cs.sort((x, y) => x - y); MIC.floor = Math.max(0.002, a[Math.floor(a.length * 0.85)] || 0.006); $('micState').textContent = ''; } return; }
    const thr = micThr(); const lv = MIC.rms / thr;
    $('micFill').style.width = Math.min(100, lv * 60) + '%'; $('micHud').classList.toggle('hot', lv > 1);
    MIC.cd -= dt;
    if (lv > 1) MIC.over += dt; else MIC.over = 0;
    if (MIC.over > 0.12 && MIC.cd <= 0) { MIC.cd = 0.8; heardNoise(Math.min(1, (lv - 1) / 3)); }
  }
  // 他聽到你的聲音：範圍跟音量有關；躲著被聽到＝被抓；在寢室裡 → 一間一間開門找
  function roomAtPlayer() { if (P.y < 3) return null; for (const r of DORM.rooms) { if (P.z >= r.z0 && P.z <= r.z1 && r.s * P.x > r.s * r.X(0) - 0.05) return r; } return null; }
  function roomSearchList(room, px, pz) {
    const near = DORM.rooms.filter((r) => (r.s === room.s && Math.abs(r.zc - room.zc) < 4.5) || (r.s !== room.s && Math.abs(r.zc - room.zc) < 0.5));
    const ez = pz + (Math.random() - 0.5) * 7; near.sort((a, b) => Math.abs(a.zc - ez) - Math.abs(b.zc - ez));
    return near.map((r) => ({ no: r.no, out: { x: r.X(-0.85), y: DORM.F, z: r.zc }, in: { x: r.X(1.7), y: DORM.F, z: r.zc } }));
  }
  function heardNoise(loud, src) {
    $('micState').textContent = ''; G.lastNoise = performance.now();
    if (G.phase !== 'chase' || !enemy.active || enemy.stun > 0 || G.paused || dlgState) return false;
    const sx = P.hidden && G.bed ? G.bed.cx : P.x, sz = P.hidden && G.bed ? G.bed.cz : P.z;
    const dy = Math.abs(P.y - enemy.y), range = (7 + 17 * loud) * (dy > 1.5 ? 0.4 : 1);
    if (Math.hypot(sx - enemy.x, sz - enemy.z) + dy * 2 > range) return false;
    if (P.hidden && G.bed) { if (enemy.state !== 'hunt') { enemy.huntBed(G.bed); alertToast('他聽到你的聲音了！'); } return true; }
    if (enemy.state === 'chase' || enemy.state === 'hunt' || enemy.state === 'lure' || enemy.state === 'pickup') return true;
    const room = roomAtPlayer();
    if (room) { enemy.searchRooms(roomSearchList(room, P.x, P.z)); alertToast('他聽到聲音了……正在一間一間開門找'); }
    else { enemy.hear(P.x, P.y, P.z); alertToast('他聽到聲音了，正往這邊過來……'); }
    return true;
  }
  function alertToast(t) { const n = performance.now(); if (n < (G.alertCD || 0)) return; G.alertCD = n + 2500; toast(t, 2200); }
  // 手電筒：光照到他看得到的地方，他就會靠過來；躲著還開燈被他看到光＝被抓
  function lightCheck() {
    if (!P.light || G.phase !== 'chase' || !enemy.active || enemy.stun > 0 || G.paused || dlgState) return;
    if (enemy.state === 'chase' || enemy.state === 'lure' || enemy.state === 'pickup' || (enemy.state === 'hunt')) return;
    const hid = P.hidden && G.bed; const ex = camera.position.x, ey = camera.position.y, ez = camera.position.z; // 光從眼睛（相機）的位置照出去
    const fx = -Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * Math.cos(P.pitch);
    let hx = ex, hy = ey, hz = ez; for (let t = 0.4; t <= 14; t += 0.4) { const x = ex + fx * t, y = ey + fy * t, z = ez + fz * t; if (!world.los(ex, ey, ez, x, y, z)) break; hx = x; hy = y; hz = z; }
    const gx = enemy.x, gy = enemy.y + 1.55, gz = enemy.z;
    if (hid) { // 躲著還開手電筒：光會從被子／門縫透出來，他在附近看得到你躲的地方就會發現
      const b = G.bed, ty = b.kind === 'bed' ? b.top + 0.85 : b.floor + 2.25; // 床鋪上方／隔間上方透出來的光
      if (Math.hypot(b.cx - gx, b.cz - gz) < 9 && Math.abs(b.floor - enemy.y) < 1.5 && (world.los(gx, gy, gz, b.cx, ty, b.cz) || world.los(gx, gy, gz, b.cx, b.floor + 0.15, b.cz))) { enemy.huntBed(b); alertToast('他看到你的手電筒光了！'); }
      return;
    }
    if (Math.abs(ey - gy) > 3.2) return;
    const dHit = Math.hypot(hx - gx, hz - gz), dSrc = Math.hypot(ex - gx, ez - gz);
    let saw = dHit < 16 && world.los(gx, gy, gz, hx, hy, hz); // 看到光照到的地方
    if (!saw && dSrc < 22) { const vx = gx - ex, vz = gz - ez, L = Math.hypot(vx, vz) || 1; if ((fx * vx + fz * vz) / L > 0.85 && world.los(gx, gy, gz, ex, ey, ez)) saw = true; } // 光直接照到他
    if (!saw) return;
    enemy.hear(P.x, P.y, P.z); alertToast('他注意到手電筒的光了……');
  }

  // ---------- 對話 ----------
  let dlgState = null;
  function dialog(lines, opts = {}) {
    return new Promise((resolve) => {
      unlockPointer();
      ui.dlg.hidden = false; ui.dlg.classList.toggle('mono', !!opts.mono); ui.dlgName.textContent = opts.name || ''; ui.dlgName.hidden = !opts.name;
      dlgState = { lines, i: -1, typing: false, timer: 0, resolve, opts };
      nextLine();
    });
  }
  function nextLine() {
    const s = dlgState; s.i++;
    if (s.i >= s.lines.length) { ui.dlg.hidden = true; dlgState = null; s.resolve(); return; }
    const line = s.lines[s.i]; ui.dlgText.textContent = ''; ui.dlgText.classList.toggle('shout', /！！/.test(line)); s.typing = true; let k = 0;
    clearInterval(s.timer);
    s.timer = setInterval(() => { k++; ui.dlgText.textContent = line.slice(0, k); if (k % 2 === 0 && line[k - 1] !== '…') SFX.blip(s.opts.mono); if (k >= line.length) { clearInterval(s.timer); s.typing = false; } }, s.opts.mono ? 62 : 42);
  }
  function advanceDialog() { const s = dlgState; if (!s) return; if (s.typing) { clearInterval(s.timer); s.typing = false; ui.dlgText.textContent = s.lines[s.i]; } else nextLine(); }
  ui.dlg.addEventListener('click', advanceDialog);

  // ---------- 劇情 ----------
  async function talkNPC() {
    G.phase = 'talk'; P.yaw = Math.atan2(P.x - npcPos.x, P.z - npcPos.z);
    await dialog(['欸！宿舍怎麼突然停電了？', '那個……可以拜託你幫我一個忙嗎？', '我有一罐乳清放在二樓的某間房間裡。', '可以幫我上去拿下來嗎？', '啊，還有一件很重要的事……', '拜託你絕對不要偷喝我的乳清！！！'], { name: '樓友' });
    G.phase = 'quest'; G.questT = 0; setObjective('前往二樓，找到他的乳清'); toast('樓梯就在大門進來的左手邊 · 按 G 開關手電筒', 3600); lockPointer();
  }
  async function talkHou() {
    const first = !HOU.talked; HOU.talked++; G.inTalk = true;
    G.target = null;
    if (first) {
      SFX.cough();
      await dialog(['齁優～嘎你共……', '捲毛已經發瘋了……', '只要有人動到了他的乳清，就會被他暴扁。'], { name: '侯宸宇' });
      SFX.pickup(); addItem('card'); toast('獲得道具：冷氣卡（按 Q 丟到地上）', 3600);
      await dialog(['這張給你……反正我已經沒救了，這張冷氣卡也沒有必要藏了……', '等等你把卡丟在地上，他就會優先過去撿起來……', '雖然他發現後，應該之後會再找我算帳一次，但……', '（咳嗽）……總比多一個受害者好……'], { name: '侯宸宇' });
      SFX.cough();
    } else {
      await dialog([G.items.includes('card') ? '卡……丟在地上……他會先去撿的……' : '快走……別管我了……'], { name: '侯宸宇' });
    }
    G.inTalk = false; G.talkCD = performance.now() + 900; ui.pause.hidden = true; G.paused = false; lockPointer();
    setTimeout(() => { if (!locked() && !G.noLock && playable() && !dlgState) { G.paused = true; ui.pause.hidden = false; } }, 400);
  }
  // 潘柏翰：打開 222 的門 → 臉貼著你出現（小 jump scare，不會傷害你）→ 講完話自己走出去
  async function panScare(d) {
    G.panDone = true; G.inTalk = true; G.target = null;
    let vx = d.cx - P.x, vz = d.cz - P.z; const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    panMesh.position.set(P.x + vx * 0.42, d.y0, P.z + vz * 0.42); panMesh.visible = true;
    P.yaw = Math.atan2(-vx, -vz); P.pitch = 0.04;
    try { SFX.peek(); } catch (e) { }
    G.shake = 0.35;
    await new Promise((r) => setTimeout(r, 900));
    await dialog(['乾你娘……', '剛剛在打遊戲，給我突然停電。', '我先去外面ㄅㄡˋ一根。', '……欸，你要不要也來一根？', '啊，這包只剩下一根了……', '算了，給你啦，我再去買。'], { name: '潘柏翰' });
    G.cigs = 1; SFX.pickup(); addItem('cig'); toast('獲得道具：香菸（只剩一根 · 按住 F 抽，可以短暫加速）', 3600);
    // 默默走出去：先走到走廊中間，再往南（樓梯那邊）走，越走越遠就不見了
    const sx = panMesh.position.x, sz = panMesh.position.z, side = Math.sign(d.cx - DORM.XS) || -1;
    G.panWalk = { t: 0, pts: [[sx, sz], [DORM.XS + side * 0.6, sz + 0.3], [DORM.XS + side * 0.6, sz + 16]] };
    G.inTalk = false; G.talkCD = performance.now() + 900; ui.pause.hidden = true; G.paused = false; lockPointer();
    setTimeout(() => { if (!locked() && !G.noLock && playable() && !dlgState) { G.paused = true; ui.pause.hidden = false; } }, 400);
  }
  function updatePan(dt) {
    const W = G.panWalk; if (!W || !panMesh) return;
    W.t += dt * 1.25; let t = W.t;
    for (let i = 0; i < W.pts.length - 1; i++) { const [ax, az] = W.pts[i], [bx, bz] = W.pts[i + 1], seg = Math.hypot(bx - ax, bz - az);
      if (t <= seg) { panMesh.position.x = ax + (bx - ax) * t / seg; panMesh.position.z = az + (bz - az) * t / seg; panMesh.position.y = DORM.F + Math.abs(Math.sin(W.t * 6)) * 0.02; return; } t -= seg; }
    panMesh.visible = false; G.panWalk = null;
  }
  async function takeWhey() {
    whey.inWorld = false; wheyMesh.visible = false; SFX.pickup(); addItem('whey');
    G.phase = 'mono'; ui.fade.className = 'fade dim';
    await dialog(['這就是他說的乳清嗎……', '看起來好像很好喝的樣子。', '可是他剛剛說不能偷喝……', '……', '應該只喝一口沒關係吧？'], { mono: true, name: '（你的內心）' });
    showChoice();
  }
  // 「不要」：每次想點它，它就跳到滑鼠游標旁邊（永遠差一點點）
  function dodgeNear(cx, cy) {
    const b = ui.btnNo; if (b.parentElement !== ui.choice) ui.choice.appendChild(b); b.classList.add('fled');
    const w = b.offsetWidth || 150, h = b.offsetHeight || 56, W = window.innerWidth, H = window.innerHeight;
    const opts = [];
    for (const [sx, sy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
      const gap = rand(14, 34);
      let x = sx > 0 ? cx + gap : sx < 0 ? cx - gap - w : cx - w / 2 + rand(-w * 0.3, w * 0.3);
      let y = sy > 0 ? cy + gap : sy < 0 ? cy - gap - h : cy - h / 2 + rand(-h * 0.3, h * 0.3);
      if (x < 8 || y < 8 || x + w > W - 8 || y + h > H - 8) continue;
      if (cx >= x - 6 && cx <= x + w + 6 && cy >= y - 6 && cy <= y + h + 6) continue; // 不可蓋住游標
      { const r = ui.btnYes.getBoundingClientRect(); if (x < r.right + 12 && x + w > r.left - 12 && y < r.bottom + 12 && y + h > r.top - 12) continue; } // 不可蓋住「喝一口」
      opts.push([x, y]);
    }
    const [x, y] = opts.length ? pick(opts) : [clamp(cx + 40, 8, W - w - 8), clamp(cy + 40, 8, H - h - 8)];
    b.style.left = x + 'px'; b.style.top = y + 'px';
  }
  function showChoice() {
    G.phase = 'choice'; unlockPointer(); ui.choice.hidden = false; ui.choice.querySelector('.opts').appendChild(ui.btnNo); ui.btnNo.classList.remove('fled'); ui.btnNo.style.left = ''; ui.btnNo.style.top = '';
  }
  function noDown(e) { e.preventDefault(); e.stopPropagation(); let x = e.clientX, y = e.clientY; if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; } if (x === undefined || (x === 0 && y === 0)) { const r = ui.btnNo.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } dodgeNear(x, y); SFX.blip(true); }
  ui.btnNo.addEventListener('pointerdown', noDown);
  ui.btnNo.addEventListener('touchstart', noDown, { passive: false });
  ui.btnNo.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (e.detail === 0) noDown(e); }); // 鍵盤按下也一樣閃開
  ui.btnNo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') noDown(e); });
  ui.btnYes.addEventListener('click', () => { if (G.phase !== 'choice') return; ui.choice.hidden = true; lockPointer(); drinkEvent(); });

  async function drinkEvent() {
    G.phase = 'event'; G.sips = 1; renderSlots(); G.drinkAt = { x: P.x, y: P.y, z: P.z };
    ui.fade.className = 'fade black';
    await sleep(500); SFX.gulp();
    mixTo(AU.amb, 0.0001, 0.25);
    await sleep(1700);
    // 死寂
    await sleep(1500);
    // 變身
    npcMesh.visible = false; npcBox.on = false; enemyMesh.visible = true; enemyMesh.position.set(npcPos.x, 0, npcPos.z);
    enemy.x = npcPos.x; enemy.y = 0; enemy.z = npcPos.z; enemy.yaw = Math.PI;
    eSpot.intensity = 4.2; eGlow.intensity = 1.4;
    try { SFX.transform(); SFX.roar(npcPos.x, 0, npcPos.z, 0); } catch (e) { console.error(e); }
    showRoar('就跟你說！！不准偷喝我的乳清！！！');
    G.shake = 1.1;
    ui.fade.className = 'fade';
    mixTo(AU.amb, 1, 1.5); mixTo(AU.horror, 0.07, 0.6);
    setTimeout(() => { if (G.phase === 'chase') { bgmStart(); mixTo(AU.bgmG, 0.5, 1.6); } }, 3800);
        doorBox.on = false; MAIN.open = true;
    G.phase = 'chase'; G.paused = !locked() && !G.noLock; ui.pause.hidden = !G.paused;
    setObjective('逃出宿舍！回到一樓大門');
    await sleep(2400);
    if (G.phase !== 'chase') return;
    enemy.activate(npcPos.x, 0, npcPos.z); enemy.rushTo(G.drinkAt.x, G.drinkAt.y, G.drinkAt.z);
    toast('他衝上樓了！', 2600);
  }
  let roarT = 0; function showRoar(t) { ui.roar.textContent = t; ui.roar.classList.remove('show'); void ui.roar.offsetWidth; ui.roar.classList.add('show'); clearTimeout(roarT); roarT = setTimeout(() => ui.roar.classList.remove('show'), 4600); }

  function secondSip() {
    G.sips = 2; SFX.gulp(); renderSlots();
    setTimeout(() => {
      if (G.phase !== 'chase') return;
      enemy.speedMul = 1.32; G.enemySpeedMul = 1.32;
      try { SFX.roar(enemy.x, enemy.y, enemy.z, 1); } catch (e) { console.error(e); } showRoar('你還敢喝第二口！！！！'); G.shake = 1.4;
      eSpot.color.setHex(0xff0000); eSpot.intensity = 5.6;
      if (!P.hidden) enemy.hear(P.x, P.y, P.z);
      toast('他變得更快了', 2600);
    }, 1500);
  }

  // ---------- 隨機生成 ----------
  function spawnItems() {
    const desks = L.usableDesks; const d = desks.find((x) => x.name === DORM.wheyDesk) || pick(desks);
    whey.desk = d; G.wheyRoom = d.room; whey.x = d.x + 0.15; whey.y = d.top; whey.z = d.z; whey.inWorld = true;
    wheyMesh.visible = true; wheyMesh.position.set(whey.x, whey.y, whey.z);
    // 快煮鍋只生成在二樓：其他房間的書桌
    const other = desks.filter((x) => x.room !== d.room && x.top > 3).map((x) => ({ x: x.x + rand(-0.35, 0.35), y: x.top, z: x.z }));
    const s = pick(other);
    pot.x = s.x; pot.y = s.y; pot.z = s.z; pot.inWorld = true; pot.fly = null; potMesh.visible = true; potMesh.position.set(pot.x, pot.y, pot.z);
  }

  // ---------- 新遊戲 / 重置 ----------
  function newGame() {
    Object.assign(P, { x: SPAWN_X, y: 0, z: SPAWN_Z, vy: 0, grounded: true, yaw: 0, pitch: -0.05, stamina: 100, exhausted: false, hidden: false, running: false, light: true }); Object.assign(look, { yaw: 0, pitch: -0.05, dx: 0, dy: 0 }); setFlash(true, true);
    Object.assign(G, { phase: 'intro', paused: false, enemyDist: 99, chaseMix: 0, enemySpeedMul: 1, items: [], cur: -1, hold: 0, holding: false, questT: 0, hintShown: false, sips: 0, hits: 0, startTime: performance.now(), bed: null, target: null, shake: 0 });
    enemy.reset(); enemyMesh.visible = false; npcMesh.visible = true; npcMesh.position.set(npcPos.x, 0, npcPos.z); npcBox.on = true; doorBox.on = true;
    eSpot.intensity = 0; eGlow.intensity = 0; eSpot.color.setHex(0xff1410); stunMesh.visible = false;
    for (const dr of DROPS.slice()) removeDrop(dr); G.lureDrop = null; HOU.talked = 0; G.panDone = false; G.panWalk = null; G.cigs = 0; G.boostT = 0; if (panMesh) panMesh.visible = false; zhuReset(); $('sub').classList.remove('show');
    spawnItems(); renderSlots(); tvReset();
    for (const d of DOORS) { d.open = false; d.ang = 0; d.piv.rotation.y = d.base; d.box.on = true; }
    MAIN.open = false; MAIN.ang = 0; for (const l of MAIN.leaves) l.piv.rotation.y = 0;
    for (const sp of L.usableBeds) if (sp.doorMesh) sp.doorMesh.visible = false;
    Object.assign(G.walk, { phase: 0, amp: 0, run: 0, land: 0, fov: 72, kick: 0, foot: 1 }); G.exert = 0; G.held = false;
    for (const k of ['dead', 'won', 'scare', 'start', 'pause', 'choice', 'dialog']) ui[k === 'dialog' ? 'dlg' : k].hidden = true;
    ui.hud.hidden = false; ui.fade.className = 'fade'; ui.hideFx.hidden = true; ui.danger.style.opacity = 0;
    setObjective('跟大廳裡的樓友說話');
    if (AU.ctx) { mixTo(AU.amb, 1, 0.5); mixTo(AU.horror, 0, 0.5); mixTo(AU.chase, 0, 0.3); mixTo(AU.hb, 0, 0.3); bgmStop(0.3); }
    chaseVoiceStop();
    lockPointer();
  }

  // ---------- 結局 ----------
  async function caught(kind) {
    if (G.phase !== 'chase') return; G.phase = 'dead'; unlockPointer(); keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
    const fromBed = kind === 'bed'; const spotKind = G.bed ? G.bed.kind : 'bed'; if (G.bed && G.bed.doorMesh) G.bed.doorMesh.visible = false;
    if (fromBed) { ui.hideFx.classList.add('torn'); G.shake = 1.6; await sleep(420); ui.hideFx.hidden = true; ui.hideFx.classList.remove('torn'); P.hidden = false; }
    try { SFX.riser(); } catch (e) { }
    const ty = Math.atan2(P.x - enemy.x, P.z - enemy.z); const y0 = P.yaw; let d = ty - y0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let i = 1; i <= 8; i++) { P.yaw = y0 + d * i / 8; P.pitch *= 0.8; await sleep(16); }
    SFX.scare(); ui.scare.hidden = false; ui.scare.classList.remove('go'); void ui.scare.offsetWidth; ui.scare.classList.add('go');
    mixTo(AU.horror, 0, 0.8); mixTo(AU.chase, 0, 0.5); mixTo(AU.hb, 0, 0.3); bgmStop(0.2); chaseVoiceStop();
    await sleep(1500);
    ui.scare.hidden = true; ui.hud.hidden = true;
    ui.deadLine.textContent = fromBed ? (spotKind === 'bed' ? '他看見你爬上床了。' : spotKind === 'stall' ? '他看見你躲進隔間了。' : '他看見你躲到浴簾後面了。') : (G.sips >= 2 ? '你喝了兩口。他不會原諒你。' : '他說過，不准偷喝。');
    ui.dead.hidden = false; $('btnRetry').focus({ preventScroll: true });
  }
  async function escape() {
    G.phase = 'won'; enemy.active = false; eSpot.intensity = 0; eGlow.intensity = 0; unlockPointer();
    SFX.win(); bgmStop(1.0); chaseVoiceStop(); mixTo(AU.horror, 0, 1.2); mixTo(AU.chase, 0, 0.8); mixTo(AU.hb, 0, 0.5); mixTo(AU.amb, 0.25, 1.5);
    ui.fade.className = 'fade white'; await sleep(1900);
    const sec = Math.round((performance.now() - G.startTime) / 1000);
    ui.wonStats.innerHTML = `<div><dt>用時</dt><dd>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</dd></div><div><dt>喝了幾口</dt><dd>${G.sips} 口</dd></div><div><dt>快煮鍋命中</dt><dd>${G.hits} 次</dd></div>`;
    ui.hud.hidden = true; ui.won.hidden = false; ui.fade.className = 'fade';
    $('btnAgain').focus({ preventScroll: true });
  }

  // ---------- 互動 ----------
  function findTarget() {
    const ex = P.x, ey = P.y + K.EYE, ez = P.z;
    const fx = -Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * Math.cos(P.pitch);
    const facing = (x, y, z) => { const dx = x - ex, dy = y - ey, dz = z - ez, l = Math.hypot(dx, dy, dz) || 1; return (dx * fx + dy * fy + dz * fz) / l; };
    if (G.phase === 'intro' && Math.hypot(P.x - npcPos.x, P.z - npcPos.z) < 2.4 && P.y < 1) return { kind: 'npc', text: '按 F 進行對話' };
    if (G.phase === 'quest' && whey.inWorld) { const d = Math.hypot(whey.x - ex, whey.y + 0.15 - ey, whey.z - ez); if (d < 2.1 && facing(whey.x, whey.y + 0.15, whey.z) > 0.25 && world.los(ex, ey, ez, whey.x, whey.y + 0.2, whey.z)) return { kind: 'whey', text: '按 F 拿取乳清' }; }
    if (pot.inWorld && !pot.fly && (G.phase === 'quest' || G.phase === 'chase' || G.phase === 'intro')) { const d = Math.hypot(pot.x - ex, pot.y + 0.13 - ey, pot.z - ez); if (d < 2.1 && facing(pot.x, pot.y + 0.13, pot.z) > 0.2 && world.los(ex, ey, ez, pot.x, pot.y + 0.2, pot.z)) return { kind: 'pot', text: '按 F 拾取快煮鍋' }; }
    if (houMesh && P.y > 3 && playable() && performance.now() > (G.talkCD || 0)) { const d = Math.hypot(HOU.x - P.x, HOU.z - P.z); if (d < 2.8 && world.los(ex, ey, ez, HOU.x, HOU.y + 0.3, HOU.z)) return { kind: 'hou', text: '按 F 和侯宸宇交談' }; }
    for (const dr of DROPS) { if (dr.fly || !dr.mesh) continue; const d = Math.hypot(dr.x - ex, dr.y + 0.08 - ey, dr.z - ez); if (d < 2.1 && facing(dr.x, dr.y + 0.05, dr.z) > 0.2) return { kind: 'drop', drop: dr, text: `按 F 撿起${ITEM_NAME(dr.type)}` }; }
    if (TV.remoteInWorld && TV.remoteMesh && playable()) { const r = LNG.remote; const d = Math.hypot(r.x - ex, r.y - ey, r.z - ez); if (d < 2.0 && facing(r.x, r.y, r.z) > 0.3) return { kind: 'remote', text: '按 F 拿起遙控器' }; }
    if (G.items.includes('remote') && P.y > 3) { const t = LNG.tv; const d = Math.hypot(t.x - ex, t.y - ey, t.z - ez); if (d < 12 && facing(t.x, t.y, t.z) > 0.55 && world.los(ex, ey, ez, t.x + t.nx * 0.3, t.y, t.z + t.nz * 0.3)) return { kind: 'tv', text: TV.on ? '按 F 按遙控器（下一張）' : '按 F 用遙控器打開電視' }; }
    if (P.y > 3 && P.y < 3.7) {
      let best = null, bd = 1e9;
      for (const b of L.usableBeds) {
        if (b.kind === 'bed') { // 上床不用一直對準：站在床邊 1.4 m 內、看得到床的任何一個角落（或床邊、梯子那一側）就可以
          const d = L.rectDist(b, P.x, P.z); if (d >= 1.4 || d >= bd) continue;
          const nx = Math.max(b.x0, Math.min(P.x, b.x1)), nz = Math.max(b.z0, Math.min(P.z, b.z1));
          const pts = [[b.cx, b.top + 0.45, b.cz], [nx, b.top + 0.6, nz], [nx, b.top - 0.4, nz], [(nx + b.cx) / 2, b.top + 0.8, (nz + b.cz) / 2]];
          if (d < 0.6 || pts.some(([x, y, z]) => world.los(ex, ey, ez, x, y, z))) { bd = d; best = b; } }
        else if (P.x > b.x0 - 0.15 && P.x < b.x1 + 0.15 && P.z > b.z0 - 0.15 && P.z < b.z1 + 0.15) { const d = Math.hypot(P.x - b.cx, P.z - b.cz) * 0.1; if (d < bd) { bd = d; best = b; } }
      }
      if (best) return { kind: 'bed', bed: best, text: best.kind === 'stall' ? '按 F 關上門躲起來' : best.kind === 'shower' ? '按 F 拉上浴簾躲起來' : '按 F 躲到床上' };
    }
    if (playable()) { let best = null, bd = 2.0; for (const d of DOORS) { if (Math.abs(P.y - d.y0) > 0.8) continue; const cx = d.cx, cz = d.cz, dd = Math.hypot(cx - P.x, cz - P.z); if (dd < bd && facing(cx, ey - 0.3, cz) > 0.35) { bd = dd; best = d; } } if (best) return { kind: 'roomdoor', door: best, text: best.open ? '按 F 關門' : '按 F 開門' }; }
    if (G.phase !== 'chase' && P.z > DOOR.z - 0.9 && Math.abs(P.x - DOOR.x) < 2.2 && P.y < 1) return { kind: 'door', text: '大門打不開……先幫他把乳清拿下來吧' };
    return null;
  }
  function interact(t) {
    if (t.kind === 'npc') talkNPC();
    else if (t.kind === 'whey') takeWhey();
    else if (t.kind === 'pot') { pot.inWorld = false; potMesh.visible = false; SFX.pickup(); addItem('pot'); toast('拿到快煮鍋：長按 F 投擲，砸中他可以讓他暈 4 秒'); }
    else if (t.kind === 'bed') hide(t.bed);
    else if (t.kind === 'door') SFX.locked();
    else if (t.kind === 'roomdoor') { const opening = !t.door.open; setDoor(t.door, !t.door.open, true); if (opening && t.door.no === 222 && !G.panDone && panMesh) panScare(t.door); }
    else if (t.kind === 'remote') { TV.remoteInWorld = false; TV.remoteMesh.visible = false; SFX.pickup(); addItem('remote'); toast('拿到電視遙控器：對著電視按 F', 3000); }
    else if (t.kind === 'tv') tvPress();
    else if (t.kind === 'hou') talkHou();
    else if (t.kind === 'drop') { const dr = t.drop; removeDrop(dr); SFX.pickup(); addItem(dr.type); if (dr.type === 'card' && (enemy.state === 'lure' || enemy.state === 'pickup')) { enemy.state = 'search'; enemy.wait = 0.5; } }
  }
  function hide(bed) {
    const seen = enemy.active && enemy.stun <= 0 && (enemy.sees || enemy.canSee(P));
    G.bed = bed; G.prevPos = { x: P.x, y: P.y, z: P.z, yaw: P.yaw }; P.hidden = true; P.running = false;
    P.yaw = bed.lookYaw; P.pitch = bed.kind === 'bed' ? -0.22 : -0.08; ui.hideFx.hidden = false;
    ui.hideFx.dataset.t = bed.kind === 'bed' ? '躲在被子裡　屏住呼吸' : bed.kind === 'stall' ? '縮在隔間裡　門縫外一片漆黑' : '躲在浴簾後　別發出聲音';
    ui.hideFx.classList.toggle('stall', bed.kind !== 'bed');
    if (bed.doorMesh) { bed.doorMesh.visible = true; SFX.click(false); }
    if (seen) enemy.huntBed(bed);
  }
  function unhide() { if (!P.hidden) return; P.hidden = false; ui.hideFx.hidden = true; if (G.bed && G.bed.doorMesh) G.bed.doorMesh.visible = false; const p = G.prevPos; P.x = p.x; P.y = p.y; P.z = p.z; G.bed = null; }

  // ---------- 道具使用（長按 F）----------
  function canUseItem() { const it = G.items[G.cur]; if (it === 'remote' || it === 'card') return false; if (it === 'cig') return (G.cigs || 0) > 0 && !P.hidden && !dlgState && !G.target && (G.boostT || 0) <= 0; if (!it || G.phase !== 'chase' && !(it === 'pot' && G.phase === 'quest')) return false; if (it === 'whey' && (G.sips !== 1)) return false; return !P.hidden && !dlgState && !G.target; }
  function useItem() {
    const it = G.items[G.cur];
    if (it === 'pot') {
      removeItem('pot'); SFX.whoosh();
      const fx = -Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * Math.cos(P.pitch);
      pot.fly = { x: P.x + fx * 0.5, y: P.y + K.EYE - 0.15 + fy * 0.5, z: P.z + fz * 0.5, vx: fx * 13, vy: fy * 13 + 2.2, vz: fz * 13, noise: false, rest: 0 };
      pot.inWorld = false; potMesh.visible = true;
    } else if (it === 'whey') secondSip();
    else if (it === 'cig') { // 抽一根：短暫加速
      G.cigs--; G.boostT = 8; try { SFX.click(true); } catch (e) { }
      toast('抽了一根……整個人精神起來了！（加速 8 秒）', 2600);
      if (G.cigs <= 0) removeItem('cig'); else renderSlots();
    }
  }
  function potStep(dt) {
    const f = pot.fly; if (!f) return; const n = 6, h = dt / n;
    for (let s = 0; s < n && pot.fly; s++) {
      const px = f.x, py = f.y, pz = f.z; f.vy -= 9.8 * h; f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
      if (enemy.active && enemy.stun <= 0 && Math.hypot(f.x - enemy.x, f.z - enemy.z) < 0.5 && f.y > enemy.y && f.y < enemy.y + 1.95) {
        if (enemy.stunFor(4)) { G.hits++; SFX.clang(f.x, f.y, f.z); SFX.stun(enemy.x, enemy.y, enemy.z); toast('砸中了！他暈過去了，快跑！', 2400); }
        f.vx *= -0.15; f.vz *= -0.15; f.vy = 1;
        continue;
      }
      const hit = world.boxAt(f.x, f.y, f.z, 0.1);
      if (hit) {
        const speed = Math.hypot(f.vx, f.vy, f.vz);
        if (py >= hit.y1 - 0.03) { f.y = hit.y1; if (Math.abs(f.vy) > 2.2) { f.vy *= -0.28; f.vx *= 0.5; f.vz *= 0.5; } else { f.vy = 0; f.vx *= 0.6; f.vz *= 0.6; if (Math.hypot(f.vx, f.vz) < 0.4) { land(); return; } } }
        else { f.x = px; f.z = pz; f.y = py; f.vx *= -0.25; f.vz *= -0.25; }
        if (speed > 2) { SFX.clang(f.x, f.y, f.z); if (!f.noise) { f.noise = true; enemy.hear(f.x, Math.max(0, f.y - 0.5), f.z); } }
      }
      if (f.y < -3) { land(); return; }
    }
    potMesh.position.set(f.x, f.y - 0.13, f.z);
  }
  function land() { const f = pot.fly; pot.x = f.x; pot.y = Math.max(f.y, 0); pot.z = f.z; pot.fly = null; pot.inWorld = true; potMesh.position.set(pot.x, pot.y, pot.z); }

  // ---------- Q：把手上的道具丟出去（拋物線、會彈跳、落地後可以再撿） ----------
  const ITEM_NAME = (t) => ({ whey: G.sips >= 2 ? '空罐' : '乳清', pot: '快煮鍋', remote: '遙控器', card: '冷氣卡' })[t] || t;
  const DROPS = [];
  function flyPhys(f, h) { // 回傳 'land' 表示停下
    const px = f.x, py = f.y, pz = f.z; f.vy -= 9.8 * h; f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h; f.spin = (f.spin || 0) + h * 8;
    const hit = world.boxAt(f.x, f.y, f.z, 0.06);
    if (hit) {
      const sp = Math.hypot(f.vx, f.vy, f.vz);
      if (py >= hit.y1 - 0.03) { f.y = hit.y1; if (Math.abs(f.vy) > 1.6) { f.vy *= -0.32; f.vx *= 0.55; f.vz *= 0.55; } else { f.vy = 0; f.vx *= 0.5; f.vz *= 0.5; if (Math.hypot(f.vx, f.vz) < 0.35) return 'land'; } }
      else { f.x = px; f.z = pz; f.y = py; f.vx *= -0.3; f.vz *= -0.3; }
      if (sp > 1.5) SFX.thud(f.x, f.y, f.z, f.type);
    }
    if (f.y < -3) return 'land';
    return null;
  }
  function makeDropMesh(type, flat) {
    const tex = TEX[type]; const h = { whey: 0.3, pot: 0.26, remote: 0.2, card: 0.1, cig: 0.12 }[type];
    if (flat && (type === 'card' || type === 'remote')) { const w = type === 'card' ? 0.17 : 0.06, l = w * tex.image.height / tex.image.width; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshPhongMaterial({ shininess: 6, specular: 0x0a0a0a,  map: tex, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0x161616, emissiveMap: tex })); m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, Math.PI * 2); scene.add(m); return m; }
    const m = billboard(tex, h, type === 'card' ? 0x222222 : 0x111111); m.userData.drop = true; return m;
  }
  function removeDrop(dr) { if (dr.mesh) scene.remove(dr.mesh); const i = DROPS.indexOf(dr); if (i >= 0) DROPS.splice(i, 1); if (G.lureDrop === dr) G.lureDrop = null; }
  function dropCurrent() {
    const it = G.items[G.cur]; if (!it || !playable() || G.paused || P.hidden || dlgState) return;
    const fx = -Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * Math.cos(P.pitch);
    const v = 5.2, start = { x: P.x + fx * 0.45, y: P.y + K.EYE - 0.25 + fy * 0.3, z: P.z + fz * 0.45 };
    if (world.pointSolid(start.x, start.y, start.z)) { start.x = P.x; start.z = P.z; }
    ui.hand.classList.add('toss'); setTimeout(() => ui.hand.classList.remove('toss'), 260); SFX.whoosh();
    removeItem(it);
    if (it === 'pot') { pot.fly = { ...start, vx: fx * v, vy: fy * v + 2.4, vz: fz * v, noise: false, rest: 0 }; pot.inWorld = false; potMesh.visible = true; return; }
    const dr = { type: it, x: start.x, y: start.y, z: start.z, fly: { ...start, vx: fx * v, vy: fy * v + 2.4, vz: fz * v, type: it }, mesh: makeDropMesh(it, false) };
    DROPS.push(dr);
  }
  function dropsStep(dt) {
    for (const dr of DROPS.slice()) {
      const f = dr.fly; if (!f) continue; const n = 5, h = dt / n; let res = null;
      for (let i = 0; i < n && !res; i++) res = flyPhys(f, h);
      dr.x = f.x; dr.y = f.y; dr.z = f.z;
      if (res === 'land') {
        dr.fly = null; dr.y = Math.max(dr.y, 0);
        if (dr.type === 'card' || dr.type === 'remote') { scene.remove(dr.mesh); dr.mesh = makeDropMesh(dr.type, true); dr.mesh.position.set(dr.x, dr.y + 0.016, dr.z); }
        else dr.mesh.position.set(dr.x, dr.y, dr.z);
        if (dr.type === 'card') toast(enemy.active ? '冷氣卡掉在地上……他會先去撿！' : '冷氣卡掉在地上', 2600);
      } else { dr.mesh.position.set(dr.x, dr.y - ({ whey: 0.15, pot: 0.13, remote: 0.1, card: 0.05 }[dr.type] || 0.1), dr.z); dr.mesh.rotation.z = Math.sin(f.spin) * 0.6; }
    }
    // 地上的冷氣卡：他會放下一切先去撿
    if (enemy.active && enemy.stun <= 0 && !G.lureDrop) { const c = DROPS.find((d) => d.type === 'card' && !d.fly); if (c) { G.lureDrop = c; enemy.lure(c.x, c.y, c.z); } }
  }

  // ---------- 輸入 ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' && G.phase === 'choice') return;
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && G.phase !== 'start') e.preventDefault();
    if (e.code === 'KeyF') {
      if (e.repeat) return;
      if (dlgState) { advanceDialog(); return; }
      if (G.phase === 'won' || G.phase === 'dead' || G.paused) return;
      if (P.hidden) { if (G.phase === 'chase' || G.phase === 'quest' || G.phase === 'intro') unhide(); return; }
      if (!playable()) return;
      if (G.target) { interact(G.target); return; }
      if (canUseItem()) { G.holding = true; G.hold = 0; }
    }
    if (e.code === 'Space' && dlgState) { advanceDialog(); return; }
    if ((e.code === 'Digit1' || e.code === 'Digit2') && G.items.length) { const i = e.code === 'Digit1' ? 0 : 1; if (G.items[i]) { G.cur = i; renderSlots(); } }
    if (e.code === 'Digit3' && G.items[2]) { G.cur = 2; renderSlots(); }
    if (e.code === 'Digit4' && G.items[3]) { G.cur = 3; renderSlots(); }
    if (e.code === 'KeyG' && !e.repeat && playable() && !G.paused) setFlash(!P.light);
    if (e.code === 'KeyQ' && !e.repeat) dropCurrent();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyF') { G.holding = false; G.hold = 0; } });
  window.addEventListener('wheel', (e) => { if (G.items.length > 1 && playable()) { G.cur = (G.cur + (e.deltaY > 0 ? 1 : G.items.length - 1)) % G.items.length; renderSlots(); } }, { passive: true });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; G.holding = false; });
  $('micSens').addEventListener('input', (e) => { MIC.sens = +e.target.value; $('micSensV').textContent = e.target.value; });
  $('btnStart').addEventListener('click', async () => { audioInit(); micStart(); await ready; ui.start.hidden = true; newGame(); });
  $('btnRetry').addEventListener('click', () => { audioInit(); newGame(); });
  $('btnAgain').addEventListener('click', () => { audioInit(); newGame(); });

  // ---------- 主迴圈 ----------
  let last = performance.now();
  function update(dt) {
    updateDoors(dt); updatePan(dt); updateZhu(dt);
    if ((G.boostT || 0) > 0 && !G.paused && !dlgState) { G.boostT -= dt; if (G.boostT <= 0) toast('菸的效果退了', 1800); }
    const active = playable() && !G.paused && !dlgState;
    // 移動
    if (active && !P.hidden) {
      let mx = 0, mz = 0; if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
      const moving = mx || mz; const want = (keys.ShiftLeft || keys.ShiftRight) && moving;
      // 體力歸零 → 進入「力竭」：只能走路，要等體力回復到 35% 才能再跑
      if (P.stamina <= 0) P.exhausted = true;
      if (P.exhausted && P.stamina >= 35) P.exhausted = false;
      P.running = !!(want && P.stamina > 0 && !P.exhausted && !ZHU.slow); // 看到竹竿時被迫用走的
      if (P.running) P.stamina = Math.max(0, P.stamina - 15 * dt); else P.stamina = Math.min(100, P.stamina + 10 * dt);
      const sp = (P.running ? 5.0 : 1.55) * // 走路放慢（探索時壓抑的步調），跑步不變（捲毛追逐的平衡）
         ((G.boostT || 0) > 0 ? 1.45 : 1) * (ZHU.slow ? 0.7 : 1);
      if (moving) {
        const l = Math.hypot(mx, mz); mx /= l; mz /= l;
        const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
        const wx = (mx * c + mz * s) * sp * dt, wz = (-mx * s + mz * c) * sp * dt;
        const n = Math.ceil(Math.hypot(wx, wz) / 0.08); G.px0 = P.x; G.pz0 = P.z;
        for (let i = 0; i < n; i++) world.move(P, wx / n, wz / n);
        if (P.grounded) { // 每一步 = 相位走過 π；腳步聲對齊頭部下沉的瞬間
          const moved = Math.hypot(P.x - G.px0, P.z - G.pz0); const stepLen = P.running ? 1.6 : 1.08; // 走路約每秒 1.4 步（慢而沉）；跑步約每秒 3 步
          const before = Math.floor((G.walk.phase - Math.PI / 2) / Math.PI); G.walk.phase += moved / stepLen * Math.PI;
          if (Math.floor((G.walk.phase - Math.PI / 2) / Math.PI) !== before) { G.walk.kick = 1; G.walk.foot = -(G.walk.foot || 1); SFX.step(P.running, Math.abs(P.y - G.lastY) > 0.05, P.y > 3 && (P.z < DORM.bathZ || (Math.abs(P.x - DORM.XS) > 2.2 && P.x - DORM.XS > -9.6 && P.z < -0.8)), false, G.walk.foot, G.walk.amp); G.lastY = P.y; }
        }
      }
      if (keys.Space && P.grounded && !dlgState) { P.vy = 4.3; P.grounded = false; }
      const wasAir = !P.grounded, vyPrev = P.vy;
      world.vertical(P, dt);
      if (wasAir && P.grounded && vyPrev < -2.5) { G.walk.land = Math.min(1, -vyPrev / 7); SFX.step(true, false, false, true); }
      // 晃動幅度平滑過渡（起步、停下、走跑切換）
      const k = 1 - Math.exp(-dt * 3.5);
      G.walk.amp += ((moving && P.grounded ? 1 : 0) - G.walk.amp) * k; G.walk.run += ((P.running && moving ? 1 : 0) - G.walk.run) * k;
      // 喘氣程度
      if (P.running) G.exert = Math.min(1, G.exert + dt * 0.2); else G.exert = Math.max(0, G.exert - dt * (moving ? 0.045 : 0.09));
      if (P.exhausted) G.exert = Math.max(G.exert, 0.85);
      if (P.y < -8) { P.x = SPAWN_X; P.y = 0; P.z = SPAWN_Z; P.vy = 0; }
    } else if (!P.hidden) { P.running = false; P.stamina = Math.min(100, P.stamina + 10 * dt); }
    else { P.running = false; P.stamina = Math.min(100, P.stamina + 10 * dt); }
    // 體力條
    ui.stamina.style.transform = `scaleX(${P.stamina / 100})`; ui.staminaWrap.classList.toggle('empty', !!P.exhausted); ui.staminaLbl.textContent = P.exhausted ? '體力耗盡 · 恢復中' : 'SHIFT 奔跑'; ui.staminaWrap.classList.toggle('low', P.stamina < 30);
    // 互動提示
    G.target = active && !P.hidden ? findTarget() : null;
    ui.prompt.textContent = P.hidden ? '躲藏中 · 按 F 離開' : G.target ? G.target.text : '';
    ui.prompt.hidden = !ui.prompt.textContent || !playable();
    // 長按使用
    if (G.holding && active && canUseItem()) {
      const need = G.items[G.cur] === 'pot' ? 0.55 : G.items[G.cur] === 'cig' ? 0.6 : 1.2; G.hold += dt; ui.ringWrap.hidden = false; ui.ring.style.strokeDashoffset = String(113 * (1 - clamp(G.hold / need, 0, 1)));
      ui.hand.classList.toggle('charge', G.items[G.cur] === 'pot'); ui.hand.classList.toggle('sip', G.items[G.cur] === 'whey');
      if (G.hold >= need) { G.holding = false; G.hold = 0; useItem(); }
    } else { ui.ringWrap.hidden = true; ui.hand.classList.remove('charge', 'sip'); if (!G.holding) G.hold = 0; }
    // 任務提示
    if (G.phase === 'quest' && !G.paused) { G.questT += dt; if (G.questT > 80 && !G.hintShown && whey.inWorld) { G.hintShown = true; toast(`他傳訊息來：「好像放在${roomLabel(G.wheyRoom)}的書桌上」`, 6000); setObjective(`到${roomLabel(G.wheyRoom)}拿乳清`); } }
    // 敵人
    micUpdate(dt);
    if (G.phase === 'chase' && !G.paused && !dlgState) { G.lightT = (G.lightT || 0) - dt; if (G.lightT <= 0) { G.lightT = 0.25; lightCheck(); } }
    if (G.phase === 'chase' && !G.paused && !dlgState) {
      const evs = enemy.update(dt, P);
      for (const ev of evs) {
        if (ev === 'spot') { SFX.sting(); toast('他看到你了！', 1600); }
        else if (ev === 'catch') { caught('floor'); break; }
        else if (ev === 'hideCatch') { caught('bed'); break; }
        else if (ev === 'lose') toast('他好像跟丟你了……', 2000);
        else if (ev === 'picked') { if (G.lureDrop) { removeDrop(G.lureDrop); toast('他撿走了冷氣卡……', 2200); } G.lureDrop = null; }
      }
      if (enemy.active && !AU.cv) chaseVoiceStart();
      chaseVoiceUpdate(enemy.active && enemy.stun <= 0 && (enemy.state === 'chase' || enemy.state === 'hunt') && !G.paused);
      if (enemy.active && enemy.moving && enemy.stun <= 0) { enemy._st = (enemy._st || 0) + dt * enemy.speed; if (enemy._st > 1.25) { enemy._st = 0; SFX.enemyStep(enemy.x, enemy.y, enemy.z, enemy.state === 'chase'); } }
      if (G.phase === 'chase' && P.z > DOOR.z + 0.7 && P.y < 1.2 && Math.abs(P.x - DOOR.x) < 3.5 && !P.hidden) escape();
    }
    potStep(dt); tvUpdate(dt); dropsStep(dt);
    // 敵人呈現
    if (enemyMesh && enemyMesh.visible) {
      const st = enemy.stun > 0; const bob = enemy.moving ? Math.abs(Math.sin(performance.now() / (enemy.state === 'chase' ? 90 : 160))) * 0.06 : 0;
      enemyMesh.position.set(enemy.x + (st ? Math.sin(performance.now() / 70) * 0.04 : 0), enemy.y + bob, enemy.z);
      enemyMesh.rotation.z = st ? Math.sin(performance.now() / 130) * 0.22 : 0;
      const fx = Math.sin(enemy.yaw), fz = Math.cos(enemy.yaw);
      // 聚光燈放在他身體中心，避免他貼牆時光源跑進牆裡、照到隔壁房間
      eSpot.position.set(enemy.x + fx * 0.12, enemy.y + 1.55, enemy.z + fz * 0.12); if (world.pointSolid(eSpot.position.x, eSpot.position.y, eSpot.position.z)) eSpot.position.set(enemy.x, enemy.y + 1.55, enemy.z); eSpot.target.position.set(enemy.x + fx * 5, enemy.y + 0.2, enemy.z + fz * 5);
      eGlow.position.set(enemy.x + fx * 0.15, enemy.y + 1.15, enemy.z + fz * 0.15);
      const base = G.sips >= 2 ? 5.6 : 4.2; const flick = st ? (Math.random() < 0.3 ? 0.2 : 0.6) : 0.9 + Math.random() * 0.12;
      if (G.phase === 'chase' || G.phase === 'dead') { eSpot.intensity = base * flick; eGlow.intensity = 1.4 * flick; }
      stunMesh.visible = st; if (st) stunMesh.position.set(enemy.x, enemy.y + 2.15 + Math.sin(performance.now() / 200) * 0.05, enemy.z);
      G.enemyDist = enemy.active ? Math.hypot(enemy.x - P.x, (enemy.y - P.y) * 1.5, enemy.z - P.z) : 99;
    } else G.enemyDist = 99;
    // 音樂混音
    if (AU.ctx) {
      const chasing = G.phase === 'chase' && (enemy.state === 'chase' || enemy.state === 'hunt') && enemy.stun <= 0;
      G.chaseMix = chasing ? 1 : Math.max(0, G.chaseMix - dt * 0.4);
      mixTo(AU.chase, G.phase === 'chase' ? G.chaseMix * 0.32 : 0, chasing ? 0.3 : 1.2);
      if (AU.bgmSrc) mixTo(AU.bgmG, (0.48 + G.chaseMix * 0.32) * (P.hidden && G.enemyDist < 8 ? 0.55 : 1), 0.9);
      mixTo(AU.hb, G.phase === 'chase' ? clamp(1.2 - G.enemyDist / 14, 0, 0.9) : 0, 0.5);
      const l = AU.ctx.listener; const cp = camera.position; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      if (l.positionX) { l.positionX.value = cp.x; l.positionY.value = cp.y; l.positionZ.value = cp.z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; } else { l.setPosition(cp.x, cp.y, cp.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
    }
    // 危險暈影
    const danger = G.phase === 'chase' ? clamp(1 - G.enemyDist / 12, 0, 1) * (P.hidden ? 0.7 : 1) : 0;
    ui.danger.style.opacity = String(danger * (0.75 + 0.25 * Math.sin(performance.now() / 180)));
  }
  const camPos = new THREE.Vector3(), fwd = new THREE.Vector3();
  function place(dt) {
    // 滑鼠輸入：每幀套用一次
    if (look.dx || look.dy) {
      if (playable() && !G.paused) {
        P.yaw -= look.dx; P.pitch = clamp(P.pitch - look.dy, -1.45, 1.45);
        if (P.hidden && G.bed) { let d = P.yaw - G.bed.lookYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; P.yaw = G.bed.lookYaw + clamp(d, -1.7, 1.7); }
      }
      look.dx = 0; look.dy = 0;
    }
    // 視角輕微平滑（約 20ms），消除不規則輸入造成的頓挫
    let dy = P.yaw - look.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const a = 1 - Math.exp(-dt * 45);
    look.yaw += dy * a; look.pitch += (P.pitch - look.pitch) * a;
    if (Math.abs(dy) > 1.2) { look.yaw = P.yaw; look.pitch = P.pitch; } // 劇情轉向時直接對齊
    // 震動：平滑的低頻噪聲（不再每幀隨機跳動）
    G.shake = Math.max(0, G.shake - dt * 0.9);
    const t = performance.now() / 1000;
    const sh = G.shake * 0.045 + (G.phase === 'chase' ? clamp(1 - G.enemyDist / 6, 0, 1) * 0.008 : 0);
    const nx = (Math.sin(t * 23.1) + Math.sin(t * 37.7 + 1.3)) * 0.5, ny = (Math.sin(t * 19.3 + 2.1) + Math.sin(t * 41.9)) * 0.5;
    if (P.hidden && G.bed) camPos.set(G.bed.cx, G.bed.camY + Math.sin(performance.now() / 900) * 0.006, G.bed.cz);
    const Wk = G.walk; let side = 0, roll = 0, tilt = 0;
    if (!(P.hidden && G.bed)) {
      const r = Wk.run, A = Wk.amp, ph = Wk.phase;
      const s2 = Math.sin(ph) * Math.sin(ph);
      Wk.kick = Math.max(0, (Wk.kick || 0) - dt * (6 + 4 * r));              // 腳落地的瞬間頭會頓一下（跟腳步聲同時）
      const kk = Wk.kick * Wk.kick;
      let up = -(r > 0.5 ? Math.pow(s2, 1.6) : s2) * (0.045 + 0.03 * r) * A;   // 每一步下沉：走路是大而慢的起伏，跑步落地更頓
      up -= kk * (0.007 + 0.014 * r) * A;
      side = Math.sin(ph) * (0.03 + 0.012 * r) * A;                         // 左右重心轉移（走路時身體會明顯左右換腳）
      roll = Math.sin(ph) * (0.008 + 0.008 * r) * A;                        // 身體側傾
      tilt = Math.sin(2 * ph) * 0.0025 * (1 - r) * A + Math.cos(2 * ph) * 0.006 * r * A + kk * (0.003 + 0.006 * r) * A; // 走路微微點頭、跑步點頭、落地往下頓
      const heave = Math.sin(t * (1.4 + G.exert * 2.6)) * (0.004 + G.exert * 0.016); // 呼吸起伏，喘越大越明顯
      Wk.land = Math.max(0, Wk.land - dt * 3.2);
      const land = -Math.sin(Math.min(1, Wk.land) * Math.PI) * 0.12 * Wk.land;
      camPos.set(P.x, P.y + K.EYE + up + heave + land, P.z);
    }
    // 跑步時視野略為拉寬
    const fov = 72 + Wk.run * 5 + G.exert * 1.5; if (Math.abs(fov - Wk.fov) > 0.01) { Wk.fov += (fov - Wk.fov) * (1 - Math.exp(-dt * 6)); camera.fov = Wk.fov; camera.updateProjectionMatrix(); }
    const rx0 = Math.cos(look.yaw), rz0 = -Math.sin(look.yaw);
    camera.position.set(camPos.x + rx0 * side + nx * sh, camPos.y + ny * sh, camPos.z + rz0 * side);
    camera.rotation.set(look.pitch + tilt + ny * sh * 0.3, look.yaw + nx * sh * 0.3, -roll + nx * sh * 0.25);
    // 手電筒：只跟著視角方向（不跟著走路晃動），光源在眼睛略下方，避免光圈亂晃造成暈眩
    fwd.set(-Math.sin(look.yaw) * Math.cos(look.pitch), Math.sin(look.pitch), -Math.cos(look.yaw) * Math.cos(look.pitch));
    flashDir.lerp(fwd, 1 - Math.exp(-dt * 30)).normalize();
    const lx = camPos.x + Math.cos(look.yaw) * 0.08, ly = camPos.y - 0.1, lz = camPos.z - Math.sin(look.yaw) * 0.08;
    flash.position.set(lx, ly, lz); flood.position.set(lx, ly, lz);
    flash.target.position.set(lx + flashDir.x * 6, ly + flashDir.y * 6, lz + flashDir.z * 6); flood.target.position.copy(flash.target.position);
    // 反射補光：找出光線打到的第一個表面，在它前面放一盞很弱的暖光
    if (P.light) {
      let hit = 9; for (let d = 0.3; d < 9; d += 0.3) { if (world.pointSolid(lx + flashDir.x * d, ly + flashDir.y * d, lz + flashDir.z * d)) { hit = d; break; } }
      const bd = Math.max(0.3, hit - 0.45); flashSpill.position.set(lx + flashDir.x * bd, ly + flashDir.y * bd, lz + flashDir.z * bd);
      const target = BOUNCE_I * clamp(1.15 - hit / 9, 0.15, 1); flashSpill.intensity += (target - flashSpill.intensity) * (1 - Math.exp(-dt * 10));
    }
    // Billboard 面向鏡頭（只轉 Y 軸）
    const cx = camera.position.x, cz = camera.position.z;
    for (const m of [npcMesh, enemyMesh, wheyMesh, potMesh, houMesh, panMesh, ...BAGS, ...(ZHU.meshes || [])]) if (m && m.visible) m.rotation.y = Math.atan2(cx - m.position.x, cz - m.position.z);
    for (const dr of DROPS) if (dr.mesh && dr.mesh.userData.drop) dr.mesh.rotation.y = Math.atan2(cx - dr.mesh.position.x, cz - dr.mesh.position.z);
    // 手上道具晃動
    ui.hand.style.visibility = P.hidden ? 'hidden' : '';
    if (!ui.hand.hidden) { const A = G.walk.amp * (1 + G.walk.run * 1.4), b = Math.sin(G.walk.phase) * 9 * A, b2 = Math.abs(Math.sin(G.walk.phase)) * 9 * A + Math.sin(performance.now() / 700) * 2; ui.hand.style.setProperty('--bx', b + 'px'); ui.hand.style.setProperty('--by', b2 + 'px'); }
  }
  // 自適應解析度：畫面卡頓時自動降低渲染解析度，讓轉向保持流暢
  let fpsAcc = 0, fpsN = 0;
  // 自動解析度：以前每 1.5 秒就可能上下切換，幀率在 45～55 之間時會一直來回跳，看起來像畫面在抖。
  // 現在：要連續 2 次（約 4 秒）太慢才降；要連續 4 次（約 8 秒）夠快、而且距離上次調整 15 秒以上才升；來回切換 2 次後就固定不再變。
  const RES = { low: 0, high: 0, lastChange: -1e9, flips: 0, lastDir: 0, locked: false };
  function adaptRes(dt) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc < 2) return;
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (RES.locked) return;
    const now = performance.now() / 1000;
    RES.low = fps < 40 ? RES.low + 1 : 0; RES.high = fps > 58 ? RES.high + 1 : 0;
    let nd = dpr, dir = 0;
    if (RES.low >= 2 && dpr > 0.6) { nd = Math.max(0.6, dpr - 0.15); dir = -1; }
    else if (RES.high >= 4 && dpr < DPR_MAX && now - RES.lastChange > 15) { nd = Math.min(DPR_MAX, dpr + 0.1); dir = 1; }
    if (nd !== dpr) {
      if (RES.lastDir && dir !== RES.lastDir) { RES.flips++; if (RES.flips >= 2) { RES.locked = true; if (dir > 0) return; } }
      RES.lastDir = dir; RES.lastChange = now; RES.low = 0; RES.high = 0; dpr = nd; renderer.setPixelRatio(dpr); resize();
    }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (npcMesh) { update(dt); place(dt); G.shF = (G.shF || 0) + 1; renderer.shadowMap.needsUpdate = eSpot.intensity > 0.01 && (G.shF % 2 === 0); renderer.render(scene, camera); adaptRes(dt); }
    requestAnimationFrame(frame);
  }
  ready.then(() => { spawnItems(); P.yaw = 0; requestAnimationFrame(frame); $('btnStart').disabled = false; $('btnStart').textContent = '開始遊戲'; });

  // 測試用
  enemy.altVia = DORM.altVia; // 晒衣場室外樓梯頂端的平台（二樓浴廁旁）
  window.__game = { ZHU, camera, SFX, audio: AU, MIC, heardNoise, lightCheck, scene, renderer, DOORS, setDoor, DORM, P, G, enemy, world, nav, L, whey, pot, newGame, tick: (n, dt) => { for (let i = 0; i < n; i++) { update(dt); place(dt); } }, setFlash, drink: drinkEvent, hide, unhide, useItem, addItem, AU: () => AU, TV, LNG, scene, renderer, flash, flood, eSpot, DROPS, HOU, dropCurrent, talkHou, findTarget: () => G.target, findTargetNow: () => findTarget(), showChoice, cam: () => camera.position, setPos: (x, y, z) => { P.x = x; P.y = y; P.z = z; } };
})();
