// ===== LOGIC (pure, no THREE) =====
// 座標：x 右、y 上、z 前(+z 朝大門)。GLB 原始為 Z-up，載入時轉成 (x, z, -y)。
export const K = { R: 0.3, STEP: 0.45, HEAD: 1.7, EYE: 1.6, CELL: 0.3, NAVR: 0.28, GRAV: 11 };

const isDoor = (n) => n.includes('房門');
const isLadder = (n) => n.includes('梯子');
const isWindow = (n) => n.includes('窗');
const isPost = (n) => n.includes('床架立柱');

// ===== 地圖放大：建築外殼水平放大 S 倍，家具維持原尺寸、整組平移 =====
export const S = 1.6;
const ANCHOR = /床墊|大廳桌面|長椅座面/;
const MEMBER = /床架立柱|上舖床板|書桌|梯子|桌腳|長椅腳/;
const KEEP = /鞋櫃|接待櫃|公告欄|洗手盆|洗手台|扶手立柱|護欄柱/;
const MIRROR = /連通樓梯_踏階|樓梯扶手立柱|樓梯頂平台_連接二樓/; // 樓梯：南北翻轉
const REMOVED = /浴室|廁所|洗手|連通樓梯_踏階|樓梯扶手立柱|樓梯頂平台_連接二樓/; // 舊浴廁改由 buildBathroom() 重建
const roomOf = (n) => (n.match(/^(.*?房)_/) || [])[1] || '';

export function readGLB(ab) {
  const dv = new DataView(ab);
  const jl = dv.getUint32(12, true);
  const j = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 20, jl)));
  const nodes = [];
  for (const n of j.nodes) {
    if (n.mesh === undefined || REMOVED.test(n.name || '')) continue;
    const a = j.accessors[j.meshes[n.mesh].primitives[0].attributes.POSITION];
    const mn = a.min, mx = a.max;
    nodes.push({ node: n, n: n.name || '', x0: mn[0], y0: mn[2], z0: -mx[1], x1: mx[0], y1: mx[2], z1: -mn[1] });
  }
  return { j, nodes, binStart: 20 + jl + 8 };
}
// 回傳每個節點的轉換：x' = x*s + dx, z' = z*s + dz
export function computeXform(nodes) {
  const cx = (b) => (b.x0 + b.x1) / 2, cz = (b) => (b.z0 + b.z1) / 2;
  const own = (b) => ({ s: 1, dx: (S - 1) * cx(b), dz: (S - 1) * cz(b) });
  const anchors = nodes.filter((b) => ANCHOR.test(b.n));
  const steps = nodes.filter((b) => /連通樓梯_踏階/.test(b.n)); const mc = steps.length ? (Math.min(...steps.map((b) => b.z0)) + Math.max(...steps.map((b) => b.z1))) / 2 * S : 0;
  const withMirror = (b, t) => MIRROR.test(b.n) ? { s: t.s, dx: t.dx, dz: 2 * mc - t.dz, mz: -1 } : { ...t, mz: 1 };
  const rd = (a, x, z) => Math.hypot(Math.max(a.x0 - x, 0, x - a.x1), Math.max(a.z0 - z, 0, z - a.z1));
  return nodes.map((b) => withMirror(b, base(b)));
  function base(b) {
    if (ANCHOR.test(b.n)) return own(b);
    if (MEMBER.test(b.n)) {
      let best = null, bd = 0.8; const x = cx(b), z = cz(b), r = roomOf(b.n);
      for (const a of anchors) { if (roomOf(a.n) !== r) continue; const d = rd(a, x, z); if (d < bd) { bd = d; best = a; } }
      return best ? own(best) : own(b);
    }
    if (KEEP.test(b.n)) return own(b);
    return { s: S, dx: 0, dz: 0 };
  }
}
export function parseGLB(ab) {
  const { nodes } = readGLB(ab);
  const X = computeXform(nodes);
  return nodes.map((b, i) => { const t = X[i]; const za = t.mz * b.z0 * t.s + t.dz, zb = t.mz * b.z1 * t.s + t.dz; return { n: b.n, x0: b.x0 * t.s + t.dx, x1: b.x1 * t.s + t.dx, z0: Math.min(za, zb), z1: Math.max(za, zb), y0: b.y0, y1: b.y1 }; });
}

