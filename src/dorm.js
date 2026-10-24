// ===== 宿舍地圖（依平面圖程式生成）=====
// 座標：x 右（東）、y 上、z 前（南，朝大門）。二樓走廊中心線 x = 0。
// 一樓：大廳（沙發區、宿管室、上鎖的房間）＋西側走道＋西南角樓梯（斜向梯段→中間平台→沿西牆上二樓；往三樓的梯段用空氣牆擋住）
// 二樓：樓梯上來是交誼廳（北側大陽台、南側落地窗與沙發區）→ 東端左轉走廊 → 北端浴室廁所
// 有細緻模型（props）的物件：方塊只當碰撞、不畫出來
const NO_DRAW = /^(大廳_(沙發|茶几|桌巾|盆栽)|交誼廳_(長|雙人|三人)沙發|交誼廳_茶几|交誼廳_飲水機|浴廁_飲水機|浴廁_蹲式馬桶|浴廁_洗衣機|中庭_曬衣桿|中庭_草地|浴廁_小便斗(?!區)|浴廁_感應器|中庭_冷氣室外機|_小冰箱)/;
export function buildDorm() {
  const solid = [], deco = [], spots = [], patrol = [], lights = [], signs = [], terrazzo = [], diag = [], rots = [], prisms = [], doors = [], beams = [], tplanes = [], sprisms = [], fogs = [], props = [], notes = []; let fallDoor = null; // props：細緻模型（main 用 props.js 畫；方塊只留碰撞，見 NO_DRAW）
  const F = 3.35, H2 = F + 4.0, F3 = H2 + 0.2, TOP = F3 + 3.0; // 二樓地坪、二樓天花板、三樓地坪、樓梯間頂
  const C = {
    wall: 0xcbc0aa, wallR: 0xbab4ad, wallL: 0xc4bcae, floorR: 0x9a9287, corr: 0x6a6258, slab: 0x777b7d, ceil: 0x2c2a26, skirt: 0x161412,
    step: 0x8a8580, land: 0x7a7672, rail: 0x5e6368, bedB: 0x918070, mat: 0xacada5, post: 0x646d74, desk: 0x947154, shoe: 0x9f8d7c,
    door: 0xb7a388, doorF: 0x54473a, frame: 0x4a3f35, glass: 0x7e9da6, frost: 0xc9ccc4, lobbyF: 0x9a9287, board: 0x677664, bench: 0x8d6b4c, benchL: 0x61686f,
    tile: 0x8d908f, tileW: 0xe3e3dd, stall: 0xc9a47c, stallF: 0x9a9c9a, white: 0xd9d9d2, strip: 0xb8642c, pipe: 0x8d8b84, mirror: 0x93aab3,
    rattan: 0x9c7148, rattanD: 0x7a5434, glassT: 0x9fb3b0, tv: 0x111214, disp: 0x8a8f94, red: 0xb3201c, black: 0x161616, lamp: 0xe8e4d8, tray: 0x8a877f, paper: 0xd8d4c6,
    sofa: 0x5b4a3e, sofaD: 0x45372d, table: 0x6e5a46,
  };
  const box = (arr, n, x0, x1, z0, z1, y0, y1, c) => { const b = { n, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, c }; arr.push(b); return b; };
  const S_ = (n, x0, x1, z0, z1, y0, y1, c) => box(solid, n, x0, x1, z0, z1, y0, y1, c);
  const D_ = (n, x0, x1, z0, z1, y0, y1, c) => box(deco, n, x0, x1, z0, z1, y0, y1, c);
  const segs = (a, b, gaps) => { const out = []; let cur = a; for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g0 > cur) out.push([cur, g0]); cur = Math.max(cur, g1); } if (cur < b) out.push([cur, b]); return out; };
  const wallX = (n, x0, x1, z, t, y0, y1, gaps = [], c = C.wall) => { for (const [a, b] of segs(x0, x1, gaps)) S_(n, a, b, z - t / 2, z + t / 2, y0, y1, c); };
  const wallZ = (n, x, z0, z1, t, y0, y1, gaps = [], c = C.wall) => { for (const [a, b] of segs(z0, z1, gaps)) S_(n, x - t / 2, x + t / 2, a, b, y0, y1, c); };
  const air = (n, x0, x1, z0, z1, y0, y1) => S_('空氣牆_' + n, x0, x1, z0, z1, y0, y1, 0);
  const extinguisher = (x, z, y, nx) => { // Ⓒ 滅火器（貼牆放地上）
    const ox = x + nx * 0.12; D_('滅火器', ox - 0.08, ox + 0.08, z - 0.08, z + 0.08, y, y + 0.5, C.red); D_('滅火器握把', ox - 0.05, ox + 0.05, z - 0.05, z + 0.05, y + 0.5, y + 0.6, C.black);
  };
  const emergencyLight = (x, y, z, nx, nz) => lights.push({ x, y, z, nx, nz }); // Ⓔ 緊急照明燈

  // ---------- 平面圖換算 ----------
  const XC = 2.5, WT = 0.15, XE = XC + 9.5; // 走廊半寬（走廊 5 m）、牆厚、寢室外牆
  // 二樓平面圖：x 每像素 0.032 m（東端對齊走廊西牆）、z 每像素 0.04 m
  const PX = (px) => -XC - (1068 - px) * 0.032, PZ = (py) => 4.6 + (py - 1275) * 0.04;
  const ZN1 = PZ(1275), ZB = PZ(1400), ZC = PZ(1540), ZEND = PZ(1545), ZPIL = PZ(1380); // 4.6, 9.6, 15.2, 15.4, 8.8
  const XPROT0 = PX(528), XPROT1 = PX(1045), XBAL0 = PX(255) + 4.6, XBAL1 = PX(510) + 4.6, ZBAL = PZ(1142); // 陽台往東移 4.6 m：整個陽台在晒衣場正上方（跳下去落在水泥地與草地交界附近）
  const P0 = { x: PX(260), z: ZB }, P1 = { x: PX(135), z: ZC }; // 樓梯間斜牆兩端
  // 一樓平面圖（畫得比較大）：以斜牆上端對齊二樓
  const X1 = (px) => P0.x + (px - 580) * 0.0206, Z1 = (py) => ZB + (py - 1275) * 0.0258;
  const XW = X1(118), XA = XW + 2.3; // 西牆、沿西牆梯段的東緣
  const XO0 = X1(475), XO1 = X1(775), ZO0 = Z1(745), ZHN = Z1(1092); // 宿管室、一樓西側走道北牆
  const XL1 = X1(1355), ZL0 = -0.65, XAN1 = X1(1525), ZAN0 = Z1(1077); // 大廳東牆、北牆（北牆往南縮到陽台下方，陽台正前方往下就是晒衣場，不是一樓屋頂）；東側上鎖房間
  const DOOR = { x0: X1(955), x1: X1(1160) }; DOOR.x = (DOOR.x0 + DOOR.x1) / 2; // 大門
  // 宿舍區：房間深 7.2 m、寬 4 m；北端接浴廁
  const RW = 4.0, NR = 15, ZR1 = -0.8, ZR0 = ZR1 - NR * RW; // 每間寬 4 m；北端 -60.8
  const planZ = (py) => py <= 1160 ? ZR0 + (py - 132) / 1028 * (ZR1 - ZR0) : Math.max(ZR1, PZ(py));

  // =====================================================================
  // 一樓
  // =====================================================================
  S_('一樓地板', XW, XL1, ZL0, ZC, -0.22, 0, C.lobbyF);
  terrazzo.push({ x0: XO1, x1: XL1, z0: ZL0, z1: ZB, y: 0.006 }, { x0: XW, x1: XO1, z0: ZHN, z1: 8.57, y: 0.006 }, { x0: XA, x1: XO1, z0: 8.57, z1: ZB - 0.6, y: 0.006 }, { x0: P0.x, x1: XO1, z0: ZB - 0.6, z1: ZB, y: 0.006 }); // 最後一條：西側走道靠南牆那 0.6 m
  const LW = 0xdcdad3; // 大廳牆面（白）
  // 西側走道北牆、宿管室
  // ---- 一樓西側走道（宿管室～樓梯）：往西走到底，右前方是通往戶外迴廊的開口（空氣牆擋住），正前方是信箱牆 ----
  const MZ = ZHN + WT, AG1 = 8.57; // 走道北牆南面、西牆開口的南端（開口 z：MZ～AG1）
  S_('一樓走道北牆', XW, XO0 - WT, ZHN, ZHN + WT, 0, F, LW);
  terrazzo.push({ x0: XW, x1: XO0, z0: ZHN + WT, z1: ZHN + 0.4, y: 0.006 });
  D_('一樓踢腳板', XW, XO0 - WT, MZ, MZ + 0.02, 0, 0.2, C.skirt); D_('一樓踢腳板', XW, XW + 0.02, AG1, 8.57, 0, 0.2, C.skirt);
  // 北牆（走道右手邊）：佈告欄、火警警報、校園平面圖、重要聯絡電話
  D_('一樓_佈告欄框', -35.7, -33.7, MZ, MZ + 0.05, 1.0, 2.25, 0x8a6a48); D_('一樓_佈告欄', -35.6, -33.8, MZ + 0.05, MZ + 0.06, 1.08, 2.17, 0xb08a5c);
  for (const [x, y] of [[-35.3, 1.75], [-34.9, 1.55], [-34.5, 1.8], [-34.1, 1.5], [-35.0, 1.3], [-34.3, 1.25]]) D_('一樓_佈告紙', x - 0.12, x + 0.12, MZ + 0.06, MZ + 0.065, y - 0.17, y + 0.17, 0xeceae2);
  D_('一樓_火警警報', -33.5, -33.3, MZ, MZ + 0.1, 1.6, 2.1, 0xd8d8d2); D_('一樓_火警燈', -33.45, -33.35, MZ + 0.1, MZ + 0.13, 2.0, 2.08, 0xc01818);
  D_('一樓_平面圖', -33.2, -32.7, MZ, MZ + 0.03, 1.15, 1.8, 0x9bbf6a);
  signs.push({ x: -32.05, y: 1.8, z: MZ + 0.04, t: '重要聯絡電話', c: '#b01818', ry: 0, w: 0.8, h: 1.3, board: ['一、校安值勤專線', '二、宿舍值勤室', '三、正門警衛室', '四、派出所', '五、無線電計程車'] });
  for (const dz of [0.1, 0.2, 0.3]) D_('一樓_天花板管線', XW - 7, XO0 - WT, MZ + dz - 0.025, MZ + dz + 0.025, F - 0.5, F - 0.45, 0xd8d8d2);
  for (const [dz, y] of [[0.42, F - 0.3], [0.5, F - 0.3], [0.6, F - 0.36]]) D_('一樓_天花板管線', XA, XO0 - WT, MZ + dz - 0.02, MZ + dz + 0.02, y - 0.04, y, 0xe2e0d8); // 照片：天花板一整排白色線管
  for (let x = XA + 0.4; x < XO0 - 0.3; x += 1.4) D_('一樓_管線吊架', x, x + 0.03, MZ + 0.05, MZ + 0.66, F - 0.48, F - 0.45, 0x8a8c8a);
  props.push({ k: 'cable', x0: XA, x1: XO0 - WT, z: MZ + 0.24, y: F - 0.46, sag: 0.12, step: 1.4, r: 0.016, c: 0x141414 }, { k: 'cable', x0: XA, x1: XO0 - WT, z: MZ + 0.3, y: F - 0.47, sag: 0.16, step: 1.4, r: 0.012, c: 0x1c1c1c }, { k: 'cable', x0: XA + 0.2, x1: XO0 - WT, z: MZ + 0.36, y: F - 0.46, sag: 0.1, step: 2.8, r: 0.02, c: 0xc9a43a }); // 黑色電線、黃色軟管
  // 開口外：戶外迴廊（用空氣牆擋住）——整片暗暗的、霧霧的，只隱約看得到柱子
  const AX = XW - 9;
  S_('一樓迴廊_地面', AX, XW, MZ - 0.3, AG1, -0.22, 0, 0x2a2825);
  S_('一樓迴廊_屋頂', AX, XW, MZ - 0.6, AG1 + WT, F - 0.2, F, 0x1c1b19);
  S_('一樓迴廊_南牆', AX, XW - WT, AG1, AG1 + WT, 0, F, 0x3a3936); D_('一樓迴廊_踢腳板', AX, XW - WT, AG1 - 0.02, AG1, 0, 0.2, 0x111111);
  for (let x = XW - 1.6; x > AX; x -= 2.6) D_('一樓迴廊柱', x - 0.22, x + 0.22, MZ - 0.5, MZ - 0.1, 0, F - 0.2, 0x8e8e8a);
  D_('一樓迴廊_草地', AX, XW - WT, MZ - 6, MZ - 0.6, -0.05, 0.02, 0x141d0f);
  S_('一樓迴廊_遠處建築', AX - 0.2, AX, MZ - 6, AG1 + WT, 0, F + 1, 0x0a0a0a);
  S_('一樓走道西牆', XW - WT, XW, MZ, AG1, F - 0.5, F, LW); // 開口上方的樑
  air('一樓迴廊', XW - 0.25, XW + 0.05, MZ - 0.6, AG1, 0, F);
  // 霧：一層一層半透明的黑幕，越遠越黑
  for (let k = 0; k < 7; k++) fogs.push({ x: XW - 0.35 - k * 1.2, z0: MZ - 6, z1: AG1, y0: -0.1, y1: F, o: 0.34 + k * 0.04 });
  wallX('宿管室南牆', XO0 - WT, XO1, ZHN + WT / 2, WT, 0, F, [[XO0 + 2.6, XO0 + 3.6]]);
  S_('宿管室門', XO0 + 2.6, XO0 + 3.6, ZHN + 0.02, ZHN + 0.08, 0, 2.1, C.door); S_('宿管室門楣', XO0 + 2.6, XO0 + 3.6, ZHN, ZHN + WT, 2.1, F, C.wall);
  D_('宿管室門框', XO0 + 2.55, XO0 + 3.65, ZHN + WT, ZHN + WT + 0.02, 2.1, 2.16, C.frame);
  signs.push({ x: XO0 + 3.1, y: 2.45, z: ZHN + WT + 0.02, t: '宿管室', c: '#d6d0b4', ry: 0 });
  S_('宿管室西牆', XO0 - WT, XO0, ZO0 - WT, ZHN + WT, 0, F, C.wall);
  S_('宿管室北牆', XO0 - WT, XO1, ZO0 - WT, ZO0, 0, F, C.wall);
  S_('宿管室內部', XO0, XO1 - WT, ZO0, ZHN, 0, F, C.black); // 門後是實心（進不去）
  // 大廳
  S_('大廳西牆', XO1 - WT, XO1, ZL0 - WT, ZHN + WT, 0, F, LW);
  const YD0 = XO1 + 0.6, YD1 = YD0 + 1.7; // 大廳北牆、宿管室旁通往中庭的門（紗窗鐵門，雙開，預設打開）
  for (const [hx, sgn] of [[YD0, 1], [YD1, -1]]) { // 兩扇門往中庭推開、貼著牆
    const lx0 = sgn > 0 ? hx : hx - 0.05, lx1 = lx0 + 0.05, zA = ZL0 - WT - 0.83, zB = ZL0 - WT - 0.02;
    for (const [z0, z1] of [[zA, zA + 0.05], [zB - 0.05, zB]]) D_('中庭紗門框', lx0, lx1, z0, z1, 0.02, 2.08, 0x8e918f);
    for (const y of [0.02, 0.95, 2.03]) D_('中庭紗門框', lx0, lx1, zA, zB, y, y + 0.05, 0x8e918f);
    for (let z = zA + 0.1; z < zB - 0.05; z += 0.1) D_('中庭紗網', lx0 + 0.02, lx1 - 0.02, z - 0.004, z + 0.004, 0.07, 2.03, 0x4a4e50);
    for (let y = 0.15; y < 2.0; y += 0.1) D_('中庭紗網', lx0 + 0.02, lx1 - 0.02, zA + 0.05, zB - 0.05, y - 0.004, y + 0.004, 0x4a4e50);
    D_('中庭紗門把', sgn > 0 ? lx1 : lx0 - 0.03, sgn > 0 ? lx1 + 0.03 : lx0, zA + 0.08, zA + 0.14, 0.95, 1.1, 0xc0c0b8);
  }
  const NW = [YD1 + 0.5, XL1 - 0.4]; // 北牆的大窗（看得到中庭）
  wallX('大廳北牆', XO1 - WT, XL1 + WT, ZL0 - WT / 2, WT, 0, 0.9, [[YD0, YD1]], LW);
  wallX('大廳北牆', XO1 - WT, XL1 + WT, ZL0 - WT / 2, WT, 0.9, 2.75, [[YD0, YD1], NW], LW);
  wallX('大廳北牆', XO1 - WT, XL1 + WT, ZL0 - WT / 2, WT, 2.75, F, [[YD0, YD1]], LW); S_('大廳北牆', YD0, YD1, ZL0 - WT, ZL0, 2.1, 2.75, LW);
  S_('大廳_北側窗戶', NW[0], NW[1], ZL0 - WT / 2 - 0.02, ZL0 - WT / 2 + 0.02, 0.9, 2.75, C.glass);
  for (let x = NW[0]; x <= NW[1] + 0.01; x += (NW[1] - NW[0]) / 7) D_('大廳_窗框', x - 0.04, x + 0.04, ZL0 - WT - 0.01, ZL0 + 0.01, 0.9, 2.75, 0x9a9c9a);
  for (const y of [0.9, 2.15, 2.71]) D_('大廳_窗框', NW[0], NW[1], ZL0 - WT - 0.01, ZL0 + 0.01, y, y + 0.05, 0x9a9c9a);
  for (let x = NW[0] + 0.15; x < NW[1]; x += 0.3) D_('大廳_窗外鐵窗', x - 0.008, x + 0.008, ZL0 - WT - 0.05, ZL0 - WT - 0.03, 0.95, 2.7, 0x8a8c8a);
  for (const x of [YD0 - 0.07, YD1]) D_('中庭門框', x, x + 0.07, ZL0 - WT - 0.02, ZL0 + 0.02, 0, 2.16, C.frame);
  D_('中庭門框', YD0 - 0.07, YD1 + 0.07, ZL0 - WT - 0.02, ZL0 + 0.02, 2.08, 2.16, C.frame);
  S_('大廳東牆', XL1, XL1 + WT, ZL0 - WT, ZB + WT, 0, F, LW);
  // 東牆：百鶴圖掛畫、上鎖的灰色鐵門（上半部霧面玻璃、貼著「男士止步」）
  D_('大廳_掛畫框', XL1 - 0.06, XL1, 0.4, 3.4, 1.35, 2.75, 0x3a2420); D_('大廳_掛畫', XL1 - 0.07, XL1 - 0.06, 0.5, 3.3, 1.45, 2.65, 0xcbb489);
  for (const z of [0.9, 2.9]) D_('大廳_掛畫掛勾', XL1 - 0.05, XL1, z - 0.06, z + 0.06, 2.78, 2.88, 0xc8a24a);
  D_('上鎖的門框', XL1 - 0.06, XL1, 6.0, 7.25, 0, 2.2, 0x8f8c84);
  D_('上鎖的門', XL1 - 0.08, XL1 - 0.06, 6.08, 7.17, 0, 2.12, 0xa7a59c); D_('上鎖的門玻璃', XL1 - 0.09, XL1 - 0.08, 6.2, 7.05, 1.15, 2.0, 0x2b3134);
  D_('上鎖的門把', XL1 - 0.16, XL1 - 0.09, 7.0, 7.05, 0.85, 1.25, 0xc0c0b8); D_('上鎖的門讀卡機', XL1 - 0.03, XL1, 7.35, 7.48, 1.1, 1.25, 0x111111);
  signs.push({ x: XL1 - 0.1, y: 1.05, z: 6.62, t: '男士止步', c: '#222', ry: -Math.PI / 2, w: 0.42, h: 0.12, paper: true });
  S_('東側房間', XL1 + WT, XAN1, ZAN0, ZB + WT, 0, F, C.wall);
  const SL = [[DOOR.x0 - 1.7, DOOR.x0 - 0.12], [DOOR.x1 + 0.12, DOOR.x1 + 1.7]]; // 大門兩側的玻璃
  wallX('一樓南牆', P0.x, XL1 + WT, ZB + WT / 2, WT, 0, 0.25, [[DOOR.x0, DOOR.x1]], LW);
  wallX('一樓南牆', P0.x, XL1 + WT, ZB + WT / 2, WT, 0.25, 2.55, [[DOOR.x0, DOOR.x1], ...SL], LW);
  wallX('一樓南牆', P0.x, XL1 + WT, ZB + WT / 2, WT, 2.55, F, [[DOOR.x0, DOOR.x1]], LW);
  for (const [a, b] of SL) { S_('大廳_大門側窗戶', a, b, ZB + WT / 2 - 0.02, ZB + WT / 2 + 0.02, 0.25, 2.55, C.glass); for (const x of [a, (a + b) / 2, b - 0.06]) D_('大廳_大門窗框', x, x + 0.06, ZB - 0.01, ZB + WT + 0.01, 0.25, 2.55, 0xa8aaa8); for (const y of [0.25, 1.2, 2.5]) D_('大廳_大門窗框', a, b, ZB - 0.01, ZB + WT + 0.01, y, y + 0.05, 0xa8aaa8); }
  S_('大門門楣', DOOR.x0, DOOR.x1, ZB, ZB + WT, 2.55, F, C.wall);
  for (const x of [DOOR.x0 - 0.08, DOOR.x1]) D_('大門門框', x, x + 0.08, ZB - 0.02, ZB + WT + 0.02, 0, 2.55, C.frame);
  D_('大門門框', DOOR.x0 - 0.08, DOOR.x1 + 0.08, ZB - 0.02, ZB + WT + 0.02, 2.5, 2.58, C.frame);
  D_('一樓天花板', XO0 - WT, XL1 + WT, ZL0 - WT, ZN1, F - 0.22, F - 0.2, C.ceil);
  for (const [x0, x1, z] of [[XO1, YD0, ZL0], [YD1, XL1, ZL0], [XW, XO0, ZHN + WT], [P0.x, DOOR.x0 - 1.7, ZB], [DOOR.x1 + 1.7, XL1, ZB]]) D_('一樓踢腳板', x0, x1, z - 0.02, z + 0.02, 0, 0.2, C.skirt);
  D_('一樓踢腳板', XL1 - 0.02, XL1, ZL0, 6.0, 0, 0.2, C.skirt); D_('一樓踢腳板', XL1 - 0.02, XL1, 7.25, ZB, 0, 0.2, C.skirt); D_('一樓踢腳板', XO1, XO1 + 0.02, ZL0, ZHN, 0, 0.2, C.skirt);
  // 大廳沙發區（照片：黃色皮沙發、木頭茶几＋玻璃桌面；北牆那個方框是電腦桌）
  const YEL = 0xd99a2b, YELD = 0xc0841f, CHR = 0xb8bab8;
  const lsofa = (x0, x1, z0, z1, back) => { // back：'N' | 'W' | 'E'
    const yb = 0.12; props.push({ k: 'leather', x0, x1, z0, z1, back, y: 0, arm: 0.18, bt: 0.22 });
    S_('大廳_沙發座', x0, x1, z0, z1, yb, 0.45, YEL);
    if (back === 'N') { S_('大廳_沙發背', x0, x1, z0 - 0.22, z0, yb, 0.88, YELD); S_('大廳_沙發扶手', x0 - 0.18, x0, z0 - 0.22, z1, yb, 0.66, YELD); S_('大廳_沙發扶手', x1, x1 + 0.18, z0 - 0.22, z1, yb, 0.66, YELD); }
    if (back === 'W') { S_('大廳_沙發背', x0 - 0.22, x0, z0, z1, yb, 0.88, YELD); S_('大廳_沙發扶手', x0 - 0.22, x1, z0 - 0.18, z0, yb, 0.66, YELD); S_('大廳_沙發扶手', x0 - 0.22, x1, z1, z1 + 0.18, yb, 0.66, YELD); }
    if (back === 'E') { S_('大廳_沙發背', x1, x1 + 0.22, z0, z1, yb, 0.88, YELD); S_('大廳_沙發扶手', x0, x1 + 0.22, z0 - 0.18, z0, yb, 0.66, YELD); S_('大廳_沙發扶手', x0, x1 + 0.22, z1, z1 + 0.18, yb, 0.66, YELD); }
    const bx0 = Math.min(x0, x1) - 0.1, bx1 = Math.max(x0, x1) + 0.1, bz0 = z0 - 0.1, bz1 = z1 + 0.1;
    for (const [x, z] of [[bx0 + 0.12, bz0 + 0.12], [bx1 - 0.12, bz0 + 0.12], [bx0 + 0.12, bz1 - 0.12], [bx1 - 0.12, bz1 - 0.12]]) D_('大廳_沙發腳', x - 0.02, x + 0.02, z - 0.02, z + 0.02, 0, yb, CHR);
  };
  const SOF = 2.3; // 大廳縮短後沙發區整組往南移
  lsofa(X1(1092) + 0.15, X1(1217) - 0.15, Z1(875) + 0.22 + SOF, Z1(907) + 0.25 + SOF, 'N');
  lsofa(X1(1007) + 0.22, X1(1050), Z1(940) + SOF, Z1(1025) + SOF, 'W');
  lsofa(X1(1245), X1(1297) - 0.22, Z1(940) + SOF, Z1(1025) + SOF, 'E');
  { const tx = (X1(1085) + X1(1220)) / 2, tz = (Z1(932) + Z1(1025)) / 2 + SOF;
    props.push({ k: 'lobbyTable', x: tx, z: tz, y: 0 });
    S_('大廳_茶几', tx - 0.75, tx + 0.75, tz - 0.4, tz + 0.4, 0, 0.42, 0x5a2e1e); D_('大廳_茶几玻璃', tx - 0.75, tx + 0.75, tz - 0.4, tz + 0.4, 0.42, 0.44, 0x8fa6a2);
    D_('大廳_桌巾', tx - 0.45, tx + 0.45, tz - 0.42, tz + 0.42, 0.44, 0.445, 0xe8e6de);
    D_('大廳_盆栽', tx - 0.08, tx + 0.08, tz - 0.08, tz + 0.08, 0.445, 0.6, 0x222222); D_('大廳_盆栽葉', tx - 0.16, tx + 0.16, tz - 0.16, tz + 0.16, 0.6, 0.85, 0x3d5a2a); }
  // 電腦桌＋小電腦＋椅子
  { const x0 = X1(1007), x1 = X1(1137), z0 = ZL0, z1 = ZL0 + 0.7, xm = (x0 + x1) / 2;
    S_('大廳_電腦桌', x0, x1, z0, z1, 0.72, 0.76, 0x8a6a4a);
    for (const x of [x0 + 0.05, x1 - 0.09]) S_('大廳_電腦桌腳', x, x + 0.04, z0 + 0.05, z1 - 0.05, 0, 0.72, 0x4a4a4a);
    D_('大廳_螢幕', xm - 0.25, xm + 0.25, z0 + 0.18, z0 + 0.24, 0.86, 1.2, 0x15171a); D_('大廳_螢幕腳', xm - 0.04, xm + 0.04, z0 + 0.16, z0 + 0.24, 0.76, 0.86, 0x2a2a2a);
    D_('大廳_螢幕畫面', xm - 0.22, xm + 0.22, z0 + 0.241, z0 + 0.243, 0.89, 1.17, 0x0b0d10);
    D_('大廳_鍵盤', xm - 0.22, xm + 0.22, z0 + 0.38, z0 + 0.52, 0.76, 0.78, 0x2b2b2b); D_('大廳_滑鼠', xm + 0.32, xm + 0.38, z0 + 0.42, z0 + 0.5, 0.76, 0.785, 0x2b2b2b);
    S_('大廳_主機', x1 - 0.55, x1 - 0.35, z0 + 0.05, z0 + 0.5, 0, 0.42, 0x2a2b2d);
    S_('大廳_椅子座', xm - 0.24, xm + 0.24, z1 + 0.25, z1 + 0.73, 0.42, 0.48, 0x1f2a3a); D_('大廳_椅子背', xm - 0.22, xm + 0.22, z1 + 0.68, z1 + 0.73, 0.48, 0.95, 0x1f2a3a); D_('大廳_椅子腳', xm - 0.03, xm + 0.03, z1 + 0.46, z1 + 0.52, 0, 0.42, 0x333333); }
  // 天花板的樑與日光燈
  for (const x of [-20.5, -16.2]) D_('大廳_橫樑', x - 0.2, x + 0.2, ZL0, ZB, F - 0.65, F - 0.2, LW);
  for (const [x, z] of [[-18.3, 1.2], [-18.3, 5.6], [-14.0, 3.4]]) D_('日光燈', x - 0.13, x + 0.13, z - 0.62, z + 0.62, F - 0.3, F - 0.22, C.lamp);
  S_('大廳_公告欄', XO1, XO1 + 0.08, 0.6, 2.6, 1.05, 2.1, C.board);
  // 二樓樓板（一樓天花板）
  S_('二樓樓板', XW, -XC, ZN1, 8.57, F - 0.2, F, C.slab);
  S_('二樓樓板', P0.x, -XC, 8.57, ZB, F - 0.2, F, C.slab);
  S_('二樓樓板_沙發區', XPROT0, XPROT1, ZB, ZC, F - 0.2, F, C.slab);
  S_('二樓樓板_陽台', XBAL0, XBAL1, ZBAL, ZN1, F - 0.2, F, C.slab);

  // =====================================================================
  // 西南角樓梯：斜向梯段（從一樓走道往西南上）→ 1-2樓中間平台 → 沿西牆往北上二樓
  //            二樓→三樓的梯段疊在正上方，用空氣牆擋住
  // =====================================================================
  const L = Math.hypot(P1.x - P0.x, P1.z - P0.z), u = { x: (P1.x - P0.x) / L, z: (P1.z - P0.z) / L }, n = { x: -u.z, z: u.x }; // u：沿斜牆往西南；n：往西北（室內）
  if (n.x > 0) { n.x = -n.x; n.z = -n.z; }
  const BW = 2.3, t0 = 0.6, TT = 0.5, t1 = t0 + 8 * TT, r = F / 16, r3 = (F3 - F) / 16;
  const ZT = 8.57, ZLB = ZT + 8 * 0.35; // 沿西牆梯段：頂端（二樓）z、底端（平台）z
  const Pp = (s, w = 0) => ({ x: P0.x + u.x * s + n.x * w, z: P0.z + u.z * s + n.z * w });
  const sw = (x, z) => ({ s: (x - P0.x) * u.x + (z - P0.z) * u.z, w: (x - P0.x) * n.x + (z - P0.z) * n.z });
  const qAtZ = (z) => { const s = (z - (P0.z + n.z * BW)) / u.z; return Pp(s, BW); }; // 斜梯內緣在某個 z 的位置
  const Q0 = qAtZ(ZT), Q1 = qAtZ(ZLB);
  const hAt = (x, z) => { // 樓梯區的高度場（碰撞用）
    if (x < XW || z > ZC) return null;
    const { s, w } = sw(x, z); if (w < 0) return null;
    if (x < XA && z >= ZT && z < ZLB) return null;           // 沿西牆梯段另外做
    if (x >= XA && z >= ZT && z < ZLB && w > BW) return null; // 兩段梯中間（一樓地面）
    if (w <= BW && s >= 0 && s <= L) { if (s < t0) return null; if (s < t1) { const h = (Math.floor((s - t0) / TT) + 1) * r; return w > BW - 0.2 ? h + 1.0 : h; } return 8 * r; } // 內側矮牆當扶手
    if (z >= ZLB) return 8 * r;                               // 中間平台
    return null;
  };
  { const CS = 0.2; // 以小方塊拼出碰撞（同一列相同高度合併）
    for (let z = ZT - 0.8; z < ZB + 0.8; z += CS) for (let x = P0.x - 2.6; x < P0.x + 0.2; x += CS) { const { s: ss, w } = sw(x + CS / 2, z + CS / 2); if (ss <= t0 + 0.02 && w >= -0.05 && w <= BW && z + CS > ZT && x < P0.x) S_('樓梯碰撞_二樓平台', x, x + CS, z, z + CS, F - 0.2, F, C.slab); }
    for (let z = ZT - 0.6; z < ZC; z += CS) { let run = null;
      const flush = () => { if (run) { S_('樓梯碰撞', run.x0, run.x1, z, z + CS, 0, run.h, C.step); run = null; } };
      for (let x = XW; x < P0.x + 0.2; x += CS) { const h = hAt(x + CS / 2, z + CS / 2); if (h === null) { flush(); continue; } if (run && Math.abs(run.h - h) < 1e-6) run.x1 = x + CS; else { flush(); run = { x0: x, x1: x + CS, h }; } }
      flush(); }
  }
  const rot = (n_, s0, s1, w0, w1, y0, y1, c) => { const a = Pp((s0 + s1) / 2, (w0 + w1) / 2); rots.push({ n: n_, x: a.x, z: a.z, wa: s1 - s0, wb: w1 - w0, y0, y1, ry: Math.atan2(u.x, u.z), c }); };
  for (let k = 0; k < 8; k++) { rot('樓梯_斜向梯段', t0 + k * TT, t0 + (k + 1) * TT, 0, BW - 0.12, 0, (k + 1) * r, C.step); rot('樓梯_止滑條', t0 + (k + 1) * TT - 0.08, t0 + (k + 1) * TT - 0.02, 0.05, BW - 0.05, (k + 1) * r, (k + 1) * r + 0.01, C.frame); }
  const landPts = [Pp(t1), P1, { x: XW, z: ZC }, { x: XW, z: ZLB }, Q1, Pp(t1, BW)];
  prisms.push({ n: '樓梯_1-2樓中間平台', pts: landPts, y0: 0, y1: 8 * r, c: C.land });
  // 扶手（矮牆）：斜向梯段內側、沿西牆梯段東側、平台邊緣、二樓樓梯口
  // 扶手矮牆：外側做成平滑的斜牆（不是一階一階的），上面加咖啡色木扶手（照片）
  // 兩段樓梯中間的轉角空間：原本信箱牆那一整組（大小、朝向不變）搬到沿西牆梯段朝東的牆上
  terrazzo.push({ x0: XA, x1: Q0.x, z0: ZB - 0.6, z1: ZLB, y: 0.006 }, { x0: Q0.x, x1: P0.x, z0: ZB - 0.6, z1: ZB, y: 0.006 }, { x0: Q0.x, x1: P0.x, z0: ZB, z1: Pp(t0).z + 0.05, y: 0.006 }); // 轉角空間與斜梯底下的磨石子地（伸進梯段底下的部分會被台階蓋住）
  const sQ = t0, MX = XA, GZ = ZLB - 8.57; // 整組往南平移：原本靠樓梯牆的那一端對齊中間平台
  const box_ = (z0, z1, c) => { D_('一樓_信箱格', MX, MX + 0.24, z0, z1, 0.85, 2.0, c); for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 4) D_('一樓_信箱格線', MX + 0.24, MX + 0.25, z - 0.008, z + 0.008, 0.85, 2.0, 0x8a7a40); for (let y = 0.85; y <= 2.01; y += 0.115) D_('一樓_信箱格線', MX + 0.24, MX + 0.25, z0, z1, y - 0.006, y + 0.006, 0x8a7a40); };
  box_(7.45 + GZ, 8.15 + GZ, 0xe6d9a6); box_(6.8 + GZ, 7.45 + GZ, 0xe8b72a);
  signs.push({ x: MX + 0.02, y: 2.5, z: 7.48 + GZ, t: '信箱 Mailbox', c: '#222', ry: Math.PI / 2, w: 1.1, h: 0.22, plate: true },
    { x: MX + 0.27, y: 2.12, z: 7.8 + GZ, t: 'B區', c: '#222', ry: Math.PI / 2, w: 0.36, h: 0.16, plate: true }, { x: MX + 0.27, y: 2.12, z: 7.12 + GZ, t: 'C區', c: '#222', ry: Math.PI / 2, w: 0.36, h: 0.16, paper: true });
  D_('一樓_電箱', MX, MX + 0.2, 7.5 + GZ, 8.0 + GZ, 2.75, 3.15, 0x2a2622); D_('一樓_電箱', MX, MX + 0.2, 6.9 + GZ, 7.4 + GZ, 2.7, 3.15, 0x3a3836); D_('一樓_電箱蓋', MX + 0.2, MX + 0.22, 7.6 + GZ, 7.9 + GZ, 2.8, 3.1, 0x8a6a48);
  extinguisher(MX + 0.05, 6.95 + GZ, 0, 0); extinguisher(MX + 0.05, 7.2 + GZ, 0, 0);
  // A 區信箱櫃（靠中間平台那面牆，朝北）
  S_('一樓_A區信箱櫃', MX + 0.3, MX + 1.15, ZLB - 0.42, ZLB, 0, 1.6, 0xe9e2c8);
  for (let y = 0.15; y < 1.55; y += 0.2) D_('一樓_信箱格線', MX + 0.3, MX + 1.15, ZLB - 0.43, ZLB - 0.42, y, y + 0.015, 0xb8b09a);
  D_('一樓_A區牌座', MX + 0.5, MX + 0.95, ZLB - 0.3, ZLB - 0.1, 1.6, 1.68, 0xf2f2ee);
  signs.push({ x: MX + 0.72, y: 1.78, z: ZLB - 0.21, t: 'A區', c: '#222', ry: Math.PI, w: 0.4, h: 0.18, plate: true });
  // 地上雜物（水桶、電風扇、紙箱、紙板、燈管、臉盆）
  D_('一樓_雜物_水桶', MX + 1.25, MX + 1.65, ZLB - 0.55, ZLB - 0.15, 0, 0.5, 0xd8c9b4);
  D_('一樓_雜物_電風扇', MX + 1.7, MX + 2.1, ZLB - 0.95, ZLB - 0.55, 0, 0.35, 0xb9c8b0); D_('一樓_雜物_電風扇', MX + 1.82, MX + 1.98, ZLB - 0.85, ZLB - 0.65, 0.35, 0.5, 0xb9c8b0);
  D_('一樓_雜物_紙箱', MX + 0.3, MX + 0.8, 7.9 + GZ, 8.3 + GZ, 0, 0.25, 0x8a6a48); D_('一樓_雜物_紙板', MX + 0.25, MX + 0.3, 7.3 + GZ, 8.1 + GZ, 0, 0.45, 0x9d8566);
  for (let i = 0; i < 3; i++) D_('一樓_雜物_燈管', MX + 0.4 + i * 0.1, MX + 0.44 + i * 0.1, 6.9 + GZ, 7.9 + GZ, 0.02, 0.06, 0xe8e8e0);
  D_('一樓_雜物_臉盆', MX + 0.6, MX + 0.9, 6.85 + GZ, 7.1 + GZ, 0, 0.1, 0xb01818);
  const RB = 0x5a3a24, ryD = Math.atan2(u.x, u.z);
  { const o = Pp(0, BW - 0.06); sprisms.push({ n: '樓梯_斜向梯段扶手牆', x: o.x, z: o.z, ry: ryD, t: 0.12, c: C.wall, pts: [[sQ, 0], [t1, 0], [t1, 8 * r + 1.0], [t0, r + 1.0], [sQ, r + 1.0]] });
    const a0 = Pp(t0, BW - 0.06), a1 = Pp(t1, BW - 0.06); beams.push({ x0: a0.x, y0: r + 1.03, z0: a0.z, x1: a1.x, y1: 8 * r + 1.03, z1: a1.z, w: 0.16, h: 0.07, c: RB }); }
  for (let k = 0; k < 8; k++) S_('樓梯碰撞_扶手', XA - 0.12, XA, ZLB - (k + 1) * 0.35, ZLB - k * 0.35, 0, 8 * r + (k + 1) * r + 1.0, C.wall);
  sprisms.push({ n: '樓梯_沿西牆梯段扶手牆', x: XA - 0.06, z: ZLB, ry: Math.PI, t: 0.12, c: C.wall, pts: [[0, 0], [ZLB - ZT, 0], [ZLB - ZT, F + 1.0], [0, 8 * r + 1.0]] });
  beams.push({ x0: XA - 0.06, y0: 8 * r + 1.03, z0: ZLB, x1: XA - 0.06, y1: F + 1.03, z1: ZT, w: 0.16, h: 0.07, c: RB });
  S_('樓梯_平台扶手牆', XA - 0.12, Q1.x, ZLB, ZLB + 0.12, 0, 8 * r + 1.0, C.wall);
  S_('樓梯_二樓樓梯口扶手牆', XA - 0.12, Q0.x + 0.1, ZT - 0.12, ZT, F - 0.2, F + 1.0, C.wall);
  S_('樓梯間_上方牆', XA - 0.12, Q0.x, ZT - 0.08, ZT, H2, TOP, C.wall);
  for (let k = 0; k < 8; k++) { S_('樓梯_沿西牆梯段', XW, XA - 0.12, ZLB - (k + 1) * 0.35, ZLB - k * 0.35, 0, 8 * r + (k + 1) * r, C.step); D_('樓梯_止滑條', XW + 0.05, XA - 0.05, ZLB - (k + 1) * 0.35 + 0.02, ZLB - (k + 1) * 0.35 + 0.07, 8 * r + (k + 1) * r, 8 * r + (k + 1) * r + 0.01, C.frame); }
  // 往三樓（畫出來但走不上去）
  prisms.push({ n: '樓梯_二樓平台', pts: [{ x: P0.x, z: ZT }, P0, Pp(t0), Pp(t0, BW), Q0], y0: F - 0.2, y1: F, c: 0xa69a8a, tex: 'terrazzo' });
  for (let k = 0; k < 8; k++) { rot('樓梯_往三樓斜向梯段', t0 + k * TT, t0 + (k + 1) * TT, 0, BW - 0.12, F + (k + 1) * r3 - 0.22, F + (k + 1) * r3, C.step); rot('樓梯_往三樓扶手牆', t0 + k * TT, t0 + (k + 1) * TT, BW - 0.12, BW, F + (k + 1) * r3 - 0.22, F + (k + 1) * r3 + 1.0, C.wall); }
  prisms.push({ n: '樓梯_2-3樓中間平台', pts: landPts, y0: F + 8 * r3 - 0.22, y1: F + 8 * r3, c: C.land });
  for (let k = 0; k < 8; k++) { const tp = F + 8 * r3 + (k + 1) * r3; D_('樓梯_往三樓沿西牆梯段', XW, XA - 0.12, ZLB - (k + 1) * 0.35, ZLB - k * 0.35, tp - 0.22, tp, C.step); D_('樓梯_往三樓扶手牆', XA - 0.12, XA, ZLB - (k + 1) * 0.35, ZLB - k * 0.35, tp - 0.22, tp + 1.0, C.wall); }
  D_('樓梯_2-3樓平台扶手牆', XA - 0.12, Q1.x, ZLB, ZLB + 0.12, F + 8 * r3 - 0.22, F + 8 * r3 + 1.0, C.wall);
  S_('三樓樓板_樓梯口', XW, XA, ZN1, ZT, F3 - 0.2, F3, C.slab);
  for (let i = 0; i <= 12; i++) { const p = Pp(t0, BW * i / 12); air('往三樓', p.x - 0.18, p.x + 0.18, p.z - 0.18, p.z + 0.18, F, TOP); }
  // 樓梯間外牆（通高）
  S_('樓梯間西牆', XW - WT, XW, 8.57, ZC + WT, 0, TOP, C.wall); S_('樓梯間西牆', XW - WT, XW, ZHN, 8.57, F, TOP, C.wall);
  S_('樓梯間南牆', XW - WT, P1.x, ZC, ZC + WT, 0, TOP, C.wall);
  diag.push({ x0: P1.x, z0: P1.z, x1: P0.x, z1: P0.z, y0: 0, y1: TOP, c: C.wall, t: 0.15 });
  for (let i = 0; i < 24; i++) { const a = Pp(L * (i + 0.5) / 24, -0.3); S_('斜牆碰撞', a.x - 0.25, a.x + 0.25, a.z - 0.25, a.z + 0.25, 0, TOP, C.wall); }
  D_('樓梯間_天花板', XW - WT, P0.x + 0.2, ZT - 0.1, ZC + WT, TOP, TOP + 0.1, C.ceil);
  S_('樓梯間_上方牆', XW, XA, ZT - 0.08, ZT, F3, TOP, C.wall);
  S_('樓梯間西牆', XW - WT, XW, ZN1, ZHN, F, TOP, C.wall); // 交誼廳北牆和樓梯間西牆之間原本有一條縫看得到外面
  patrol.push({ x: XA + 1.2, z: 7.2, y: 0 }, { x: XW + 1.1, z: 7.6, y: F });

  // =====================================================================
  // 二樓交誼廳（北側大陽台、南側落地窗、沙發區）
  // =====================================================================
  terrazzo.push({ x0: XW, x1: -XC, z0: ZN1, z1: ZT, y: F + 0.006 }, { x0: P0.x, x1: -XC, z0: ZT, z1: ZB, y: F + 0.006 }, { x0: XPROT0, x1: XPROT1, z0: ZB, z1: ZC, y: F + 0.006 });
  wallX('交誼廳_北牆', XW - WT, -XC, ZN1 - WT / 2, WT, F, H2, [[XBAL0, XBAL1]]);
  S_('交誼廳_陽台門楣', XBAL0, XBAL1, ZN1 - WT, ZN1, F + 2.6, H2, C.wall);
  // 進陽台的那面牆：兩側落地窗、中間是出入口
  { const XM = (XBAL0 + XBAL1) / 2, h = 0.9;
    S_('陽台入口_西側落地窗戶', XBAL0, XM - h, ZN1 - WT / 2 - 0.03, ZN1 - WT / 2 + 0.03, F, F + 2.6, C.glass);
    S_('陽台入口_東側落地窗戶', XM + h, XBAL1, ZN1 - WT / 2 - 0.03, ZN1 - WT / 2 + 0.03, F, F + 2.6, C.glass);
    for (const x of [XBAL0, XM - h - 0.07, XM + h, XBAL1 - 0.07]) D_('陽台入口_窗框', x, x + 0.07, ZN1 - WT - 0.01, ZN1 + 0.01, F, F + 2.6, C.frame);
    for (let x = XBAL0 + 1.3; x < XM - h - 0.3; x += 1.3) D_('陽台入口_窗框', x, x + 0.05, ZN1 - WT, ZN1, F, F + 2.6, C.frame);
    for (let x = XM + h + 1.3; x < XBAL1 - 0.3; x += 1.3) D_('陽台入口_窗框', x, x + 0.05, ZN1 - WT, ZN1, F, F + 2.6, C.frame);
    for (const [a, b] of [[XBAL0, XM - h], [XM + h, XBAL1]]) for (const y of [F, F + 1.0]) D_('陽台入口_窗框', a, b, ZN1 - WT - 0.01, ZN1 + 0.01, y, y + 0.06, C.frame); }
  // 大陽台：兩側是牆、北側矮牆
  S_('陽台_西牆', XBAL0, XBAL0 + WT, ZBAL - WT, ZN1 - WT, F, H2, C.wall);
  S_('陽台_東牆', XBAL1 - WT, XBAL1, ZBAL - WT, ZN1 - WT, F, H2, C.wall);
  S_('陽台_矮牆', XBAL0, XBAL1, ZBAL - WT, ZBAL, F, F + 1.1, C.wall);
  D_('陽台_屋簷', XBAL0 - 0.1, XBAL1 + 0.1, ZBAL - 0.3, ZN1, H2, H2 + 0.15, C.ceil);
  terrazzo.push({ x0: XBAL0 + WT, x1: XBAL1 - WT, z0: ZBAL, z1: ZN1, y: F + 0.006 });
  // 南側：落地窗（斜牆上端～沙發區）
  S_('交誼廳_南側落地窗戶', P0.x, XPROT0, ZB, ZB + 0.06, F, H2, C.glass);
  for (let x = P0.x; x < XPROT0; x += 1.4) D_('交誼廳_落地窗框', x, x + 0.07, ZB - 0.02, ZB + 0.1, F, H2, C.frame);
  for (const y of [F, F + 0.9, H2 - 0.06]) D_('交誼廳_落地窗框', P0.x, XPROT0, ZB - 0.02, ZB + 0.1, y, y + 0.06, C.frame);
  S_('交誼廳_南側懸牆', P0.x - 0.05, P0.x + 0.1, ZT, ZB + 0.1, H2, TOP, C.wall);
  // 沙發區
  S_('交誼廳_沙發區西牆', XPROT0 - WT, XPROT0, ZB, ZC + WT, F, H2, C.wall);
  const WIN = [XPROT1 - 3.2, XPROT1 - 1.8];
  wallX('交誼廳_沙發區南牆', XPROT0 - WT, XPROT1, ZC + WT / 2, WT, F, H2, [WIN]);
  S_('交誼廳_沙發區南牆', WIN[0], WIN[1], ZC, ZC + WT, F, F + 0.3, C.wall); S_('交誼廳_沙發區南牆', WIN[0], WIN[1], ZC, ZC + WT, F + 3.2, H2, C.wall);
  S_('交誼廳_長窗戶', WIN[0], WIN[1], ZC + 0.05, ZC + 0.1, F + 0.3, F + 3.2, C.glass);
  for (const y of [F + 0.3, F + 1.2, F + 2.0, F + 2.8, F + 3.16]) D_('交誼廳_窗框', WIN[0], WIN[1], ZC + 0.02, ZC + 0.12, y, y + 0.04, C.wall);
  D_('交誼廳_窗框', (WIN[0] + WIN[1]) / 2 - 0.02, (WIN[0] + WIN[1]) / 2 + 0.02, ZC + 0.02, ZC + 0.12, F + 0.3, F + 3.2, C.wall);
  S_('交誼廳_柱牆', XPROT1, -XC, ZPIL, ZEND, F, H2, C.wall);
  D_('交誼廳_天花板', XA, -XC, ZN1 - 0.1, ZT, H2, H2 + 0.1, C.ceil); D_('交誼廳_天花板', P0.x, -XC, ZT, ZB, H2, H2 + 0.1, C.ceil); D_('交誼廳_天花板', XPROT0, XPROT1, ZB, ZC, H2, H2 + 0.1, C.ceil);
  S_('樓梯間_上方牆', Q0.x, P0.x, ZT - 0.08, ZT, H2, TOP, C.wall);
  D_('交誼廳_大樑', XPROT0, XPROT1, ZB - 0.2, ZB + 0.2, H2 - 0.55, H2, C.wall);
  D_('交誼廳_大樑', XW, -XC, ZN1 - 0.05, ZN1 + 0.3, H2 - 0.55, H2, C.wall);
  for (const [x0, x1, z] of [[XW, XBAL0, ZN1], [XBAL1, -XC, ZN1], [XPROT0, XPROT1, ZC]]) D_('交誼廳_踢腳板', x0, x1, z - 0.02, z + 0.02, F, F + 0.2, C.skirt);
  // 沙發區（照片：三張藤編沙發圍著玻璃茶几；電視掛在靠上樓樓梯那側的西牆）
  const TX = XPROT0 + 4.9, TZ = (ZB + ZC) / 2;
  props.push({ k: 'rattanTable', x: TX, z: TZ, y: F });
  S_('交誼廳_茶几', TX - 0.7, TX + 0.7, TZ - 0.4, TZ + 0.4, F, F + 0.4, C.rattan); D_('交誼廳_茶几玻璃', TX - 0.7, TX + 0.7, TZ - 0.4, TZ + 0.4, F + 0.4, F + 0.45, C.glassT);
  const sofa = (n_, x0, x1, z0, z1, back) => {
    props.push({ k: 'rattan', x0, x1, z0, z1, back, y: F, arm: 0.15, bt: 0.22 });
    S_(n_ + '座', x0, x1, z0, z1, F, F + 0.42, C.rattan);
    if (back === 'E') { S_(n_ + '背', x1, x1 + 0.22, z0 - 0.15, z1 + 0.15, F, F + 0.88, C.rattanD); S_(n_ + '扶手', x0, x1 + 0.22, z0 - 0.15, z0, F, F + 0.62, C.rattanD); S_(n_ + '扶手', x0, x1 + 0.22, z1, z1 + 0.15, F, F + 0.62, C.rattanD); }
    if (back === 'N') { S_(n_ + '背', x0 - 0.15, x1 + 0.15, z0 - 0.22, z0, F, F + 0.88, C.rattanD); S_(n_ + '扶手', x0 - 0.15, x0, z0 - 0.22, z1, F, F + 0.62, C.rattanD); S_(n_ + '扶手', x1, x1 + 0.15, z0 - 0.22, z1, F, F + 0.62, C.rattanD); }
    if (back === 'S') { S_(n_ + '背', x0 - 0.15, x1 + 0.15, z1, z1 + 0.22, F, F + 0.88, C.rattanD); S_(n_ + '扶手', x0 - 0.15, x0, z0, z1 + 0.22, F, F + 0.62, C.rattanD); S_(n_ + '扶手', x1, x1 + 0.15, z0, z1 + 0.22, F, F + 0.62, C.rattanD); }
  };
  sofa('交誼廳_長沙發', TX + 1.4, TX + 2.2, TZ - 1.1, TZ + 1.1, 'E');
  sofa('交誼廳_雙人沙發', TX - 0.8, TX + 0.8, TZ - 1.95, TZ - 1.2, 'N');
  sofa('交誼廳_三人沙發', TX - 1.1, TX + 1.1, TZ + 1.2, TZ + 1.95, 'S');
  const tv = { x: XPROT0 + 0.07, y: F + 1.6, z: TZ, w: 1.7, h: 0.96, ry: Math.PI / 2, nx: 1, nz: 0 };
  S_('交誼廳_電視', XPROT0, XPROT0 + 0.06, tv.z - 0.88, tv.z + 0.88, tv.y - 0.51, tv.y + 0.51, C.tv);
  D_('交誼廳_電視線', XPROT0 + 0.01, XPROT0 + 0.03, tv.z - 0.4, tv.z - 0.38, tv.y - 1.3, tv.y - 0.5, C.black); D_('交誼廳_插座', XPROT0, XPROT0 + 0.03, tv.z + 0.9, tv.z + 1.0, F + 0.3, F + 0.42, C.white);
  const remote = { x: TX + 0.25, y: F + 0.452, z: TZ - 0.05 };
  props.push({ k: 'disp', x0: XPROT1 - 1.15, x1: XPROT1 - 0.7, z0: ZC - 0.5, z1: ZC - 0.02, y: F, face: 'N' }); // 貼南牆、朝北
  S_('交誼廳_飲水機', XPROT1 - 1.15, XPROT1 - 0.7, ZC - 0.5, ZC - 0.02, F, F + 1.3, C.disp);
  extinguisher(XPROT0, ZC - 0.6, F, 1); extinguisher(XPROT0, ZC - 0.9, F, 1);
  D_('交誼廳_吊扇座', TX + 1.6 - 0.06, TX + 1.6 + 0.06, TZ - 0.06, TZ + 0.06, H2 - 0.55, H2, C.white);
  D_('交誼廳_吊扇', TX + 1.6 - 0.32, TX + 1.6 + 0.32, TZ - 0.05, TZ + 0.05, H2 - 0.7, H2 - 0.5, C.white); D_('交誼廳_吊扇', TX + 1.6 - 0.05, TX + 1.6 + 0.05, TZ - 0.32, TZ + 0.32, H2 - 0.7, H2 - 0.5, C.white);
  for (const [x, z] of [[TX + 4.5, TZ], [-26, 6.6], [-16, 6.6], [-7, 6.6]]) D_('日光燈', x - 0.6, x + 0.6, z - 0.12, z + 0.12, H2 - 0.08, H2, C.lamp);
  patrol.push({ x: XA + 0.8, z: 6.2, y: F }, { x: -26, z: 6.6, y: F }, { x: -16, z: 6.6, y: F }, { x: TX + 3, z: TZ, y: F }, { x: -6, z: 12.5, y: F }, { x: -24.4, z: 1.8, y: F }, { x: -5, z: 6.6, y: F });

  // =====================================================================
  // 宿舍走廊與寢室（右側 201–215 由南往北、左側 216–230 由北往南，整圈像 U 字）
  // 走廊參考照片：米色牆、黑色踢腳板、門在寢室正中間、門上方有高窗、天花板線槽
  // =====================================================================
  S_('走廊_地板', -XC, XC, ZR0, ZEND, F - 0.2, F, C.corr);
  terrazzo.push({ x0: -XC, x1: XC, z0: ZR0, z1: ZEND, y: F + 0.006 });
  D_('走廊_天花板', -XC - WT, XC + WT, ZR0, ZEND + 0.2, H2, H2 + 0.1, C.ceil);
  S_('走廊_南端牆', -XC, XE + WT, ZEND, ZEND + WT, F, H2, C.wall);
  for (const sx of [-1, 1]) { // 天花板兩側的線槽／管線
    D_('走廊_線槽', sx * (XC - 0.08), sx * (XC - 0.5), ZR0, ZEND, H2 - 0.48, H2 - 0.44, C.tray);
    for (let z = ZR0 + 0.5; z < ZEND; z += 1.6) D_('走廊_線槽吊桿', sx * (XC - 0.3) - 0.01, sx * (XC - 0.3) + 0.01, z, z + 0.02, H2 - 0.44, H2, C.tray);
    for (const dx of [0.12, 0.22, 0.32, 0.42]) D_('走廊_管線', sx * (XC - dx) - 0.025, sx * (XC - dx) + 0.025, ZR0, ZEND, H2 - 0.43, H2 - 0.38, C.pipe);
  }
  for (let z = ZR0 + 3.3; z < ZEND; z += 6.6) D_('走廊_橫樑', -XC, XC, z - 0.2, z + 0.2, H2 - 0.35, H2, C.wall);
  for (let z = ZR0 + 5; z < ZEND; z += 6.6) D_('日光燈', -0.14, 0.14, z - 0.62, z + 0.62, H2 - 0.42, H2 - 0.33, C.lamp);
  const rooms = [], noteAt = new Map(); // noteAt：門旁告示框改放在門右手邊、夾手寫紙的房間（門中心 z → 紙上的字）
  const DW = 1.0, DH = F + 2.08, LT = F + 2.16, WL0 = F + 2.55, WL1 = F + 3.15; // 門寬、門高、門框上緣、高窗上下緣
  const corridorWall = (s, z0, z1, centers) => { // centers：門中心 z
    const x = s * (XC + WT / 2), xf = s * XC; // 牆中心、走廊側牆面
    const dg = centers.map((c) => [c - DW / 2, c + DW / 2]), wg = centers.map((c) => [c - 1.1, c + 1.1]);
    wallZ('走廊_牆', x, z0, z1, WT, F, LT, dg, C.wall);
    wallZ('走廊_牆', x, z0, z1, WT, LT, WL0, [], C.wall);
    wallZ('走廊_牆', x, z0, z1, WT, WL0, WL1, wg, C.wall);
    wallZ('走廊_牆', x, z0, z1, WT, WL1, H2, [], C.wall);
    for (const [a, b] of segs(z0, z1, dg)) D_('走廊_踢腳板', xf - s * 0.02, xf, a, b, F, F + 0.28, C.skirt);
    for (const c of centers) {
      // 門框（深色）
      for (const zz of [c - DW / 2 - 0.07, c + DW / 2]) D_('走廊_門框', x - WT / 2 - 0.02, x + WT / 2 + 0.02, zz, zz + 0.07, F, LT, C.frame);
      D_('走廊_門框', x - WT / 2 - 0.02, x + WT / 2 + 0.02, c - DW / 2 - 0.07, c + DW / 2 + 0.07, DH, LT, C.frame);
      // 門上方的高窗（兩片霧面玻璃＋深色窗框）
      S_('走廊_高窗戶', x - 0.02, x + 0.02, c - 1.1, c + 1.1, WL0, WL1, C.frost);
      for (const zz of [c - 1.1, c - 0.03, c + 1.04]) D_('走廊_高窗框', x - WT / 2 - 0.015, x + WT / 2 + 0.015, zz, zz + 0.07, WL0, WL1, C.frame);
      for (const yy of [WL0, WL1 - 0.06]) D_('走廊_高窗框', x - WT / 2 - 0.015, x + WT / 2 + 0.015, c - 1.1, c + 1.1, yy, yy + 0.06, C.frame);
      // 門旁的告示框
      const note = noteAt.get(c), nz = note ? (s < 0 ? c - DW / 2 - 0.45 - 0.32 : c + DW / 2 + 0.45) : c + DW / 2 + 0.45; // 站在走廊面對門：西排右手邊是北（-z）
      D_('走廊_告示框', xf - s * 0.025, xf, nz, nz + 0.32, F + 1.3, F + 1.75, C.frame); D_('走廊_告示紙', xf - s * 0.03, xf - s * 0.025, nz + 0.03, nz + 0.29, F + 1.33, F + 1.72, C.paper);
      if (note) notes.push({ x: xf - s * 0.042, y: F + 1.525, z: nz + 0.16, ry: s < 0 ? Math.PI / 2 : -Math.PI / 2, w: 0.25, h: 0.38, t: note });
    }
  };
  const room = (s, i, no) => {
    const z0 = ZR0 + i * RW, z1 = z0 + RW, zc = (z0 + z1) / 2, xc = s * (XC + WT), xe = s * (XE - WT); // 房內：走廊牆內面→外牆內面
    const X = (d) => xc + s * d, D = XE - WT - (XC + WT); // d：離走廊牆的距離
    const tag = `二樓_${no}房_`;
    const RWc = 0xdcd9d0, BW_ = 0xe6e6e1, TEAL = 0x5fa9a3, GRY = 0x8c9094, DESK = 0x9cc9c6;
    S_(tag + '地板', Math.min(s * XC, xe), Math.max(s * XC, xe), z0, z1, F - 0.2, F, C.floorR);
    tplanes.push({ kind: 'roomTile', x0: Math.min(xc, xe), x1: Math.max(xc, xe), z0: z0 + 0.06, z1: z1 - 0.06, y: F + 0.006 });
    D_(tag + '天花板', Math.min(xc, xe), Math.max(xc, xe), z0, z1, H2, H2 + 0.1, 0xd8d6cf);
    if (i === 0) S_(tag + '北牆', s * (XC + WT), s * XE, z0 - 0.06, z0 + 0.06, F, H2, RWc);
    S_(tag + '隔牆', s * (XC + WT), s * XE, z1 - 0.06, z1 + 0.06, F, H2, RWc);
    for (const zz of [z0 + 0.06, z1 - 0.08]) D_(tag + '踢腳板', X(0), X(D), zz, zz + 0.02, F, F + 0.15, C.skirt);
    const xw = s * (XE - WT / 2);
    S_(tag + '外牆', xw - WT / 2, xw + WT / 2, z0, z1, F, F + 0.9, RWc); S_(tag + '外牆', xw - WT / 2, xw + WT / 2, z0, z1, F + 2.5, H2, RWc);
    S_(tag + '外牆', xw - WT / 2, xw + WT / 2, z0, z0 + 0.35, F + 0.9, F + 2.5, RWc); S_(tag + '外牆', xw - WT / 2, xw + WT / 2, z1 - 0.35, z1, F + 0.9, F + 2.5, RWc);
    S_(tag + '最內側窗戶', xw - 0.03, xw + 0.03, z0 + 0.35, z1 - 0.35, F + 0.9, F + 2.5, C.frost);
    for (const zz of [z0 + 0.35, zc - 0.03, z1 - 0.41]) D_(tag + '窗框', xw - 0.07, xw + 0.07, zz, zz + 0.06, F + 0.9, F + 2.5, 0xb9bab4);
    for (const yy of [F + 0.9, F + 1.95, F + 2.45]) D_(tag + '窗框', xw - 0.07, xw + 0.07, z0 + 0.35, z1 - 0.35, yy, yy + 0.05, 0xb9bab4);
    for (const zz of [z0 + 0.25, z1 - 0.65]) D_(tag + '窗簾', X(D - 0.12), X(D - 0.08), zz, zz + 0.4, F + 0.75, F + 2.55, 0x9aaaa0);
    D_(tag + '冷氣', X(D - 0.25), X(D), zc - 0.45, zc + 0.45, F + 2.75, F + 3.05, 0xeeeeea);
    // 門（在寢室正中間）：門框上緣＝門牌位置；門扇可開關（預設關著）
    S_(tag + '門框上緣', s * XC, s * (XC + WT), zc - DW / 2, zc + DW / 2, DH, LT, C.frame);
    if (no === 224) noteAt.set(zc, '莫須有'); // 224：白色鐵門、門右手邊的告示框夾一張手寫「莫須有」
    doors.push({ iron: no === 224, room: tag.slice(0, -1), no, hx: s * (XC + WT / 2), hz: zc + DW / 2, cx: s * (XC + WT / 2), cz: zc, axis: 'z', openAng: -s * Math.PI / 2 * 0.95, len: DW - 0.02, y0: F + 0.01, y1: DH - 0.01, s, zc });
    // 入口區（進門後約一張床長的空間）：側邊鞋櫃、門旁穿衣鏡
    S_(tag + '鞋櫃', X(0.25), X(1.85), z0 + 0.08, z0 + 0.43, F, F + 1.0, BW_);
    D_(tag + '鞋櫃門縫', X(1.04), X(1.06), z0 + 0.43, z0 + 0.44, F + 0.05, F + 0.95, 0xb0b0aa);
    D_(tag + '鏡框', X(0), X(0.03), zc + DW / 2 + 0.15, zc + DW / 2 + 0.75, F + 0.35, F + 1.95, 0x9a9c9a); D_(tag + '鏡子', X(0.03), X(0.04), zc + DW / 2 + 0.19, zc + DW / 2 + 0.71, F + 0.39, F + 1.91, C.mirror);
    S_(tag + '鞋櫃', X(0.25), X(1.85), z1 - 0.43, z1 - 0.08, F, F + 1.0, BW_);
    if (no === 224) { // 進門右手邊（西排面朝房內右手是北）的白色小冰箱，緊貼鞋櫃旁
      const fz0 = s < 0 ? z0 + 0.1 : z1 - 0.6, fa = 1.95, fb = 2.47;
      S_(tag + '小冰箱', Math.min(X(fa), X(fb)), Math.max(X(fa), X(fb)), fz0, fz0 + 0.5, F, F + 0.86, 0xf0f0ec);
      props.push({ k: 'fridge', x: X((fa + fb) / 2), z: fz0 + 0.25, y: F, ry: s < 0 ? 0 : Math.PI });
    }
    // 上舖下桌（參考照片）：同一面牆兩張床頭尾相接；床下櫃子連著櫃子（門口端書桌＋書架 → 衣櫃 → 衣櫃 → 窗邊書桌）；
    // 兩張床中間共用一片隔板、一個斜靠的灰色鐵梯（上端彎鉤）；白色床箱、灰色方管床架
    const DJ = 5.45, beds = [[3.3, DJ, 'door'], [DJ, 7.6, 'win']];
    for (const side of [0, 1]) {
      const za = side === 0 ? z0 + 0.06 : z1 - 1.06, zb = za + 1.0, zw0 = side === 0 ? z0 + 0.06 : z1 - 0.66, zw1 = zw0 + 0.6;
      const zin = side === 0 ? zb : za, out = side === 0 ? 1 : -1, zf = side === 0 ? zw1 : zw0; // 靠走道那側、往走道的方向、櫃子正面
      const face = (t) => (side === 0 ? [zf, zf + t] : [zf - t, zf]);
      beds.forEach(([d0, d1, deskEnd], bi) => {
        const k = side * 2 + bi + 1;
        S_(tag + '上舖床板' + k, X(d0), X(d1), za, zb, F + 1.84, F + 1.98, BW_);
        S_(tag + '床墊' + k, X(d0 + 0.05), X(d1 - 0.05), za + 0.04, zb - 0.04, F + 1.98, F + 2.1, 0x7d8286);
        D_(tag + '棉被' + k, bi === 0 ? X(d0 + 0.15) : X(d1 - 0.75), bi === 0 ? X(d0 + 0.75) : X(d1 - 0.15), za + 0.15, zb - 0.15, F + 2.1, F + 2.32, 0x5d6266);
        const sa = bi === 0 ? d0 : d0 + 0.3, sb = bi === 0 ? d1 - 0.3 : d1; // 梯子那段不做側板（上下床的開口）
        S_(tag + '床側板' + k, X(sa), X(sb), zin - 0.02, zin + 0.02, F + 1.84, F + 2.38, BW_);
        D_(tag + '床側板邊' + k, X(sa), X(sb), zin - 0.025, zin + 0.025, F + 2.36, F + 2.4, TEAL);
        const endD = bi === 0 ? d0 : d1; S_(tag + '床尾板' + k, X(endD - 0.02), X(endD + 0.02), za, zb, F + 1.84, F + 2.5, BW_);
        // 床下：書桌（門口那張在門口端、窗邊那張在窗邊）＋衣櫃（兩個衣櫃在中間連在一起）
        const [ka, kb] = deskEnd === 'door' ? [d0 + 0.06, d0 + 1.2] : [d1 - 1.2, d1 - 0.06], [wa, wb] = deskEnd === 'door' ? [d0 + 1.22, d1 - 0.01] : [d0 + 0.01, d1 - 1.22];
        S_(tag + '衣櫃' + k, X(wa), X(wb), zw0, zw1, F, F + 1.82, BW_);
        const wm = (wa + wb) / 2;
        D_(tag + '衣櫃門縫' + k, X(wm - 0.01), X(wm + 0.01), ...face(0.005), F + 0.05, F + 1.77, 0xb0b0aa);
        for (const dd of [wm - 0.09, wm + 0.07]) D_(tag + '衣櫃把手' + k, X(dd), X(dd + 0.02), ...face(0.03), F + 0.95, F + 1.12, 0x9a9a96);
        for (const dd of [wa, wb - 0.02]) D_(tag + '衣櫃邊' + k, X(dd), X(dd + 0.02), ...face(0.006), F, F + 1.82, TEAL);
        S_(tag + '書桌' + k, X(ka), X(kb), zw0, zw1, F + 0.72, F + 0.76, DESK);
        D_(tag + '書桌邊' + k, X(ka), X(kb), ...face(0.02), F + 0.71, F + 0.77, 0x7a4a2a);
        const [ra, rb] = deskEnd === 'door' ? [ka, ka + 0.42] : [kb - 0.42, kb];
        S_(tag + '書桌抽屜' + k, X(ra), X(rb), zw0, zw1 - 0.04, F, F + 0.72, BW_);
        D_(tag + '書桌抽屜邊' + k, X(ra), X(rb), ...face(-0.035), F + 0.5, F + 0.52, TEAL);
        D_(tag + '書架背板' + k, X(ka), X(kb), side === 0 ? zw0 : zw1 - 0.02, side === 0 ? zw0 + 0.02 : zw1, F + 0.76, F + 1.82, BW_);
        const zs0 = side === 0 ? zw0 : zw1 - 0.32, zs1 = zs0 + 0.32;
        for (const y of [F + 1.12, F + 1.47]) { D_(tag + '書架' + k, X(ka), X(kb), zs0, zs1, y, y + 0.03, BW_); D_(tag + '書架' + k, X(ka), X(kb), side === 0 ? zs1 - 0.01 : zs0, side === 0 ? zs1 + 0.01 : zs0 + 0.01, y, y + 0.02, TEAL); }
        D_(tag + '床架橫桿' + k, X(ka), X(kb), zin - 0.03 * out - 0.02, zin - 0.03 * out + 0.02, F + 1.42, F + 1.46, GRY); // 書桌外側那根灰色橫桿
        // 摺疊椅
        { const cx_ = (ka + kb) / 2, czz = side === 0 ? zw1 + 0.35 : zw0 - 0.35;
          D_(tag + '椅子' + k, X(cx_ - 0.21), X(cx_ + 0.21), czz - 0.2, czz + 0.2, F + 0.44, F + 0.49, 0x1d1f22);
          D_(tag + '椅背' + k, X(cx_ - 0.2), X(cx_ + 0.2), side === 0 ? czz + 0.18 : czz - 0.22, side === 0 ? czz + 0.22 : czz - 0.18, F + 0.55, F + 0.85, 0x1d1f22);
          for (const [a, b] of [[-0.19, -0.18], [0.17, -0.18], [-0.19, 0.16], [0.17, 0.16]]) D_(tag + '椅腳' + k, X(cx_ + a), X(cx_ + a + 0.02), czz + b, czz + b + 0.02, F, F + 0.44, GRY); }
      });
      // 床架立柱：兩端＋中間共用一組
      for (const dd of [3.3, DJ - 0.025, 7.55]) for (const zz of [za, zb - 0.05]) S_(tag + '床架立柱' + (side * 2 + 1), X(dd), X(dd + 0.05), zz, zz + 0.05, F, F + 1.9, GRY);
      // 兩張床中間共用的隔板（上緣做成圓弧感：中間高、兩側低）
      S_(tag + '床間隔板' + (side + 1), X(DJ - 0.02), X(DJ + 0.02), za, zb, F + 1.84, F + 2.55, BW_);
      D_(tag + '床間隔板邊' + (side + 1), X(DJ - 0.025), X(DJ + 0.025), za, zb, F + 2.55, F + 2.58, TEAL);
      // 共用的斜靠鐵梯（在兩張床中間，上端彎鉤）
      const lzB = zin + out * 0.5, lzT = zin + out * 0.04, la = DJ - 0.24, lb = DJ + 0.24;
      for (const dd of [la, lb]) { beams.push({ x0: X(dd), y0: F, z0: lzB, x1: X(dd), y1: F + 2.45, z1: lzT, w: 0.045, c: GRY }); beams.push({ x0: X(dd), y0: F + 2.45, z0: lzT, x1: X(dd), y1: F + 2.6, z1: lzT - out * 0.12, w: 0.045, c: GRY }); }
      for (let j = 1; j <= 7; j++) { const t = j / 7.6, zz = lzB + (lzT - lzB) * t; D_(tag + '梯子橫桿' + (side + 1), X(la), X(lb + 0.045), zz - 0.02, zz + 0.02, F + 2.45 * t, F + 2.45 * t + 0.035, GRY); }
    }
    rooms.push({ no, s, z0, z1, zc, cx: X(4.6), X });
    patrol.push({ x: X(1.0), z: zc, y: F });
    return zc;
  };
  for (const s of [1, -1]) {
    const cs = [];
    for (let i = 0; i < NR; i++) cs.push(room(s, i, s > 0 ? 215 - i : 216 + i)); // 東側由南往北 201→215（215 靠浴廁），西側由北往南 216→230
    corridorWall(s, ZR0, ZR1, cs);
  }
  // 右側南段：上鎖的房間（不能進入，門一樣在中間）
  {
    const bounds = [ZR1, PZ(1233), PZ(1305), PZ(1370), PZ(1448), ZEND], cs = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const z0 = bounds[i], z1 = bounds[i + 1], c = (z0 + z1) / 2; cs.push(c);
      S_('二樓_儲藏室_隔牆', XC + WT, XE, z1 - 0.06, z1 + 0.06, F, H2, C.wallR);
      S_('二樓_儲藏室_門', XC + 0.05, XC + 0.1, c - DW / 2, c + DW / 2, F, DH, C.door); D_('二樓_儲藏室_門把', XC, XC + 0.05, c - DW / 2 + 0.1, c - DW / 2 + 0.16, F + 0.95, F + 1.05, C.pipe);
    }
    S_('二樓_儲藏室_外牆', XE - WT, XE, ZR1, ZEND, F, H2, C.wallR);
    S_('二樓_儲藏室_封板', XC + 0.1, XE - WT, ZR1, ZEND, F, H2, C.black);
    corridorWall(1, ZR1, ZEND, cs);
  }
  // 左側南段：往一樓的小樓梯間（只能往下；用空氣牆擋住）
  {
    const z0 = ZR1, z1 = ZN1, x0 = -XE, x1 = -XC - WT;
    const rr = F / 16, tt = 0.55, xa = x1 - 0.6, xm = xa - 8 * tt;
    S_('二樓_小樓梯間頂平台', xa, -XC, z0 + 0.06, z1, F - 0.2, F, C.slab);
    S_('二樓_小樓梯間一樓地板', x0, x1, z0, z1, -0.22, 0, C.slab);
    S_('二樓_小樓梯間西牆', x0 - WT, x0, z0, z1, 0, H2, C.wall);
    S_('二樓_小樓梯間北牆', x0, -XC, z0 - 0.06, z0 + 0.06, 0, F, C.wallR);
    S_('二樓_小樓梯間南牆', x0, -XC, z1 - WT, z1, 0, F, C.wall);
    S_('二樓_小樓梯間東牆', x1, -XC, z0, z1, 0, F - 0.2, C.wall);
    for (let k = 0; k < 8; k++) S_('二樓_小樓梯', xa - (k + 1) * tt, xa - k * tt, z1 - 2.1, z1 - 0.1, 0, F - (k + 1) * rr, C.step);
    S_('二樓_小樓梯平台', x0, xm, z0 + 0.1, z1 - 0.1, 0, F - 8 * rr, C.land);
    for (let k = 0; k < 7; k++) S_('二樓_小樓梯', xm + k * tt, xm + (k + 1) * tt, z0 + 0.1, z0 + 2.1, 0, F - (9 + k) * rr, C.step);
    S_('二樓_小樓梯中牆', xm, xa, z0 + 2.1, z1 - 2.1, 0, F - 8 * rr + 1.0, C.wall);
    for (let k = 0; k < 8; k++) D_('二樓_小樓梯止滑條', xa - (k + 1) * tt + 0.02, xa - (k + 1) * tt + 0.08, z1 - 2.05, z1 - 0.15, F - (k + 1) * rr, F - (k + 1) * rr + 0.01, C.frame);
    S_('二樓_小樓梯間牆', xa - 0.12, xa, z0 + 0.06, z1 - 2.1, F - 0.2, H2, C.wall);
    D_('二樓_小樓梯間天花板', x0, x1, z0, z1, H2, H2 + 0.1, C.ceil);
    // 走廊牆在這段只留上半部（下方是開口）
    const x = -(XC + WT / 2);
    S_('走廊_牆', x - WT / 2, x + WT / 2, z0, z1, F + 2.6, H2, C.wall);
    air('小樓梯間', -XC - WT, -XC, z0, z1, F, H2);
  }
  // Ⓔ 緊急照明、Ⓒ 滅火器（位置依平面圖）
  for (const r of rooms) if (r.no === 202 || r.no === 217) emergencyLight(r.s * (XC + WT + 0.04), F + 2.35, r.zc + 1.0, r.s, 0);
  for (const py of [297, 717, 1215]) emergencyLight(XC - 0.04, F + 2.45, planZ(py) + 1.6, -1, 0);
  for (const py of [343, 544, 686, 957, 1095]) extinguisher(-XC, planZ(py), F, 1);
  extinguisher(-XC, ZN1 - 0.3, F, 1);
  for (let z = ZEND - 2; z > ZR0; z -= 6) patrol.push({ x: 0, z, y: F });

  // =====================================================================
  // 浴室廁所（依浴室平面圖：左半部浴室、右半部廁所〔蹲式〕、中間洗手台與落地窗）
  // 平面圖像素換算：x 以走廊中線（px 792）為 0，每像素 0.021 m；南牆（py 1165）對齊寢室北端
  // =====================================================================
  const BK = 0.021, BZ1 = ZR0;
  const bx = (px) => (px - 792) * BK, bz = (py) => BZ1 - (1165 - py) * BK;
  const BX0 = bx(88), BX1 = bx(1525), BZ0 = bz(662), ZAN = bz(1240), XAN = Math.max(bx(1313), XE + WT); // 外框；東南角小便斗區
  const PH = 0.25, FP = F + PH; // 北半部整片墊高（只有一層落差）
  const CZ0 = bz(668), CZ1 = bz(1013); // 每一排隔間的南北範圍（4 間）
  S_('浴廁_地板', BX0, BX1, BZ0, BZ1, F - 0.2, F, C.tile);
  S_('浴廁_地板', XAN, BX1, BZ1, ZAN, F - 0.2, F, C.tile);
  D_('浴廁_天花板', BX0 - WT, BX1 + WT, BZ0 - WT, BZ1, H2, H2 + 0.1, C.ceil); D_('浴廁_天花板', XAN, BX1 + WT, BZ1, ZAN + WT, H2, H2 + 0.1, C.ceil);
  S_('浴廁_北牆', BX0 - WT, BX1 + WT, BZ0 - WT, BZ0, F, H2, C.tileW);
  S_('浴廁_西牆', BX0 - WT, BX0, BZ0, BZ1 + WT, F, H2, C.tileW);
  S_('浴廁_東牆', BX1, BX1 + WT, BZ0, ZAN + WT, F, H2, C.tileW);
  const BD0 = -14.4, BD1 = -13.3; // 南牆通往室外樓梯的門
  wallX('浴廁_南牆', BX0, -XE, BZ1 + WT / 2, WT, F, H2, [[BD0, BD1]], C.tileW); S_('浴廁_南牆', BD0, BD1, BZ1, BZ1 + WT, F + 2.1, H2, C.tileW);
  for (const x of [BD0 - 0.07, BD1]) D_('浴廁_側門框', x, x + 0.07, BZ1 - 0.02, BZ1 + WT + 0.02, F, F + 2.16, C.frame);
  S_('浴廁_南牆', XE, XAN, BZ1, BZ1 + WT, F, H2, C.tileW);
  S_('浴廁_南牆', XAN - WT, XAN, BZ1, ZAN + WT, F, H2, C.tileW);
  S_('浴廁_南牆', XAN, BX1, ZAN, ZAN + WT, F, H2, C.tileW);
  for (const [x0, x1, z0, z1] of [[BX0, BX1, BZ0, BZ0 + 0.02], [BX0, BX0 + 0.02, BZ0, BZ1], [BX1 - 0.02, BX1, BZ0, ZAN]]) D_('浴廁_磁磚腰帶', x0, x1, z0, z1, F + 1.42, F + 1.52, C.strip);
  // 平面圖粉紅線：北半部（隔間、洗手台、洗衣機那一帶）整片比走道高一層，只有中間落地窗那排沒有
  S_('浴廁_墊高地面', BX0, bx(727), BZ0, CZ1, F, FP, C.tile); S_('浴廁_墊高地面', bx(840), BX1, BZ0, CZ1, F, FP, C.tile);
  D_('浴廁_落差邊', BX0, bx(727), CZ1 - 0.04, CZ1, FP, FP + 0.005, C.stallF); D_('浴廁_落差邊', bx(840), BX1, CZ1 - 0.04, CZ1, FP, FP + 0.005, C.stallF);
  // 地板：灰色方塊磁磚；牆面：白色小磁磚＋橘色馬賽克腰帶；天花板：白色格子板
  tplanes.push({ kind: 'bathFloor', x0: BX0, x1: BX1, z0: CZ1, z1: BZ1, y: F + 0.006 }, { kind: 'bathFloor', x0: XAN, x1: BX1, z0: BZ1, z1: ZAN, y: F + 0.006 });
  tplanes.push({ kind: 'bathFloor', x0: BX0, x1: bx(727), z0: BZ0, z1: CZ1, y: FP + 0.006 }, { kind: 'bathFloor', x0: bx(840), x1: BX1, z0: BZ0, z1: CZ1, y: FP + 0.006 });
  tplanes.push({ kind: 'bathFloor', wall: 'z', z: CZ1 + 0.006, x0: BX0, x1: bx(727), y0: F, y1: FP, nz: 1 }, { kind: 'bathFloor', wall: 'z', z: CZ1 + 0.006, x0: bx(840), x1: BX1, y0: F, y1: FP, nz: 1 });
  tplanes.push({ kind: 'wallTile', wall: 'z', z: BZ0 + 0.004, x0: BX0, x1: bx(712), y0: F, y1: FP + 2.2, nz: 1 }, { kind: 'wallTile', wall: 'z', z: BZ0 + 0.004, x0: bx(840), x1: BX1, y0: F, y1: FP + 2.2, nz: 1 });
  tplanes.push({ kind: 'wallTile', wall: 'x', x: BX0 + 0.004, z0: BZ0, z1: BZ1, y0: F, y1: H2, nx: 1 }, { kind: 'wallTile', wall: 'x', x: BX1 - 0.004, z0: BZ0, z1: ZAN, y0: F, y1: H2, nx: -1 });
  tplanes.push({ kind: 'wallTile', wall: 'z', z: BZ1 - 0.004, x0: BX0, x1: BD0, y0: F, y1: H2, nz: -1 }, { kind: 'wallTile', wall: 'z', z: BZ1 - 0.004, x0: BD1, x1: -XE, y0: F, y1: H2, nz: -1 });
  tplanes.push({ kind: 'ceilPanel', x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, y: H2 - 0.004, down: 1 });
  // 北牆高處的鋁製百葉窗（隔間上方）
  for (const [wx0, wx1] of [[BX0 + 0.25, bx(712) - 0.25], [bx(840) + 0.25, BX1 - 0.25]]) {
    const n = Math.max(1, Math.round((wx1 - wx0) / 1.6)), ww = (wx1 - wx0) / n, wy0 = FP + 2.3, wy1 = H2 - 0.3;
    D_('浴廁_高窗戶', wx0, wx1, BZ0 + 0.005, BZ0 + 0.02, wy0, wy1, C.frost);
    for (let i = 0; i <= n; i++) D_('浴廁_高窗框', wx0 + i * ww - 0.03, wx0 + i * ww + 0.03, BZ0 - 0.01, BZ0 + 0.05, wy0, wy1, 0xc4c6c4);
    for (const y of [wy0, wy1 - 0.05]) D_('浴廁_高窗框', wx0, wx1, BZ0 - 0.01, BZ0 + 0.05, y, y + 0.05, 0xc4c6c4);
    for (let y = wy0 + 0.13; y < wy1 - 0.08; y += 0.13) D_('浴廁_百葉', wx0 + 0.03, wx1 - 0.03, BZ0 + 0.0, BZ0 + 0.04, y, y + 0.012, 0xb4b7b6);
  }
  // ---------- 隔間排（open：開口方向 'E' 或 'W'；back、front：背牆與開口的 x）----------
  const column = (kind, back, front, open, oldDoor) => { // oldDoor：最靠走道那間（k = 3）的門是老舊、會倒下來的那扇
    const dir = open === 'E' ? -1 : 1; // 從開口往內
    const xa = Math.min(back, front), xb = Math.max(back, front), toilet = kind === 'stall';
    const L = (CZ1 - CZ0) / 4;
    const SH = toilet ? 0.2 : 0; // 廁所隔間比走道再高一階（照片）
    for (let k = 0; k <= 4; k++) S_('浴廁_隔間板', xa, xb, CZ0 + k * L - 0.03, CZ0 + k * L + 0.03, F + PH, F + PH + SH + 2.1, C.stall);
    for (let k = 0; k < 4; k++) {
      const z0 = CZ0 + k * L, z1 = z0 + L, zm = (z0 + z1) / 2, F2 = F + PH + SH;
      if (toilet) { // 隔間內的台階：從後牆到門口，門口往走道多凸出 5 cm，立面與上面都貼地磚
        const ef = front - dir * 0.05, sx0 = Math.min(back, ef), sx1 = Math.max(back, ef);
        S_('浴廁_隔間台階', sx0, sx1, z0 + 0.03, z1 - 0.03, FP, F2, C.tile);
        tplanes.push({ kind: 'bathFloor', x0: sx0, x1: sx1, z0: z0 + 0.03, z1: z1 - 0.03, y: F2 + 0.006 }, { kind: 'bathFloor', wall: 'x', x: ef - dir * 0.006, z0: z0 + 0.03, z1: z1 - 0.03, y0: FP, y1: F2, nx: -dir });
        D_('浴廁_台階邊', Math.min(ef, ef + dir * 0.04), Math.max(ef, ef + dir * 0.04), z0 + 0.03, z1 - 0.03, F2, F2 + 0.004, C.stallF);
      }
      if (toilet) { // 蹲式馬桶
        const p0 = back - dir * 0.22, p1 = back - dir * 0.82;
        props.push({ k: 'squat', x: (p0 + p1) / 2, z: zm, y: F2, dir });
        D_('浴廁_蹲式馬桶', Math.min(p0, p1), Math.max(p0, p1), zm - 0.2, zm + 0.2, F2, F2 + 0.03, C.white);
        D_('浴廁_蹲式馬桶凹槽', Math.min(p0, p1) + 0.08, Math.max(p0, p1) - 0.08, zm - 0.12, zm + 0.12, F2 + 0.031, F2 + 0.033, 0x3a3f42);
        D_('浴廁_沖水管', back - dir * 0.04 - 0.02, back - dir * 0.04 + 0.02, zm - 0.02, zm + 0.02, F2, F2 + 1.1, C.pipe);
        D_('浴廁_沖水閥', back - dir * 0.08 - 0.04, back - dir * 0.08 + 0.04, zm - 0.06, zm + 0.06, F2 + 1.0, F2 + 1.12, C.pipe);
      } else { // 淋浴間
        D_('浴廁_蓮蓬頭', back - dir * 0.04 - 0.05, back - dir * 0.04 + 0.05, zm - 0.05, zm + 0.05, F2 + 1.9, F2 + 2.05, C.pipe);
        D_('浴廁_水管', back - dir * 0.03 - 0.02, back - dir * 0.03 + 0.02, zm - 0.02, zm + 0.02, F2 + 0.9, F2 + 1.95, C.pipe);
        D_('浴廁_毛巾架', back - dir * 0.03 - 0.02, back - dir * 0.03 + 0.02, z0 + 0.25, z0 + 0.7, F2 + 1.4, F2 + 1.43, C.pipe);
      }
      // 隔間正面：一片固定面板＋一扇門（平常半開，躲進去時關上）
      const DWd = 1.0, hz = z1 - 0.04, ang = 1.15, vx = dir * Math.sin(ang), vz = -Math.cos(ang);
      S_('浴廁_隔間前板', front - 0.03, front + 0.03, z0 + 0.03, hz - DWd, F2, F2 + 2.0, C.stall);
      if (oldDoor && k === 2) { // 老舊的門：整片往走道外翻開、斜斜掛著；玩家看著它時會倒下來（main.js 的 updateFallDoor）
        fallDoor = { x0: Math.min(front, front - dir * DWd), x1: Math.max(front, front - dir * DWd), z: hz + 0.02, y0: F2 + 0.06, h: 1.85, floor: F2, c: C.stall }; // 門整片往外翻到隔間前的通道上、只剩一個鉸鏈掛著；倒下時往南（玩家走進來的方向）拍在墊高的台階地面上
        D_('浴廁_門牌', front - 0.035, front + 0.035, hz - DWd - 0.35, hz - DWd - 0.15, F2 + 1.6, F2 + 1.72, C.white);
        continue;
      }
      rots.push({ n: '浴廁_隔間門', x: front + vx * DWd / 2, z: hz + vz * DWd / 2, wa: DWd, wb: 0.04, y0: F2 + 0.1, y1: F2 + 1.95, ry: Math.atan2(vx, vz), c: C.stall });
      D_('浴廁_門牌', front - 0.035, front + 0.035, hz - DWd - 0.35, hz - DWd - 0.15, F2 + 1.6, F2 + 1.72, C.white);
      spots.push({ kind, room: toilet ? '廁所' : '浴室', x0: xa + 0.06, x1: xb - 0.06, z0: z0 + 0.06, z1: z1 - 0.06, cx: front + dir * 0.45, cz: hz - DWd / 2, floor: F, camY: F2 + (toilet ? 1.0 : 1.3), lookYaw: open === 'E' ? -Math.PI / 2 : Math.PI / 2,
        door: { x0: front - 0.03, x1: front + 0.03, z0: hz - DWd, z1: hz, y0: F2 + 0.1, y1: F2 + 1.95, c: C.stall } });
    }
  };
  const backWall = (x0, x1) => S_('浴廁_背牆', bx(x0), bx(x1), CZ0, CZ1, F, FP + 2.4, C.tileW);
  // 左半部：浴室
  column('shower', bx(88), bx(148), 'E');
  column('shower', bx(275), bx(230), 'W'); backWall(275, 300); column('shower', bx(300), bx(372), 'E');
  column('shower', bx(503), bx(440), 'W', true); backWall(503, 522); // 最靠走廊入口那排：外間再往裡一間的門老舊會倒
  // 洗衣機（黃）與飲水機（紫）：靠在背牆東側
  for (const py of [717, 818, 916]) { const z = bz(py); props.push({ k: 'washer', x0: bx(522), x1: bx(522) + 0.62, z0: z - 0.31, z1: z + 0.31, y: FP, face: 'E' }); S_('浴廁_洗衣機', bx(522), bx(522) + 0.62, z - 0.31, z + 0.31, FP, FP + 0.88, 0xe2e2dc); D_('浴廁_洗衣機蓋', bx(522) + 0.1, bx(522) + 0.52, z - 0.21, z + 0.21, FP + 0.88, FP + 0.9, 0x9aa0a6); }
  { const z = bz(993); props.push({ k: 'disp', x0: bx(522), x1: bx(522) + 0.45, z0: z - 0.25, z1: z + 0.25, y: FP, face: 'E' }); S_('浴廁_飲水機', bx(522), bx(522) + 0.45, z - 0.25, z + 0.25, FP, FP + 1.3, C.disp); D_('浴廁_飲水機面板', bx(522) + 0.45, bx(522) + 0.47, z - 0.18, z + 0.18, FP + 0.95, FP + 1.2, C.black); }
  // 北牆的小洗手台（紅）
  { const x0 = bx(605), x1 = bx(660); S_('浴廁_洗手台', x0, x1, BZ0, BZ0 + 0.55, FP, FP + 0.85, C.white); D_('浴廁_鏡子', x0, x1, BZ0, BZ0 + 0.02, FP + 1.1, FP + 2.0, C.mirror); D_('浴廁_洗手盆', x0 + 0.1, x1 - 0.1, BZ0 + 0.12, BZ0 + 0.45, FP + 0.85, FP + 0.9, 0x88a4ab) }
  // 中間：兩道牆夾著的落地窗
  S_('浴廁_窗間牆', bx(712), bx(727), BZ0, bz(1015), F, H2, C.tileW);
  S_('浴廁_窗間牆', bx(826), bx(840), BZ0, bz(1015), F, H2, C.tileW);
  S_('浴廁_落地窗戶', bx(727), bx(826), bz(856) - 0.03, bz(856) + 0.03, F, H2, C.glass);
  for (const x of [bx(727), (bx(727) + bx(826)) / 2 - 0.03, bx(826) - 0.06]) D_('浴廁_落地窗框', x, x + 0.06, bz(856) - 0.05, bz(856) + 0.05, F, H2, C.frame);
  for (const y of [F, F + 1.0, H2 - 0.06]) D_('浴廁_落地窗框', bx(727), bx(826), bz(856) - 0.05, bz(856) + 0.05, y, y + 0.06, C.frame);
  S_('浴廁_窗外', bx(727), bx(826), BZ0, bz(850), F, H2, C.black); // 窗外（進不去）
  // 兩排長洗手台（紅）
  const longSink = (x0, x1, front) => { // front：洗手的人站的那一側（+1 東、-1 西）
    S_('浴廁_長洗手台', x0, x1, BZ0, bz(1008), FP, FP + 0.85, C.white);
    const wx = front > 0 ? x0 : x1; D_('浴廁_鏡子', wx - 0.01, wx + 0.01, BZ0 + 0.3, bz(1008) - 0.3, FP + 1.1, FP + 2.0, C.mirror);
    // 老式一整排的長水槽（沒有分格）
    D_('浴廁_長水槽', x0 + 0.12, x1 - 0.1, BZ0 + 0.15, bz(1008) - 0.15, FP + 0.85, FP + 0.855, 0x5f686c);
    D_('浴廁_水槽邊', front > 0 ? x1 - 0.1 : x0, front > 0 ? x1 : x0 + 0.1, BZ0, bz(1008), FP + 0.85, FP + 0.92, C.white);
    D_('浴廁_水管', front > 0 ? x0 + 0.05 : x1 - 0.09, front > 0 ? x0 + 0.09 : x1 - 0.05, BZ0 + 0.1, bz(1008) - 0.1, FP + 1.12, FP + 1.16, C.pipe);
    for (let z = BZ0 + 0.5; z < bz(1008) - 0.3; z += 0.75) D_('浴廁_水龍頭', front > 0 ? x0 + 0.06 : x1 - 0.18, front > 0 ? x0 + 0.18 : x1 - 0.06, z - 0.025, z + 0.025, FP + 1.0, FP + 1.14, C.pipe);
  };
  longSink(bx(840), bx(840) + 0.6, 1);
  S_('浴廁_背牆', bx(1067), bx(1093), CZ0, CZ1, F, FP + 2.4, C.tileW);
  longSink(bx(1067) - 0.6, bx(1067), -1);
  // 右半部：廁所（蹲式）
  column('stall', bx(1093), bx(1153), 'E');
  column('stall', bx(1305), bx(1245), 'W'); backWall(1305, 1325); column('stall', bx(1325), bx(1382), 'E');
  column('stall', bx(1525), bx(1468), 'W');
  // 北牆的兩個小便斗（綠）
  for (const [a, b] of [[1178, 1222], [1402, 1448]]) { const xm = (bx(a) + bx(b)) / 2; props.push({ k: 'urinal', x: xm, z: BZ0, y: FP + 0.45, face: 'S' }); S_('浴廁_小便斗', xm - 0.22, xm + 0.22, BZ0, BZ0 + 0.34, FP + 0.45, FP + 1.1, C.white); D_('浴廁_感應器', xm - 0.15, xm + 0.15, BZ0, BZ0 + 0.08, FP + 1.35, FP + 1.5, C.white); }
  for (const [a, b] of [[1153, 1245], [1382, 1468]]) D_('浴廁_橘色磁磚帶', bx(a), bx(b), BZ0 + 0.006, BZ0 + 0.016, FP + 1.24, FP + 1.32, 0xc47a36); // 照片：小便斗那面牆的橘色小磁磚帶
  // 東南角小便斗區（不做台階）
  S_('浴廁_小便斗區北牆', bx(1452), BX1, bz(1070) - 0.06, bz(1070) + 0.06, F, F + 2.2, C.tileW);
  S_('浴廁_小便斗區隔牆', bx(1452) - 0.06, bx(1452) + 0.06, bz(1150), ZAN, F, F + 2.2, C.tileW);
  for (const py of [1110, 1196]) { const z = bz(py); props.push({ k: 'urinal', x: BX1, z, y: F + 0.45, face: 'W' }); S_('浴廁_小便斗', BX1 - 0.34, BX1, z - 0.22, z + 0.22, F + 0.45, F + 1.1, C.white); D_('浴廁_感應器', BX1 - 0.08, BX1, z - 0.15, z + 0.15, F + 1.35, F + 1.5, C.white); }
  S_('浴廁_拖把桶', XAN + 0.3, XAN + 0.8, ZAN - 0.7, ZAN - 0.2, F, F + 0.5, 0x5b5f3a);
  // 入口
  // 巡邏點
  const AZ_ = (CZ0 + CZ1) / 2, ZS_ = (CZ1 + BZ1) / 2;
  for (const px of [189, 406, 610, 955, 1199, 1425]) patrol.push({ x: bx(px), z: AZ_, y: F });
  for (const px of [300, 792, 1200, 1490]) patrol.push({ x: bx(px), z: ZS_, y: F });

  // =====================================================================
  // 一樓中庭（大廳北側、宿管室旁的門出去）：走道＋兩塊草地＋曬衣桿；北端有室外樓梯上二樓浴室
  // 參考照片：左邊是別棟的高牆、右邊是宿舍寢室（有鐵窗與冷氣室外機）
  // =====================================================================
  const YX0 = XO1, YX1 = -XE, YZ1 = ZL0 - WT, YZ0 = ZR0 - 2.3; // 中庭範圍（西：宿管室東側那條線、東：寢室外牆）
  const CC = { conc: 0x55564f, grass: 0x3d6524, post: 0x3a2e24, bar: 0x8a8d8c, fac: 0xb9b6ad, win: 0x1a2226, ac: 0xd6d6d0, gate: 0x141414 };
  S_('中庭_地面', YX0, YX1, YZ0, ZL0, -0.22, 0, CC.conc);
  D_('中庭_草地', -22.3, YX1 - 0.7, -54.4, -26.1, 0, 0.03, CC.grass);
  D_('中庭_草地', -22.3, YX1 - 0.7, -21.4, -5.4, 0, 0.03, CC.grass);
  D_('中庭_排水溝蓋', YX0, YX0 + 0.5, YZ0, YZ1, 0, 0.012, 0x7c807f);
  // 曬衣桿（紅色）：每排三根木樁＋一根橫桿
  for (const z of [-50.5, -47.0, -43.7, -39.8, -36.4, -33.0, -29.5]) {
    for (const x of [-21.6, -18.0, -14.4]) S_('中庭_曬衣桿柱', x - 0.06, x + 0.06, z - 0.06, z + 0.06, 0, 1.9, CC.post);
    D_('中庭_曬衣桿', -21.66, -14.34, z - 0.02, z + 0.02, 1.78, 1.82, CC.bar);
  }
  // 西側：別棟建築的高牆（窗戶與冷氣室外機）
  S_('中庭_西側建築', YX0 - 0.3, YX0, YZ0, YZ1, 0, 12, CC.fac);
  for (let z = YZ0 + 2; z < YZ1 - 1; z += 4) {
    for (const y of [1.3, 4.6, 7.9]) { // 西側建築的窗：不透明的深色玻璃＋鋁框、中間直框、窗台（原本是半透明玻璃，貼在暗牆上看起來像浮在空中）
      D_('中庭_西側窗', YX0, YX0 + 0.02, z - 0.8, z + 0.8, y, y + 1.3, 0x1c2428);
      for (const zz of [z - 0.84, z + 0.8, z - 0.02]) D_('中庭_西側窗框', YX0, YX0 + 0.05, zz, zz + 0.04, y - 0.04, y + 1.34, 0x9a9e9e);
      for (const yy of [y - 0.04, y + 1.3]) D_('中庭_西側窗框', YX0, YX0 + 0.05, z - 0.84, z + 0.84, yy, yy + 0.04, 0x9a9e9e);
      D_('中庭_西側窗台', YX0, YX0 + 0.12, z - 0.9, z + 0.9, y - 0.1, y - 0.04, 0xa8a49a); }
    D_('中庭_冷氣室外機', YX0, YX0 + 0.35, z + 1.0, z + 1.8, 0, 0.6, CC.ac);
  }
  // 北側：圍牆與黑色鐵門
  S_('中庭_北側圍牆', YX0 - 0.3, -14.8, YZ0 - 0.3, YZ0, 0, 3.6, CC.fac);
  S_('中庭_北側圍牆', -14.8, YX1, YZ0 - 0.3, YZ0, 0, F - 0.2, CC.fac);
  D_('中庭_鐵門', -22.6, -20.4, YZ0, YZ0 + 0.04, 0, 2.4, CC.gate);
  // 東側：寢室一樓外牆（鐵窗、冷氣）＋二樓外牆上的冷氣室外機
  S_('中庭_寢室一樓外牆', YX1, YX1 + WT, YZ0, ZR1, 0, F, C.wallR);
  for (let i = 0; i < NR; i++) {
    const zc = ZR0 + (i + 0.5) * RW;
    D_('中庭_一樓窗戶', YX1 - 0.02, YX1, zc - 1.0, zc + 1.0, 1.0, 2.4, CC.win);
    for (let k = 0; k <= 12; k++) D_('中庭_鐵窗', YX1 - 0.08, YX1 - 0.05, zc - 1.0 + k * (2.0 / 12) - 0.01, zc - 1.0 + k * (2.0 / 12) + 0.01, 1.0, 2.4, CC.bar);
    D_('中庭_冷氣室外機', YX1 - 0.4, YX1, zc + 1.1, zc + 1.85, 2.5, 3.0, CC.ac);
    D_('中庭_冷氣室外機', YX1 - 0.4, YX1, zc + 1.1, zc + 1.85, F + 0.2, F + 0.75, CC.ac);
  }
  S_('中庭_南側牆', XL1 + WT, YX1, YZ1 - WT, YZ1, 0, F, C.wall);
  S_('一樓屋頂', XO1, YX1, YZ1 - 0.02, ZN1, F - 0.2, F - 0.02, C.slab); // 大廳北半部的屋頂（從中庭看得到）
  // 室外樓梯：從中庭往東上到二樓浴室（扶手是矮牆）
  const SZ0 = ZR0 + 0.2, SZ1 = SZ0 + 1.6, ST = 0.36, SXL = -XE - 2.74, SX0 = SXL - 16 * ST, sr = F / 16, RC = 0xd8d8d2; // 欄杆：白色鐵欄杆
  const rails = []; // 欄杆的扶手線（斜的用 beams 畫）
  for (let k = 0; k < 16; k++) {
    const x0 = SX0 + k * ST, top = (k + 1) * sr;
    S_('中庭_室外樓梯', x0, x0 + ST, SZ0, SZ1, 0, top, 0x6c6d68);
    S_('欄杆碰撞', x0, x0 + ST, SZ1 - 0.04, SZ1, 0, top + 1.0, RC);
    if (x0 < -14.8) S_('欄杆碰撞', x0, x0 + ST, SZ0, SZ0 + 0.04, 0, top + 1.0, RC);
    if (k % 2 === 0) for (const z of x0 < -14.8 ? [SZ0 + 0.03, SZ1 - 0.03] : [SZ1 - 0.03]) D_('中庭_欄杆柱', x0 + ST / 2 - 0.02, x0 + ST / 2 + 0.02, z - 0.02, z + 0.02, top, top + 1.0, RC);
  }
  for (const z of [SZ1 - 0.03, SZ0 + 0.03]) {
    const xe = z === SZ1 - 0.03 ? SXL : -14.8, ye = z === SZ1 - 0.03 ? F : ((-14.8 - SX0) / ST) * sr;
    for (const dy of [1.0, 0.5]) beams.push({ x0: SX0, y0: sr + dy, z0: z, x1: xe, y1: ye + dy, z1: z, w: dy === 1.0 ? 0.05 : 0.025, c: RC });
  }
  S_('中庭_室外樓梯平台', SXL, YX1, ZR0, SZ1 + 0.6, 0, F, 0x6c6d68);
  // 平台欄杆（南側、西側）
  S_('欄杆碰撞', SXL, YX1, SZ1 + 0.56, SZ1 + 0.6, F, F + 1.0, RC); S_('欄杆碰撞', SXL, SXL + 0.04, SZ1, SZ1 + 0.6, F, F + 1.0, RC);
  for (const dy of [1.0, 0.5]) { D_('中庭_欄杆', SXL, YX1, SZ1 + 0.56, SZ1 + 0.6, F + dy - 0.03, F + dy, RC); D_('中庭_欄杆', SXL, SXL + 0.04, SZ1, SZ1 + 0.6, F + dy - 0.03, F + dy, RC); }
  for (let x = SXL; x <= YX1; x += 0.68) D_('中庭_欄杆柱', x, x + 0.04, SZ1 + 0.56, SZ1 + 0.6, F, F + 1.0, RC);
  D_('中庭_欄杆柱', SXL, SXL + 0.04, SZ1, SZ1 + 0.04, F, F + 1.0, RC);
  // 大廳北牆的門（宿管室旁邊）、浴室南牆的門
  patrol.push({ x: -22, z: -8, y: 0 }, { x: -22, z: -24, y: 0 }, { x: -22, z: -40, y: 0 }, { x: -22, z: -58, y: 0 }, { x: -16, z: -23.8, y: 0 }, { x: -16, z: -56.5, y: 0 }, { x: -13.4, z: ZR0 + 1.6, y: F });

  // ---------- 巡邏點：一樓 ----------
  patrol.push({ x: DOOR.x - 3, z: 6.5, y: 0 }, { x: DOOR.x + 3.5, z: 6.5, y: 0 }, { x: -15.6, z: 0.7, y: 0 }, { x: XO1 + 1.0, z: 4.0, y: 0 }, { x: XL1 - 1.0, z: 0.7, y: 0 }, { x: -27, z: 6.5, y: 0 });

  // ---------- 一樓大門外（固定碰撞，不參與導航）----------
  const extra = [
    { n: 'outside', x0: DOOR.x - 7, x1: DOOR.x + 7, z0: ZB, z1: ZB + 10, y0: -0.4, y1: 0 },
    { n: 'outsideL', x0: DOOR.x - 7.2, x1: DOOR.x - 7, z0: ZB, z1: ZB + 10, y0: 0, y1: 3 },
    { n: 'outsideR', x0: DOOR.x + 7, x1: DOOR.x + 7.2, z0: ZB, z1: ZB + 10, y0: 0, y1: 3 },
    { n: 'outsideF', x0: DOOR.x - 7, x1: DOOR.x + 7, z0: ZB + 10, z1: ZB + 10.2, y0: 0, y1: 3 },
  ];
  // ---------- 208 號房：乳清、侯宸宇、垃圾袋 ----------
  const r208 = rooms.find((r) => r.no === 208);
  const hou = { x: r208.X(8.55), y: F + 0.01, z: r208.z0 + 0.75, talked: 0 }; // 進門左手邊靠窗的地上
  const bags = [[0, r208.X(2.3), r208.z0 + 1.0, 0.6], [1, r208.X(5.5), r208.z0 + 1.6, 0.55], [1, r208.X(1.2), r208.z0 + 2.9, 0.5], [0, r208.X(6.9), r208.z0 + 1.7, 0.46]];
  // =====================================================================
  // 樓梯上來後的走道加長 4.6 m：二樓在 x = C2 以東的東西（交誼廳、陽台、宿舍走廊、寢室、浴廁）全部往東移；
  // 跨過分界線的（交誼廳北牆、樓板、天花板…）往東拉長補滿。一樓只有寢室那一棟（晒衣場東側外牆、室外樓梯平台）跟著移，晒衣場因此變寬。
  // =====================================================================
  const XS = 4.6, C2 = -28.1, C1 = -12.15;
  const lvl2 = (y0, n) => y0 >= F - 0.21 && n !== '一樓屋頂';
  const mx = (v, cut) => (v >= cut ? v + XS : v);
  const fixBox = (b) => {
    const yard = b.n.startsWith('中庭_') || (b.n === '欄杆碰撞' && b.z1 < -50); // 晒衣場裡的東西（含西側高樓的窗、室外樓梯平台的欄杆）一律照一樓的規則，不跟著二樓整體移動
    const cut = (lvl2(b.y0, b.n) && !yard) ? C2 : C1;
    if (b.n === '中庭_草地' && b.x1 > -13.5) { b.x1 += XS; return; }
    if (b.n === '中庭_冷氣室外機' && b.x1 > C1) { b.x0 += XS; b.x1 += XS; return; } // 掛在寢室外牆上的冷氣室外機：整台跟著牆移，不要被拉長
    if (b.x0 >= cut) { b.x0 += XS; b.x1 += XS; }
    else if (b.x1 > cut + 0.001) { if (b.n.includes('窗')) { b.x0 += XS; b.x1 += XS; } else b.x1 += XS; }
  };
  for (const b of solid) fixBox(b); for (const b of deco) fixBox(b);
  for (const r of rots) r.x = mx(r.x, lvl2(r.y0, r.n) ? C2 : C1);
  for (const p of prisms) for (const q of p.pts) q.x = mx(q.x, lvl2(p.y0, p.n) ? C2 : C1);
  for (const bm of beams) { const c = Math.min(bm.y0, bm.y1) >= F - 0.21 ? C2 : C1; bm.x0 = mx(bm.x0, c); bm.x1 = mx(bm.x1, c); }
  for (const r of terrazzo) { const c = r.y > 3 ? C2 : C1; if (r.x0 >= c) { r.x0 += XS; r.x1 += XS; } else if (r.x1 > c) r.x1 += XS; }
  for (const p of tplanes) { const y = p.y ?? p.y0; const c = y > 3 ? C2 : C1; if (p.wall === 'x') p.x = mx(p.x, c); else { if (p.x0 >= c) { p.x0 += XS; p.x1 += XS; } else if (p.x1 > c) p.x1 += XS; } }
  for (const s of signs) s.x = mx(s.x, s.y > 3.2 ? C2 : C1);
  for (const e of lights) e.x = mx(e.x, e.y > 3.2 ? C2 : C1);
  for (const d of doors) { const c = d.y0 > 3 ? C2 : C1; d.hx = mx(d.hx, c); d.cx = mx(d.cx, c); }
  for (const p of patrol) p.x = mx(p.x, p.y > 3 ? C2 : C1);
  for (const s of spots) if ((s.floor ?? 0) > 3 && s.x0 >= C2) { s.x0 += XS; s.x1 += XS; if (s.cx !== undefined) s.cx += XS; if (s.door) { s.door.x0 += XS; s.door.x1 += XS; } }
  for (const r of rooms) { const oX = r.X; r.X = (d) => oX(d) + XS; r.cx += XS; }
  for (const o of [tv, remote, hou]) if (o) o.x = mx(o.x, C2);
  for (const bg of bags) bg[1] += XS;
  for (const nt of notes) nt.x = mx(nt.x, C2);
  if (fallDoor) { fallDoor.x0 += XS; fallDoor.x1 += XS; }
  for (const p of props) { const c = p.y > 3 ? C2 : C1; if (p.x !== undefined) p.x = mx(p.x, c); if (p.x0 !== undefined) { if (p.x0 >= c) { p.x0 += XS; p.x1 += XS; } else if (p.x1 > c) p.x1 += XS; } }
  // 晒衣場：草地、曬衣桿（木樁＋鐵鍊）用最終座標從方塊取出
  for (const b of deco) if (b.n === '中庭_草地') props.push({ k: 'grass', x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y: 0 });
  { const posts = solid.filter((b) => b.n === '中庭_曬衣桿柱'), rows = new Map();
    for (const b of posts) { const z = +((b.z0 + b.z1) / 2).toFixed(2); if (!rows.has(z)) rows.set(z, []); rows.get(z).push((b.x0 + b.x1) / 2); }
    for (const [z, xs] of rows) { xs.sort((a, b) => a - b); props.push({ k: 'clothesline', z, xs, y: 0 }); } }
  // 填滿：原本陽台西邊那塊空洞（交誼廳北牆外、一樓屋頂上方）做成實心建築
  S_('二樓_宿管室上方建築', XO0 - WT, XO1 - 0.3, -4.32, ZN1 - WT, F - 0.2, H2 + 0.15, C.wall); // 只填宿管室上方（晒衣場西側高樓後面）；陽台旁邊那段不再填
  // 加長那段南側（落地窗西邊）補上白牆
  S_('交誼廳_南牆_延伸', P0.x, -28.36 + XS, ZB - 0.02, ZB + 0.12, F, H2, C.wall); D_('交誼廳_踢腳板', P0.x, -28.36 + XS, ZB - 0.04, ZB - 0.02, F, F + 0.2, C.skirt);
  // 雙開門（銀色鋁框，兩扇都開著、關不起來）＋門框；門與落地窗中間放木頭塊堆成的擺飾
  { const XD = -25.2, Z0 = ZN1, Z1 = ZB, DWh = 1.2, zc = (Z0 + Z1) / 2, AL = 0xb9bdbf, ALd = 0x8e9294;
    S_('交誼廳_門牆', XD - 0.075, XD + 0.075, Z0, zc - DWh, F, H2, C.wall); S_('交誼廳_門牆', XD - 0.075, XD + 0.075, zc + DWh, Z1, F, H2, C.wall);
    S_('交誼廳_門楣', XD - 0.075, XD + 0.075, zc - DWh, zc + DWh, F + 2.25, H2, C.wall);
    for (const z of [zc - DWh - 0.06, zc + DWh]) D_('交誼廳_門框', XD - 0.1, XD + 0.1, z, z + 0.06, F, F + 2.28, AL);
    D_('交誼廳_門框', XD - 0.1, XD + 0.1, zc - DWh - 0.06, zc + DWh + 0.06, F + 2.22, F + 2.28, AL);
    for (const sg of [-1, 1]) { // 兩扇門往東推開、貼在門牆上
      const zH = zc + sg * DWh, x0 = XD + 0.08, x1 = XD + 0.08 + DWh * 0.98, zz0 = sg < 0 ? zH + 0.01 : zH - 0.06, zz1 = zz0 + 0.05;
      D_('交誼廳_雙開門', x0, x1, zz0, zz1, F + 0.02, F + 2.2, AL);
      D_('交誼廳_雙開門玻璃窗戶', x0 + 0.12, x1 - 0.12, zz0 - 0.005, zz1 + 0.005, F + 1.0, F + 2.05, C.frost);
      D_('交誼廳_門把', x1 - 0.18, x1 - 0.12, sg < 0 ? zz1 : zz0 - 0.05, sg < 0 ? zz1 + 0.05 : zz0, F + 0.7, F + 1.5, 0xd8d6cc);
      S_('欄杆碰撞', x0, x1, zz0, zz1, F, F + 2.2, AL); // 開著的門扇擋路（看不見的碰撞）
    }
    // 木頭擺飾：八角形、木條一圈圈往上疊、上寬下窄
    const px = XD + 0.55, pz = Z1 - 0.5, WD = [0x5c3420, 0x6a3d26, 0x4e2c1a];
    D_('交誼廳_擺飾底板', px - 0.25, px + 0.25, pz - 0.25, pz + 0.25, F, F + 0.03, 0x5a3a22);
    for (let k = 0; k < 14; k++) { const r = 0.16 + k * 0.016, y = F + 0.03 + k * 0.055; for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + (k % 2) * Math.PI / 8;
      rots.push({ n: '交誼廳_擺飾', x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r, wa: r * 0.8, wb: 0.05, y0: y, y1: y + 0.05, ry: -a, c: WD[(j + k) % 3] }); } }
    S_('欄杆碰撞', px - 0.35, px + 0.35, pz - 0.35, pz + 0.35, F, F + 0.8, 0x7a4a2c); // 擺飾的碰撞（看不見）
  }
  // 冷氣室外機（props.js 的 ac）：西側高樓的放地上、寢室外牆的掛在牆上（有鐵架）
  for (const b of deco) if (b.n === '中庭_冷氣室外機') props.push({ k: 'ac', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1, face: (b.x0 + b.x1) / 2 < -16 ? 'E' : 'W', y: b.y0 });
  // 細長的管線方塊改畫成圓管（props.js 的 tube）
  for (const b of deco) if (/管線|水管|沖水管/.test(b.n)) {
    const d = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0], m = Math.max(...d), ai = d.indexOf(m), r = Math.min(...d.filter((_, i) => i !== ai)) / 2;
    if (m < r * 6) continue; props.push({ k: 'tube', ax: 'xyz'[ai], x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1, r, c: b.c }); b.noDraw = true;
  }
  return {
    notes, fallDoor, solid, deco, spots, patrol, lights, signs, props, NO_DRAW, terrazzo, diag, rots, prisms, doors, beams, tplanes, sprisms, fogs, extra, tv, remote, hou, bags, rooms,
    F, H2, DOOR: { ...DOOR, z: ZB }, spawn: { x: DOOR.x, y: 0, z: ZB - 0.9 }, npc: { x: DOOR.x, y: 0, z: ZB - 3.2 },
    bathZ: ZR0, wheyDesk: '二樓_208房_書桌1', XS, altVia: { x: -13.4 + XS, y: F, z: ZR0 + 1.6 },
    exitSign: { x: DOOR.x, y: 2.78, z: ZB - 0.02 }, outside: { x: DOOR.x, z: ZB + 5, w: 14, d: 10 },
  };
}