// ===== 二樓浴廁區（程式生成）：西側淋浴間、中央洗手台與置物櫃、東側廁所隔間 =====
export function buildBathroom() {
  const solid = [], deco = [], spots = [];
  const F = 3.35, H = 6.35, T = 0.2;
  const C = { wall: 0x7d8a89, tile: 0x3e4647, part: 0x52707c, curtain: 0x5f6e4c, white: 0xd9d9d2, counter: 0x5d6567, mirror: 0x93aab3, locker: 0x4b5763, bench: 0x5a4636, ceil: 0x1d2122, door: 0x4a5f6b, pipe: 0x8d8d86 };
  const box = (arr, n, x0, x1, z0, z1, y0, y1, c) => { const b = { n: '浴廁_' + n, x0, x1, z0, z1, y0, y1, c }; arr.push(b); return b; };
  const W = (n, x0, x1, z0, z1, c = C.wall, y0 = F, y1 = H) => box(solid, n, x0, x1, z0, z1, y0, y1, c);
  const segs = (a, b, gaps) => { const out = []; let cur = a; for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g0 > cur) out.push([cur, g0]); cur = Math.max(cur, g1); } if (cur < b) out.push([cur, b]); return out; };
  const wallX = (n, x0, x1, z, gaps, c) => { for (const [a, b] of segs(x0, x1, gaps)) W(n, a, b, z - T / 2, z + T / 2, c); }; // 沿 x 方向的牆
  const wallZ = (n, x, z0, z1, gaps, c) => { for (const [a, b] of segs(z0, z1, gaps)) W(n, x - T / 2, x + T / 2, a, b, c); }; // 沿 z 方向的牆
  const ZS = -20.3, ZN = -40.3, XW = -14.4, XE = 14.4;
  box(solid, '地板', XW, XE, ZN, ZS + 0.25, 3.15, F, C.tile);
  box(deco, '天花板', XW - 0.2, XE + 0.2, ZN - 0.2, ZS, H, H + 0.1, C.ceil);
  wallX('北牆', XW - T, XE + T, ZN, []);
  wallZ('西牆', XW, ZN, -17.8, []);
  wallZ('東牆', XE, ZN, ZS, []);
  W('防墜牆', -20.3, XW, -17.9, -17.75);
  wallX('南牆', XW, XE, ZS, [[-2, 2], [10.4, 12.4]]);
  wallZ('淋浴區隔牆', -6, ZN, ZS, [[-23.6, -22], [-33.6, -32], [-40.1, -38.6]]);
  wallZ('廁所區隔牆', 6, ZN, ZS, [[-23.6, -22], [-34.6, -33], [-40.1, -38.6]]);
  wallX('洗手區後牆', -6, 6, -28.5, [[-1, 1], [4.1, 5.7]]);
  // --- 中央洗手台（雙面島台＋鏡子）---
  W('洗手台島', -3.6, 3.6, -24.9, -23.7, C.counter, F, F + 0.9);
  W('鏡面隔板', -3.6, 3.6, -24.36, -24.24, C.mirror, F + 0.9, F + 2.3);
  for (let i = 0; i < 5; i++) { const x = -2.8 + i * 1.4; for (const z of [-23.95, -24.65]) { box(deco, '洗手盆', x - 0.26, x + 0.26, z - 0.18, z + 0.18, F + 0.9, F + 0.97, C.white); box(deco, '水龍頭', x - 0.03, x + 0.03, (z < -24.3 ? z + 0.2 : z - 0.2) - 0.03, (z < -24.3 ? z + 0.2 : z - 0.2) + 0.03, F + 0.97, F + 1.22, C.pipe); } }
  for (const z of [-21.4, -26.8]) { box(deco, '牆面鏡', -5.88, -5.84, z - 0.6, z + 0.6, F + 1.1, F + 2.0, C.mirror); box(deco, '牆面鏡', 5.84, 5.88, z - 0.6, z + 0.6, F + 1.1, F + 2.0, C.mirror); }
  W('拖把桶', 4.6, 5.2, -27.9, -27.3, 0x5b5f3a, F, F + 0.55);
  // --- 置物櫃區 ---
  W('置物櫃', -4.5, 4.5, -31.9, -31.3, C.locker, F, F + 2.0);
  W('置物櫃', -6, 1.8, -35.3, -34.7, C.locker, F, F + 2.0);
  W('置物櫃', -1.8, 6, -38.3, -37.7, C.locker, F, F + 2.0);
  W('長椅', -3, 3, -33.5, -33.1, C.bench, F, F + 0.5);
  W('長椅', -3.5, 0.5, -36.7, -36.3, C.bench, F, F + 0.5);
  // --- 淋浴間 ---
  const shower = (x0, x1, z0, z1, open) => { // open: 'E' 開口朝 +x、'W' 朝 -x
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, front = open === 'E' ? x1 : x0, back = open === 'E' ? x0 : x1, dir = open === 'E' ? 1 : -1;
    box(deco, '蓮蓬頭', back - dir * 0.02 - 0.05, back - dir * 0.02 + 0.05, cz - 0.05, cz + 0.05, F + 1.9, F + 2.05, C.pipe);
    box(deco, '水管', back - dir * 0.05 - 0.02, back - dir * 0.05 + 0.02, cz - 0.02, cz + 0.02, F + 0.9, F + 1.95, C.pipe);
    box(deco, '浴簾桿', front - 0.02, front + 0.02, z0, z1, F + 2.05, F + 2.09, C.pipe);
    box(deco, '浴簾(開)', front - 0.03, front + 0.03, z1 - 0.42, z1 - 0.06, F + 0.12, F + 2.04, C.curtain);
    spots.push({ kind: 'shower', room: '浴室', x0: Math.min(x0, x1) + 0.05, x1: Math.max(x0, x1) - 0.05, z0: z0 + 0.05, z1: z1 - 0.05, cx: front - dir * 0.55, cz: z1 - 0.32, floor: F, camY: F + 1.3, lookYaw: open === 'E' ? -Math.PI / 2 : Math.PI / 2,
      door: { x0: front - 0.035, x1: front + 0.035, z0: z0 + 0.04, z1: z1 - 0.17, y0: F + 0.12, y1: F + 2.04, c: C.curtain } });
  };
  const part = (x0, x1, z, y0 = F, y1 = F + 2.2) => box(solid, '隔板', x0, x1, z - 0.04, z + 0.04, y0, y1, C.part);
  { const L = 1.55; for (let k = 0; k <= 10; k++) part(-14.4, -12.8, -22.4 - k * L); for (let k = 0; k < 10; k++) shower(-14.4, -12.8, -22.4 - (k + 1) * L, -22.4 - k * L, 'E'); }
  for (const [za, zb] of [[-22.4, -28.6], [-31.4, -37.6]]) {
    W('淋浴島背牆', -9.85, -9.75, zb, za, C.part, F, F + 2.2);
    const L = (za - zb) / 4; for (let k = 0; k <= 4; k++) part(-11.4, -8.2, za - k * L);
    for (let k = 0; k < 4; k++) { const z1 = za - k * L, z0 = z1 - L; shower(-11.4, -9.85, z0, z1, 'W'); shower(-9.75, -8.2, z0, z1, 'E'); }
  }
  // --- 廁所隔間 ---
  const stall = (x0, x1, z0, z1, open) => {
    const cz = (z0 + z1) / 2, front = open === 'W' ? x0 : x1, back = open === 'W' ? x1 : x0, dir = open === 'W' ? 1 : -1; // dir: 從開口往內的方向
    const bx0 = back - dir * 0.62, bx1 = back - dir * 0.04; box(solid, '馬桶', Math.min(bx0, bx1), Math.max(bx0, bx1), cz - 0.22, cz + 0.22, F, F + 0.47, C.white);
    box(deco, '水箱', Math.min(back - dir * 0.2, back - dir * 0.03), Math.max(back - dir * 0.2, back - dir * 0.03), cz - 0.25, cz + 0.25, F + 0.47, F + 0.9, C.white);
    box(deco, '門(開)', Math.min(front, front + dir * 0.85), Math.max(front, front + dir * 0.85), (open === 'W' ? z1 : z1) - 0.07, z1 - 0.03, F + 0.15, F + 2.0, C.door);
    spots.push({ kind: 'stall', room: '廁所', x0: Math.min(front, back) + 0.05, x1: Math.max(front, back) - 0.05, z0: z0 + 0.05, z1: z1 - 0.05, cx: front + dir * 0.5, cz: z1 - 0.3, floor: F, camY: F + 1.15, lookYaw: open === 'W' ? Math.PI / 2 : -Math.PI / 2,
      door: { x0: front - 0.03, x1: front + 0.03, z0: z0 + 0.04, z1: z1 - 0.16, y0: F + 0.15, y1: F + 2.0, c: C.door } });
  };
  const spart = (x0, x1, z) => box(solid, '隔間板', x0, x1, z - 0.03, z + 0.03, F + 0.15, F + 2.1, C.part);
  { const L = 1.3; for (let k = 0; k <= 12; k++) spart(12.6, 14.4, -22.4 - k * L); for (let k = 0; k < 12; k++) stall(12.6, 14.4, -22.4 - (k + 1) * L, -22.4 - k * L, 'W'); }
  for (const [za, zb] of [[-22.4, -28.9], [-31.5, -38.0]]) {
    W('廁所島背牆', 9.15, 9.25, zb, za, C.part, F, F + 2.1);
    const L = (za - zb) / 5; for (let k = 0; k <= 5; k++) spart(7.6, 10.8, za - k * L);
    for (let k = 0; k < 5; k++) { const z1 = za - k * L, z0 = z1 - L; stall(7.6, 9.15, z0, z1, 'W'); stall(9.25, 10.8, z0, z1, 'E'); }
  }
  for (const z of [-25.2, -26.2, -27.2, -36.2, -37.2]) W('小便斗', 6.1, 6.42, z - 0.2, z + 0.2, C.white, F + 0.5, F + 1.15);
  // 標示牌
  const signs = [{ x: -11.6, z: ZS + 0.12, t: '浴室', c: '#7fb2c9' }, { x: 0, z: ZS + 0.12, t: '洗手間', c: '#c9c3a8' }, { x: 11.4, z: ZS + 0.12, t: '廁所', c: '#c97f7f' }];
  // 巡邏點
  const patrol = [[0, -21.6], [-4.9, -24.3], [4.9, -24.3], [0, -30], [0, -39.3], [-12.1, -30], [-7.1, -30], [-10, -39.2], [11.7, -30], [6.9, -30], [10, -39.2]];
  return { solid, deco, spots, signs, patrol };
}