// 程式產生的磁磚貼圖（寢室米色地磚、浴廁灰色地磚、白色壁磚、天花板格子板）
const TILE_KINDS = { roomTile: { m: 1.2, n: 4, base: [212, 198, 170], var: 12, grout: '#a49679', stain: 0.45 }, bathFloor: { m: 1.2, n: 4, base: [146, 149, 147], var: 9, grout: '#6c6f6e', stain: 0.4 }, wallTile: { m: 1.0, n: 5, base: [230, 230, 224], var: 5, grout: '#c3c3bb', stain: 0.1 }, ceilPanel: { m: 1.2, n: 2, base: [232, 232, 228], var: 2, grout: '#b8b8b0', stain: 0 } };
function tileCanvas(kind) {
  const K = TILE_KINDS[kind], S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  let seed = kind.length * 977; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = K.grout; g.fillRect(0, 0, S, S); const t = S / K.n, gw = kind === 'ceilPanel' ? 4 : 3;
  for (let i = 0; i < K.n; i++) for (let j = 0; j < K.n; j++) {
    const v = (rnd() - 0.5) * K.var; g.fillStyle = `rgb(${K.base[0] + v | 0},${K.base[1] + v | 0},${K.base[2] + v * 0.8 | 0})`; g.fillRect(i * t + gw / 2, j * t + gw / 2, t - gw, t - gw);
    for (let k = 0; k < 40 * K.stain + 4; k++) { const a = rnd() * 0.12 * (K.stain + 0.2); g.fillStyle = rnd() < 0.5 ? `rgba(90,70,50,${a})` : `rgba(255,255,255,${a * 0.7})`; const r = 2 + rnd() * t * 0.18; g.beginPath(); g.arc(i * t + rnd() * t, j * t + rnd() * t, r, 0, 7); g.fill(); }
  }
  return { canvas: c, m: K.m };
}

// 直立的多邊形牆（沿著方向 ry 延伸、厚度 t）：pts 為 [沿線距離 s, 高度 y]
function sprismGeo(sp) {
  const sh = new THREE.Shape(sp.pts.map(([s, y]) => new THREE.Vector2(-s, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: sp.t, bevelEnabled: false }).toNonIndexed();
  g.rotateY(Math.PI / 2); g.translate(-sp.t / 2, 0, 0); g.rotateY(sp.ry); g.translate(sp.x, 0, sp.z); return g;
}