// ===== 交誼廳（樓梯上來後）→ 左轉小廳 → 宿舍走廊 =====
export function buildLounge() {
  const solid = [], deco = [];
  const F = 3.35, H = 6.35;
  const box = (arr, n, x0, x1, z0, z1, y0, y1, c) => { const b = { n: '交誼廳_' + n, x0, x1, z0, z1, y0, y1, c }; arr.push(b); return b; };
  const W = (n, x0, x1, z0, z1, c = 0x6f6a60, y0 = F, y1 = H) => box(solid, n, x0, x1, z0, z1, y0, y1, c);
  const C = { wood: 0x5a4636, sofa: 0x4b3a33, sofaD: 0x3a2c27, tv: 0x111214, rug: 0x3b2e2a, shelf: 0x3b2e24, rail: 0x8d8d86, vend: 0x6e2626 };
  // 地板
  box(solid, '地板', -20.3, -3.45, 13.9, 26.0, 3.15, 3.33, 0x4a4540);
  box(solid, '小廳地板', -3.45, 3.45, 19.0, 26.0, 3.15, 3.4, 0x4a4540);
  box(deco, '天花板', -20.5, 3.6, 13.9, 26.2, H, H + 0.1, 0x1d1b19);
  box(solid, '走廊地板', -3.42, 3.42, -20.3, 26.0, 3.3, 3.415, 0x6d726e); // 走廊磨石子地板（上面另外貼材質）
  // 牆
  W('西牆', -20.5, -20.3, 9.0, 26.2);
  W('南牆', -20.5, 3.65, 26.0, 26.2);
  W('隔牆', -3.55, -3.35, 17.0, 22.4); W('隔牆', -3.55, -3.35, 24.4, 26.0); W('門楣', -3.55, -3.35, 22.4, 24.4, 0x6f6a60, 5.6, H);
  W('小廳東牆', 3.35, 3.55, 17.0, 26.0);
  // 樓梯口欄杆（樓梯兩側與舊通道盡頭都是挑空）
  const rail = (n, x0, x1, z0, z1, y1 = F + 1.05) => { W(n, x0, x1, z0, z1, C.rail, y1 - 0.06, y1); W(n + '下緣', x0, x1, z0, z1, C.rail, F, F + 0.06); const along = (x1 - x0) > (z1 - z0); const L = along ? x1 - x0 : z1 - z0; for (let i = 0; i <= Math.ceil(L / 0.9); i++) { const t = Math.min(L, i * 0.9); along ? W(n + '柱', x0 + t - 0.03, x0 + t + 0.03, z0, z1, C.rail, F, y1) : W(n + '柱', x0, x1, z0 + t - 0.03, z0 + t + 0.03, C.rail, F, y1); } };
  // ---- 兩段式樓梯：大門進來左手邊。第一段往北上到中間平台，迴轉後第二段往南直接上到交誼廳 ----
  const r = 3.35 / 16, ZF = 13.25, T = 0.7;
  for (let k = 0; k < 8; k++) box(solid, '樓梯一段', -17.6, -14.6, ZF - (k + 1) * T, ZF - k * T, 0, (k + 1) * r, 0x5b5650);
  box(solid, '樓梯平台', -20.6, -14.6, ZF - 8 * T - 1.8, ZF - 8 * T, 0, 8 * r, 0x55504a);
  for (let k = 0; k < 8; k++) box(solid, '樓梯二段', -20.6, -17.75, ZF - 8 * T + k * T, ZF - 8 * T + (k + 1) * T, 0, (9 + k) * r, 0x5b5650);
  W('樓梯中牆', -17.75, -17.6, ZF - 8 * T, ZF, 0x6f6a60, 0, F + 1.05);
  box(solid, '樓梯頂平台', -20.6, -17.6, ZF, 14.2, 3.15, F, 0x55504a);
  for (let k = 0; k < 8; k++) box(deco, '踏階止滑條', -17.55, -14.65, ZF - (k + 1) * T + 0.02, ZF - (k + 1) * T + 0.08, (k + 1) * r, (k + 1) * r + 0.01, 0x8a8478);
  for (let k = 0; k < 8; k++) box(deco, '踏階止滑條', -20.55, -17.8, ZF - 8 * T + (k + 1) * T - 0.08, ZF - 8 * T + (k + 1) * T - 0.02, (9 + k) * r, (9 + k) * r + 0.01, 0x8a8478);
  W('樓梯西牆', -20.75, -20.6, ZF - 8 * T - 1.8, 13.47, 0x6f6a60, 0, F);
  // 二樓挑空邊的欄杆
  rail('樓梯口欄杆', -17.6, -14.5, 13.85, 13.95);
  rail('樓梯井欄杆', -14.6, -14.5, ZF - 8 * T - 1.8, 13.9);
  rail('樓梯井北欄杆', -20.6, -14.5, ZF - 8 * T - 1.85, ZF - 8 * T - 1.75);
  W('窄道封牆', -14.5, -13.6, 13.85, 13.95);
  // 北側：封住舊樓梯通道，避免從浴室那邊直接跑去樓梯間
  W('北廳封牆', -3.62, -3.42, -20.3, -12.7);
  // 家具
  W('電視櫃', -13.4, -10.6, 25.35, 25.95, C.wood, F, F + 0.55);
  W('電視', -13.3, -10.7, 25.6, 25.8, C.tv, F + 0.7, F + 2.15);
  W('長沙發座', -14.4, -9.6, 20.6, 21.5, C.sofa, F, F + 0.45); W('長沙發背', -14.4, -9.6, 20.35, 20.6, C.sofaD, F, F + 1.05);
  W('長沙發扶手', -14.6, -14.4, 20.35, 21.5, C.sofaD, F, F + 0.65); W('長沙發扶手', -9.6, -9.4, 20.35, 21.5, C.sofaD, F, F + 0.65);
  W('茶几', -13.1, -10.9, 22.6, 23.5, C.wood, F, F + 0.45);
  W('短沙發座', -17.2, -16.3, 21.4, 23.4, C.sofa, F, F + 0.45); W('短沙發背', -17.45, -17.2, 21.4, 23.4, C.sofaD, F, F + 1.05);
  W('短沙發扶手', -17.45, -16.3, 21.2, 21.4, C.sofaD, F, F + 0.65); W('短沙發扶手', -17.45, -16.3, 23.4, 23.6, C.sofaD, F, F + 0.65);
  W('書架', -20.3, -19.9, 17.6, 20.4, C.shelf, F, F + 1.95);
  W('販賣機', 2.35, 3.35, 24.6, 25.95, C.vend, F, F + 1.85);
  box(deco, '地毯', -15.2, -8.8, 19.9, 24.6, 3.333, 3.345, C.rug);
  box(deco, '立燈桿', -16.27, -16.21, 24.55, 24.61, F, F + 1.6, C.rail); box(deco, '立燈罩', -16.45, -16.03, 24.37, 24.79, F + 1.6, F + 1.9, 0x8a7b62);
  for (let i = 0; i < 4; i++) box(deco, '書', -19.88, -19.6, 17.8 + i * 0.6, 18.2 + i * 0.6, F + 0.35 + (i % 2) * 0.6, F + 0.65 + (i % 2) * 0.6, [0x6b3a2a, 0x2f4a5a, 0x5a5a3a, 0x4a2f4a][i]);
  box(deco, '販賣機面板', 2.33, 2.36, 24.75, 25.8, F + 0.9, F + 1.75, 0x9c8f7a);
  const patrol = [[-17.6, 15.2], [-9, 22.5], [0, 22.6]];
  return { solid, deco, patrol, tv: { x: -12, y: F + 1.425, z: 25.585, w: 2.4, h: 1.35 }, remote: { x: -11.7, y: F + 0.452, z: 23.0 } };
}

export class World {
  constructor(raw) {
    this.raw = raw;
    this.solid = [];
    this.sight = [];
    for (const b of raw) {
      if (isDoor(b.n) || isLadder(b.n)) continue;
      this.solid.push(b);
      const md = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
      if (!isWindow(b.n) && !isPost(b.n) && !b.n.startsWith('空氣牆') && md > 0.3) this.sight.push(b);
    }
    this.extra = []; // 大門外的地面等（由地圖提供，不參與導航）
    // 動態碰撞（NPC、未解鎖的大門）
    this.dyn = [];
  }
  // ---- 空間格（2 m 一格）：每次查詢只看附近的方塊，不再每次掃過整張地圖上千個方塊 ----
  _grid() {
    const n = this.solid.length * 7 + this.sight.length;
    if (this._g && this._g.n === n) return this._g;
    const CS = 2, solid = new Map(), sight = new Map();
    const add = (m, b) => { const i0 = Math.floor(b.x0 / CS), i1 = Math.floor(b.x1 / CS), k0 = Math.floor(b.z0 / CS), k1 = Math.floor(b.z1 / CS);
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const key = (i + 4096) * 8192 + (k + 4096); let a = m.get(key); if (!a) m.set(key, a = []); a.push(b); } };
    for (const b of this.solid) add(solid, b); for (const b of this.sight) add(sight, b);
    this._g = { n, CS, solid, sight }; this._stamp = 1; return this._g;
  }
  // 對 (x±r, z±r) 範圍內的固定方塊各呼叫一次 cb（不重複）
  _near(x, z, r, cb) {
    const g = this._grid(), CS = g.CS, st = ++this._stamp;
    const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS), k0 = Math.floor((z - r) / CS), k1 = Math.floor((z + r) / CS);
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const a = g.solid.get((i + 4096) * 8192 + (k + 4096)); if (!a) continue; for (const b of a) { if (b._s === st) continue; b._s = st; if (cb(b)) return true; } }
    return false;
  }
  _allNear(x, z, r, cb) {
    if (this._near(x, z, r, cb)) return;
    for (const b of this.extra) if (cb(b)) return;
    for (const b of this.dyn) if (b.on !== false && cb(b)) return;
  }
  _all(cb) {
    for (const b of this.solid) cb(b);
    for (const b of this.extra) cb(b);
    for (const b of this.dyn) if (b.on !== false) cb(b);
  }
  blocked(x, z, feet, r = K.R) {
    const lo = feet + K.STEP, hi = feet + K.HEAD, r2 = r * r;
    let hit = false;
    this._allNear(x, z, r + 0.05, (b) => {
      if (b.y1 <= lo || b.y0 >= hi) return false;
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dz = Math.max(b.z0 - z, 0, z - b.z1);
      if (dx * dx + dz * dz < r2) { hit = true; return true; }
      return false;
    });
    return hit;
  }
  // 拋出去的東西：找第一個碰到的方塊（含邊距 m）
  boxAt(x, y, z, m) {
    const f = (b) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m && y > b.y0 && y < b.y1 + 0.02;
    let hit = null; this._near(x, z, m, (b) => { if (f(b)) { hit = b; return true; } return false; }); if (hit) return hit;
    for (const b of this.extra) if (f(b)) return b; return null;
  }
  pointSolid(x, y, z) { return this._near(x, z, 0, (b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1); }
  blockedNav(x, z, h, r) {
    const lo = h + 0.4, hi = h + K.HEAD, r2 = r * r;
    return this._near(x, z, r + 0.05, (b) => {
      if (b.y1 <= lo || b.y0 >= hi) return false;
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dz = Math.max(b.z0 - z, 0, z - b.z1);
      return dx * dx + dz * dz < r2;
    });
  }
  ground(x, z, feet, maxUp = K.STEP) {
    let best = -Infinity;
    const lim = feet + maxUp + 0.001;
    this._allNear(x, z, 0.06, (b) => {
      if (b.y1 > lim || b.y1 <= best) return false;
      if (x < b.x0 - 0.04 || x > b.x1 + 0.04 || z < b.z0 - 0.04 || z > b.z1 + 0.04) return false;
      best = b.y1; return false;
    });
    return best;
  }
  // 水平移動（分軸滑牆）
  move(p, dx, dz) {
    const nx = p.x + dx;
    if (!this.blocked(nx, p.z, p.y)) p.x = nx;
    const nz = p.z + dz;
    if (!this.blocked(p.x, nz, p.y)) p.z = nz;
  }
  // 垂直（重力、站階、跳躍）
  vertical(p, dt) {
    p.vy -= K.GRAV * dt;
    let ny = p.y + p.vy * dt;
    const g = this.ground(p.x, p.z, p.y);
    if (p.grounded && p.vy <= 0 && g > -Infinity && p.y - g <= 0.45) {
      ny = g; p.vy = 0; // 下樓梯貼地
    } else if (ny <= g) {
      ny = g; p.vy = 0; p.grounded = true;
    } else {
      p.grounded = false;
    }
    if (p.vy > 0) { // 撞頭
      const top0 = p.y + K.HEAD, top1 = ny + K.HEAD;
      let hit = false;
      this._allNear(p.x, p.z, 0, (b) => { if (b.y0 >= top0 - 0.01 && b.y0 <= top1 && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) { hit = true; return true; } return false; });
      if (hit) { p.vy = 0; ny = p.y; }
    }
    p.y = ny;
    if (p.grounded && p.vy <= 0 && g === -Infinity) p.grounded = false;
  }
  // 線段與不透明物體是否相交（視線）：沿著線段經過的格子逐格檢查
  _segBox(b, ax, ay, az, dx, dy, dz) {
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (ax < b.x0 || ax > b.x1) return false; }
    else { let a = (b.x0 - ax) / dx, c = (b.x1 - ax) / dx; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false; }
    if (Math.abs(dy) < 1e-9) { if (ay < b.y0 || ay > b.y1) return false; }
    else { let a = (b.y0 - ay) / dy, c = (b.y1 - ay) / dy; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false; }
    if (Math.abs(dz) < 1e-9) { if (az < b.z0 || az > b.z1) return false; }
    else { let a = (b.z0 - az) / dz, c = (b.z1 - az) / dz; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false; }
    return true;
  }
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    for (const b of this.dyn) if (b.sight && b.on !== false && this._segBox(b, ax, ay, az, dx, dy, dz)) return false;
    const g = this._grid(), CS = g.CS, st = ++this._stamp;
    let i = Math.floor(ax / CS), k = Math.floor(az / CS); const ie = Math.floor(bx / CS), ke = Math.floor(bz / CS);
    const si = dx > 0 ? 1 : -1, sk = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) < 1e-12 ? Infinity : CS / Math.abs(dx), tdz = Math.abs(dz) < 1e-12 ? Infinity : CS / Math.abs(dz);
    let tmx = Math.abs(dx) < 1e-12 ? Infinity : ((si > 0 ? (i + 1) * CS - ax : ax - i * CS) / Math.abs(dx));
    let tmz = Math.abs(dz) < 1e-12 ? Infinity : ((sk > 0 ? (k + 1) * CS - az : az - k * CS) / Math.abs(dz));
    for (let guard = 0; guard < 4000; guard++) {
      const a = g.sight.get((i + 4096) * 8192 + (k + 4096));
      if (a) for (const b of a) { if (b._s === st) continue; b._s = st; if (this._segBox(b, ax, ay, az, dx, dy, dz)) return false; }
      if (i === ie && k === ke) break;
      if (tmx < tmz) { if (tmx > 1) break; i += si; tmx += tdx; } else { if (tmz > 1) break; k += sk; tmz += tdz; }
    }
    return true;
  }
}

// ===== 導航格（由場景碰撞盒自動生成）=====
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export class Nav {
  constructor(world, start) {
    const C = K.CELL, R = K.NAVR;
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    for (const b of world.solid) { if (b.y1 > 4.6) continue; bx0 = Math.min(bx0, b.x0); bx1 = Math.max(bx1, b.x1); bz0 = Math.min(bz0, b.z0); bz1 = Math.max(bz1, b.z1); }
    this.C = C; this.x0 = Math.floor(bx0) - 1; this.z0 = Math.floor(bz0) - 1;
    this.nx = Math.ceil((bx1 - this.x0 + 1) / C); this.nz = Math.ceil((bz1 - this.z0 + 1) / C);
    const { nx, nz } = this;
    const solid = world.solid;
    // 依格子分桶，加速
    const buckets = new Map();
    for (const b of solid) {
      const i0 = Math.max(0, Math.floor((b.x0 - this.x0) / C)), i1 = Math.min(nx - 1, Math.floor((b.x1 - this.x0) / C));
      const k0 = Math.max(0, Math.floor((b.z0 - this.z0) / C)), k1 = Math.min(nz - 1, Math.floor((b.z1 - this.z0) / C));
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const key = i * nz + k; let a = buckets.get(key); if (!a) buckets.set(key, a = []); a.push(b); }
    }
    const cand = new Map(); // cell -> heights
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = this.x0 + C * i, z = this.z0 + C * k;
      const bs = buckets.get(i * nz + k); if (!bs) continue;
      const tops = [];
      for (const b of bs) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 > -0.3 && b.y1 < 4.6) tops.push(Math.round(b.y1 * 100) / 100);
      tops.sort((a, b) => a - b);
      const kept = [];
      for (const h of tops) { if (kept.length && h - kept[kept.length - 1] < 0.15) kept[kept.length - 1] = h; else if (!kept.length || h !== kept[kept.length - 1]) kept.push(h); }
      const ok = kept.filter((h) => !world.blockedNav(x, z, h, R));
      if (ok.length) cand.set(i * nz + k, ok);
    }
    this.cand = cand;
    const dh = 0.41;
    const near = (i, k, h) => { const a = cand.get(i * nz + k); if (!a) return null; for (const hh of a) if (Math.abs(hh - h) <= dh) return hh; return null; };
    const key = (i, k, h) => (i * nz + k) * 200 + Math.round(h * 20);
    // 找起點
    let st = null, bd = 1e9;
    for (const [ck, hs] of cand) { const i = Math.floor(ck / nz), k = ck % nz; for (const h of hs) { const d = (this.x0 + C * i - start.x) ** 2 + (this.z0 + C * k - start.z) ** 2 + (h - start.y) ** 2 * 4; if (d < bd) { bd = d; st = [i, k, h]; } } }
    // BFS
    const seen = new Map(); const q = [st]; seen.set(key(...st), st);
    while (q.length) {
      const [i, k, h] = q.pop();
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue;
        const i2 = i + di, k2 = k + dk; if (i2 < 0 || k2 < 0 || i2 >= nx || k2 >= nz) continue;
        const h2 = near(i2, k2, h); if (h2 === null) continue;
        if (di && dk) { if (near(i + di, k, h) === null || near(i, k + dk, h) === null) continue; }
        const kk = key(i2, k2, h2); if (!seen.has(kk)) { const n = [i2, k2, h2]; seen.set(kk, n); q.push(n); }
      }
    }
    // 建節點
    this.nodes = []; this.cellNodes = new Map(); const idOf = new Map();
    for (const [kk, [i, k, h]] of seen) { const id = this.nodes.length; this.nodes.push({ x: this.x0 + C * i, z: this.z0 + C * k, h, i, k }); idOf.set(kk, id); const ck = i * nz + k; let a = this.cellNodes.get(ck); if (!a) this.cellNodes.set(ck, a = []); a.push(id); }
    this.adj = this.nodes.map(() => []);
    this.nodes.forEach((n, id) => {
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue;
        const a = this.cellNodes.get((n.i + di) * nz + (n.k + dk)); if (!a) continue;
        for (const id2 of a) { const m = this.nodes[id2]; if (Math.abs(m.h - n.h) > dh) continue; if (di && dk) { if (near(n.i + di, n.k, n.h) === null || near(n.i, n.k + dk, n.h) === null) continue; } this.adj[id].push(id2); }
      }
    });
  }
  nearest(x, z, y, maxDy = 1.6) {
    const C = this.C; const ci = Math.round((x - this.x0) / C), ck = Math.round((z - this.z0) / C);
    for (let rad = 1; rad <= 14; rad++) {
      let best = -1, bd = 1e9;
      for (let di = -rad; di <= rad; di++) for (let dk = -rad; dk <= rad; dk++) {
        if (Math.max(Math.abs(di), Math.abs(dk)) !== rad) continue;
        const a = this.cellNodes.get((ci + di) * this.nz + (ck + dk)); if (!a) continue;
        for (const id of a) { const n = this.nodes[id]; const dy = Math.abs(n.h - y); if (dy > maxDy) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2 + dy * dy * 4; if (d < bd) { bd = d; best = id; } }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  path(from, to) {
    if (from < 0 || to < 0) return null;
    if (from === to) return [to];
    const N = this.nodes; const g = new Map([[from, 0]]); const came = new Map(); const open = new Heap(); const closed = new Set();
    const hh = (id) => { const n = N[id], t = N[to]; return Math.hypot(n.x - t.x, n.z - t.z, (n.h - t.h) * 2); };
    open.push(hh(from), from);
    while (open.size) {
      const [, cur] = open.pop();
      if (cur === to) { const p = [cur]; let c = cur; while (came.has(c)) { c = came.get(c); p.push(c); } return p.reverse(); }
      if (closed.has(cur)) continue; closed.add(cur);
      const n = N[cur];
      for (const nb of this.adj[cur]) {
        if (closed.has(nb)) continue;
        const m = N[nb]; const ng = g.get(cur) + Math.hypot(m.x - n.x, m.z - n.z, (m.h - n.h));
        if (ng < (g.get(nb) ?? 1e9)) { g.set(nb, ng); came.set(nb, cur); open.push(ng + hh(nb), nb); }
      }
    }
    return null;
  }
}

// ===== 場景資訊：書桌 / 床 / 房門 / 巡邏點 =====
export function buildLayout(world, nav, extraSpots = [], extraPatrol = [], xs = 0) { // xs：宿舍走廊中心線的 x（用來判斷東西側）
  const desks = [], beds = [], doors = [];
  for (const b of world.raw) {
    const room = (b.n.match(/^(二樓_\d{3}房)/) || [])[1];
    if (b.n.includes('書桌') && !b.n.includes('抽屜') && room) {
      desks.push({ room, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, top: b.y1, floor: b.y1 - 0.8, name: b.n });
    } else if (b.n.includes('床墊') && room) {
      beds.push({ room, name: b.n, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, top: b.y1, floor: 3.4, side: (b.x0 + b.x1) / 2 > xs ? 1 : -1 });
    } else if (b.n.includes('門框上緣') && room) {
      doors.push({ room, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, side: (b.x0 + b.x1) / 2 > xs ? 1 : -1 });
    }
  }
  const nearNodeDist = (x, z, y, maxD) => { // 附近是否有可到達節點
    let best = 1e9;
    const C = nav.C, ci = Math.round((x - nav.x0) / C), ck = Math.round((z - nav.z0) / C), rr = Math.ceil(maxD / C) + 1;
    for (let di = -rr; di <= rr; di++) for (let dk = -rr; dk <= rr; dk++) {
      const a = nav.cellNodes.get((ci + di) * nav.nz + (ck + dk)); if (!a) continue;
      for (const id of a) { const n = nav.nodes[id]; if (Math.abs(n.h - y) > 0.3) continue; best = Math.min(best, Math.hypot(n.x - x, n.z - z)); }
    }
    return best;
  };
  const usableDesks = desks.filter((d) => nearNodeDist(d.x, d.z, d.floor, 1.5) <= 1.4);
  const rectDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
  const usableBeds = beds.filter((b) => {
    const C = nav.C; let ok = false;
    for (let x = b.x0 - 1.2; x <= b.x1 + 1.2 && !ok; x += C) for (let z = b.z0 - 1.2; z <= b.z1 + 1.2; z += C) { if (rectDist(b, x, z) <= 0.9 && nearNodeDist(x, z, 3.4, 0.2) <= 0.2) { ok = true; break; } }
    return ok;
  });
  for (const b of usableBeds) { b.kind = 'bed'; b.lookYaw = b.side > 0 ? Math.PI / 2 : -Math.PI / 2; b.camY = b.top + 0.34; }
  for (const sp of extraSpots) { // 浴廁躲藏點：隔間內要有可站立的導航點
    if (nearNodeDist((sp.x0 + sp.x1) / 2, (sp.z0 + sp.z1) / 2, sp.floor, 0.9) <= 0.7) usableBeds.push(sp);
  }
  // 巡邏點（由地圖提供）
  const raw = extraPatrol.map((p) => Array.isArray(p) ? { x: p[0], z: p[1], y: 3.4 } : p);
  const waypoints = [];
  for (const w of raw) { const id = nav.nearest(w.x, w.z, w.y, 0.8); if (id >= 0) { const n = nav.nodes[id]; waypoints.push({ id, x: n.x, z: n.z, y: n.h, f: n.h > 1.5 ? 1 : 0, last: -1e9 }); } }
  return { desks, usableDesks, beds, usableBeds, doors, waypoints, rectDist };
}

// ===== 敵人 AI =====
export class Enemy {
  constructor(world, nav, layout) { this.w = world; this.nav = nav; this.L = layout; this.reset(); }
  reset() {
    this.active = false; this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.state = 'off';
    this.speedMul = 1; this.stun = 0; this.stunImmune = 0; this.path = null; this.pi = 0; this.wait = 0;
    this.rush = false; this.lostT = 0; this.lastSeen = null; this.senseT = 0; this.repathT = 0; this.sees = false; this.hideBed = null; this.t = 0; this.moving = false; this.resumeState = 'search';
    this.noise = null; this.losAge = 99;
    for (const w of this.L.waypoints) w.last = -1e9;
  }
  activate(x, y, z) { this.active = true; this.x = x; this.y = y; this.z = z; this.state = 'search'; this.path = null; this.wait = 0; this.pickWaypoint(0); }
  get speed() {
    const m = this.speedMul;
    if (this.state === 'chase' || this.state === 'hunt') return 4.5 * m;
    if (this.state === 'investigate') return (this.rush ? 4.6 : 2.7) * m;
    if (this.state === 'roomsearch') return 2.9 * m;
    if (this.state === 'lure') return 4.2 * m;
    return 1.75 * m; // 巡視：慢慢走
  }
  stunFor(t) { if (this.stunImmune > 0 || !this.active) return false; this.stun = t; this.stunImmune = t + 1.6; return true; }
  hear(x, y, z) { if (!this.active || this.state === 'chase' || this.state === 'hunt' || this.stun > 0) return; this.noise = { x, y, z }; this.state = 'investigate'; this.wait = 0; this.goTo(x, y, z); }
  goTo(x, y, z) {
    const a = this.nav.nearest(this.x, this.z, this.y, 2.2), b = this.nav.nearest(x, z, y, 2.2);
    this.path = null;
    // 上下樓換路線：不是在追人時，約 45% 的機率改走晒衣場的室外樓梯（從二樓浴廁那邊上下），其他時候走一般的主樓梯
    const V = this.altVia, crossFloor = Math.abs(y - this.y) > 1.5;
    const pAlt = this.rushVia === 'yard' ? 1 : this.rushVia === 'main' ? 0 : (!this.rush && this.state !== 'chase' && this.state !== 'hunt' ? 0.45 : 0);
    if (V && crossFloor && Math.random() < pAlt) {
      const v = this.nav.nearest(V.x, V.z, V.y, 2.2); const p1 = v != null ? this.nav.path(a, v) : null, p2 = p1 ? this.nav.path(v, b) : null;
      if (p1 && p2) { this.path = p1.concat(p2.slice(1)); this.viaYard = true; }
    }
    if (!this.path) { this.path = this.nav.path(a, b); this.viaYard = false; }
    this.pi = 0;
    if (this.path && this.path.length > 1) this.pi = 1;
  }
  // 巡視：偏好附近、很久沒去過、和玩家同一層的地點，看起來像在逐區搜查
  pickWaypoint(playerY) {
    const W = this.L.waypoints; if (!W.length) return;
    const pf = playerY > 1.5 ? 1 : 0;
    let best = null, bs = -1e9;
    for (const w of W) {
      const d = Math.hypot(w.x - this.x, w.z - this.z) + Math.abs(w.y - this.y) * 6;
      if (d < 1.5) continue;
      const since = Math.min(320, this.t - w.last);
      const sc = since * 0.075 + (w.f === pf ? 6 : 0) - d * 0.22 + Math.random() * 3;
      if (sc > bs) { bs = sc; best = w; }
    }
    if (!best) best = W[(Math.random() * W.length) | 0];
    this.target = best; this.goTo(best.x, best.y, best.z);
    if (!this.path) { best.last = this.t; this.wait = 0.5; }
  }
  // 冷氣卡掉在地上：不管在做什麼都先去撿
  lure(x, y, z) { this.state = 'lure'; this.rush = false; this.hideBed = null; this.lurePos = { x, y, z }; this.wait = 0; this.goTo(x, y, z); }
  // 聽到寢室裡有聲音：照順序一間一間走到門口 → 開門走進去看一下 → 下一間
  searchRooms(list) { if (!this.active || this.state === 'chase' || this.state === 'hunt') return; this.state = 'roomsearch'; this.rq = list.slice(0, 4); this.rqi = 0; this.rqPhase = 'go'; this.wait = 0; this.rush = false; this.target = null; const r = this.rq[0]; if (r) this.goTo(r.out.x, r.out.y, r.out.z); }
  rushTo(x, y, z) { this.state = 'investigate'; this.rush = true; this.target = null; this.wait = 0; this.rushVia = Math.random() < 0.5 ? 'yard' : 'main'; this.goTo(x, y, z); this.rushVia = null; } // 喝下乳清：直接衝上樓（一半機率從晒衣場的室外樓梯、浴廁那邊上去）
  walkTo(x, y, z) { this.state = 'search'; this.target = null; this.wait = 0; this.goTo(x, y, z); }
  follow(dt, speed) {
    if (!this.path || this.pi >= this.path.length) { this.moving = false; return true; }
    const n = this.nav.nodes[this.path[this.pi]];
    const dx = n.x - this.x, dz = n.z - this.z; const d = Math.hypot(dx, dz); const step = speed * dt;
    if (d > 0.001) {
      const ty = Math.atan2(dx, dz); let da = ty - this.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      this.yaw += da * Math.min(1, dt * 9);
    }
    if (d <= step) { this.x = n.x; this.z = n.z; this.pi++; } else { this.x += dx / d * step; this.z += dz / d * step; }
    this.y += (n.h - this.y) * Math.min(1, dt * 10);
    this.moving = true;
    return this.pi >= this.path.length;
  }
  canSee(P) {
    const dx = P.x - this.x, dz = P.z - this.z; const dist = Math.hypot(dx, dz);
    if (dist > (P.light === false ? 11 : 30) * (P.crouch ? 0.7 : 1) || Math.abs(P.y - this.y) > 4) return false; // 蹲著比較難被看到（看得到的距離短、矮的東西擋得住）
    if (dist > 2.2) { const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); const dot = (fx * dx + fz * dz) / dist; if (dot < 0.42) return false; }
    return this.w.los(this.x, this.y + 1.55, this.z, P.x, P.y + (P.crouch ? 0.85 : 1.5), P.z);
  }
  // P: {x,y,z,hidden,running}；回傳事件陣列 'spot','lose','catch','hideCatch'
  update(dt, P) {
    const ev = [];
    if (!this.active) return ev;
    this.t += dt; this.stunImmune = Math.max(0, this.stunImmune - dt);
    if (this.stun > 0) { this.stun -= dt; this.moving = false; if (this.stun <= 0) { this.stun = 0; if (this.state === 'chase' || this.state === 'hunt') { this.repathT = 0; } } return ev; }
    // 感知
    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.12;
      this.sees = !P.hidden && this.state !== 'lure' && this.state !== 'pickup' && this.canSee(P);
      if (this.sees) {
        this.lastSeen = { x: P.x, y: P.y, z: P.z }; this.lostT = 0;
        if (this.state !== 'chase' && this.state !== 'hunt') { this.state = 'chase'; this.repathT = 0; ev.push('spot'); }
      } else if (!P.hidden && P.running && this.state !== 'chase' && this.state !== 'hunt') {
        const d = Math.hypot(P.x - this.x, P.z - this.z);
        if (d < 10 && Math.abs(P.y - this.y) < 1.5) this.hear(P.x, P.y, P.z);
      }
    }
    // 抓捕
    if (!P.hidden) {
      const d = Math.hypot(P.x - this.x, P.z - this.z);
      if (d < 1.0 && Math.abs(P.y - this.y) < 1.2 && (d < 0.7 || this.w.los(this.x, this.y + 1.3, this.z, P.x, P.y + 1.3, P.z))) { ev.push('catch'); return ev; }
    }
    // 躲藏被看到 → 直奔床鋪
    if (this.hideBed && this.state === 'hunt') {
      const b = this.hideBed;
      if (this.L.rectDist(b, this.x, this.z) <= 1.15 && Math.abs(this.y - b.floor) < 0.8) { ev.push('hideCatch'); return ev; }
      if (!P.hidden) { this.hideBed = null; this.state = this.sees ? 'chase' : 'search'; }
    }
    switch (this.state) {
      case 'lure': {
        const lp = this.lurePos; const done = this.follow(dt, this.speed);
        if (done || (Math.hypot(this.x - lp.x, this.z - lp.z) < 0.9 && Math.abs(this.y - lp.y) < 1.2)) { this.state = 'pickup'; this.wait = 2.4; this.moving = false; }
        else if (!this.path) { this.state = 'search'; this.wait = 0.5; }
        break;
      }
      case 'pickup': {
        this.wait -= dt; this.moving = false; this.yaw += Math.sin(this.t * 3) * dt;
        if (this.wait <= 0) { ev.push('picked'); this.state = 'search'; this.wait = 1.2; this.lastSeen = null; }
        break;
      }
      case 'search': {
        if (this.wait > 0) { this.wait -= dt; this.moving = false; this.yaw = (this.lookBase ?? this.yaw) + Math.sin(this.t * 1.3) * 1.1; if (this.wait <= 0) this.pickWaypoint(P.y); break; }
        const done = this.follow(dt, this.speed);
        if (done) { if (this.target) this.target.last = this.t; this.wait = 1.6 + Math.random() * 2.2; this.lookBase = this.yaw; }
        break;
      }
      case 'investigate': {
        if (this.wait > 0) { this.wait -= dt; this.moving = false; this.yaw += Math.sin(this.t * 2.1) * dt * 1.5; if (this.wait <= 0) { this.state = 'search'; this.pickWaypoint(P.y); } break; }
        const done = this.follow(dt, this.speed); if (done) { this.wait = 2.2; this.rush = false; }
        break;
      }
      case 'chase': {
        this.repathT -= dt;
        if (this.sees) {
          if (this.repathT <= 0) { this.repathT = 0.25; this.goTo(P.x, P.y, P.z); }
          this.follow(dt, this.speed);
        } else if (!P.hidden) {
          // 被他發現後就不會跟丟：只要你沒有趁他看不到時躲進可以躲的地方，他一直知道你在哪
          this.lastSeen = { x: P.x, y: P.y, z: P.z }; this.lostT = 0;
          if (this.repathT <= 0) { this.repathT = 0.35; this.goTo(P.x, P.y, P.z); }
          this.follow(dt, this.speed);
        } else {
          this.lostT += dt;
          if (this.lastSeen && this.repathT <= 0) { this.repathT = 0.6; this.goTo(this.lastSeen.x, this.lastSeen.y, this.lastSeen.z); }
          const done = this.follow(dt, this.speed);
          if (done) { this.moving = false; this.yaw += Math.sin(this.t * 2.4) * dt * 2.2; }
          if (this.lostT > 7) { this.state = 'search'; this.wait = 0.5; this.lastSeen = null; ev.push('lose'); }
        }
        break;
      }
      case 'roomsearch': {
        const r = this.rq && this.rq[this.rqi];
        if (!r) { this.state = 'search'; this.wait = 1.0; ev.push('roomsDone'); break; }
        if (this.wait > 0) { this.wait -= dt; this.moving = false; this.yaw = (this.lookBase ?? this.yaw) + Math.sin(this.t * 1.7) * 0.9;
          if (this.wait <= 0) { this.rqi++; this.rqPhase = 'go'; const nr = this.rq[this.rqi]; if (nr) this.goTo(nr.out.x, nr.out.y, nr.out.z); } break; }
        const done = this.follow(dt, this.speed);
        if (done || !this.path) {
          if (this.rqPhase === 'go') { this.rqPhase = 'enter'; this.goTo(r.in.x, r.in.y, r.in.z); ev.push('openRoom:' + r.no); }
          else { this.rqPhase = 'look'; this.wait = 1.5; this.lookBase = this.yaw; }
        }
        break;
      }
      case 'hunt': {
        this.repathT -= dt;
        if (this.repathT <= 0) { this.repathT = 0.5; const b = this.hideBed; this.goTo(b.cx, b.floor, b.cz); }
        this.follow(dt, this.speed);
        break;
      }
    }
    return ev;
  }
  // 玩家在敵人視線內躲進床鋪
  huntBed(bed) { this.hideBed = bed; this.state = 'hunt'; this.repathT = 0; this.wait = 0; }
}
